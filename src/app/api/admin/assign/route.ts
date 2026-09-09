import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { findCourse } from "@/content/courses";
import { addNotice } from "@/lib/notice.server";
import { normalizeJoinCode } from "@/training/joinCode";
import { heldCourseIds } from "@/lib/held";

/* 席を、教育担当者が直接配る（受講コードを打たせない）。

   誰に受けさせるかが決まっているとき、12文字を口頭やLINEで伝えて
   打ち込ませるのは、要らない手間で、間違いのもとになる。
   打ち間違えれば「開かない」と言われて、担当者がもう一度調べることになる。

   **受講コードの方式は残してある。** その場に居ない人、まだ名簿に
   入っていない人には、コードを渡すしかない。画面が動かないときの
   逃げ道にもなる。

   ここで受け取るのは「誰に」「どの講座を」の2つだけ。
   **会社は画面から受け取らない**（ログインしている担当者の会社を使う）。
   受け取ると、よその会社の席を配れてしまう。

   在籍しているか・二重に渡していないか・空きがあるかは
   assign_seat（0028）が見る。画面の出し分けではなく、ここを通さないと渡らない。 */

/** code は任意。受講コードの一覧の「配る」から来たときだけ入る（0031）。
    入っていれば**そのコード**が渡る。入っていなければ空いているものから自動 */
type Body = { userId?: unknown; courseId?: unknown; code?: unknown };

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの操作です。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const userId = typeof b.userId === "string" ? b.userId.trim() : "";
  const courseId = typeof b.courseId === "string" ? b.courseId.trim() : "";
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "誰に配るかが分かりません。" }, { status: 400 });
  }
  if (!courseId || !findCourse(courseId)) {
    return NextResponse.json({ ok: false, reason: "どの講座か分かりません。" }, { status: 400 });
  }

  /* **取得済みの資格には配れない**（げんきさん 2026-09-09）。
     修了証が出ている講座は assign_seat も断るが、よそで取った資格
     （本人がマイページで入れたもの）は講座との対応が画面側にしか無い。
     画面は「配る」の相手から外しているが、ここを通さないと渡らない */
  const held = (await heldCourseIds(supabase, [userId])).get(userId) ?? [];
  if (held.includes(courseId)) {
    return NextResponse.json(
      { ok: false, reason: `その人は、${findCourse(courseId)?.short ?? "この講座"}を取得済みです。取得済みの資格に受講コードは配れません。` },
      { status: 409 },
    );
  }

  /* 打ち方の揺れ（ハイフン・小文字・空白）をそろえてから渡す。
     一覧の「配る」からは整った形で来るが、手で打つ道も残す */
  const code = typeof b.code === "string" ? normalizeJoinCode(b.code) : "";

  const { data, error } = await supabase.rpc("assign_seat", {
    p_company: admin.companyId,
    p_user: userId,
    p_course: courseId,
    p_admin: admin.userId,
    p_code: code || null,
  });
  if (error) {
    /* 断る理由は、そのまま画面に出す。「その講座の、空いている席がありません」
       「もうこの講座の席が渡っています」など、次にやることが分かる文になっている */
    return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
  }
  /* **受け取った本人に知らせる。**配られたことは、本人が開くまで分からない。
     知らせを押すと、その講座がそのまま開く（コードは打たない） */
  await addNotice(userId, "given", { courseId });

  /* 配った席のコードを返す。画面に出しておけば、
     あとから「どの席を渡したか」を口頭でも確かめられる */
  return NextResponse.json({ ok: true, code: typeof data === "string" ? data : null });
}
