"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";
import { AuthSplitShell, GlassInputWrapper } from "@/components/ui/sign-in";

export default function ForgotPasswordPage() {
  const t = useTranslations("ForgotPasswordPage");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
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
          href="/login"
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
          {t("title")}
        </span>
      }
      description={t("desc")}
    >
      <form onSubmit={handleReset} className="space-y-4">
        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="animate-element animate-delay-300 space-y-1.5">
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

        <button
          type="submit"
          disabled={loading}
          className="animate-element animate-delay-400 w-full rounded-2xl bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? t("sending") : t("sendLink")}
        </button>
      </form>

      <Link
        href="/login"
        className="animate-element animate-delay-500 flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToSignIn")}
      </Link>
    </AuthSplitShell>
  );
}
