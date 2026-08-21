"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "./config";

/* ブラウザ側の Supabase。anon キーは公開前提で、守りは RLS が受け持つ。 */

let cached: SupabaseClient | null | undefined;

export function getBrowserClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  cached = hasSupabase ? createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  return cached;
}
