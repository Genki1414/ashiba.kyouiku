import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "./config";

/* サーバ側で、いま誰がログインしているかを見る。
   クッキーの読み書きは Next の cookies() 経由。 */

export async function getSessionClient(): Promise<SupabaseClient | null> {
  if (!hasSupabase) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          /* サーバコンポーネントからは書けない。更新は middleware が受け持つ */
        }
      },
    },
  });
}

/** いまログインしている人。していなければ null */
export async function currentUser(): Promise<User | null> {
  const supabase = await getSessionClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
