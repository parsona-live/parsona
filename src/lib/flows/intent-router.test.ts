import { describe, expect, it } from 'vitest';
import { scoreSemanticIntent, normalizeConversationalText, routeInboundIntent } from './intent-router';
import type { AiIntentTriggerConfig, FlowRow } from './types';

describe('scoreSemanticIntent', () => {
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
      'Appointment lena hai.',
    ],
    negative_examples: [
      'I booked already.',
      'I have an appointment tomorrow.',
    ],
  };

  it('recognizes pricing intent across English, Hindi, and Hinglish', () => {
    expect(scoreSemanticIntent('Price kya hai?', pricingConfig).score).toBeGreaterThanOrEqual(0.75);
    expect(scoreSemanticIntent('How much will it cost?', pricingConfig).score).toBeGreaterThanOrEqual(0.75);
    expect(scoreSemanticIntent('Kitne ka hai?', pricingConfig).score).toBeGreaterThanOrEqual(0.75);
    expect(scoreSemanticIntent('Pricing batao please', pricingConfig).score).toBeGreaterThanOrEqual(0.75);
    expect(scoreSemanticIntent('Budget friendly option hai?', pricingConfig).score).toBeGreaterThanOrEqual(0.75);
    expect(scoreSemanticIntent('Can I get an estimate?', pricingConfig).score).toBeGreaterThanOrEqual(0.75);
    expect(scoreSemanticIntent('Kitne ka padega?', pricingConfig).score).toBeGreaterThanOrEqual(0.75);
  });

  it('recognizes booking intent across natural variations and Hinglish', () => {
    expect(scoreSemanticIntent('I want to schedule a demo.', bookingConfig).score).toBeGreaterThanOrEqual(0.75);
    expect(scoreSemanticIntent('Kal visit kar sakte hain?', bookingConfig).score).toBeGreaterThanOrEqual(0.75);
    expect(scoreSemanticIntent('Book my appointment', bookingConfig).score).toBeGreaterThanOrEqual(0.75);
    expect(scoreSemanticIntent('Can I book a slot for tomorrow?', bookingConfig).score).toBeGreaterThanOrEqual(0.75);
  });

  it('rejects false positives: "I already paid" does not trigger pricing inquiry', () => {
    const result = scoreSemanticIntent('I already paid', pricingConfig);
    expect(result.score).toBeLessThan(0.3);
  });

  it('rejects false positives: "I booked already" does not trigger new booking flow', () => {
    const result = scoreSemanticIntent('I booked already', bookingConfig);
    expect(result.score).toBeLessThan(0.3);
  });

  it('rejects false positives: "I have an appointment tomorrow"', () => {
    const result = scoreSemanticIntent('I have an appointment tomorrow', bookingConfig);
    expect(result.score).toBeLessThan(0.4);
  });
});

describe('routeInboundIntent Arbitration', () => {
  const dummyFlow1: FlowRow = {
    id: 'flow-pricing',
    account_id: 'acc-1',
    user_id: 'user-1',
    name: 'Pricing Flow',
    description: null,
    status: 'active',
    trigger_type: 'ai_intent' as any,
    trigger_config: {
      intent_name: 'pricing',
      intent_description: 'Customer asks for price or cost',
      priority: 1,
    },
    entry_node_id: 'node-start',
    fallback_policy: {} as any,
    execution_count: 0,
    last_executed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const dummyFlow2: FlowRow = {
    id: 'flow-booking',
    account_id: 'acc-1',
    user_id: 'user-1',
    name: 'Booking Flow',
    description: null,
    status: 'active',
    trigger_type: 'ai_intent' as any,
    trigger_config: {
      intent_name: 'booking',
      intent_description: 'Customer wants to schedule an appointment',
      priority: 2,
    },
    entry_node_id: 'node-start-2',
    fallback_policy: {} as any,
    execution_count: 0,
    last_executed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('arbitrates cleanly when customer asks pricing: selects pricing flow', async () => {
    const decision = await routeInboundIntent({
      db: {} as any,
      accountId: 'acc-1',
      contactId: 'contact-1',
      conversationId: 'conv-1',
      message: { kind: 'text', text: 'Price kya hai?', meta_message_id: 'wamid-1' },
      isFirstInbound: false,
      activeRun: null,
      flows: [dummyFlow1, dummyFlow2],
    });

    expect(decision.decision).toBe('trigger');
    expect(decision.selectedFlow?.id).toBe('flow-pricing');
  });

  it('arbitrates cleanly when customer asks booking: selects booking flow', async () => {
    const decision = await routeInboundIntent({
      db: {} as any,
      accountId: 'acc-1',
      contactId: 'contact-1',
      conversationId: 'conv-1',
      message: { kind: 'text', text: 'Book my appointment please', meta_message_id: 'wamid-2' },
      isFirstInbound: false,
      activeRun: null,
      flows: [dummyFlow1, dummyFlow2],
    });

    expect(decision.decision).toBe('trigger');
    expect(decision.selectedFlow?.id).toBe('flow-booking');
  });

  it('handles active flow interruption: pauses previous run to preserve variables', async () => {
    const activeRun: any = {
      id: 'run-active',
      flow_id: 'flow-booking',
      account_id: 'acc-1',
      contact_id: 'contact-1',
      conversation_id: 'conv-1',
      status: 'active',
      current_node_key: 'collect_date',
      vars: { customer_name: 'Amit', service: 'Solar' },
    };

    const decision = await routeInboundIntent({
      db: {} as any,
      accountId: 'acc-1',
      contactId: 'contact-1',
      conversationId: 'conv-1',
      message: { kind: 'text', text: 'Price kya hai?', meta_message_id: 'wamid-3' },
      isFirstInbound: false,
      activeRun,
      flows: [dummyFlow1, dummyFlow2],
    });

    expect(decision.decision).toBe('interrupted_pause');
    expect(decision.selectedFlow?.id).toBe('flow-pricing');
  });
});
