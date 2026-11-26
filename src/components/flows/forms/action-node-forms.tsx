'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Mail, Server, ExternalLink, Sparkles, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowEditor } from '../flow-editor-state';
import { ChannelIcon } from '@/components/channels/channel-badge';
import { NodeKeySelect } from './fields';
import type { BuilderNode } from '../shared';

// ============================================================
// AI Response Action Form (From User Mockup)
// ============================================================

export function AiResponseForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const prompt = (config.prompt as string) || '';
  const proceedCondition = (config.proceed_condition as string) || 'wait_high_confidence';
  const confidenceThreshold = typeof config.confidence_threshold === 'number' ? config.confidence_threshold : 0.8;
  const lowConfidenceMessage = (config.low_confidence_message as string) || "I'm not confident about my response. Could you rephrase your question?";
  const active = config.active !== false;

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">AI Prompt</Label>
        <Textarea
          value={prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder="Enter the prompt for AI response... (optional)"
          rows={3}
          className="text-xs resize-y border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Leave empty to use default AI behavior, or add specific instructions for the AI.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Proceed Condition</Label>
        <Select
          value={proceedCondition}
          onValueChange={(val) => onChange({ proceed_condition: val })}
        >
          <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="always">Always Proceed</SelectItem>
            <SelectItem value="wait_high_confidence">Wait for High Confidence</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {proceedCondition === 'wait_high_confidence' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Confidence Threshold</Label>
            <Input
              type="number"
              step="0.05"
              min="0.1"
              max="1.0"
              value={confidenceThreshold}
              onChange={(e) => onChange({ confidence_threshold: parseFloat(e.target.value) || 0.8 })}
              className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Set between 0.1 (10%) and 1.0 (100%). Higher values require more confident AI responses.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Low Confidence Message *</Label>
            <Textarea
              value={lowConfidenceMessage}
              onChange={(e) => onChange({ low_confidence_message: e.target.value })}
              placeholder="I'm not confident about my response..."
              rows={2}
              className="text-xs resize-y border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Message sent when AI confidence is below the threshold. Cannot be empty.
            </p>
          </div>
        </>
      )}

      {/* Explanatory Info Card (From Mockup) */}
      <div className="rounded-lg border border-blue-100 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/30 p-3 space-y-2 text-[11.5px] text-slate-700 dark:text-slate-300">
        <p className="font-semibold text-blue-900 dark:text-blue-200">How AI Response Flow Works:</p>
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-200">Always Proceed:</p>
          <p className="text-slate-600 dark:text-slate-400">AI sends response and flow immediately continues to next node.</p>
        </div>
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-200">Wait for High Confidence:</p>
          <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400 pl-1">
            <li>AI generates response and calculates confidence (0-100%)</li>
            <li>If confidence ≥ 80%: Send response and continue</li>
            <li>If confidence &lt; 80%: Send fallback message and wait for user input</li>
            <li>AI keeps trying until it reaches the confidence threshold</li>
          </ul>
        </div>
      </div>

      <div className="flex items-center space-x-2 pt-1">
        <Checkbox
          id="ai-active"
          checked={active}
          onCheckedChange={(checked) => onChange({ active: !!checked })}
        />
        <Label htmlFor="ai-active" className="text-xs font-medium cursor-pointer text-slate-700 dark:text-slate-300">
          Active
        </Label>
      </div>
    </div>
  );
}

// ============================================================
// Send Email Action Form (From User Mockup)
// ============================================================

export function SendEmailForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const toEmail = (config.to_email as string) ?? '{{contact.email}}';
  const subject = (config.subject as string) || '';
  const body = (config.body as string) || '';
  const useCustomSmtp = Boolean(config.use_custom_smtp);
  const smtpHost = (config.smtp_host as string) || '';
  const smtpPort = (config.smtp_port as string) || '587';
  const username = (config.username as string) || '';
  const password = (config.password as string) || '';
  const encryption = (config.encryption as string) || 'tls';
  const fromName = (config.from_name as string) || '';
  const fromEmail = (config.from_email as string) || '';
  const active = config.active !== false;

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      {/* Email Recipient Section */}
      <div className="space-y-3">
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Recipient &amp; Content
        </p>

        {/* To Email with Variable Pills */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">To (Recipient Email)</Label>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Defaults to contact email</span>
          </div>
          <Input
            value={toEmail}
            onChange={(e) => onChange({ to_email: e.target.value })}
            placeholder="e.g., {{contact.email}}, {{vars.email}}, or user@domain.com"
            className="h-8 text-xs font-mono border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10.5px] text-slate-500 dark:text-slate-400">Quick Insert:</span>
            <button
              type="button"
              onClick={() => onChange({ to_email: '{{contact.email}}' })}
              className="rounded border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/40 px-1.5 py-0.5 text-[10px] font-mono text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
            >
              {'{{contact.email}}'}
            </button>
            <button
              type="button"
              onClick={() => onChange({ to_email: '{{vars.email}}' })}
              className="rounded border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-indigo-950/40 px-1.5 py-0.5 text-[10px] font-mono text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
            >
              {'{{vars.email}}'}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Subject</Label>
          <Input
            value={subject}
            onChange={(e) => onChange({ subject: e.target.value })}
            placeholder="e.g., Welcome to our service {{contact.name}}"
            className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Body</Label>
          <Textarea
            value={body}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder="Write your email body here... supports {{vars.*}} and {{contact.*}}"
            rows={4}
            className="text-xs resize-y border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
        </div>
      </div>

      {/* Centralized Email Integration / Override Section */}
      <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Email Delivery Provider
          </p>
          <a
            href="/settings?tab=email"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
          >
            Manage Settings
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {!useCustomSmtp ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-3 space-y-2">
            <div className="flex items-start gap-2.5">
              <Server className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Using Workspace Centralized Provider</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  This email will be dispatched using your centralized Brevo API or SMTP configuration defined in Workspace Settings.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center space-x-2 pt-1">
          <Checkbox
            id="use-custom-smtp"
            checked={useCustomSmtp}
            onCheckedChange={(checked) => onChange({ use_custom_smtp: !!checked })}
          />
          <Label htmlFor="use-custom-smtp" className="text-xs font-medium cursor-pointer text-slate-700 dark:text-slate-300">
            Override provider settings for this node
          </Label>
        </div>

        {useCustomSmtp ? (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">SMTP Host</Label>
                <Input
                  value={smtpHost}
                  onChange={(e) => onChange({ smtp_host: e.target.value })}
                  placeholder="e.g., smtp-relay.brevo.com"
                  className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">SMTP Port</Label>
                <Input
                  value={smtpPort}
                  onChange={(e) => onChange({ smtp_port: e.target.value })}
                  placeholder="587"
                  className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Username</Label>
                <Input
                  value={username}
                  onChange={(e) => onChange({ username: e.target.value })}
                  placeholder="login@email.com"
                  className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Password / Key</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => onChange({ password: e.target.value })}
                  placeholder="App password or key"
                  className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Encryption</Label>
                <Select
                  value={encryption}
                  onValueChange={(val) => onChange({ encryption: val })}
                >
                  <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">TLS</SelectItem>
                    <SelectItem value="ssl">SSL</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">From Name</Label>
                <Input
                  value={fromName}
                  onChange={(e) => onChange({ from_name: e.target.value })}
                  placeholder="Your Company Name"
                  className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">From Email</Label>
              <Input
                value={fromEmail}
                onChange={(e) => onChange({ from_email: e.target.value })}
                placeholder="noreply@yourdomain.com"
                className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Explanatory Info Card */}
      <div className="rounded-lg border border-blue-100 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/30 p-3 text-[11.5px] text-slate-700 dark:text-slate-300 space-y-1">
        <p className="font-semibold text-blue-900 dark:text-blue-200">What happens:</p>
        <p className="text-slate-600 dark:text-slate-400">
          An email will be sent to the specified recipient (supports variables like {'{{contact.email}}'} or {'{{vars.email}}'}). By default, it uses your centralized Brevo API or SMTP credentials from Settings.
        </p>
      </div>

      <div className="flex items-center space-x-2 pt-1">
        <Checkbox
          id="email-active"
          checked={active}
          onCheckedChange={(checked) => onChange({ active: !!checked })}
        />
        <Label htmlFor="email-active" className="text-xs font-medium cursor-pointer text-slate-700 dark:text-slate-300">
          Active
        </Label>
      </div>
    </div>
  );
}

