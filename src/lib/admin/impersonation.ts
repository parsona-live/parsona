import crypto from "crypto";
import { encrypt, decrypt } from "@/lib/whatsapp/encryption";

export const IMPERSONATOR_COOKIE_NAME = "wapp_admin_impersonator_token";
export const IS_IMPERSONATING_COOKIE_NAME = "wapp_is_impersonating";
export const IMPERSONATED_ACCOUNT_ID_COOKIE = "wapp_impersonate_account_id";
export const IMPERSONATED_TENANT_NAME_COOKIE = "wapp_impersonated_tenant_name";
export const IMPERSONATED_USER_EMAIL_COOKIE = "wapp_impersonated_user_email";
export const IMPERSONATED_USER_ROLE_COOKIE = "wapp_impersonated_user_role";
export const IMPERSONATED_AT_COOKIE = "wapp_impersonated_at";

export const IMPERSONATION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

export interface ImpersonationTokenPayload {
  adminUserId: string;
  adminProfileId: string;
  adminEmail: string;
  adminName: string;
  tenantAccountId: string;
  tenantUserId: string;
  tenantEmail: string;
  tenantRole: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Creates an encrypted, tamper-evident impersonation state token for storage in an HTTP-only cookie.
 */
export function createImpersonationToken(payload: ImpersonationTokenPayload): string {
  const json = JSON.stringify(payload);
  return encrypt(json);
}

/**
 * Decrypts and verifies the impersonation token from the HTTP-only cookie.
 * Returns null if the token has been tampered with or has expired.
 */
export function verifyImpersonationToken(token: string): ImpersonationTokenPayload | null {
  try {
    const json = decrypt(token);
    const payload = JSON.parse(json) as ImpersonationTokenPayload;
    if (!payload.adminUserId || !payload.tenantAccountId || !payload.expiresAt) {
      return null;
    }
    if (Date.now() > payload.expiresAt) {
      return null;
    }
    return payload;
  } catch (err) {
    console.warn("[impersonation] Token verification failed:", err);
    return null;
  }
}

