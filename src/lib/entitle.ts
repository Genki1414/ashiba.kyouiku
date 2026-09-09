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
  /* Supabase を繋いでいないあいだは、ログインも求めていない（手元で動かすとき）。
     ここで止めると何も開けなくなるので、そのまま通す */
  if (!supabase) return { ok: true, by: "open" };

  const user = await currentUser();
  if (!user) return { ok: false, why: "signin", company: "" };

  return learnFor(supabase, user.id, courseId);
}