// ============================================================
// Canvas Trigger Form (From User Mockup)
// ============================================================

// export function TriggerNodeForm({
//   config,
//   onChange,
// }: {
//   config: Record<string, unknown>;
//   onChange: (patch: Record<string, unknown>) => void;
// }) {
//   const startingStep = (config.starting_step as string) || 'new_contact';
//   const keywords = Array.isArray(config.keywords) ? (config.keywords as string[]) : [];
//   const [keywordInput, setKeywordInput] = useState('');

//   const addKeyword = () => {
//     const val = keywordInput.trim();
//     if (!val || keywords.includes(val)) return;
//     onChange({ keywords: [...keywords, val] });
//     setKeywordInput('');
//   };

//   const removeKeyword = (kw: string) => {
//     onChange({ keywords: keywords.filter((k) => k !== kw) });
//   };

//   return (
//     <div className="space-y-4 text-xs text-slate-700">
//       <div className="space-y-1.5">
//         <Label className="text-xs font-semibold text-slate-800">Starting Step</Label>
//         <Select
//           value={startingStep}
//           onValueChange={(val) => onChange({ starting_step: val })}
//         >
//           <SelectTrigger className="h-8 text-xs border-slate-200 bg-white">
//             <SelectValue />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="new_contact">New contact</SelectItem>
//             <SelectItem value="keyword">Text contains specific keywords</SelectItem>
//           </SelectContent>
//         </Select>
//         <p className="text-[11px] text-slate-500">
//           Define the input parameters to trigger the workflow, to ensure that accurate information is captured in the conversation flow.
//         </p>
//       </div>

//       {startingStep === 'keyword' && (
//         <div className="space-y-2 pt-2 border-t border-slate-100">
//           <Label className="text-xs font-semibold text-slate-800">Keywords</Label>
//           <div className="flex gap-1.5">
//             <Input
//               value={keywordInput}
//               onChange={(e) => setKeywordInput(e.target.value)}
//               onKeyDown={(e) => {
//                 if (e.key === 'Enter') {
//                   e.preventDefault();
//                   addKeyword();
//                 }
//               }}
//               placeholder="e.g. hello, pricing, help"
//               className="h-8 text-xs border-slate-200"
//             />
//             <button
//               type="button"
//               onClick={addKeyword}
//               className="px-3 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800"
//             >
//               Add
//             </button>
//           </div>
//           {keywords.length > 0 && (
//             <div className="flex flex-wrap gap-1.5 pt-1">
//               {keywords.map((kw) => (
//                 <span
//                   key={kw}
//                   className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] border border-slate-200"
//                 >
//                   {kw}
//                   <button
//                     type="button"
//                     onClick={() => removeKeyword(kw)}
//                     className="hover:text-red-500 font-bold"
//                   >
//                     ×
//                   </button>
//                 </span>
//               ))}
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

// ============================================================
// Delay Form
// ============================================================

export function DelayForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const amount = typeof config.amount === 'number' ? config.amount : 5;
  const unit = (config.unit as string) || 'minutes';

  return (
    <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Amount</Label>
          <Input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => onChange({ amount: parseInt(e.target.value, 10) || 1 })}
            className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Unit</Label>
          <Select value={unit} onValueChange={(val) => onChange({ unit: val })}>
            <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Execution pauses for the specified duration before moving to the next node.
      </p>
    </div>
  );
}

// ============================================================
// Webhook Form
// ============================================================

