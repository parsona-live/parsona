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
  const { mode, toggleMode } = useTheme();
  const isClient = useIsClient();

  // On SSR / first hydration pass, use DEFAULT_MODE so server and client
  // render the same icon. After mount, switch to the real mode.
  const displayMode = isClient ? mode : DEFAULT_MODE;

  const goingTo = displayMode === "dark" ? "light" : "dark";
  const switchLabel = t("switchMode", { mode: goingTo });

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={switchLabel}
      title={switchLabel}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {displayMode === "dark" ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </button>
  );
}
