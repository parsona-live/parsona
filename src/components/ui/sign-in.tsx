'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// --- HELPER COMPONENTS (ICONS) ---

export const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z"
    />
    <path
      fill="#FF3D00"
      d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z"
    />
  </svg>
);

// --- TYPE DEFINITIONS ---

export interface Testimonial {
  avatarSrc?: string;
  initials?: string;
  name: string;
  handle: string;
  text: string;
}

export const DEFAULT_AUTH_TESTIMONIALS: Testimonial[] = [
  {
    initials: 'SC',
    name: 'Sarah Chen',
    handle: '@sarahdigital',
    text: 'Amazing platform! The WhatsApp automation and CRM flows are seamless and exactly what our team needed.',
  },
  {
    initials: 'MJ',
    name: 'Marcus Johnson',
    handle: '@marcustech',
    text: 'This service has transformed how we handle leads. Clean design, powerful workflows, and reliable delivery.',
  },
  {
    initials: 'DM',
    name: 'David Martinez',
    handle: '@davidcreates',
    text: "I've tried many CRM tools, but this one stands out. Intuitive, fast, and genuinely helpful for productivity.",
  },
];

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
  error?: string | null;
  warning?: string | null;
  loading?: boolean;
  email?: string;
  onEmailChange?: (value: string) => void;
  password?: string;
  onPasswordChange?: (value: string) => void;
  submitLabel?: string;
  loadingLabel?: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  forgotPasswordLabel?: string;
  noAccountLabel?: string;
  createAccountLabel?: string;
}

// --- SUB-COMPONENTS ---

export const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/[0.03] backdrop-blur-sm transition-colors focus-within:border-primary/70 focus-within:bg-primary/5">
    {children}
  </div>
);

export const GlassPasswordInput = ({
  name = 'password',
  placeholder = 'Enter your password',
  value,
  onChange,
  autoComplete,
  required,
}: {
  name?: string;
  placeholder?: string;
  value?: string;
  onChange?: (val: string) => void;
  autoComplete?: string;
  required?: boolean;
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <GlassInputWrapper>
      <div className="relative">
        <input
          name={name}
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          autoComplete={autoComplete}
          required={required}
          className="w-full rounded-2xl bg-transparent p-3.5 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-3 flex items-center"
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
          ) : (
            <Eye className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
          )}
        </button>
      </div>
    </GlassInputWrapper>
  );
};

const TestimonialCard = ({
  testimonial,
  delay,
}: {
  testimonial: Testimonial;
  delay: string;
}) => (
  <div
    className={`animate-testimonial ${delay} flex w-64 items-start gap-3 rounded-3xl border border-white/20 bg-black/35 p-5 text-white shadow-xl backdrop-blur-xl`}
  >
    {testimonial.avatarSrc ? (
      <img
        src={testimonial.avatarSrc}
        className="h-10 w-10 shrink-0 rounded-2xl object-cover"
        alt={testimonial.name}
      />
    ) : (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xs font-semibold text-white">
        {testimonial.initials ?? testimonial.name.slice(0, 2).toUpperCase()}
      </div>
    )}
    <div className="text-xs leading-snug">
      <p className="font-semibold text-white">{testimonial.name}</p>
      <p className="text-white/70">{testimonial.handle}</p>
      <p className="mt-1.5 text-white/90 leading-relaxed">{testimonial.text}</p>
    </div>
  </div>
);