export function WebhookForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const url = (config.url as string) || '';
  const method = (config.method as string) || 'POST';
  const bodyTemplate = (config.body_template as string) || '';

  return (
    <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Method</Label>
          <Select value={method} onValueChange={(val) => onChange({ method: val })}>
            <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Endpoint URL</Label>
          <Input
            value={url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://api.example.com/webhook"
            className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">JSON Body Template</Label>
        <Textarea
          value={bodyTemplate}
          onChange={(e) => onChange({ body_template: e.target.value })}
          placeholder='{"contact_id": "{{contact.id}}", "event": "order"}'
          rows={4}
          className="font-mono text-xs resize-y border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Supports interpolation: {'{{contact.*}}'}, {'{{vars.*}}'}.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Save Response to Variable (Optional)</Label>
        <Input
          value={(config.save_response_var as string) || ''}
          onChange={(e) => onChange({ save_response_var: e.target.value })}
          placeholder="e.g. api_response"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
        <p className="text-[10px] text-slate-500">
          Accessible in downstream nodes as <code>{"{{vars.api_response}}"}</code> and status code as <code>{"{{vars.webhook_status}}"}</code>.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Update Contact Form
// ============================================================

export function UpdateContactForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const field = (config.field as string) || 'name';
  const value = (config.value as string) || '';

  return (
    <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Contact Field</Label>
        <Select value={field} onValueChange={(val) => onChange({ field: val })}>
          <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Full Name</SelectItem>
            <SelectItem value="email">Email Address</SelectItem>
            <SelectItem value="company">Company</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Value</Label>
        <Input
          value={value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="New value or {{vars.captured_name}}"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
      </div>
    </div>
  );
}

// ============================================================
// WhatsApp Payment Form
// ============================================================

export function WhatsAppPaymentForm({
  config,
  onChange,
  allNodes,
  currentKey,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  allNodes?: BuilderNode[];
  currentKey?: string;
}) {
  const amount = config.amount !== undefined ? String(config.amount) : '100';
  const currency = (config.currency as string) || 'INR';
  const itemName = (config.item_name as string) || 'Product Order';
  const provider = (config.provider as string) || 'razorpay';
  const paymentLink = (config.payment_link as string) || '';
  const waitForPayment = Boolean(config.wait_for_payment);
  const cancelNext = (config.cancel_next as string) || '';
  const successNext = (config.success_next as string) || '';

  return (
    <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Amount</Label>
          <Input
            value={amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="100 or {{vars.total}}"
            className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Currency</Label>
          <Input
            value={currency}
            onChange={(e) => onChange({ currency: e.target.value.toUpperCase() })}
            placeholder="INR"
            className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Item Name</Label>
        <Input
          value={itemName}
          onChange={(e) => onChange({ item_name: e.target.value })}
          placeholder="e.g. Consulting Session"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Payment Provider</Label>
        <Select value={provider} onValueChange={(val) => onChange({ provider: val })}>
          <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="razorpay">Razorpay Payment Link</SelectItem>
            <SelectItem value="whatsapp_pay">WhatsApp Pay (Native)</SelectItem>
            <SelectItem value="custom">Custom Link</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Payment Link (Optional Static URL)</Label>
        <Input
          value={paymentLink}
          onChange={(e) => onChange({ payment_link: e.target.value })}
          placeholder="Leave blank to auto-generate via Razorpay"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
        <p className="text-[10px] text-slate-500">
          Leave blank to generate a dynamic tracked Razorpay Payment Link per customer.
        </p>
      </div>

      <div className="flex items-start gap-2 pt-1 pb-1">
        <Checkbox
          id="wait_for_payment"
          checked={waitForPayment}
          onCheckedChange={(checked) => onChange({ wait_for_payment: Boolean(checked) })}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <Label htmlFor="wait_for_payment" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
            Wait for Payment Webhook
          </Label>
          <p className="text-[10px] text-slate-500">
            Pause flow execution until Razorpay notifies of successful payment, then advance to success step.
          </p>
        </div>
      </div>

      {waitForPayment && (
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Success Next Step</Label>
            {allNodes ? (
              <NodeKeySelect
                value={successNext || null}
                nodes={allNodes}
                excludeKey={currentKey}
                onChange={(v) => onChange({ success_next: v || '' })}
                placeholder="Select step..."
              />
            ) : (
              <Input
                value={successNext}
                onChange={(e) => onChange({ success_next: e.target.value })}
                placeholder="e.g. step_confirm"
                className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
              />
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-rose-700 dark:text-rose-400">Cancel Next Step</Label>
            {allNodes ? (
              <NodeKeySelect
                value={cancelNext || null}
                nodes={allNodes}
                excludeKey={currentKey}
                onChange={(v) => onChange({ cancel_next: v || '' })}
                placeholder="Select step..."
              />
            ) : (
              <Input
                value={cancelNext}
                onChange={(e) => onChange({ cancel_next: e.target.value })}
                placeholder="e.g. step_cancel"
                className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Create Deal Form
// ============================================================

export function CreateDealForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const title = (config.title as string) || 'New Deal';
  const value = config.value !== undefined ? String(config.value) : '0';
  const pipelineId = (config.pipeline_id as string) || '';
  const stageId = (config.stage_id as string) || '';

  return (
    <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Deal Title</Label>
        <Input
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Enterprise Plan - {{contact.name}}"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
        <p className="text-[10px] text-muted-foreground">Supports variables like <code>{"{{contact.name}}"}</code> or <code>{"{{vars.requirement}}"}</code></p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Estimated Value</Label>
        <Input
          value={value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="e.g. 5000 or {{vars.budget}}"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
        <p className="text-[10px] text-muted-foreground">Supports numeric values or variables like <code>{"{{vars.budget}}"}</code></p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Pipeline ID (Optional)</Label>
          <Input
            value={pipelineId}
            onChange={(e) => onChange({ pipeline_id: e.target.value })}
            placeholder="Auto (Default Pipeline)"
            className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Stage ID (Optional)</Label>
          <Input
            value={stageId}
            onChange={(e) => onChange({ stage_id: e.target.value })}
            placeholder="Auto (Initial Stage)"
            className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
        </div>
      </div>
      <p className="text-[10px] text-slate-500">
        Leave Pipeline and Stage blank to automatically assign to the account's primary sales pipeline and entry stage.
      </p>
    </div>
  );
}

// ============================================================
// WhatsApp Form Node Form
// ============================================================

export function WhatsAppFormForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const flowId = (config.flow_id as string) || '';
  const buttonText = (config.button_text as string) || 'Complete Form';
  const bodyText = (config.body_text as string) || 'Please fill out this form to continue:';
  const screenId = (config.screen_id as string) || '';

  return (
    <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Meta Flow ID</Label>
        <Input
          value={flowId}
          onChange={(e) => onChange({ flow_id: e.target.value })}
          placeholder="e.g. 123456789012345"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
        <p className="text-[10px] text-muted-foreground">ID of the published WhatsApp Flow in Meta Business Manager</p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Message Body</Label>
        <Textarea
          value={bodyText}
          onChange={(e) => onChange({ body_text: e.target.value })}
          placeholder="Please fill out this quick form:"
          rows={2}
          className="text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Button CTA Label</Label>
          <Input
            value={buttonText}
            onChange={(e) => onChange({ button_text: e.target.value })}
            placeholder="Open Form"
            className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Initial Screen (Optional)</Label>
          <Input
            value={screenId}
            onChange={(e) => onChange({ screen_id: e.target.value })}
            placeholder="e.g. SCREEN_ONE"
            className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Catalog Node Form
// ============================================================

export function CatalogForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const catalogId = (config.catalog_id as string) || '';
  const productRetailerId = (config.product_retailer_id as string) || '';
  const bodyText = (config.body_text as string) || 'Explore our latest products and catalog below:';

  return (
    <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Message Body</Label>
        <Textarea
          value={bodyText}
          onChange={(e) => onChange({ body_text: e.target.value })}
          placeholder="Explore our latest collection:"
          rows={2}
          className="text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Catalog ID (Optional)</Label>
        <Input
          value={catalogId}
          onChange={(e) => onChange({ catalog_id: e.target.value })}
          placeholder="e.g. catalog_12345"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
        <p className="text-[10px] text-muted-foreground">ID of the connected WhatsApp Commerce catalog</p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Featured Product SKU / Retailer ID (Optional)</Label>
        <Input
          value={productRetailerId}
          onChange={(e) => onChange({ product_retailer_id: e.target.value })}
          placeholder="e.g. SKU-9872"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
        <p className="text-[10px] text-muted-foreground">Specify to highlight a single product instead of the entire catalog</p>
      </div>
    </div>
  );
}

// ============================================================
// Book Appointment Node Form
// ============================================================

export function BookAppointmentForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const bookingUrl = (config.booking_url as string) || '';
  const promptText = (config.prompt_text as string) || 'Book your meeting slot here:';
  const serviceType = (config.service_type as string) || 'cal_com';

  return (
    <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Booking Service</Label>
        <Select value={serviceType} onValueChange={(val) => onChange({ service_type: val })}>
          <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cal_com">Cal.com</SelectItem>
            <SelectItem value="calendly">Calendly</SelectItem>
            <SelectItem value="custom">Custom URL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Booking URL</Label>
        <Input
          value={bookingUrl}
          onChange={(e) => onChange({ booking_url: e.target.value })}
          placeholder="https://cal.com/your-team/30min"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
        <p className="text-[10px] text-muted-foreground">Contact name, email, and phone are automatically appended as query parameters</p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Prompt Text</Label>
        <Textarea
          value={promptText}
          onChange={(e) => onChange({ prompt_text: e.target.value })}
          placeholder="Select a convenient time for your consultation:"
          rows={2}
          className="text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
      </div>
    </div>
  );
}

// ============================================================
// Add / Remove From Group Forms
// ============================================================

export function AddToGroupForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const groupId = (config.group_id as string) || '';
  const groupName = (config.group_name as string) || '';

  return (
    <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Contact Group ID</Label>
        <Input
          value={groupId}
          onChange={(e) => onChange({ group_id: e.target.value })}
          placeholder="UUID or group identifier"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Group Name (Label)</Label>
        <Input
          value={groupName}
          onChange={(e) => onChange({ group_name: e.target.value })}
          placeholder="e.g. VIP Customers / Leads"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
      </div>
    </div>
  );
}

export function RemoveFromGroupForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const groupId = (config.group_id as string) || '';

  return (
    <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Contact Group ID</Label>
        <Input
          value={groupId}
          onChange={(e) => onChange({ group_id: e.target.value })}
          placeholder="UUID of group to remove contact from"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
      </div>
    </div>
  );
}

// ============================================================
// Trigger Node Form
// ============================================================

// export function TriggerNodeForm({
//   config,
//   onChange,
// }: {
//   config: Record<string, unknown>;
//   onChange: (patch: Record<string, unknown>) => void;
// }) {
//   const startingStep = (config.starting_step as string) || 'new_contact';
//   const keywords = Array.isArray(config.keywords) ? (config.keywords as string[]) : [];

//   return (
//     <div className="space-y-4 text-xs text-slate-700">
//       <div className="space-y-1.5">
//         <Label className="text-xs font-semibold text-slate-800">Starting Step</Label>
//         <Select
//           value={startingStep}
//           onValueChange={(val) => {
//             onChange({ starting_step: val });
//           }}
//         >
//           <SelectTrigger className="h-8 text-xs border-slate-200 bg-white">
//             <SelectValue />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="new_contact">New contact</SelectItem>
//             <SelectItem value="keyword">Text contains specific keywords</SelectItem>
//             <SelectItem value="contact_from_ad">Contact from Ad</SelectItem>
//           </SelectContent>
//         </Select>
//       </div>

//       {startingStep === 'keyword' && (
//         <div className="space-y-1.5">
//           <Label className="text-xs font-semibold text-slate-800">Keywords (comma separated)</Label>
//           <Input
//             value={keywords.join(', ')}
//             onChange={(e) => {
//               const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
//               onChange({ keywords: list });
//             }}
//             placeholder="e.g. hi, hello, start, pricing"
//             className="h-8 text-xs border-slate-200"
//           />
//           <p className="text-[11px] text-slate-500">
//             Flow starts when customer sends any of these keywords.
//           </p>
//         </div>
//       )}

//       {startingStep === 'new_contact' && (
//         <p className="text-[11px] text-slate-500">
//           Flow automatically triggers when a contact messages for the first time.
//         </p>
//       )}

//       {startingStep === 'contact_from_ad' && (
//         <p className="text-[11px] text-slate-500">
//           Flow triggers when a customer clicks a Click-to-WhatsApp ad.
//         </p>
//       )}
//     </div>
//   );
// }


// ============================================================
// Trigger Node Form
// ============================================================

export function TriggerNodeForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const { state, setState } = useFlowEditor();
  const currentChannels = state.channels || ['whatsapp', 'instagram', 'facebook'];
  const startingStep = (config.starting_step as string) || 'new_contact';
  const keywords = Array.isArray(config.keywords) ? (config.keywords as string[]) : [];

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      {/* Active Channels */}
      <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground">Active Channels</Label>
          <span className="text-[10px] text-muted-foreground">Where this flow triggers</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'whatsapp', label: 'WhatsApp', color: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
            { id: 'instagram', label: 'Instagram', color: 'text-pink-600 dark:text-pink-400 border-pink-500/30 bg-pink-500/10' },
            { id: 'facebook', label: 'Messenger', color: 'text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10' },
          ].map(({ id, label, color }) => {
            const isChecked = currentChannels.includes(id as any);
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  const updated = isChecked
                    ? currentChannels.filter((c) => c !== id)
                    : [...currentChannels, id];
                  if (updated.length > 0) {
                    setState((s) => ({ ...s, channels: updated as any }));
                  }
                }}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border text-xs transition-all shadow-2xs',
                  isChecked
                    ? cn(color, 'font-semibold ring-1 ring-current/20')
                    : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
                )}
                title={`Toggle ${label}`}
              >
                <ChannelIcon channel={id as any} className="size-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Starting Step</Label>
        <Select
          value={startingStep}
          onValueChange={(val: string | null) => {
            const step = val || 'new_contact';
            onChange({ starting_step: step });
            if (step === 'ai_intent') {
              const intentConfig = {
                intent_name: (config.intent_name as string) || (state.trigger_config?.intent_name as string) || '',
                intent_description: (config.intent_description as string) || (state.trigger_config?.intent_description as string) || '',
                positive_examples: (config.positive_examples as string[]) || (state.trigger_config?.positive_examples as string[]) || [],
                negative_examples: (config.negative_examples as string[]) || (state.trigger_config?.negative_examples as string[]) || [],
                confidence_threshold: typeof config.confidence_threshold === 'number' ? config.confidence_threshold : 0.75,
                priority: typeof config.priority === 'number' ? config.priority : 0,
              };
              onChange(intentConfig);
              setState((s) => ({ ...s, trigger_type: 'ai_intent', trigger_config: intentConfig }));
            } else if (step === 'keyword' || step === 'contact_from_ad') {
              setState((s) => ({
                ...s,
                trigger_type: 'keyword',
                trigger_config: { keywords, ...(step === 'contact_from_ad' ? { ad: true } : {}) },
              }));
            } else {
              setState((s) => ({ ...s, trigger_type: 'first_inbound_message', trigger_config: {} }));
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new_contact">New contact</SelectItem>
            <SelectItem value="keyword">Text contains specific keywords</SelectItem>
            <SelectItem value="ai_intent">AI Intent — Natural Language</SelectItem>
            <SelectItem value="contact_from_ad">Contact from Ad</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {startingStep === 'ai_intent' && (
        <div className="space-y-3 p-3 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                Intent Name *
              </Label>
              <Input
                value={(config.intent_name as string) || (state.trigger_config?.intent_name as string) || ''}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                  const patch = { intent_name: val };
                  onChange(patch);
                  setState((s) => ({ ...s, trigger_type: 'ai_intent', trigger_config: { ...s.trigger_config, ...patch } }));
                }}
                placeholder="e.g. appointment_booking"
                className="h-8 text-xs font-mono border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                Priority
              </Label>
              <Input
                type="number"
                value={typeof config.priority === 'number' ? config.priority : (state.trigger_config?.priority as number) ?? 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  const patch = { priority: val };
                  onChange(patch);
                  setState((s) => ({ ...s, trigger_type: 'ai_intent', trigger_config: { ...s.trigger_config, ...patch } }));
                }}
                className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              Confidence Threshold (0.1 - 1.0)
            </Label>
            <Input
              type="number"
              step="0.05"
              min="0.1"
              max="1.0"
              value={typeof config.confidence_threshold === 'number' ? config.confidence_threshold : (state.trigger_config?.confidence_threshold as number) ?? 0.75}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0.75;
                const patch = { confidence_threshold: val };
                onChange(patch);
                setState((s) => ({ ...s, trigger_type: 'ai_intent', trigger_config: { ...s.trigger_config, ...patch } }));
              }}
              className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              Intent Description (AI Routing Criteria) *
            </Label>
            <Textarea
              value={(config.intent_description as string) || (state.trigger_config?.intent_description as string) || ''}
              onChange={(e) => {
                const val = e.target.value;
                const patch = { intent_description: val };
                onChange(patch);
                setState((s) => ({ ...s, trigger_type: 'ai_intent', trigger_config: { ...s.trigger_config, ...patch } }));
              }}
              placeholder="e.g. Trigger when a customer wants to schedule, book, or reserve an appointment."
              rows={2}
              className="text-xs resize-y border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              Positive Examples (Comma-separated)
            </Label>
            <Input
              value={
                Array.isArray(config.positive_examples)
                  ? config.positive_examples.join(', ')
                  : Array.isArray(state.trigger_config?.positive_examples)
                    ? (state.trigger_config.positive_examples as string[]).join(', ')
                    : ''
              }
              onChange={(e) => {
                const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                const patch = { positive_examples: list };
                onChange(patch);
                setState((s) => ({ ...s, trigger_type: 'ai_intent', trigger_config: { ...s.trigger_config, ...patch } }));
              }}
              placeholder="book appointment, slot chahiye, schedule demo"
              className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              Negative Examples (Messages to reject)
            </Label>
            <Input
              value={
                Array.isArray(config.negative_examples)
                  ? config.negative_examples.join(', ')
                  : Array.isArray(state.trigger_config?.negative_examples)
                    ? (state.trigger_config.negative_examples as string[]).join(', ')
                    : ''
              }
              onChange={(e) => {
                const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                const patch = { negative_examples: list };
                onChange(patch);
                setState((s) => ({ ...s, trigger_type: 'ai_intent', trigger_config: { ...s.trigger_config, ...patch } }));
              }}
              placeholder="already booked, cancel, pricing kitna hai"
              className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
            />
          </div>
        </div>
      )}

      {startingStep === 'keyword' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Keywords (comma separated)</Label>
          <Input
            value={keywords.join(', ')}
            onChange={(e) => {
              const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
              onChange({ keywords: list });
            }}
            placeholder="e.g. hi, hello, start, pricing"
            className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Flow starts when customer sends any of these keywords.
          </p>
        </div>
      )}

      {startingStep === 'new_contact' && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Flow automatically triggers when a contact messages for the first time.
        </p>
      )}

      {startingStep === 'contact_from_ad' && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Flow triggers when a customer clicks a Click-to-WhatsApp ad.
        </p>
      )}
    </div>
  );
}

