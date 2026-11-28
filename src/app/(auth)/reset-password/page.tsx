"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { AuthSplitShell, GlassPasswordInput } from "@/components/ui/sign-in";

type Status = "checking" | "ready" | "expired" | "done";

export default function ResetPasswordPage() {
  const t = useTranslations("ResetPasswordPage");
  const supabase = createClient();

  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setStatus(user ? "ready" : "expired");
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
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

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    setStatus("done");
  };

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          {t("checking")}
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <AuthSplitShell
        title={
          <span className="font-light tracking-tighter text-foreground">
            {t("expiredTitle")}
          </span>
        }
        description={t("expiredDesc")}
      >
        <div className="flex flex-col gap-3">
          <Link
            href="/forgot-password"
            className="animate-element animate-delay-300 flex w-full items-center justify-center rounded-2xl bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("requestNewLink")}
          </Link>
          <Link
            href="/login"
            className="animate-element animate-delay-400 flex w-full items-center justify-center rounded-2xl border border-border py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            {t("backToSignIn")}
          </Link>
        </div>
      </AuthSplitShell>
    );
  }

  if (status === "done") {
    return (
      <AuthSplitShell
        title={
          <span className="font-light tracking-tighter text-foreground">
            {t("successTitle")}
          </span>
        }
        description={t("successDesc")}
      >
        <button
          type="button"
          className="animate-element animate-delay-300 w-full rounded-2xl bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          onClick={() => {
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full reload so the auth cookies reach the middleware
            window.location.href = "/dashboard";
          }}
        >
          {t("continueToDashboard")}
        </button>
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
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="animate-element animate-delay-300 space-y-1.5">
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

        <div className="animate-element animate-delay-400 space-y-1.5">
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
          disabled={saving}
          className="animate-element animate-delay-500 w-full rounded-2xl bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? t("saving") : t("submit")}
        </button>
      </form>
    </AuthSplitShell>
  );
}
