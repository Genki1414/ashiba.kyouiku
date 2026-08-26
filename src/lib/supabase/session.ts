import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "./config";

/* サーバ側で、いま誰がログインしているかを見る。
   クッキーの読み書きは Next の cookies() 経由。

   ── 速さの話 ──
   ここは画面と API のほぼ全部から呼ばれる。
   素直に書くと、1回の画面表示で何度も Supabase に問い合わせに行く。
   /api/me だけでも、運営か・担当者か・受講できるか、で3回呼んでいた。
   東京から Supabase までの往復が毎回乗るので、その分だけ画面が遅くなる。

   ・cache() で、ひとつの取りに行きの中では1回だけにする
   ・getUser() ではなく getClaims() を使う。
     getUser() は毎回 Supabase の認証サーバまで聞きに行く。
     getClaims() は、鍵が非対称（ECC/RSA）なら手元で確かめられるので
     往復が消える。対称鍵（旧来のもの）のままだと中で getUser() に落ちるが、
     その場合でも遅くはならない。 */

export type Me = { id: string; email: string | null };

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

/** いまログインしている人。していなければ null。
    ひとつの取りに行きの中では、何度呼んでも1回しか聞きに行かない */
export const currentUser = cache(async (): Promise<Me | null> => {
  const supabase = await getSessionClient();
  if (!supabase) return null;

  /* ログインのクッキーが1枚も無ければ、聞きに行くまでもない */
  const store = await cookies();
  if (!store.getAll().some((c) => c.name.startsWith("sb-"))) return null;

  const { data, error } = await supabase.auth.getClaims();
  if (!error && data?.claims?.sub) {
    return {
      id: data.claims.sub as string,
      email: (data.claims.email as string) ?? null,
    };
  }

  /* getClaims が使えないとき（古い版・鍵の都合）の受け皿 */
  const { data: u } = await supabase.auth.getUser();
  return u.user ? { id: u.user.id, email: u.user.email ?? null } : null;
});
