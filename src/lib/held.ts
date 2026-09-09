import type { SupabaseClient } from "@supabase/supabase-js";
import { findQual } from "@/content/quals";

/* その人が「取得済み」の講座。

   げんきさんの依頼（2026-09-09）。
     「取得済みの資格は講座一覧にも取得済表示」
     「取得済の資格には受講コード配布不可」

   取得済みは2通りある。
     ・この仕組みで修了証が出ている（certificates。取り消したものは除く）
     ・よそで取ったと本人が入れた（held_quals）。講座との対応は
       src/content/quals.ts の courseId
   どちらも同じ「取得済み」として扱う。名簿の「取得済み資格」と同じ数え方。

   使う所は3つ。
     ・/api/me　　　　　　… 講座一覧の札に「取得済」を出す
     ・/api/order　　　　 … 「配る」の相手から取得済みの人を外す
     ・/api/admin/assign … 画面をすり抜けても、ここで断る
   1か所にまとめておかないと、片方だけ直したときに食い違う。

   修了証のほうは assign_seat（0031）も見る。
   よそで取った資格の対応表は画面側にしか無いので、ここで見る。 */

export async function heldCourseIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string[]>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const out = new Map<string, Set<string>>();
  if (!ids.length) return new Map();
  const add = (u: string, c: string) => {
    if (!out.has(u)) out.set(u, new Set());
    out.get(u)!.add(c);
  };

  const { data: ens } = await supabase
    .from("enrollments")
    .select("id, user_id, course_id")
    .in("user_id", ids);
  const byEnroll = new Map((ens ?? []).map((e) => [e.id as string, e]));
  const eids = [...byEnroll.keys()];
  if (eids.length) {
    /* 取り消した修了証は「取得済み」ではない（受け直しの道を残す） */
    const { data: certs } = await supabase
      .from("certificates")
      .select("enrollment_id")
      .in("enrollment_id", eids)
      .is("revoked_at", null);
    for (const c of certs ?? []) {
      const e = byEnroll.get(c.enrollment_id as string);
      if (e) add(e.user_id as string, e.course_id as string);
    }
  }

  const { data: quals } = await supabase
    .from("held_quals")
    .select("user_id, qual_id")
    .in("user_id", ids);
  for (const h of quals ?? []) {
    const cid = findQual(h.qual_id as string)?.courseId;
    if (cid) add(h.user_id as string, cid);
  }

  return new Map([...out].map(([u, set]) => [u, [...set].sort()]));
}
