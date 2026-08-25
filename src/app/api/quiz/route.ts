import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";
import { getLesson } from "@/lib/curriculum";
import { lessonKey } from "@/content/courses";

/* 確認問題の合格記録。
   規定時間（legal_min）に達しているかは DB の mark_quiz_passed() が最終判定する。 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const courseId = typeof body?.courseId === "string" ? body.courseId : "";
  const lessonId = typeof body?.lessonId === "string" ? body.lessonId : null;
  if (!lessonId || !(await getLesson(courseId, lessonId))) {
    return NextResponse.json({ error: "単元が見つかりません" }, { status: 404 });
  }

  const supabase = getServiceClient();
  const who = await currentEnrollment(courseId);
  const enrollmentId = who?.enrollmentId ?? null;
  if (!supabase || !enrollmentId) {
    return NextResponse.json({ mode: "local" });
  }

  const { data, error } = await supabase.rpc("mark_quiz_passed", {
    p_enrollment_id: enrollmentId,
    p_lesson_id: lessonKey(courseId, lessonId),
  });
  if (error) {
    // 規定時間未達などの業務エラーは 409 で返す
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return NextResponse.json({ mode: "supabase", quizPassedAt: data as string });
}
