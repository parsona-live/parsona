'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';

export interface CountryOption {
  code: string;
  dial: string;
  label: string;
}

export const COUNTRY_CODES: CountryOption[] = [
  { code: 'IN', dial: '+91', label: 'India (+91)' },
  { code: 'US', dial: '+1', label: 'United States (+1)' },
  { code: 'GB', dial: '+44', label: 'United Kingdom (+44)' },
  { code: 'AE', dial: '+971', label: 'UAE (+971)' },
  { code: 'SA', dial: '+966', label: 'Saudi Arabia (+966)' },
  { code: 'SG', dial: '+65', label: 'Singapore (+65)' },
  { code: 'AU', dial: '+61', label: 'Australia (+61)' },
  { code: 'DE', dial: '+49', label: 'Germany (+49)' },
  { code: 'FR', dial: '+33', label: 'France (+33)' },
  { code: 'BR', dial: '+55', label: 'Brazil (+55)' },
  { code: 'ID', dial: '+62', label: 'Indonesia (+62)' },
  { code: 'MY', dial: '+60', label: 'Malaysia (+60)' },
  { code: 'PH', dial: '+63', label: 'Philippines (+63)' },
  { code: 'NG', dial: '+234', label: 'Nigeria (+234)' },
  { code: 'ZA', dial: '+27', label: 'South Africa (+27)' },
  { code: 'MX', dial: '+52', label: 'Mexico (+52)' },
];

// Sort longest dial codes first so "+971" matches before "+9"
const DIALS_DESC = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);

export function splitE164Phone(value: string, defaultDial = '+91'): { dial: string; national: string } {
  const trimmed = (value || '').trim();
  if (!trimmed) return { dial: defaultDial, national: '' };
  for (const c of DIALS_DESC) {
    if (trimmed.startsWith(c.dial)) {
      return {
        dial: c.dial,
        national: trimmed.slice(c.dial.length).replace(/\D/g, ''),
      };
    }
  }
  return { dial: defaultDial, national: trimmed.replace(/\D/g, '') };
}

interface PhoneInputWithCountryProps {
  value: string;
  onChange: (e164: string) => void;
  placeholder?: string;
  disabled?: boolean;
  defaultDial?: string;
}

export function PhoneInputWithCountry({
  value,
  onChange,
  placeholder = '9876543210',
  disabled = false,
  defaultDial = '+91',
}: PhoneInputWithCountryProps) {
  const { dial, national } = useMemo(
    () => splitE164Phone(value, defaultDial),
    [value, defaultDial],
  );

  function handleDialChange(nextDial: string) {
    onChange(national ? `${nextDial}${national}` : '');
  }

  function handleNationalChange(raw: string) {
    const digits = raw.replace(/\D/g, '');
    onChange(digits ? `${dial}${digits}` : '');
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label="Country code"
        disabled={disabled}
        value={dial}
        onChange={(e) => handleDialChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground shrink-0 max-w-[140px]"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.dial}>
            {c.code} {c.dial}
          </option>
        ))}
      </select>
      <Input
        type="tel"
        disabled={disabled}
        value={national}
        onChange={(e) => handleNationalChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-xs flex-1 font-mono"
      />
    </div>
  );
}
