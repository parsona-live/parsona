"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { DEFAULT_MODE } from "@/lib/themes";
import { cn } from "@/lib/utils";

import { useTranslations } from "next-intl";

// Returns false during SSR and the first hydration render, true after.
// Matches the boot-script's initial data-mode so React sees identical
// server and client HTML on first paint, eliminating the hydration mismatch.
const noopSubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Light/dark mode toggle — a single icon button that flips the app
 * between the two modes. Sun shows in light mode (click → go dark),
 * moon shows in dark mode (click → go light); the label always names
 * the destination so screen-reader users hear what the click does.
 *
 * Uses useSyncExternalStore to match DEFAULT_MODE on the server and
 * first hydration render, then switches to the real user preference.
 * This prevents the hydration mismatch that occurs when the boot script
 * has set data-mode to a non-default value before React hydrates.
 *
 * 40×40 hit target to match the header's other touch controls.
 */
export function ModeToggle({ className }: { className?: string }) {
  const t = useTranslations("ModeToggle");
  const { mode, setMode } = useTheme();
  const isClient = useIsClient();

  // On SSR / first hydration pass, use DEFAULT_MODE so server and client
  // render the same active state. After mount, switch to the real mode.
  const displayMode = isClient ? mode : DEFAULT_MODE;

  const lightLabel = t("switchMode", { mode: "light" });
  const darkLabel = t("switchMode", { mode: "dark" });

  return (
    <div
      role="group"
      aria-label={t("switchMode", {
        mode: displayMode === "dark" ? "light" : "dark",
      })}
      className={cn(
        "inline-flex h-8 items-center rounded-md border border-border bg-muted/40 p-0.5",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setMode("light")}
        aria-label={lightLabel}
        aria-pressed={displayMode === "light"}
        title={lightLabel}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
          displayMode === "light"
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setMode("dark")}
        aria-label={darkLabel}
        aria-pressed={displayMode === "dark"}
        title={darkLabel}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
          displayMode === "dark"
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
