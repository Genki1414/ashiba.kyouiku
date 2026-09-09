import { getServiceClient } from "./supabase/server";
import { currentUser } from "./supabase/session";
import { learnFor, type Learn } from "./entitleQuery";

/* 受講してよい人かどうかを、いまログインしている人について見る。
   決まりそのものは entitleQuery.ts。 */

export type { Learn };

/** @param courseId 教材を出す所では**必ず渡す**。省くと
                    「どれか1講座でも持っているか」になる */
export async function canLearn(courseId?: string): Promise<Learn> {
  const supabase = getServiceClient();
  if (!supabase) {
    /* **本番では、設定が欠けていても開けない。**
       げんきさん（2026-09-09）「受講コードが無いのに開けてはダメだよ」。

       Supabase の設定を1つ間違えただけで、73講座が誰にでも開く、
       という壊れ方をしていた（実際に、独自ドメインへ移した直後の
       ashiba-kyouiku がその状態だった）。
       止まっているほうが、タダで配られるよりましなので、閉じる。 */
    if (process.env.VERCEL) return { ok: false, why: "seat", company: "" };
    /* 手元で動かすときだけ、そのまま通す（Supabase を立てずに画面を見る） */
    return { ok: true, by: "open" };
  }

  const user = await currentUser();
  if (!user) return { ok: false, why: "signin", company: "" };

  return learnFor(supabase, user.id, courseId);
}