export function AgentHandoverForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const { user, profile } = useAuth();
  const [members, setMembers] = useState<Array<{ userId: string; fullName: string; email: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      try {
        const res = await fetch('/api/account/members');
        let fetchedList: any[] = [];
        if (res.ok) {
          const data = await res.json();
          fetchedList = Array.isArray(data)
            ? data
            : Array.isArray(data?.members)
            ? data.members
            : [];
        }

        const map = new Map<string, { userId: string; fullName: string; email: string }>();

        // 1. Current logged-in user ("including me")
        const currentUserId = user?.id || profile?.id;
        if (currentUserId) {
          const currentName = profile?.full_name || (user?.user_metadata as any)?.full_name || profile?.email || 'You';
          const currentEmail = profile?.email || user?.email || '';
          map.set(currentUserId, {
            userId: currentUserId,
            fullName: `${currentName} (You)`,
            email: currentEmail,
          });
        }

        // 2. Add all account members returned by API
        for (const m of fetchedList) {
          const id = m.user_id || m.userId || m.id;
          if (!id) continue;
          const name = m.full_name || m.fullName || '';
          const email = m.email || '';
          if (map.has(id)) {
            const existing = map.get(id)!;
            map.set(id, {
              userId: id,
              fullName: existing.fullName,
              email: email || existing.email,
            });
          } else {
            map.set(id, {
              userId: id,
              fullName: name,
              email: email,
            });
          }
        }

        if (!cancelled) {
          setMembers(Array.from(map.values()));
        }
      } catch (err) {
        console.error('Failed to load team members:', err);
        const currentUserId = user?.id || profile?.id;
        if (currentUserId && !cancelled) {
          setMembers([{
            userId: currentUserId,
            fullName: `${profile?.full_name || 'You'} (You)`,
            email: profile?.email || user?.email || '',
          }]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [user, profile]);

  const assignTo = (config.assign_to as string) || '';
  const message = (config.message as string) ?? 'Transferring you to our team. Please wait...';
  const active = (config.active as boolean) ?? true;

  const handleSelectMember = (userId: string) => {
    const member = members.find((m) => m.userId === userId);
    const cleanName = member?.fullName ? member.fullName.replace(/\s*\(You\)$/, '') : (member?.email || 'Agent');
    onChange({
      assign_to: userId,
      agent_name: cleanName,
      agent_email: member?.email || '',
    });
  };

  return (
    <div className="space-y-4">
      {/* Assign to Agent */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Assign to Agent</Label>
        <Select value={assignTo || '__none__'} onValueChange={(val: string | null) => handleSelectMember(val && val !== '__none__' ? val : '')}>
          <SelectTrigger className="h-9 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
            <SelectValue placeholder={loading && members.length === 0 ? 'Loading agents...' : 'Select an agent...'} />
          </SelectTrigger>
          <SelectContent className="max-h-56">
            <SelectItem value="__none__">Select an agent...</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.fullName ? `${m.fullName} ${m.email ? `(${m.email})` : ''}` : (m.email || m.userId)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Select which agent/user will receive this conversation
        </p>
      </div>

      {/* Handover Message */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Handover Message</Label>
        <Textarea
          value={message}
          onChange={(e) => onChange({ message: e.target.value })}
          placeholder="Transferring you to our team. Please wait..."
          rows={3}
          className="text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card resize-none"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          This message will be sent to the user before transferring to the agent. You can use placeholders like &#123;first_name&#125;, &#123;organization_name&#125;, etc.
        </p>
      </div>

      {/* How Agent Handover Works Card */}
      <div className="rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/70 dark:bg-purple-950/30 p-3.5 text-xs space-y-2 text-purple-950 dark:text-purple-200">
        <p className="font-semibold text-purple-900 dark:text-purple-200">How Agent Handover Works:</p>
        <ul className="space-y-1 text-purple-800 dark:text-purple-300 list-disc list-inside text-[11px] leading-relaxed">
          <li>User reaches this node (e.g., clicks &quot;Sales&quot; button)</li>
          <li>Sends your custom message to the user</li>
          <li>Assigns contact to the selected agent</li>
          <li>Ends the flow</li>
          <li>Agent can now handle the conversation</li>
        </ul>
        <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1 pt-0.5 text-[11px]">
          <span>⚠️ Flow cannot continue after this node</span>
        </p>
      </div>

      {/* Active checkbox */}
      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id="handover-active"
          checked={active}
          onCheckedChange={(c) => onChange({ active: Boolean(c) })}
        />
        <Label htmlFor="handover-active" className="text-xs font-medium cursor-pointer text-slate-700 dark:text-slate-300">
          Active
        </Label>
      </div>
    </div>
  );
}

// ============================================================
// AI Message Form
// ============================================================

export function AiMessageForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const mode = (config.mode as 'static' | 'generated') || 'generated';
  const prompt = (config.prompt as string) || '';
  const staticText = (config.static_text as string) || '';
  const fallbackText = (config.fallback_text as string) || 'I understand. How else can I assist you?';
  const languageStyle = (config.language_style as string) || 'conversational Hinglish/English';
  const maxTokens = typeof config.max_tokens === 'number' ? config.max_tokens : 300;
  const contextSources = Array.isArray(config.context_sources)
    ? (config.context_sources as string[])
    : ['contact', 'conversation', 'memories'];

  const toggleSource = (source: string) => {
    const updated = contextSources.includes(source)
      ? contextSources.filter((s) => s !== source)
      : [...contextSources, source];
    onChange({ context_sources: updated });
  };

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Response Mode</Label>
        <Select
          value={mode}
          onValueChange={(val: string | null) => onChange({ mode: (val || 'generated') as 'static' | 'generated' })}
        >
          <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="generated">AI Generated (Context-Aware)</SelectItem>
            <SelectItem value="static">Static Text Message</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === 'generated' ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              AI System Prompt & Instructions
            </Label>
            <Textarea
              value={prompt}
              onChange={(e) => onChange({ prompt: e.target.value })}
              placeholder="e.g. Acknowledge the user's booking request warmly. Confirm their appointment date and ask if they prefer morning or evening slots. Keep it concise."
              rows={4}
              className="text-xs resize-y border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Supports interpolation like <code className="bg-muted px-1 rounded">&#123;&#123;contact.name&#125;&#125;</code> or <code className="bg-muted px-1 rounded">&#123;&#123;vars.booking_date&#125;&#125;</code>.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Tone & Language Style
            </Label>
            <Input
              value={languageStyle}
              onChange={(e) => onChange({ language_style: e.target.value })}
              placeholder="e.g. conversational Hinglish/English, empathetic, professional"
              className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Context Sources
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'contact', label: 'Contact Profile & Tags' },
                { id: 'conversation', label: 'Recent Message History' },
                { id: 'memories', label: 'Customer Memories & Notes' },
                { id: 'orders', label: 'Recent Orders & Deals' },
              ].map(({ id, label }) => (
                <label key={id} className="flex items-center gap-2 cursor-pointer text-[11px]">
                  <Checkbox
                    checked={contextSources.includes(id)}
                    onCheckedChange={() => toggleSource(id)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Max Response Tokens
            </Label>
            <Input
              type="number"
              min={50}
              max={1000}
              step={50}
              value={maxTokens}
              onChange={(e) => onChange({ max_tokens: parseInt(e.target.value, 10) || 300 })}
              className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
            />
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Static Text
          </Label>
          <Textarea
            value={staticText}
            onChange={(e) => onChange({ static_text: e.target.value })}
            placeholder="Enter the static message..."
            rows={3}
            className="text-xs resize-y border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
          />
        </div>
      )}

      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Safe Fallback Message (on timeout/error)
        </Label>
        <Textarea
          value={fallbackText}
          onChange={(e) => onChange({ fallback_text: e.target.value })}
          placeholder="I understand. How else can I assist you?"
          rows={2}
          className="text-xs resize-y border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Sent if the AI model times out or encounters an unrecoverable generation error.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// AI Extract Form
// ============================================================

export function AiExtractForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const instructions = (config.extraction_instructions as string) || '';
  const fields = Array.isArray(config.fields)
    ? (config.fields as Array<{ name: string; type?: string; description?: string; required?: boolean }>)
    : [];

  const handleAddField = () => {
    const updated = [
      ...fields,
      {
        name: `field_${fields.length + 1}`,
        type: 'string',
        description: '',
        required: true,
      },
    ];
    onChange({ fields: updated });
  };

  const handleUpdateField = (index: number, patch: Partial<{ name: string; type: string; description: string; required: boolean }>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...patch };
    onChange({ fields: updated });
  };

  const handleRemoveField = (index: number) => {
    const updated = fields.filter((_, i) => i !== index);
    onChange({ fields: updated });
  };

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Extraction Instructions
        </Label>
        <Textarea
          value={instructions}
          onChange={(e) => onChange({ extraction_instructions: e.target.value })}
          placeholder="e.g. Extract key appointment details from the user's message."
          rows={2}
          className="text-xs resize-y border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Fields to Extract ({fields.length})
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddField}
            className="h-7 text-[11px] gap-1"
          >
            <Plus className="h-3 w-3" /> Add Field
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">No fields configured. Click &quot;Add Field&quot; above.</p>
        ) : (
          <div className="space-y-2.5">
            {fields.map((f, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-card/50 p-2.5 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={f.name}
                    onChange={(e) => handleUpdateField(idx, { name: e.target.value })}
                    placeholder="Field name (e.g. service_type)"
                    className="h-7 text-xs font-mono bg-white dark:bg-card flex-1"
                  />
                  <Select
                    value={f.type || 'string'}
                    onValueChange={(val: string | null) => handleUpdateField(idx, { type: val || 'string' })}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs bg-white dark:bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">string</SelectItem>
                      <SelectItem value="number">number</SelectItem>
                      <SelectItem value="boolean">boolean</SelectItem>
                      <SelectItem value="date">date</SelectItem>
                      <SelectItem value="email">email</SelectItem>
                      <SelectItem value="phone">phone</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveField(idx)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Input
                  value={f.description || ''}
                  onChange={(e) => handleUpdateField(idx, { description: e.target.value })}
                  placeholder="Extraction guidance (e.g. Specific service requested by customer)"
                  className="h-7 text-xs bg-white dark:bg-card"
                />

                <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                  <Checkbox
                    checked={f.required !== false}
                    onCheckedChange={(c) => handleUpdateField(idx, { required: Boolean(c) })}
                  />
                  <span>Required (triggers missing fields branch if absent)</span>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// AI Decision Form
// ============================================================

export function AiDecisionForm({
  config,
  allNodes,
  currentKey,
  onChange,
}: {
  config: Record<string, unknown>;
  allNodes: BuilderNode[];
  currentKey: string;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const prompt = (config.prompt as string) || (config.decision_prompt as string) || (config.instruction as string) || '';
  const branches = Array.isArray(config.branches)
    ? (config.branches as Array<{ key?: string; branch_key?: string; description?: string; label?: string; next_node_key?: string }>)
    : [];

  const handleAddBranch = () => {
    const key = `branch_${branches.length + 1}`;
    onChange({
      branches: [
        ...branches,
        { branch_key: key, key, description: 'Condition description', label: 'Condition description', next_node_key: '' },
      ],
    });
  };

  const handleUpdateBranch = (index: number, patch: Partial<{ key?: string; branch_key?: string; description?: string; label?: string; next_node_key?: string }>) => {
    const updated = [...branches];
    const prev = updated[index];
    const newKey = patch.branch_key ?? patch.key ?? prev.branch_key ?? prev.key ?? `branch_${index + 1}`;
    const desc = patch.description ?? patch.label ?? prev.description ?? prev.label ?? '';
    updated[index] = { ...prev, ...patch, branch_key: newKey, key: newKey, description: desc, label: desc };
    onChange({ branches: updated });
  };

  const handleRemoveBranch = (index: number) => {
    const updated = branches.filter((_, i) => i !== index);
    onChange({ branches: updated });
  };

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Decision Evaluation Prompt
        </Label>
        <Textarea
          value={prompt}
          onChange={(e) => onChange({ prompt: e.target.value, decision_prompt: e.target.value })}
          placeholder="e.g. Classify whether the customer wants to schedule a product demo, request custom pricing, or speak with support."
          rows={3}
          className="text-xs resize-y border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Decision Branches ({branches.length})
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddBranch}
            className="h-7 text-[11px] gap-1"
          >
            <Plus className="h-3 w-3" /> Add Branch
          </Button>
        </div>

        {branches.map((b, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-card/50 p-2.5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Input
                value={b.branch_key || b.key || ''}
                onChange={(e) => handleUpdateBranch(idx, { branch_key: e.target.value, key: e.target.value })}
                placeholder="Branch key (e.g. demo)"
                className="h-7 text-xs font-mono bg-white dark:bg-card w-28 shrink-0"
              />
              <Input
                value={b.description || b.label || ''}
                onChange={(e) => handleUpdateBranch(idx, { description: e.target.value, label: e.target.value })}
                placeholder="Condition description (e.g. Customer wants a live demo)"
                className="h-7 text-xs bg-white dark:bg-card flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveBranch(idx)}
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-20 shrink-0">Advance to:</span>
              <NodeKeySelect
                value={b.next_node_key || null}
                nodes={allNodes}
                excludeKey={currentKey}
                onChange={(v) => handleUpdateBranch(idx, { next_node_key: v || '' })}
                placeholder="(Stop flow)"
                className="h-7 flex-1"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Fallback Branch */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Fallback Branch (When No Branch Matches)
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground w-20 shrink-0">Advance to:</span>
          <NodeKeySelect
            value={(config.fallback_next as string) || (config.fallback_node_key as string) || null}
            nodes={allNodes}
            excludeKey={currentKey}
            onChange={(v) => onChange({ fallback_next: v || '', fallback_node_key: v || '' })}
            placeholder="(Stop flow)"
            className="h-7 flex-1"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AI Summarize Form
// ============================================================

export function AiSummarizeForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const targetVar = (config.target_var as string) || 'summary';
  const focus = (config.focus as string) || 'all';
  const maxWords = typeof config.max_words === 'number' ? config.max_words : 100;

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Target Variable Name
        </Label>
        <Input
          value={targetVar}
          onChange={(e) => onChange({ target_var: e.target.value })}
          placeholder="e.g. summary"
          className="h-8 text-xs font-mono border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Result will be stored in <code className="bg-muted px-1 rounded">&#123;&#123;vars.{targetVar || 'summary'}&#125;&#125;</code> for downstream nodes.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Focus Area
        </Label>
        <Select
          value={focus}
          onValueChange={(val: string | null) => onChange({ focus: val || 'all' })}
        >
          <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Complete Context & Needs</SelectItem>
            <SelectItem value="inquiry">Customer Inquiries & Questions</SelectItem>
            <SelectItem value="complaint">Complaints & Blockers</SelectItem>
            <SelectItem value="action_items">Action Items & Next Steps</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Maximum Words
        </Label>
        <Input
          type="number"
          min={20}
          max={500}
          step={20}
          value={maxWords}
          onChange={(e) => onChange({ max_words: parseInt(e.target.value, 10) || 100 })}
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
      </div>
    </div>
  );
}

/**
 * Trigger Another Flow Form:
 * Hands off the conversation to a target flow with optional variable forwarding
 * (e.g. passing `doctor: "{{vars.selected_card_title}}"` from a Doctors carousel).
 */
export function TriggerFlowForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const [flows, setFlows] = useState<Array<{ id: string; name: string; status: string }>>([]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/flows")
      .then((res) => (res.ok ? res.json() : { flows: [] }))
      .then((data) => {
        if (mounted && Array.isArray(data.flows)) {
          setFlows(data.flows);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const targetFlowId = (config.target_flow_id as string) ?? "";
  const targetFlowName = (config.target_flow_name as string) ?? "";
  const passAllVars = Boolean(config.pass_all_vars);
  const passVars = (config.pass_vars as Record<string, string>) || {};
  const entries = Object.entries(passVars);

  const handleSetVar = (idx: number, key: string, value: string) => {
    const next: Record<string, string> = {};
    entries.forEach(([k, v], i) => {
      if (i === idx) {
        if (key.trim() || value) next[key] = value;
      } else {
        next[k] = v;
      }
    });
    onChange({ pass_vars: next });
  };

  const handleAddVar = () => {
    onChange({
      pass_vars: {
        ...passVars,
        [`var_${entries.length + 1}`]: "{{vars.selected_card_title}}",
      },
    });
  };

  const handleRemoveVar = (keyToRemove: string) => {
    const next = { ...passVars };
    delete next[keyToRemove];
    onChange({ pass_vars: next });
  };

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Target Flow
        </Label>
        {flows.length > 0 ? (
          <Select
            value={targetFlowId || "__custom__"}
            onValueChange={(val) => {
              if (val === "__custom__") return;
              const found = flows.find((f) => f.id === val);
              onChange({
                target_flow_id: val,
                target_flow_name: found?.name || targetFlowName,
              });
            }}
          >
            <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
              <SelectValue placeholder="Choose a target flow..." />
            </SelectTrigger>
            <SelectContent>
              {flows.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} ({f.status})
                </SelectItem>
              ))}
              <SelectItem value="__custom__">Enter Flow ID / Name manually…</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        <Input
          value={targetFlowId || targetFlowName}
          onChange={(e) =>
            onChange({
              target_flow_id: e.target.value,
              target_flow_name: e.target.value,
            })
          }
          placeholder="Target Flow ID or exact Name (e.g. Appointment Booking)"
          className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card"
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-900/30">
        <div>
          <Label className="text-xs font-medium">Forward All Flow Variables</Label>
          <p className="text-[11px] text-muted-foreground">
            Automatically copy collected vars to the target flow
          </p>
        </div>
        <input
          type="checkbox"
          checked={passAllVars}
          onChange={(e) => onChange({ pass_all_vars: e.target.checked })}
          className="h-4 w-4 accent-purple-600 rounded cursor-pointer"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Pass Specific Variables ({entries.length})
          </Label>
          <Button type="button" variant="outline" size="sm" onClick={handleAddVar} className="h-7 text-xs">
            + Add Mapping
          </Button>
        </div>
        {entries.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Example: <code>doctor</code> → <code>{"{{vars.selected_card_title}}"}</code>
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map(([k, v], idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <Input
                  value={k}
                  onChange={(e) => handleSetVar(idx, e.target.value, v)}
                  placeholder="var name (e.g. doctor)"
                  className="h-7 text-xs flex-1"
                />
                <span className="text-muted-foreground">=</span>
                <Input
                  value={v}
                  onChange={(e) => handleSetVar(idx, k, e.target.value)}
                  placeholder="{{vars.selected_card_title}}"
                  className="h-7 text-xs flex-[1.4]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveVar(k)}
                  className="h-7 px-1.5 text-rose-500"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



