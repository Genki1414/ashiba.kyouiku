import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getDevEnrollmentId } from "@/lib/supabase/server";
import { getLesson } from "@/lib/curriculum";

/* 確認問題の合格記録。
   規定時間（legal_min）に達しているかは DB の mark_quiz_passed() が最終判定する。 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const lessonId = typeof body?.lessonId === "string" ? body.lessonId : null;
  if (!lessonId || !(await getLesson(lessonId))) {
    return NextResponse.json({ error: "単元が見つかりません" }, { status: 404 });
  }

  const supabase = getServiceClient();
  const enrollmentId = getDevEnrollmentId();
  if (!supabase || !enrollmentId) {
    return NextResponse.json({ mode: "local" });
  }

  const { data, error } = await supabase.rpc("mark_quiz_passed", {
    p_enrollment_id: enrollmentId,
    p_lesson_id: lessonId,
  });
  if (error) {
    // 規定時間未達などの業務エラーは 409 で返す
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return NextResponse.json({ mode: "supabase", quizPassedAt: data as string });
}
