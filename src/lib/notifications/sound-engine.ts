import type { ChannelType } from "@/types";

/**
 * Inbox Notification Sound Engine
 *
 * Synthesizes distinct, realistic notification chimes for WhatsApp, Instagram,
 * and Facebook Messenger using the Web Audio API (no external audio files,
 * zero network latency, works offline).
 *
 * High-load resilience:
 * - Single shared AudioContext + master DynamicsCompressorNode -> GainNode
 *   (prevents browser AudioContext limit errors and prevents clipping/distortion).
 * - Global (450ms) and per-channel (850ms) cooldowns with a single trailing
 *   coalesced slot so a burst of 100+ messages/sec plays smoothly without
 *   overlapping noise or CPU/memory spikes.
 */

export const SOUND_PREFS_STORAGE_KEY = "wacrm:inbox-sound-notifications";
export const SOUND_PREFS_CHANGE_EVENT = "wacrm:inbox-sound-notifications-change";

export const GLOBAL_SOUND_COOLDOWN_MS = 450;
export const CHANNEL_SOUND_COOLDOWN_MS = 850;

export type SoundChannel = "whatsapp" | "instagram" | "facebook";

export interface InboxSoundPrefs {
  enabled: boolean;
  volume: number; // 0.1 to 1.0
  muteActiveChat: boolean;
  channels: Record<SoundChannel, boolean>;
}

export const DEFAULT_SOUND_PREFS: InboxSoundPrefs = {
  enabled: true,
  volume: 0.75,
  muteActiveChat: true,
  channels: {
    whatsapp: true,
    instagram: true,
    facebook: true,
  },
};

export function normalizeSoundChannel(channel?: string | null): SoundChannel {
  if (channel === "instagram" || channel === "facebook") return channel;
  return "whatsapp";
}

let cachedRawPrefs: string | null = null;
let cachedParsedPrefs: InboxSoundPrefs = DEFAULT_SOUND_PREFS;

export function readSoundPrefs(): InboxSoundPrefs {
  if (typeof window === "undefined") return DEFAULT_SOUND_PREFS;
  try {
    const raw = window.localStorage.getItem(SOUND_PREFS_STORAGE_KEY);
    if (!raw) {
      cachedRawPrefs = null;
      cachedParsedPrefs = DEFAULT_SOUND_PREFS;
      return cachedParsedPrefs;
    }
    if (raw === cachedRawPrefs) return cachedParsedPrefs;

    const parsed = JSON.parse(raw) as Partial<InboxSoundPrefs>;
    const next: InboxSoundPrefs = {
      enabled:
        typeof parsed.enabled === "boolean"
          ? parsed.enabled
          : DEFAULT_SOUND_PREFS.enabled,
      volume:
        typeof parsed.volume === "number" &&
        Number.isFinite(parsed.volume) &&
        parsed.volume >= 0.1 &&
        parsed.volume <= 1
          ? parsed.volume
          : DEFAULT_SOUND_PREFS.volume,
      muteActiveChat:
        typeof parsed.muteActiveChat === "boolean"
          ? parsed.muteActiveChat
          : DEFAULT_SOUND_PREFS.muteActiveChat,
      channels: {
        whatsapp:
          typeof parsed.channels?.whatsapp === "boolean"
            ? parsed.channels.whatsapp
            : DEFAULT_SOUND_PREFS.channels.whatsapp,
        instagram:
          typeof parsed.channels?.instagram === "boolean"
            ? parsed.channels.instagram
            : DEFAULT_SOUND_PREFS.channels.instagram,
        facebook:
          typeof parsed.channels?.facebook === "boolean"
            ? parsed.channels.facebook
            : DEFAULT_SOUND_PREFS.channels.facebook,
      },
    };
    cachedRawPrefs = raw;
    cachedParsedPrefs = next;
    return cachedParsedPrefs;
  } catch {
    return cachedParsedPrefs;
  }
}

export function writeSoundPrefs(
  patch: Partial<Omit<InboxSoundPrefs, "channels">> & {
    channels?: Partial<Record<SoundChannel, boolean>>;
  },
): InboxSoundPrefs {
  const current = readSoundPrefs();
  const next: InboxSoundPrefs = {
    enabled: patch.enabled ?? current.enabled,
    volume: patch.volume ?? current.volume,
    muteActiveChat: patch.muteActiveChat ?? current.muteActiveChat,
    channels: {
      ...current.channels,
      ...patch.channels,
    },
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SOUND_PREFS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort in private/sandboxed browsing
    }
    window.dispatchEvent(new Event(SOUND_PREFS_CHANGE_EVENT));
  }
  return next;
}

