import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { findCourse } from "@/content/courses";

/* 受講リクエスト。本人が「この講座を受けたい」を教育担当者に送る。

   席（受講コード）は担当者が用意する。ここは、それを頼む声を
   画面に残すだけ。自分のぶんしか触らない。会社の番号も
   画面から受け取らない（いま在籍している会社に、DB側で決める）。 */

type Body = { courseId?: string; action?: "request" | "cancel" };

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const courseId = typeof b.courseId === "string" ? b.courseId.trim() : "";
  if (!courseId || !findCourse(courseId)) {
    return NextResponse.json({ ok: false, reason: "どの講座か分かりません。" }, { status: 400 });
  }

  if (b.action === "cancel") {
    const { error } = await supabase.rpc("cancel_course_request", {
      p_user: user.id,
      p_course: courseId,
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.rpc("request_course", {
    p_user: user.id,
    p_course: courseId,
  });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
