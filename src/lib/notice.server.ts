import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { isNoticeKind, noteOf, type NoticeKind } from "./noticeText";

/* こちらが返事をしたことを、待っていた本人に残す。

   ── なぜ要るか ──
   許可を出しても、入金を確認しても、候補日を出しても、
   相手には何も伝わらない。相手は開いてみるまで分からないし、
   **開くのをやめた人には、永久に伝わらない。**

   ── 決めたこと ──
   ・**残せなくても、返事そのものは通す。** 知らせが書けないから
     許可が出せない、では本末転倒。失敗は握りつぶす（投げない）
   ・宛先は「待っていた本人」。その操作をした人ではない。
     入れ違えると、押した本人に「許可されました」が出る
   ・断るときは理由を入れる。理由の無い「断られました」は、
     受け取った人がどうすればいいか分からない */

/** 知らせを1件残す。**失敗しても投げない。**

    @param userId 待っていた人（押した人ではない）
    @param kind   何があったか
    @param courseId 講座に紐づく知らせだけ。無ければ省く
    @param note   こちらが書いた一言（断った理由など）。そのまま相手に出る */
export async function addNotice(
  userId: string | null | undefined,
  kind: NoticeKind,
  opts: { courseId?: string | null; note?: string | null } = {},
): Promise<boolean> {
  const to = (userId ?? "").trim();
  if (!to || !isNoticeKind(kind)) return false;

  const supabase = getServiceClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.rpc("add_notice", {
      p_user: to,
      p_kind: kind,
      p_course: (opts.courseId ?? "").trim() || null,
      p_note: noteOf(opts.note),
    });
    if (error) {
      console.error("お知らせを残せません:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("お知らせを残せません:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** 何人かにまとめて残す。1人が失敗しても、ほかは残す */
export async function addNotices(
  userIds: (string | null | undefined)[],
  kind: NoticeKind,
  opts: { courseId?: string | null; note?: string | null } = {},
): Promise<number> {
  const ids = [...new Set(userIds.map((u) => (u ?? "").trim()).filter(Boolean))];
  const done = await Promise.all(ids.map((u) => addNotice(u, kind, opts)));
  return done.filter(Boolean).length;
}