export function subscribeSoundPrefs(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SOUND_PREFS_STORAGE_KEY) onChange();
  };
  window.addEventListener(SOUND_PREFS_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SOUND_PREFS_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// ---------------------------------------------------------------------
// High-load rate limiter & coalescing state (testable)
// ---------------------------------------------------------------------

export interface SoundRateLimiterState {
  lastGlobalAt: number;
  lastByChannel: Partial<Record<SoundChannel, number>>;
}

export function createSoundRateLimiterState(): SoundRateLimiterState {
  return { lastGlobalAt: 0, lastByChannel: {} };
}

export function canPlayChannelSoundNow(
  state: SoundRateLimiterState,
  channel: SoundChannel,
  now = Date.now(),
): { allowed: boolean; waitMs: number } {
  const globalElapsed = now - state.lastGlobalAt;
  const channelElapsed = now - (state.lastByChannel[channel] ?? 0);

  if (
    globalElapsed >= GLOBAL_SOUND_COOLDOWN_MS &&
    channelElapsed >= CHANNEL_SOUND_COOLDOWN_MS
  ) {
    return { allowed: true, waitMs: 0 };
  }

  const globalWait = Math.max(0, GLOBAL_SOUND_COOLDOWN_MS - globalElapsed);
  const channelWait = Math.max(0, CHANNEL_SOUND_COOLDOWN_MS - channelElapsed);
  return { allowed: false, waitMs: Math.max(globalWait, channelWait) };
}

export function recordChannelSoundPlayed(
  state: SoundRateLimiterState,
  channel: SoundChannel,
  now = Date.now(),
): void {
  state.lastGlobalAt = now;
  state.lastByChannel[channel] = now;
}

// ---------------------------------------------------------------------
// Web Audio API Singleton & Synthesizer
// ---------------------------------------------------------------------

let sharedCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let unlockAttached = false;

const rateState = createSoundRateLimiterState();
let pendingChannel: SoundChannel | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function getAudioGraph(): {
  ctx: AudioContext;
  output: GainNode;
} | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioCtx();
    compressor = sharedCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-16, sharedCtx.currentTime);
    compressor.knee.setValueAtTime(18, sharedCtx.currentTime);
    compressor.ratio.setValueAtTime(6, sharedCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, sharedCtx.currentTime);
    compressor.release.setValueAtTime(0.15, sharedCtx.currentTime);

    masterGain = sharedCtx.createGain();
    masterGain.gain.setValueAtTime(readSoundPrefs().volume, sharedCtx.currentTime);

    compressor.connect(masterGain);
    masterGain.connect(sharedCtx.destination);
  }

  if (!masterGain || !compressor) return null;
  return { ctx: sharedCtx, output: masterGain };
}

/**
 * Unlocks Web Audio on the first user interaction so incoming Realtime
 * messages can play immediately without browser autoplay blocks.
 */
export function attachAudioUnlockListener(): () => void {
  if (typeof window === "undefined" || unlockAttached) return () => {};
  unlockAttached = true;

  const unlock = () => {
    const graph = getAudioGraph();
    if (graph && graph.ctx.state === "suspended") {
      void graph.ctx.resume().catch(() => {});
    }
    if (graph && graph.ctx.state === "running") {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      unlockAttached = false;
    }
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });

  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    unlockAttached = false;
  };
}

function scheduleTone(
  ctx: AudioContext,
  dest: AudioNode,
  opts: {
    startAt: number;
    duration: number;
    freqStart: number;
    freqEnd?: number;
    type?: OscillatorType;
    peakGain: number;
    attack?: number;
  },
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freqStart, opts.startAt);
  if (opts.freqEnd && opts.freqEnd !== opts.freqStart) {
    osc.frequency.exponentialRampToValueAtTime(
      opts.freqEnd,
      opts.startAt + Math.min(0.035, opts.duration * 0.5),
    );
  }

  const attack = opts.attack ?? 0.006;
  gain.gain.setValueAtTime(0.0001, opts.startAt);
  gain.gain.linearRampToValueAtTime(opts.peakGain, opts.startAt + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, opts.startAt + opts.duration);

  osc.connect(gain);
  gain.connect(dest);

  osc.start(opts.startAt);
  osc.stop(opts.startAt + opts.duration + 0.01);
}

