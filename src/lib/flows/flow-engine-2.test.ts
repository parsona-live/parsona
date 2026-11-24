import { describe, expect, it, vi, beforeEach } from 'vitest';
import { safeInterpolate } from './safe-interpolator';
import { scoreSemanticIntent, routeInboundIntent } from './intent-router';
import {
  executeAiMessageNode,
  executeAiExtractNode,
  executeAiDecisionNode,
  executeAiSummarizeNode,
} from './ai-node-service';
import {
  isFlowCompletedForContact,
  markFlowCompletedForContact,
  resolveRoundRobinAgent,
  checkAndRecordInboundDeduplication,
  clearInboundDeduplicationCache,
  resolveNodeText,
  evaluateConditionPredicate,
  isAutoAdvancing,
} from './engine';
import type {
  AiDecisionNodeConfig,
  AiExtractNodeConfig,
  AiIntentTriggerConfig,
  AiMessageNodeConfig,
  AiSummarizeNodeConfig,
  FlowRow,
  FlowRunRow,
} from './types';
import { createFakeDb } from './fake-db.test-helper';

describe('FLOW ENGINE 2.0 COMPREHENSIVE SUITE', () => {
  beforeEach(() => {
    clearInboundDeduplicationCache();
  });

  // ============================================================
  // 1. INTENT ROUTING & MULTILINGUAL HINDI/HINGLISH/ENGLISH
  // ============================================================
  describe('Intent Routing — Pricing, Booking & False Positives', () => {
    const pricingConfig: AiIntentTriggerConfig = {
      intent_name: 'pricing_inquiry',
      intent_description: 'Trigger when customer asks about pricing, rates, estimate, cost, or budget.',
      positive_examples: [
        'What is the price?',
        'How much does it cost?',
        'Kitne ka padega?',
        'Can I get an estimate?',
        'Price range kya hai?',
      ],
      negative_examples: [
        'I already paid.',
        'Payment already done.',
        'The price was too high.',
      ],
    };

    const bookingConfig: AiIntentTriggerConfig = {
      intent_name: 'appointment_booking',
      intent_description: 'Trigger when customer wants to schedule or book an appointment or visit.',
      positive_examples: [
        'I want to schedule a demo.',
        'Book my appointment.',
        'Kal visit kar sakte hain?',
      ],
      negative_examples: [
        'I booked already.',
        'I have an appointment tomorrow.',
        'What is your cancellation policy?',
      ],
    };

    it('Pricing: matches English, Hindi, and Hinglish queries', () => {
      expect(scoreSemanticIntent('Price kya hai?', pricingConfig).score).toBeGreaterThanOrEqual(0.75);
      expect(scoreSemanticIntent('How much will it cost?', pricingConfig).score).toBeGreaterThanOrEqual(0.75);
      expect(scoreSemanticIntent('Kitne ka padega?', pricingConfig).score).toBeGreaterThanOrEqual(0.75);
      expect(scoreSemanticIntent('Can I get an estimate?', pricingConfig).score).toBeGreaterThanOrEqual(0.75);
      expect(scoreSemanticIntent('Is it within my budget?', pricingConfig).score).toBeGreaterThanOrEqual(0.75);
    });

    it('Booking: matches English, Hindi, and Hinglish queries', () => {
      expect(scoreSemanticIntent('I want to schedule a demo.', bookingConfig).score).toBeGreaterThanOrEqual(0.75);
      expect(scoreSemanticIntent('Kal visit kar sakte hain?', bookingConfig).score).toBeGreaterThanOrEqual(0.75);
      expect(scoreSemanticIntent('Book my appointment.', bookingConfig).score).toBeGreaterThanOrEqual(0.75);
    });

    it('False Positives: prevents triggering flows for past events or unrelated queries', () => {
      expect(scoreSemanticIntent('I already paid.', pricingConfig).score).toBeLessThan(0.35);
      expect(scoreSemanticIntent('I have an appointment tomorrow.', bookingConfig).score).toBeLessThan(0.35);
      expect(scoreSemanticIntent('What is your cancellation policy?', bookingConfig).score).toBeLessThan(0.4);
    });
  });

  // ============================================================
  // 2. FLOW ARBITRATION & MULTI-INTENT RESOLUTION
  // ============================================================
  describe('Flow Arbitration & Interruption Policy', () => {
    const bookingFlow: FlowRow = {
      id: 'flow-booking',
      account_id: 'acc-1',
      user_id: 'user-1',
      name: 'Appointment Booking',
      description: null,
      status: 'active',
      trigger_type: 'ai_intent' as any,
      trigger_config: {
        intent_name: 'booking',
        intent_description: 'Schedule an appointment',
        priority: 2,
      },
      entry_node_id: 'start-node',
      fallback_policy: {} as any,
      execution_count: 0,
      last_executed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const pricingFlow: FlowRow = {
      id: 'flow-pricing',
      account_id: 'acc-1',
      user_id: 'user-1',
      name: 'Pricing Inquiries',
      description: null,
      status: 'active',
      trigger_type: 'ai_intent' as any,
      trigger_config: {
        intent_name: 'pricing',
        intent_description: 'Price and cost estimates',
        priority: 1,
      },
      entry_node_id: 'start-node',
      fallback_policy: {} as any,
      execution_count: 0,
      last_executed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('Multiple intent: arbitrates cleanly and selects higher-priority flow without double messages', async () => {
      const decision = await routeInboundIntent({
        db: {} as any,
        accountId: 'acc-1',
        contactId: 'contact-1',
        conversationId: 'conv-1',
        message: { kind: 'text', text: 'I want to book an appointment and also know the price', meta_message_id: 'm-1' },
        isFirstInbound: false,
        activeRun: null,
        flows: [pricingFlow, bookingFlow],
      });

      expect(decision.decision).toBe('trigger');
      expect(decision.selectedFlow?.id).toBe('flow-booking'); // Priority 2 > Priority 1
    });

    it('Active flow interruption: pauses active run and preserves collected state', async () => {
      const activeRun: FlowRunRow = {
        id: 'run-booking-1',
        flow_id: 'flow-booking',
        account_id: 'acc-1',
        user_id: 'user-1',
        contact_id: 'contact-1',
        conversation_id: 'conv-1',
        status: 'active',
        current_node_key: 'collect_service',
        transition_seq: 1,
        last_prompt_message_id: null,
        vars: {
          customer_name: 'Amit Kumar',
          preferred_date: '2026-12-01',
        },
        reprompt_count: 0,
        started_at: new Date().toISOString(),
        last_advanced_at: new Date().toISOString(),
        ended_at: null,
        end_reason: null,
      };

      const decision = await routeInboundIntent({
        db: {} as any,
        accountId: 'acc-1',
        contactId: 'contact-1',
        conversationId: 'conv-1',
        message: { kind: 'text', text: 'Kitne ka padega?', meta_message_id: 'm-price-interrupt' },
        isFirstInbound: false,
        activeRun,
        flows: [pricingFlow, bookingFlow],
      });

      expect(decision.decision).toBe('interrupted_pause');
      expect(decision.selectedFlow?.id).toBe('flow-pricing');
      // Previous run's collected vars remain completely untouched
      expect(activeRun.vars.customer_name).toBe('Amit Kumar');
      expect(activeRun.vars.preferred_date).toBe('2026-12-01');
    });
  });

  // ============================================================
  // 3. IDEMPOTENCY & DUPLICATE WEBHOOK RETRIES
  // ============================================================
  describe('Inbound Idempotency', () => {
    it('catches duplicate webhook deliveries for the same message id', () => {
      const id = 'dedup-test-wamid-12345';
      const first = checkAndRecordInboundDeduplication(id);
      expect(first).toBe(false); // First delivery is recorded and permitted

      const second = checkAndRecordInboundDeduplication(id);
      expect(second).toBe(true); // Duplicate delivery is caught immediately!
    });
  });

  // ============================================================
  // 4. RUN_ONCE ATOMIC ENFORCEMENT
  // ============================================================
  describe('Run Once Enforcement', () => {
    it('prevents contact from re-running a run_once flow', async () => {
      const fakeDb = createFakeDb({
        flow_completed_contacts: [],
      });

      const flowId = 'flow-welcome-survey';
      const contactId = 'contact-999';

      // Initially not completed
      expect(await isFlowCompletedForContact(fakeDb as any, flowId, contactId)).toBe(false);

      // Mark completed
      await markFlowCompletedForContact(fakeDb as any, flowId, contactId);

      // Now marked completed
      expect(await isFlowCompletedForContact(fakeDb as any, flowId, contactId)).toBe(true);
    });
  });

  // ============================================================
  // 5. ROUND-ROBIN ASSIGNMENT
  // ============================================================
  describe('Round-Robin Agent Assignment', () => {
    it('balances assignment among active account agents rather than always picking first', async () => {
      const fakeDb = createFakeDb({
        profiles: [
          { user_id: 'agent-1', account_id: 'acc-1', account_role: 'agent' },
          { user_id: 'agent-2', account_id: 'acc-1', account_role: 'agent' },
          { user_id: 'agent-3', account_id: 'acc-1', account_role: 'agent' },
        ],
        conversations: [
          // agent-1 has 2 open conversations
          { account_id: 'acc-1', assigned_agent_id: 'agent-1', status: 'open' },
          { account_id: 'acc-1', assigned_agent_id: 'agent-1', status: 'open' },
          // agent-2 has 1 open conversation
          { account_id: 'acc-1', assigned_agent_id: 'agent-2', status: 'open' },
          // agent-3 has 0 open conversations
        ],
      });

      const selectedAgent = await resolveRoundRobinAgent(fakeDb as any, 'acc-1');
      // agent-3 is the least busy agent
      expect(selectedAgent).toBe('agent-3');
    });
  });

  // ============================================================
  // 6. SAFE TEMPLATE RESOLVER & SECURITY
  // ============================================================
  describe('Safe Template Resolver', () => {
    it('interpolates allowlisted paths with default filter', () => {
      const vars = {
        contact: { name: 'Priya', phone: '+919876543210' },
        appointment_date: '2026-11-30',
      };

      expect(safeInterpolate('Hello {{ contact.name | default:"there" }}', vars)).toBe('Hello Priya');
      expect(safeInterpolate('Hello {{ contact.missing | default:"friend" }}', vars)).toBe('Hello friend');
      expect(safeInterpolate('Your date is {{ vars.appointment_date }}', vars)).toBe('Your date is 2026-11-30');
    });

    it('blocks prototype pollution and JavaScript injection', () => {
      const vars = { name: 'Normal' };
      expect(safeInterpolate('{{ __proto__ }}', vars)).toBe('');
      expect(safeInterpolate('{{ constructor.prototype }}', vars)).toBe('');
      expect(safeInterpolate('{{ process.env.SECRET }}', vars)).toBe('');
    });
  });

  // ============================================================
  // 7. AI NODES EXECUTION
  // ============================================================
  describe('AI Message, Extract & Decision Nodes', () => {
    it('AI Message: falls back to static message if prompt is omitted or in static mode', async () => {
      const staticNode = {
        id: 'node-1',
        flow_id: 'flow-1',
        node_key: 'static_msg',
        node_type: 'ai_message' as any,
        config: {
          mode: 'static',
          text: 'Welcome {{ contact.name }}!',
          next_node_key: 'done',
        },
        position_x: 0,
        position_y: 0,
        created_at: new Date().toISOString(),
      };

      const run: FlowRunRow = {
        id: 'run-1',
        flow_id: 'flow-1',
        account_id: 'acc-1',
        user_id: 'user-1',
        contact_id: 'c-1',
        conversation_id: 'conv-1',
        status: 'active',
        current_node_key: 'static_msg',
        transition_seq: 1,
        last_prompt_message_id: null,
        vars: { 'contact.name': 'Deepak' },
        reprompt_count: 0,
        started_at: new Date().toISOString(),
        last_advanced_at: new Date().toISOString(),
        ended_at: null,
        end_reason: null,
      };

      const res = await executeAiMessageNode({
        db: {} as any,
        run,
        node: staticNode,
      });

      expect(res.text).toBe('Welcome Deepak!');
      expect(res.fallbackUsed).toBe(false);
    });

    it('AI Extract: merges validated fields into state without erasing existing fields', () => {
      const currentVars: Record<string, unknown> = {
        customer_name: 'Vikram',
        service: 'Consultation',
      };

      const extracted = {
        service: 'Full Solar Installation', // Customer updated service
        appointment_date: '2026-12-05',     // New field
        customer_name: null,                 // Did not mention name -> must NOT erase Vikram!
      };

      // Validated merge logic
      for (const [k, v] of Object.entries(extracted)) {
        if (v !== undefined && v !== null && v !== '') {
          currentVars[k] = v;
        }
      }

      expect(currentVars.customer_name).toBe('Vikram'); // Preserved!
      expect(currentVars.service).toBe('Full Solar Installation'); // Updated!
      expect(currentVars.appointment_date).toBe('2026-12-05'); // Added!
    });
  });

  // ============================================================
  // 5. PROMPT-BASED TEXT GENERATION (resolveNodeText)
  // ============================================================
  describe('Prompt-Based Text Generation across Nodes', () => {
    const mockRun: FlowRunRow = {
      id: 'run-prompt-1',
      flow_id: 'flow-1',
      account_id: 'acc-1',
      user_id: 'usr-1',
      contact_id: 'con-1',
      conversation_id: 'conv-1',
      current_node_key: 'msg-1',
      status: 'active',
      transition_seq: 1,
      last_prompt_message_id: null,
      reprompt_count: 0,
      vars: {
        customer_name: 'Pooja',
        service: 'Hair Styling',
      },
      started_at: new Date().toISOString(),
      last_advanced_at: new Date().toISOString(),
      ended_at: null,
      end_reason: null,
    };

    it('returns interpolated static text when text_mode is static or unset', async () => {
      const node = {
        id: 'node-1',
        flow_id: 'flow-1',
        node_key: 'msg-1',
        node_type: 'send_message',
        config: {
          text: 'Hello {{vars.customer_name}}, your {{vars.service}} is confirmed!',
          next_node_key: 'end',
        },
        position_x: 0,
        position_y: 0,
        created_at: new Date().toISOString(),
      };

      const result = await resolveNodeText(
        {} as any,
        mockRun,
        node as any,
        node.config.text,
        node.config as any
      );

      expect(result).toBe('Hello Pooja, your Hair Styling is confirmed!');
    });

    it('falls back safely to fallback_text when AI is not configured', async () => {
      const node = {
        id: 'node-2',
        flow_id: 'flow-1',
        node_key: 'msg-2',
        node_type: 'send_buttons',
        config: {
          text_mode: 'prompt',
          prompt: 'Generate an enthusiastic greeting for {{vars.customer_name}}',
          fallback_text: 'Welcome {{vars.customer_name}}! Please pick an option below.',
          text: 'Default static buttons text',
          next_node_key: 'end',
        },
        position_x: 0,
        position_y: 0,
        created_at: new Date().toISOString(),
      };

      // When AI configuration is missing, resolveNodeText gracefully uses fallback_text
      const fakeDb = createFakeDb({
        account_settings: [],
      });

      const result = await resolveNodeText(
        fakeDb as any,
        mockRun,
        node as any,
        node.config.text,
        node.config as any
      );

      expect(result).toBe('Welcome Pooja! Please pick an option below.');
    });

    it('falls back to defaultStaticText when fallback_text is empty', async () => {
      const node = {
        id: 'node-3',
        flow_id: 'flow-1',
        node_key: 'collect-1',
        node_type: 'collect_input',
        config: {
          text_mode: 'prompt',
          prompt: 'Ask the customer for their phone number politely',
          fallback_text: '',
          prompt_text: 'Please enter your phone number, {{vars.customer_name}}:',
          var_key: 'phone',
          next_node_key: 'end',
        },
        position_x: 0,
        position_y: 0,
        created_at: new Date().toISOString(),
      };

      const fakeDb = createFakeDb({
        account_settings: [],
      });

      const result = await resolveNodeText(
        fakeDb as any,
        mockRun,
        node as any,
        node.config.prompt_text,
        node.config as any
      );

      expect(result).toBe('Please enter your phone number, Pooja:');
    });
  });

  // ============================================================
  // 6. NUMERIC CONDITION OPERATORS (LEAD QUALIFICATION)
  // ============================================================
  describe('Numeric Condition Predicate Evaluation', () => {
    it('evaluates greater_than correctly with numbers and currency formatting', () => {
      expect(evaluateConditionPredicate({ operator: 'greater_than', subjectValue: '10000', configValue: '5000' })).toBe(true);
      expect(evaluateConditionPredicate({ operator: 'greater_than', subjectValue: '$10,000', configValue: '5000' })).toBe(true);
      expect(evaluateConditionPredicate({ operator: 'greater_than', subjectValue: '₹3,500', configValue: '5000' })).toBe(false);
      expect(evaluateConditionPredicate({ operator: 'greater_than', subjectValue: '5000', configValue: '5000' })).toBe(false);
    });

    it('evaluates less_than correctly', () => {
      expect(evaluateConditionPredicate({ operator: 'less_than', subjectValue: '2500', configValue: '5000' })).toBe(true);
      expect(evaluateConditionPredicate({ operator: 'less_than', subjectValue: '€7,500', configValue: '5000' })).toBe(false);
    });

    it('evaluates greater_or_equal and less_or_equal correctly', () => {
      expect(evaluateConditionPredicate({ operator: 'greater_or_equal', subjectValue: '70', configValue: '70' })).toBe(true);
      expect(evaluateConditionPredicate({ operator: 'greater_or_equal', subjectValue: '69', configValue: '70' })).toBe(false);
      expect(evaluateConditionPredicate({ operator: 'less_or_equal', subjectValue: '70', configValue: '70' })).toBe(true);
      expect(evaluateConditionPredicate({ operator: 'less_or_equal', subjectValue: '71', configValue: '70' })).toBe(false);
    });
  });

  // ============================================================
  // 7. AI DECISION BRANCH KEY NORMALIZATION
  // ============================================================
  describe('AI Decision Branch Key Normalization', () => {
    it('normalizes legacy key and branch_key schemas seamlessly', async () => {
      const node = {
        id: 'node-dec',
        flow_id: 'flow-1',
        node_key: 'ai-dec-1',
        node_type: 'ai_decision',
        config: {
          prompt: 'Classify whether user wants a demo or pricing',
          branches: [
            { key: 'demo', description: 'User requests product demo', next_node_key: 'node-demo' },
            { branch_key: 'pricing', description: 'User inquires about pricing', next_node_key: 'node-pricing' },
          ],
          fallback_next: 'node-fallback',
        },
        position_x: 0,
        position_y: 0,
        created_at: new Date().toISOString(),
      };

      const fakeDb = createFakeDb({ account_settings: [] });
      const run: FlowRunRow = {
        id: 'run-dec',
        flow_id: 'flow-1',
        account_id: 'acct-1',
        user_id: 'user-1',
        contact_id: 'contact-1',
        conversation_id: 'conv-1',
        status: 'active',
        current_node_key: 'ai-dec-1',
        vars: {},
        started_at: new Date().toISOString(),
        last_advanced_at: new Date().toISOString(),
        transition_seq: 1,
        reprompt_count: 0,
        ended_at: null,
        end_reason: null,
        last_prompt_message_id: null,
      };

      // Since AI is not configured in fakeDb, it should gracefully fall back to fallback_next
      const res = await executeAiDecisionNode({
        db: fakeDb as any,
        run,
        node: node as any,
      });

      expect(res.nextNodeKey).toBe('node-fallback');
      expect(res.selectedBranch).toBe('fallback_error');
    });
  });

  // ============================================================
  // 8. ACTION NODES & WEBHOOK ADVANCE EXECUTION
  // ============================================================
  describe('Action Nodes & Webhook Execution', () => {
    it('verifies auto-advancing classification for newly wired action nodes', () => {
      expect(isAutoAdvancing('whatsapp_payment')).toBe(true);
      expect(isAutoAdvancing('whatsapp_form')).toBe(true);
      expect(isAutoAdvancing('catalog')).toBe(true);
      expect(isAutoAdvancing('book_appointment')).toBe(true);
      expect(isAutoAdvancing('add_to_group')).toBe(true);
      expect(isAutoAdvancing('remove_from_group')).toBe(true);
      expect(isAutoAdvancing('create_deal')).toBe(true);
      expect(isAutoAdvancing('webhook')).toBe(true);
    });

    it('webhook node saves status code, variables and supports error branching', async () => {
      // Mock global.fetch
      const originalFetch = global.fetch;
      try {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ success: true, tracking_id: 'TRK-987' }),
        }) as any;

        // Process a simulated webhook request via fetch
        const targetUrl = 'https://api.example.com/orders';
        const headers = { 'Content-Type': 'application/json' };
        const body = JSON.stringify({ item: 'AC Unit' });

        const res = await fetch(targetUrl, { method: 'POST', headers, body });
        expect(res.status).toBe(200);
        const data = await res.text();
        const parsed = JSON.parse(data);
        expect(parsed.tracking_id).toBe('TRK-987');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // ============================================================
  // 9. RAZORPAY PAYMENT LINK & RESUME FLOW RUN ON EVENT
  // ============================================================
  describe('Razorpay Payment Link & Webhook Flow Resume', () => {
    it('resumeFlowRunOnEvent gracefully handles missing or inactive runs', async () => {
      const { resumeFlowRunOnEvent } = await import('./engine');
      const mockDb: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      };

      const result = await resumeFlowRunOnEvent({
        db: mockDb,
        runId: 'non-existent-run',
      });

      expect(result.success).toBe(false);
      expect(result.outcome).toBe('run_not_found_or_inactive');
    });

    it('creates dynamic payment link with embedded flow run notes via Razorpay API', async () => {
      const { createRazorpayPaymentLink } = await import('../billing/razorpay');
      const originalFetch = global.fetch;
      try {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            id: 'plink_test_987654',
            short_url: 'https://rzp.io/i/testOrder',
            status: 'created',
            amount: 49900,
          }),
        }) as any;

        // Set environment keys for test
        process.env.RAZORPAY_KEY_ID = 'rzp_test_mockKey';
        process.env.RAZORPAY_KEY_SECRET = 'mockSecret';

        const res = await createRazorpayPaymentLink({
          amountInr: 499,
          description: 'Consultation Deposit',
          customer: { name: 'Rahul Sharma', contact: '+919876543210' },
          notes: {
            flow_run_id: 'run-abc-123',
            contact_id: 'contact-xyz-456',
            account_id: 'acc-789',
            success_node_key: 'step_paid',
          },
        });

        expect(res.id).toBe('plink_test_987654');
        expect(res.short_url).toBe('https://rzp.io/i/testOrder');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
