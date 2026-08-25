import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";

/* 照合ログ。画像は受け取らない・保存しない。

   外れたとき（ng）と、通っていることの控え（ok）を記録する。
   ok を残さないと「外れた記録が無い＝ちゃんと受けた」なのか
   「そもそも見ていなかった」のか区別が付かない。
   監督署や元請に出すのはこの記録なので、通った証も要る。
   ok は5分に1回だけ（毎回だと6時間で7200行になる）。 */

const REASONS = ["no_face", "multi_face", "blocked", "no_motion", "not_me"] as const;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const lessonId = typeof body?.lessonId === "string" ? body.lessonId : null;
  const reason = REASONS.includes(body?.reason) ? (body.reason as (typeof REASONS)[number]) : null;
  const ok = body?.ok === true;
  /* ng なら理由が要る（0001 の決まり）。ok なら理由は付けない */
  if (!lessonId || (!ok && !reason)) {
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
    result: ok ? "ok" : "ng",
    reason: ok ? null : reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mode: "supabase" });
}
