import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";
import { TRAINING_COURSE } from "@/content/courses";
import { CHAPTERS } from "@/training/chapters";

/* 通し見学を見たことの記録。

   点は付かないが、担当者が見たいのは「この人を現場に出せるか」で、
   手順を最後まで見たかどうかは、点が付く前の段階として要る。
   だから成績（training_attempts）とは別に残す。

   開いたときに done=false、最後まで見たときに done=true で呼ぶ。
   Supabase が未設定・圏外なら mode:"local" を返し、画面は端末だけで進む。 */

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const who = supabase ? await currentEnrollment(TRAINING_COURSE) : null;
  if (!supabase || !who) {
    return NextResponse.json({ ok: true, mode: "local" });
  }

  const b = (await req.json().catch(() => ({}))) as { chapter?: string; done?: boolean };
  const chapter = CHAPTERS.find((c) => c.id === b.chapter)?.id;
  if (!chapter) {
    return NextResponse.json({ ok: false, reason: "章が分かりません。" }, { status: 400 });
  }

  const { error } = await supabase.rpc("see_demo", {
    p_enrollment: who.enrollmentId,
    p_chapter: chapter,
    p_done: b.done === true,
  });
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, mode: "supabase" });
}
