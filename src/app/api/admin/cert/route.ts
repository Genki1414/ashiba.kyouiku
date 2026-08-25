import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { getCurriculum } from "@/lib/curriculum";
import { eligible } from "@/lib/cert";

/* 教育担当者が修了証を出す／取り消す。

   出せるかどうかの判断はここでもう一度やる。画面の言い分では出さない。
   取り消しは行を消さず revoked_at を立てる（出した記録は残す）。 */

type Body = { enrollmentId?: string; action?: "issue" | "revoke" };

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの操作です。" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const id = (body.enrollmentId ?? "").trim();
  const action = body.action === "revoke" ? "revoke" : "issue";
  if (!id) {
    return NextResponse.json({ ok: false, reason: "受講が指定されていません。" }, { status: 400 });
  }

  /* その受講が自社のものか。ここを飛ばすと他社の修了証を出せてしまう。

     見るのは「受けた人がいまどこに居るか」ではなく、
     **どの会社の席で受けたか**（enrollments.company_id）。
     人の側で見ると、
       ・辞めた人の修了証を、受けさせた会社が出せなくなる（取り消しも）
       ・よそへ移った人の記録を、移った先の会社が触れてしまう
     どちらも困る。修了証はその教育を行った事業者の名義で出るもの。 */
  const { data: en } = await supabase
    .from("enrollments")
    .select("id, user_id, course_id, company_id")
    .eq("id", id)
    .maybeSingle();

  /* 0012 より前の受講で、会社が入っていないものだけ、人の側で見る（受け皿） */
  let ownerCompany = (en?.company_id as string | null) ?? null;
  if (en && !ownerCompany) {
    const { data: owner } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", en.user_id as string)
      .maybeSingle();
    ownerCompany = (owner?.company_id as string | null) ?? null;
  }
  if (!en || ownerCompany !== admin.companyId) {
    return NextResponse.json({ ok: false, reason: "自社の受講者ではありません。" }, { status: 403 });
  }

  if (action === "revoke") {
    const { error } = await supabase
      .from("certificates")
      .update({ revoked_at: new Date().toISOString() })
      .eq("enrollment_id", id)
      .is("revoked_at", null);
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, revoked: true });
  }

  /* すでに有効な1枚があれば、それを返して終わり */
  const { data: already } = await supabase
    .from("certificates")
    .select("cert_no")
    .eq("enrollment_id", id)
    .is("revoked_at", null)
    .maybeSingle();
  if (already?.cert_no) {
    return NextResponse.json({ ok: true, certNo: already.cert_no as string, issued: true });
  }

  /* どの講座の受講かは、受講の行が持っている（上で読んである） */
  const cur = await getCurriculum((en.course_id as string) ?? "");
  if (!cur) {
    return NextResponse.json({ ok: false, reason: "講座が分かりません。" }, { status: 409 });
  }
  const lessons = cur.subjects.reduce((n, s) => n + s.lessons.length, 0);

  const { data: prog } = await supabase
    .from("progress")
    .select("quiz_passed_at")
    .eq("enrollment_id", id);
  const lessonsPassed = (prog ?? []).filter((p) => p.quiz_passed_at).length;

  const { data: exam } = await supabase
    .from("exams")
    .select("id")
    .eq("enrollment_id", id)
    .eq("passed", true)
    .limit(1)
    .maybeSingle();

  const v = eligible({ lessons, lessonsPassed, examPassed: !!exam });
  if (!v.ok) return NextResponse.json({ ok: false, reason: v.reason }, { status: 409 });

  /* 番号はデータベースで採る。ぶつからないように通し番号にしてある */
  const { data: no, error: noErr } = await supabase.rpc("next_cert_no");
  if (noErr || typeof no !== "string") {
    return NextResponse.json(
      { ok: false, reason: "証明番号を採れませんでした。apply-all.sql を流し直してください。" },
      { status: 500 },
    );
  }
  const { error } = await supabase.from("certificates").insert({
    enrollment_id: id,
    cert_no: no,
    issued_at: new Date().toISOString(),
    issued_by: admin.userId,
  });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
  return NextResponse.json({ ok: true, certNo: no, issued: true });
}
