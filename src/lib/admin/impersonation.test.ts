import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createImpersonationToken,
  verifyImpersonationToken,
  IMPERSONATOR_COOKIE_NAME,
  IS_IMPERSONATING_COOKIE_NAME,
  IMPERSONATED_ACCOUNT_ID_COOKIE,
  IMPERSONATION_MAX_AGE_SECONDS,
  type ImpersonationTokenPayload,
} from "./impersonation";

describe("Impersonation token crypto", () => {
  const samplePayload: ImpersonationTokenPayload = {
    adminUserId: "admin-uid-123",
    adminProfileId: "admin-profile-456",
    adminEmail: "admin@example.com",
    adminName: "Super Admin",
    tenantAccountId: "tenant-acc-789",
    tenantUserId: "tenant-uid-101",
    tenantEmail: "tenant.owner@example.com",
    tenantRole: "owner",
    createdAt: Date.now(),
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  };

  it("exports standard cookie names and 8-hour lifespan", () => {
    expect(IMPERSONATOR_COOKIE_NAME).toBe("wapp_admin_impersonator_token");
    expect(IS_IMPERSONATING_COOKIE_NAME).toBe("wapp_is_impersonating");
    expect(IMPERSONATED_ACCOUNT_ID_COOKIE).toBe("wapp_impersonate_account_id");
    expect(IMPERSONATION_MAX_AGE_SECONDS).toBe(28800);
  });

  it("successfully encrypts and decrypts valid impersonation payload", () => {
    const encrypted = createImpersonationToken(samplePayload);
    expect(typeof encrypted).toBe("string");
    expect(encrypted).not.toContain("admin@example.com"); // Not plaintext

    const decrypted = verifyImpersonationToken(encrypted);
    expect(decrypted).not.toBeNull();
    expect(decrypted?.adminUserId).toBe("admin-uid-123");
    expect(decrypted?.adminEmail).toBe("admin@example.com");
    expect(decrypted?.tenantAccountId).toBe("tenant-acc-789");
    expect(decrypted?.tenantEmail).toBe("tenant.owner@example.com");
    expect(decrypted?.tenantRole).toBe("owner");
  });

  it("rejects expired token", () => {
    const expiredPayload: ImpersonationTokenPayload = {
      ...samplePayload,
      createdAt: Date.now() - 9 * 60 * 60 * 1000,
      expiresAt: Date.now() - 1 * 60 * 60 * 1000, // Expired 1 hour ago
    };
    const encrypted = createImpersonationToken(expiredPayload);
    const verified = verifyImpersonationToken(encrypted);
    expect(verified).toBeNull();
  });

  it("rejects tampered token bytes", () => {
    const encrypted = createImpersonationToken(samplePayload);
    const parts = encrypted.split(":");
    // Tamper with the ciphertext hex
    const tampered = `${parts[0]}:deadbeef${parts[1].slice(8)}:${parts[2]}`;
    const verified = verifyImpersonationToken(tampered);
    expect(verified).toBeNull();
  });

  it("rejects completely invalid strings", () => {
    expect(verifyImpersonationToken("invalid:token")).toBeNull();
    expect(verifyImpersonationToken("")).toBeNull();
  });
});

