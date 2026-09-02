import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";

/* 受講の準備（同意・顔登録・書類）の記録。日時だけ。

   ── 氏名と生年月日は、ここでは受け取らない ──
   前は受け取って users 表を書き換えていた。
   つまり**講座の画面から、マイページの氏名を上書きできた。**
   受講のたびに入力させる作りだったので、端末を替えるたびに
   入れ直しになり、入れ直した値がマイページを上書きしていた。

   氏名と生年月日の入り口はマイページの1か所だけ（/api/mypage）。
   ここは、その事実に触らない。 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }
  const { courseId, consented, faceRegistered, idDocument } = body as {
    courseId?: string;
    consented?: boolean;
    faceRegistered?: boolean;
    idDocument?: boolean;
  };


  const supabase = getServiceClient();
  const who = await currentEnrollment(typeof courseId === "string" ? courseId : "");
  const enrollmentId = who?.enrollmentId ?? null;
  if (!supabase || !enrollmentId) {
    return NextResponse.json({ mode: "local" });
  }

  const now = new Date().toISOString();
  const patch: Record<string, string> = {};
  if (consented) patch.consented_at = now;
  if (faceRegistered) patch.face_registered_at = now;
  if (idDocument) patch.id_document_at = now;
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("enrollments").update(patch).eq("id", enrollmentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mode: "supabase" });
}
