"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import {
  AuthSplitShell,
  GlassInputWrapper,
  GlassPasswordInput,
} from "@/components/ui/sign-in";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const t = useTranslations("SignupPage");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("passwordsMismatch"));
      return;
    }

    if (password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }

    setLoading(true);

    const next = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : "/dashboard";
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <AuthSplitShell
        title={
          <span className="font-light tracking-tighter text-foreground">
            {t("checkEmailTitle")}
          </span>
        }
        description={t.rich("checkEmailDesc", {
          email,
          strong: (chunks) => (
            <span className="font-medium text-foreground">{chunks}</span>
          ),
        })}
      >
        <Link
          href={
            inviteToken
              ? `/login?invite=${encodeURIComponent(inviteToken)}`
              : "/login"
          }
          className="animate-element animate-delay-300 flex w-full items-center justify-center rounded-2xl border border-border py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {t("backToSignIn")}
        </Link>
      </AuthSplitShell>
    );
  }

  return (
    <AuthSplitShell
      title={
        <span className="font-light tracking-tighter text-foreground">
          {inviteToken ? t("titleJoin") : t("title")}
        </span>
      }
      description={inviteToken ? t("descJoin") : t("desc")}
    >
      <form onSubmit={handleSignup} className="space-y-4">
        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="animate-element animate-delay-300 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("fullNameLabel")}
          </label>
          <GlassInputWrapper>
            <input
              type="text"
              autoComplete="name"
              placeholder={t("fullNamePlaceholder")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-2xl bg-transparent p-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </GlassInputWrapper>
        </div>

        <div className="animate-element animate-delay-400 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("emailLabel")}
          </label>
          <GlassInputWrapper>
            <input
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-2xl bg-transparent p-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </GlassInputWrapper>
        </div>

        <div className="animate-element animate-delay-500 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("passwordLabel")}
          </label>
          <GlassPasswordInput
            name="password"
            value={password}
            onChange={setPassword}
            placeholder={t("passwordPlaceholder")}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="animate-element animate-delay-600 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("confirmPasswordLabel")}
          </label>
          <GlassPasswordInput
            name="confirmPassword"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder={t("confirmPasswordPlaceholder")}
            autoComplete="new-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="animate-element animate-delay-700 w-full rounded-2xl bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? t("creating") : t("submit")}
        </button>
      </form>

      <p className="animate-element animate-delay-800 text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link
          href={
            inviteToken
              ? `/login?invite=${encodeURIComponent(inviteToken)}`
              : "/login"
          }
          className="text-primary transition-colors hover:underline"
        >
          {t("signIn")}
        </Link>
      </p>
    </AuthSplitShell>
  );
}
