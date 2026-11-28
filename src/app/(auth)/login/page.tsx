"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { SignInPage } from "@/components/ui/sign-in";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const t = useTranslations("LoginPage");
  const linkError = searchParams.get("error");
  const linkErrorMessage =
    linkError === "link_expired"
      ? t("linkExpired")
      : linkError === "link_invalid"
        ? t("linkInvalid")
        : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const redirectParam = searchParams.get("redirect");
    let destination = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : redirectParam && redirectParam.startsWith("/")
        ? redirectParam
        : "/dashboard";

    if (!redirectParam && !inviteToken) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_super_admin")
          .eq("email", email.trim().toLowerCase())
          .maybeSingle();

        if (profile?.is_super_admin) {
          destination = "/admin";
        }
      } catch {
        // Fallback cleanly
      }
    }

    window.location.href = destination;
  };

  return (
    <SignInPage
      title={
        <span className="font-light tracking-tighter text-foreground">
          {inviteToken ? t("titleAccept") : t("titleWelcome")}
        </span>
      }
      description={inviteToken ? t("descAccept") : t("descWelcome")}
      email={email}
      onEmailChange={setEmail}
      password={password}
      onPasswordChange={setPassword}
      error={error}
      warning={!error ? linkErrorMessage : null}
      loading={loading}
      emailLabel={t("emailLabel")}
      emailPlaceholder={t("emailPlaceholder")}
      passwordLabel={t("passwordLabel")}
      passwordPlaceholder={t("passwordPlaceholder")}
      forgotPasswordLabel={t("forgotPassword")}
      submitLabel={t("signIn")}
      loadingLabel={t("signingIn")}
      noAccountLabel={t("noAccount")}
      createAccountLabel={t("createAccount")}
      onSignIn={handleLogin}
      onResetPassword={() => router.push("/forgot-password")}
      onCreateAccount={() =>
        router.push(
          inviteToken
            ? `/signup?invite=${encodeURIComponent(inviteToken)}`
            : "/signup"
        )
      }
    />
  );
}
