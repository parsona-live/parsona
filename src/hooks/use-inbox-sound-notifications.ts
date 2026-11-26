"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types";
import {
  shouldNotifyForMessage,
  viewedConversationFromLocation,
} from "@/lib/notifications/browser-notify";
import {
  attachAudioUnlockListener,
  DEFAULT_SOUND_PREFS,
  normalizeSoundChannel,
  playChannelNotificationSound,
  readSoundPrefs,
  subscribeSoundPrefs,
  type InboxSoundPrefs,
  type SoundChannel,
} from "@/lib/notifications/sound-engine";

const serverPrefsSnapshot = (): InboxSoundPrefs => DEFAULT_SOUND_PREFS;

/**
 * Device-scoped inbox sound preferences, kept in sync across this tab
 * (Settings -> Inbox) and other tabs via localStorage + custom event.
 */
export function useSoundPrefs(): InboxSoundPrefs {
  return useSyncExternalStore(
    subscribeSoundPrefs,
    readSoundPrefs,
    serverPrefsSnapshot,
  );
}

const CONVERSATION_CHANNEL_CACHE_MAX = 500;
const CONVERSATION_CHANNEL_TTL_MS = 5 * 60_000;

interface CachedChannel {
  channel: SoundChannel;
  cachedAt: number;
}

/**
 * Plays WhatsApp / Instagram / Messenger notification sounds for live
 * inbound customer messages across all dashboard pages.
 *
 * Designed for high load:
 * - Bounded 500-entry TTL cache + in-flight query deduplication so burst
 *   messages in the same conversation never flood Supabase.
 * - Sound playback itself is throttled + coalesced in sound-engine.ts.
 */
export function useInboxSoundNotifications(): void {
  const prefs = useSoundPrefs();
  const prefsRef = useRef<InboxSoundPrefs>(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const seenRef = useRef<Map<string, number>>(new Map());
  const channelCacheRef = useRef<Map<string, CachedChannel>>(new Map());
  const inflightRef = useRef<Map<string, Promise<SoundChannel>>>(new Map());

  useEffect(() => {
    return attachAudioUnlockListener();
  }, []);

  useEffect(() => {
    if (!prefs.enabled) return;

    const supabase = createClient();
    let cancelled = false;

    const resolveChannel = async (
      conversationId: string,
    ): Promise<SoundChannel> => {
      const now = Date.now();
      const cached = channelCacheRef.current.get(conversationId);
      if (cached && now - cached.cachedAt < CONVERSATION_CHANNEL_TTL_MS) {
        return cached.channel;
      }

      const existing = inflightRef.current.get(conversationId);
      if (existing) return existing;

      const req = (async () => {
        try {
          const { data } = await supabase
            .from("conversations")
            .select("channel")
            .eq("id", conversationId)
            .maybeSingle();
          const resolved = normalizeSoundChannel(
            (data as { channel?: string | null } | null)?.channel,
          );
          if (channelCacheRef.current.size >= CONVERSATION_CHANNEL_CACHE_MAX) {
            const oldestKey = channelCacheRef.current.keys().next().value;
            if (oldestKey) channelCacheRef.current.delete(oldestKey);
          }
          channelCacheRef.current.set(conversationId, {
            channel: resolved,
            cachedAt: Date.now(),
          });
          return resolved;
        } catch {
          return "whatsapp" as SoundChannel;
        } finally {
          inflightRef.current.delete(conversationId);
        }
      })();

      inflightRef.current.set(conversationId, req);
      return req;
    };

    const channel = supabase
      .channel("inbox-sound-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const currentPrefs = prefsRef.current;
          if (!currentPrefs.enabled) return;

          const msg = payload.new as Message;
          const viewingId = currentPrefs.muteActiveChat
            ? viewedConversationFromLocation(
                window.location.pathname,
                window.location.search,
              )
            : null;

          const shouldPlay = shouldNotifyForMessage(msg, {
            documentVisible:
              currentPrefs.muteActiveChat &&
              document.visibilityState === "visible",
            viewingConversationId: viewingId,
            seen: seenRef.current,
          });
          if (!shouldPlay) return;

          void resolveChannel(msg.conversation_id).then((ch) => {
            if (cancelled) return;
            playChannelNotificationSound(ch);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [prefs.enabled]);
}
