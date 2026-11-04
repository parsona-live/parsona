import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, DELETE } from "./route";
import {
  createImpersonationToken,
  IMPERSONATOR_COOKIE_NAME,
} from "@/lib/admin/impersonation";

const mockRequireSuperAdmin = vi.fn();
const mockCookieSet = vi.fn();
const mockCookieDelete = vi.fn();
const mockCookieGet = vi.fn();

vi.mock("@/lib/auth/account", () => ({
  requireSuperAdmin: () => mockRequireSuperAdmin(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mockCookieGet,
    set: mockCookieSet,
    delete: mockCookieDelete,
  }),
}));

const mockGenerateLink = vi.fn();
const mockAccountsSelect = vi.fn();
const mockProfilesSelect = vi.fn();
const mockAuditInsert = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        generateLink: mockGenerateLink,
      },
    },
    from: (table: string) => {
      if (table === "accounts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mockAccountsSelect,
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              eq: () => ({
                maybeSingle: mockProfilesSelect,
              }),
              order: () => ({
                limit: () => ({
                  maybeSingle: mockProfilesSelect,
                }),
              }),
              maybeSingle: mockProfilesSelect,
            }),
          }),
        };
      }
      if (table === "admin_audit_logs") {
        return {
          insert: mockAuditInsert,
        };
      }
      return {
        select: vi.fn(),
      };
    },
  }),
}));

describe("POST /api/admin/impersonate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails with 403 if caller is not a super admin", async () => {
    mockRequireSuperAdmin.mockRejectedValue(new Error("Forbidden"));
    const req = new NextRequest("http://localhost/api/admin/impersonate", {
      method: "POST",
      body: JSON.stringify({ accountId: "acc-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("successfully initiates impersonation, issues magiclink token, and sets cookies", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      userId: "admin-uid-1",
      email: "admin@platform.com",
      profile: {
        id: "admin-prof-1",
        fullName: "Platform Admin",
      },
    });

    mockAccountsSelect.mockResolvedValue({
      data: { id: "tenant-acc-1", name: "Acme Corp", owner_user_id: "owner-uid-1" },
      error: null,
    });

    mockProfilesSelect.mockResolvedValue({
      data: {
        id: "tenant-prof-1",
        user_id: "owner-uid-1",
        email: "owner@acme.com",
        full_name: "Alice Owner",
        account_role: "owner",
      },
      error: null,
    });

    mockGenerateLink.mockResolvedValue({
      data: {
        properties: {
          hashed_token: "test-token-hash-12345",
        },
      },
      error: null,
    });

    mockAuditInsert.mockResolvedValue({ error: null });

    const req = new NextRequest("http://localhost/api/admin/impersonate", {
      method: "POST",
      body: JSON.stringify({ accountId: "tenant-acc-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.redirectUrl).toBe(
      "/auth/callback?token_hash=test-token-hash-12345&type=magiclink&next=/dashboard",
    );

    // Verify cookies were set
    expect(mockCookieSet).toHaveBeenCalledWith(
      "wapp_admin_impersonator_token",
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
    expect(mockCookieSet).toHaveBeenCalledWith(
      "wapp_is_impersonating",
      "true",
      expect.objectContaining({ httpOnly: false }),
    );

    // Verify audit log recorded
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "impersonation_started",
        tenant_id: "tenant-acc-1",
      }),
    );
  });
});

describe("DELETE /api/admin/impersonate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores super admin session and clears cookies on exit", async () => {
    const validToken = createImpersonationToken({
      adminUserId: "admin-uid-1",
      adminProfileId: "admin-prof-1",
      adminEmail: "admin@platform.com",
      adminName: "Super Admin",
      tenantAccountId: "tenant-acc-1",
      tenantUserId: "tenant-uid-1",
      tenantEmail: "owner@acme.com",
      tenantRole: "owner",
      createdAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });

    mockCookieGet.mockImplementation((name: string) => {
      if (name === "wapp_admin_impersonator_token") {
        return { value: validToken };
      }
      return undefined;
    });

    mockProfilesSelect.mockResolvedValue({
      data: {
        id: "admin-prof-1",
        user_id: "admin-uid-1",
        email: "admin@platform.com",
        is_super_admin: true,
      },
      error: null,
    });

    mockGenerateLink.mockResolvedValue({
      data: {
        properties: {
          hashed_token: "return-admin-token-hash-9999",
        },
      },
      error: null,
    });

    mockAuditInsert.mockResolvedValue({ error: null });

    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.redirectUrl).toBe(
      "/auth/callback?token_hash=return-admin-token-hash-9999&type=magiclink&next=/admin/tenants",
    );

    // Verify cookies deleted
    expect(mockCookieDelete).toHaveBeenCalledWith("wapp_admin_impersonator_token");
    expect(mockCookieDelete).toHaveBeenCalledWith("wapp_is_impersonating");

    // Verify exit audit log recorded
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "impersonation_ended",
        tenant_id: "tenant-acc-1",
      }),
    );
  });
});

