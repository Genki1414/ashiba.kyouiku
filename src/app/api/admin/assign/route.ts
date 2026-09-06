import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { findCourse } from "@/content/courses";

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

type Body = { userId?: unknown; courseId?: unknown };

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

  const { data, error } = await supabase.rpc("assign_seat", {
    p_company: admin.companyId,
    p_user: userId,
    p_course: courseId,
    p_admin: admin.userId,
  });
  if (error) {
    /* 断る理由は、そのまま画面に出す。「その講座の、空いている席がありません」
       「もうこの講座の席が渡っています」など、次にやることが分かる文になっている */
    return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
  }
  /* 配った席のコードを返す。画面に出しておけば、
     あとから「どの席を渡したか」を口頭でも確かめられる */
  return NextResponse.json({ ok: true, code: typeof data === "string" ? data : null });
}
