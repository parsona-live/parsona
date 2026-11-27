'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Phone, Mail, AlertCircle } from 'lucide-react';
import { VariableDropdown } from './fields';
import type { AccountMember } from '@/types';

export function NotifyMemberForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/account/members', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => {
        if (active) setMembers(d.members ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const channel = String(config.channel ?? 'whatsapp');
  const recipientMode = String(config.recipient_mode ?? 'specific');
  const selectedIds = new Set<string>(
    Array.isArray(config.member_ids) ? (config.member_ids as string[]) : [],
  );
  const message = String(config.message ?? '');

  function toggleMember(userId: string) {
    const next = new Set(selectedIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    onChange({ member_ids: Array.from(next) });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium">Channel</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-sm"
            value={channel}
            onChange={(e) => onChange({ channel: e.target.value })}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="both">WhatsApp + Email</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium">Recipients</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-sm"
            value={recipientMode}
            onChange={(e) => onChange({ recipient_mode: e.target.value })}
          >
            <option value="specific">Specific Members</option>
            <option value="owner_only">Owner Only</option>
            <option value="admins_and_owner">Admins &amp; Owner</option>
            <option value="all_members">All Members</option>
          </select>
        </div>
      </div>

      {recipientMode === 'specific' && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Select Members / Owner</Label>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading team members...
            </div>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground">No team members found.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-md border border-border p-2 bg-muted/20">
              {members.map((m) => {
                const checked = selectedIds.has(m.user_id);
                const missingPhone = (channel === 'whatsapp' || channel === 'both') && !m.phone;
                return (
                  <label
                    key={m.user_id}
                    className="flex items-start gap-2 rounded-md p-1.5 hover:bg-muted/60 cursor-pointer text-xs"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleMember(m.user_id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">
                          {m.full_name || m.email || 'Unnamed Member'}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {m.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        {m.phone ? (
                          <span className="inline-flex items-center gap-0.5 font-mono">
                            <Phone className="h-2.5 w-2.5" /> {m.phone}
                          </span>
                        ) : missingPhone ? (
                          <span className="inline-flex items-center gap-0.5 text-amber-500">
                            <AlertCircle className="h-2.5 w-2.5" /> No WhatsApp phone
                          </span>
                        ) : null}
                        {m.email && (
                          <span className="inline-flex items-center gap-0.5 truncate">
                            <Mail className="h-2.5 w-2.5" /> {m.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            Add or edit member WhatsApp numbers under <strong>Settings → Team members</strong>.
          </p>
        </div>
      )}

      {(channel === 'email' || channel === 'both') && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Email Subject</Label>
            <VariableDropdown
              onSelect={(tag) =>
                onChange({ email_subject: `${String(config.email_subject ?? '')}${tag}` })
              }
            />
          </div>
          <Input
            className="h-8 text-xs"
            value={String(config.email_subject ?? 'Team Notification')}
            onChange={(e) => onChange({ email_subject: e.target.value })}
            placeholder="New Appointment Booked"
          />
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Notification Message</Label>
          <VariableDropdown
            onSelect={(tag) => onChange({ message: `${message}${tag}` })}
          />
        </div>
        <Textarea
          rows={4}
          className="text-xs"
          value={message}
          onChange={(e) => onChange({ message: e.target.value })}
          placeholder="📅 New booking: {{vars.name}} ({{contact.phone}}) on {{vars.appointment_date}}"
        />
      </div>

      {(channel === 'whatsapp' || channel === 'both') && (
        <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
          <div className="text-[11px] font-medium text-foreground">
            WhatsApp Template (Optional — for outside 24h window)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              className="h-8 text-xs"
              placeholder="Template name (optional)"
              value={String(config.template_name ?? '')}
              onChange={(e) => onChange({ template_name: e.target.value })}
            />
            <Input
              className="h-8 text-xs"
              placeholder="en_US"
              value={String(config.template_language ?? 'en_US')}
              onChange={(e) => onChange({ template_language: e.target.value })}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Leave blank for standard text (requires the member to have messaged your WhatsApp within 24h), or enter an approved Meta template name (passes the message text as parameter 1).
          </p>
        </div>
      )}
    </div>
  );
}