/**
 * Renders the channel-specific chime into the shared AudioContext.
 */
function renderChannelChime(channel: SoundChannel, volume: number): boolean {
  const graph = getAudioGraph();
  if (!graph) return false;
  const { ctx } = graph;
  if (!compressor || !masterGain) return false;

  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  masterGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
  const t0 = ctx.currentTime + 0.008;

  if (channel === "whatsapp") {
    // WhatsApp-style warm marimba double-chirp (G5 -> D6 with subtle harmonic)
    scheduleTone(ctx, compressor, {
      startAt: t0,
      duration: 0.13,
      freqStart: 783.99,
      type: "sine",
      peakGain: 0.42,
      attack: 0.004,
    });
    scheduleTone(ctx, compressor, {
      startAt: t0,
      duration: 0.09,
      freqStart: 1567.98,
      type: "triangle",
      peakGain: 0.11,
      attack: 0.003,
    });

    scheduleTone(ctx, compressor, {
      startAt: t0 + 0.095,
      duration: 0.22,
      freqStart: 1174.66,
      type: "sine",
      peakGain: 0.5,
      attack: 0.004,
    });
    scheduleTone(ctx, compressor, {
      startAt: t0 + 0.095,
      duration: 0.14,
      freqStart: 2349.32,
      type: "triangle",
      peakGain: 0.12,
      attack: 0.003,
    });
    return true;
  }

  if (channel === "instagram") {
    // Instagram-style glossy upward triple-pop chime (B5 -> D#6 -> F#6)
    scheduleTone(ctx, compressor, {
      startAt: t0,
      duration: 0.11,
      freqStart: 740,
      freqEnd: 987.77,
      type: "sine",
      peakGain: 0.34,
      attack: 0.005,
    });
    scheduleTone(ctx, compressor, {
      startAt: t0 + 0.055,
      duration: 0.14,
      freqStart: 1244.51,
      type: "sine",
      peakGain: 0.38,
      attack: 0.005,
    });
    scheduleTone(ctx, compressor, {
      startAt: t0 + 0.11,
      duration: 0.22,
      freqStart: 1479.98,
      type: "triangle",
      peakGain: 0.28,
      attack: 0.006,
    });
    return true;
  }

  // Facebook Messenger-style snappy "ba-ding" pop (E5 -> B5 with upward bend)
  scheduleTone(ctx, compressor, {
    startAt: t0,
    duration: 0.095,
    freqStart: 587.33,
    freqEnd: 659.25,
    type: "sine",
    peakGain: 0.42,
    attack: 0.003,
  });
  scheduleTone(ctx, compressor, {
    startAt: t0 + 0.075,
    duration: 0.19,
    freqStart: 880,
    freqEnd: 987.77,
    type: "sine",
    peakGain: 0.52,
    attack: 0.003,
  });
  scheduleTone(ctx, compressor, {
    startAt: t0 + 0.075,
    duration: 0.11,
    freqStart: 1975.53,
    type: "triangle",
    peakGain: 0.1,
    attack: 0.003,
  });
  return true;
}

/**
 * Plays a notification sound for the given channel.
 * Under high load, bursts are coalesced and rate-limited so audio never clips.
 * Pass `{ force: true }` for explicit user "Test sound" clicks in Settings.
 */
export function playChannelNotificationSound(
  channel: ChannelType | string | null | undefined,
  opts?: { force?: boolean },
): void {
  if (typeof window === "undefined") return;
  const resolved = normalizeSoundChannel(channel);
  const prefs = readSoundPrefs();

  if (opts?.force) {
    renderChannelChime(resolved, prefs.volume);
    return;
  }

  if (!prefs.enabled || !prefs.channels[resolved]) return;

  const now = Date.now();
  const check = canPlayChannelSoundNow(rateState, resolved, now);
  if (check.allowed) {
    recordChannelSoundPlayed(rateState, resolved, now);
    renderChannelChime(resolved, prefs.volume);
    return;
  }

  // High-load coalescing: keep only the latest pending channel and play once
  // the cooldown expires, instead of dropping everything or stacking timers.
  pendingChannel = resolved;
  if (!pendingTimer) {
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      const next = pendingChannel;
      pendingChannel = null;
      if (!next) return;
      const latestPrefs = readSoundPrefs();
      if (!latestPrefs.enabled || !latestPrefs.channels[next]) return;
      recordChannelSoundPlayed(rateState, next, Date.now());
      renderChannelChime(next, latestPrefs.volume);
    }, check.waitMs);
  }
}
