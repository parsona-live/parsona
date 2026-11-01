import { createClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client authenticated with the SERVICE_ROLE_KEY.
 * Bypasses Row Level Security and has administrative access to auth.admin (createUser, etc.).
 * SERVER-SIDE ONLY — NEVER import or run on the browser!
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

