import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "fd8585703442eac3c58d08a1c97a1ff3",
  worker: defineWorker({
    name: "parsona",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-17",
    domains: ["app.parsona.live"],
    observability: {
      enabled: true,
    },
    placement: {
      mode: "smart",
    },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      NEXT_PUBLIC_APP_LOCALE: bindings.text("en"),
      NEXT_PUBLIC_APP_URL: bindings.text("https://app.parsona.live"),
      NEXT_PUBLIC_SUPABASE_URL: bindings.text("https://ymzlzswxrtmcifplhuhy.supabase.co"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: bindings.text(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inltemx6c3d4cnRtY2lmcGxodWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDU1OTIsImV4cCI6MjEwOTEyMTU5Mn0.2m8sspr7nLwYG90fXGXP2TXBcyUsMdO6eiceMvAbYHg"
      ),
      META_APP_ID: bindings.text("1673233044372356"),
      RAZORPAY_KEY_ID: bindings.text("rzp_test_STvMpjt4B7qJ2a"),
      // Keep secret values in Cloudflare Worker Secrets (and .dev.vars locally), never committed to git.
      ENCRYPTION_KEY: bindings.secret(),
      GOOGLE_SHEETS_WEBHOOK_URL: bindings.secret(),
      META_APP_SECRET: bindings.secret(),
      RAZORPAY_KEY_SECRET: bindings.secret(),
      SUPABASE_SERVICE_ROLE_KEY: bindings.secret(),
    },
  }),
});
