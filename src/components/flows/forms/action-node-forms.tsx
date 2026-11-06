'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
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
import { Mail, Server, ExternalLink, Sparkles } from 'lucide-react';

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
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const amount = typeof config.amount === 'number' ? config.amount : 100;
  const currency = (config.currency as string) || 'INR';
  const itemName = (config.item_name as string) || 'Product Order';
  const provider = (config.provider as string) || 'razorpay';

  return (
    <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Amount</Label>
          <Input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => onChange({ amount: parseFloat(e.target.value) || 0 })}
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
          </SelectContent>
        </Select>
      </div>
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
  const value = typeof config.value === 'number' ? config.value : 0;

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
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Deal Value</Label>
        <Input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange({ value: parseFloat(e.target.value) || 0 })}
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
  const startingStep = (config.starting_step as string) || 'new_contact';
  const keywords = Array.isArray(config.keywords) ? (config.keywords as string[]) : [];

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Starting Step</Label>
        <Select
          value={startingStep}
          onValueChange={(val) => {
            onChange({ starting_step: val });
          }}
        >
          <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new_contact">New contact</SelectItem>
            <SelectItem value="keyword">Text contains specific keywords</SelectItem>
            <SelectItem value="contact_from_ad">Contact from Ad</SelectItem>
          </SelectContent>
        </Select>
      </div>

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


