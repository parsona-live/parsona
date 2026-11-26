"use client";

import { useBrowserNotifications } from "@/hooks/use-browser-notifications";
import { useInboxSoundNotifications } from "@/hooks/use-inbox-sound-notifications";

/**
 * Headless. Mount ONCE per signed-in dashboard tab (the dashboard
 * shell, below the auth gate) so desktop and sound notifications for
 * new customer messages fire on every dashboard page, not just the inbox.
 */
export function BrowserNotificationsListener() {
  useBrowserNotifications();
  useInboxSoundNotifications();
  return null;
}
