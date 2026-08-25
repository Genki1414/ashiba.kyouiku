import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";

/* 受講の準備（同意・顔登録・書類・受講者情報）の記録。
   顔写真そのものは受け取らない。日時と氏名だけ。 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }
  const { courseId, consented, faceRegistered, idDocument, name, birth } = body as {
    courseId?: string;
    consented?: boolean;
    faceRegistered?: boolean;
    idDocument?: boolean;
    name?: string;
    birth?: string;
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

  if (typeof name === "string" && name.trim()) {
    const { data: enr } = await supabase
      .from("enrollments")
      .select("user_id")
      .eq("id", enrollmentId)
      .single();
    if (enr) {
      const userPatch: Record<string, string> = { name: name.trim() };
      const d = birth ? Date.parse(birth) : NaN;
      if (!Number.isNaN(d)) userPatch.birth_date = new Date(d).toISOString().slice(0, 10);
      await supabase.from("users").update(userPatch).eq("id", enr.user_id);
    }
  }
  return NextResponse.json({ mode: "supabase" });
}
