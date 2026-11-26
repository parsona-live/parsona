import { describe, it, expect } from "vitest";
import {
  canPlayChannelSoundNow,
  CHANNEL_SOUND_COOLDOWN_MS,
  createSoundRateLimiterState,
  GLOBAL_SOUND_COOLDOWN_MS,
  normalizeSoundChannel,
  recordChannelSoundPlayed,
} from "./sound-engine";

describe("normalizeSoundChannel", () => {
  it("keeps instagram and facebook, defaults others to whatsapp", () => {
    expect(normalizeSoundChannel("whatsapp")).toBe("whatsapp");
    expect(normalizeSoundChannel("instagram")).toBe("instagram");
    expect(normalizeSoundChannel("facebook")).toBe("facebook");
    expect(normalizeSoundChannel(null)).toBe("whatsapp");
    expect(normalizeSoundChannel("unknown")).toBe("whatsapp");
  });
});

describe("high-load sound rate limiter", () => {
  it("allows first sound immediately and throttles rapid same-channel bursts", () => {
    const state = createSoundRateLimiterState();
    const t0 = 10_000;

    expect(canPlayChannelSoundNow(state, "whatsapp", t0)).toEqual({
      allowed: true,
      waitMs: 0,
    });
    recordChannelSoundPlayed(state, "whatsapp", t0);

    const blockedSame = canPlayChannelSoundNow(state, "whatsapp", t0 + 100);
    expect(blockedSame.allowed).toBe(false);
    expect(blockedSame.waitMs).toBe(CHANNEL_SOUND_COOLDOWN_MS - 100);

    const afterCooldown = canPlayChannelSoundNow(
      state,
      "whatsapp",
      t0 + CHANNEL_SOUND_COOLDOWN_MS,
    );
    expect(afterCooldown.allowed).toBe(true);
  });

  it("enforces global cooldown across different channels", () => {
    const state = createSoundRateLimiterState();
    const t0 = 20_000;

    recordChannelSoundPlayed(state, "whatsapp", t0);

    const igImmediate = canPlayChannelSoundNow(state, "instagram", t0 + 150);
    expect(igImmediate.allowed).toBe(false);
    expect(igImmediate.waitMs).toBe(GLOBAL_SOUND_COOLDOWN_MS - 150);

    const igAfterGlobal = canPlayChannelSoundNow(
      state,
      "instagram",
      t0 + GLOBAL_SOUND_COOLDOWN_MS,
    );
    expect(igAfterGlobal.allowed).toBe(true);
  });
});