export const AuthSplitShell = ({
  title,
  description,
  heroImageSrc,
  testimonials = [],
  children,
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  children: React.ReactNode;
}) => {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background text-foreground md:flex-row">
      {/* Left column: auth form */}
      <section className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-5">
            <h1 className="animate-element animate-delay-100 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              {title}
            </h1>
            <p className="animate-element animate-delay-200 text-sm text-muted-foreground">
              {description}
            </p>
            {children}
          </div>
        </div>
      </section>

      {/* Right column: vibrant abstract hero + glassmorphic testimonials */}
      <section className="relative hidden flex-1 p-4 md:block">
        <div
          className="animate-slide-right animate-delay-300 relative h-full min-h-[560px] w-full overflow-hidden rounded-3xl bg-cover bg-center"
          style={
            heroImageSrc
              ? { backgroundImage: `url(${heroImageSrc})` }
              : {
                  background:
                    'radial-gradient(circle at 20% 20%, #818cf8 0%, transparent 45%), radial-gradient(circle at 80% 30%, #f43f5e 0%, transparent 50%), radial-gradient(circle at 50% 80%, #6366f1 0%, #0f172a 75%)',
                }
          }
        >
          {/* Abstract flowing wave ribbons */}
          {!heroImageSrc && (
            <svg
              viewBox="0 0 800 900"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full opacity-80 mix-blend-screen"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="ribbon1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#6366f1" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#fb7185" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="ribbon2" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.55" />
                </linearGradient>
              </defs>
              <path
                d="M-120,250 C140,80 340,420 920,120 L920,380 C420,620 180,260 -120,480 Z"
                fill="url(#ribbon1)"
              />
              <path
                d="M-100,560 C220,320 480,680 920,360 L920,640 C480,880 180,520 -100,760 Z"
                fill="url(#ribbon2)"
              />
            </svg>
          )}

          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-1/2 flex w-full -translate-x-1/2 justify-center gap-4 px-8">
              <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
              {testimonials[1] && (
                <div className="hidden xl:flex">
                  <TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" />
                </div>
              )}
              {testimonials[2] && (
                <div className="hidden 2xl:flex">
                  <TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" />
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

// --- MAIN COMPONENT ---

export const SignInPage: React.FC<SignInPageProps> = ({
  title = <span className="font-light tracking-tighter text-foreground">Welcome</span>,
  description = 'Access your account and continue your journey with us',
  heroImageSrc,
  testimonials = [],
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
  error,
  warning,
  loading = false,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  submitLabel = 'Sign In',
  loadingLabel = 'Signing in...',
  emailLabel = 'Email Address',
  emailPlaceholder = 'Enter your email address',
  passwordLabel = 'Password',
  passwordPlaceholder = 'Enter your password',
  forgotPasswordLabel = 'Reset password',
  noAccountLabel = 'New to our platform?',
  createAccountLabel = 'Create Account',
}) => {
  return (
    <AuthSplitShell
      title={title}
      description={description}
      heroImageSrc={heroImageSrc}
      testimonials={testimonials}
    >
      <form className="space-y-4" onSubmit={onSignIn}>
        {warning && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            {warning}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="animate-element animate-delay-300 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{emailLabel}</label>
          <GlassInputWrapper>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={onEmailChange ? (e) => onEmailChange(e.target.value) : undefined}
              placeholder={emailPlaceholder}
              className="w-full rounded-2xl bg-transparent p-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </GlassInputWrapper>
        </div>

        <div className="animate-element animate-delay-400 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{passwordLabel}</label>
          <GlassPasswordInput
            name="password"
            value={password}
            onChange={onPasswordChange}
            placeholder={passwordPlaceholder}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" name="rememberMe" className="custom-checkbox" />
            <span className="text-foreground/90">Keep me signed in</span>
          </label>
          <a
            href="/forgot-password"
            onClick={(e) => {
              if (onResetPassword) {
                e.preventDefault();
                onResetPassword();
              }
            }}
            className="text-primary transition-colors hover:underline"
          >
            {forgotPasswordLabel}
          </a>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? loadingLabel : submitLabel}
        </button>
      </form>

      {onGoogleSignIn && (
        <>
          <div className="animate-element animate-delay-700 relative flex items-center justify-center py-1">
            <span className="w-full border-t border-border" />
            <span className="absolute bg-background px-4 text-xs text-muted-foreground">
              Or continue with
            </span>
          </div>

          <button
            type="button"
            onClick={onGoogleSignIn}
            className="animate-element animate-delay-800 flex w-full items-center justify-center gap-3 rounded-2xl border border-border py-3.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </>
      )}

      <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
        {noAccountLabel}{' '}
        <a
          href="/signup"
          onClick={(e) => {
            if (onCreateAccount) {
              e.preventDefault();
              onCreateAccount();
            }
          }}
          className="text-primary transition-colors hover:underline"
        >
          {createAccountLabel}
        </a>
      </p>
    </AuthSplitShell>
  );
};
