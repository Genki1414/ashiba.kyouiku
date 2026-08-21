import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* サーバ専用。service_role キーはクライアントへ出さない。

   書き込みは service_role で行うが、「誰の受講に書くか」は
   クッキーのログインから決める（src/lib/enrollment.ts）。
   クライアントから直に触られたときは RLS が受け持つ。

   環境変数が無ければ null を返し、呼び出し側は端末内の記録へ切り替える。 */

let cached: SupabaseClient | null | undefined;

export function getServiceClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cached;
}

/** ログインが無いときに使う開発用の受講。手元で画面を確かめるときのため。
    本番では設定しない（設定すると、ログインしていない人の記録が1か所に混ざる）。 */
export function getDevEnrollmentId(): string | null {
  return process.env.DEV_ENROLLMENT_ID ?? null;
}
