import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";

/* 照合ログ。失敗（ng）だけを記録する。画像は受け取らない・保存しない。 */

const REASONS = ["no_face", "multi_face", "blocked", "no_motion"] as const;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const lessonId = typeof body?.lessonId === "string" ? body.lessonId : null;
  const reason = REASONS.includes(body?.reason) ? (body.reason as (typeof REASONS)[number]) : null;
  if (!lessonId || !reason) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const who = await currentEnrollment();
  const enrollmentId = who?.enrollmentId ?? null;
  if (!supabase || !enrollmentId) {
    return NextResponse.json({ mode: "local" });
  }
  const { error } = await supabase.from("verify_logs").insert({
    enrollment_id: enrollmentId,
    lesson_id: lessonId,
    result: "ng",
    reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mode: "supabase" });
}
