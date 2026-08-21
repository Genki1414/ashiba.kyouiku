import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* サーバ専用。service_role キーはクライアントへ出さない。
   フェーズ1は Auth 導入前なので、seed の開発用受講（DEV_ENROLLMENT_ID）に記録する。
   環境変数が無ければ null を返し、呼び出し側はローカル記録（端末内）へ切り替える。 */

let cached: SupabaseClient | null | undefined;

export function getServiceClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cached;
}

export function getDevEnrollmentId(): string | null {
  return process.env.DEV_ENROLLMENT_ID ?? null;
}
