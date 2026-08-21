import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getDevEnrollmentId } from "@/lib/supabase/server";
import { getLesson } from "@/lib/curriculum";

/* 視聴時間の同期。
   クライアントは「前回同期からの再生秒数」を送るだけで、
   実際の加算は DB の sync_watched_sec()（実経過＋2秒で頭打ち）が決める。
   Supabase 未設定のあいだは mode:"local" を返し、記録は端末内に置く。 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const lessonId = typeof body?.lessonId === "string" ? body.lessonId : null;
  const deltaSec = Number.isInteger(body?.deltaSec) ? (body.deltaSec as number) : null;
  if (!lessonId || deltaSec === null || deltaSec < 0 || deltaSec > 300) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }
  if (!(await getLesson(lessonId))) {
    return NextResponse.json({ error: "単元が見つかりません" }, { status: 404 });
  }

  const supabase = getServiceClient();
  const enrollmentId = getDevEnrollmentId();
  if (!supabase || !enrollmentId) {
    return NextResponse.json({ mode: "local" });
  }

  const { data, error } = await supabase.rpc("sync_watched_sec", {
    p_enrollment_id: enrollmentId,
    p_lesson_id: lessonId,
    p_delta_sec: deltaSec,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ mode: "supabase", watchedSec: data as number });
}

export async function GET(req: NextRequest) {
  const lessonId = req.nextUrl.searchParams.get("lessonId");
  if (!lessonId) return NextResponse.json({ error: "lessonId が必要です" }, { status: 400 });

  const supabase = getServiceClient();
  const enrollmentId = getDevEnrollmentId();
  if (!supabase || !enrollmentId) {
    return NextResponse.json({ mode: "local" });
  }

  // 進捗行をここで作る（updated_at が「単元を開いた時刻」になり、
  // 最初の同期でも開いてからの実経過ぶんが正しく加算される）
  const { data, error } = await supabase.rpc("touch_progress", {
    p_enrollment_id: enrollmentId,
    p_lesson_id: lessonId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    mode: "supabase",
    watchedSec: data?.watched_sec ?? 0,
    quizPassedAt: data?.quiz_passed_at ?? null,
  });
}
