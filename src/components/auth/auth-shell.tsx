'use client';

import { useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AuthShellProps {
  icon: ReactNode;
  iconTone?: 'primary' | 'amber';
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}

export function AuthShell({
  icon,
  iconTone = 'primary',
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* Subtle ambient primary glow — works in both light and dark modes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_55%)]"
      />

      <Card className="relative z-10 w-full max-w-[420px] border-border/80 bg-card/95 shadow-xl shadow-black/5 backdrop-blur-sm dark:shadow-black/40">
        <CardHeader className="flex flex-col items-center space-y-2 pb-2 text-center">
          <div
            className={`mb-1 flex h-12 w-12 items-center justify-center rounded-2xl border ${
              iconTone === 'amber'
                ? 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-primary/25 bg-primary/10 text-primary'
            }`}
          >
            {icon}
          </div>
          <CardTitle className="text-center text-xl font-semibold tracking-tight text-foreground">
            {title}
          </CardTitle>
          <CardDescription className="text-center text-sm leading-relaxed text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">{children}</CardContent>
      </Card>
    </div>
  );
}

export function AuthAlert({
  variant = 'error',
  children,
}: {
  variant?: 'error' | 'warning';
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border px-3.5 py-2.5 text-sm leading-snug ${
        variant === 'warning'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-destructive/30 bg-destructive/10 text-destructive'
      }`}
    >
      {children}
    </div>
  );
}

export function AuthPasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="h-10 border-border bg-background pr-10 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
