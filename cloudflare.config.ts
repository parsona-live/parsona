import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "fd8585703442eac3c58d08a1c97a1ff3",
  worker: defineWorker({
    name: "parsona",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-17",
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
    },
  }),
});
