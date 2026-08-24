import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";
import { getCurriculum } from "@/lib/curriculum";
import { eligible } from "@/lib/cert";
import { issuerName, issuerResponsible } from "@/lib/issuer";

/* 修了証。
   GET  … 出せるかどうかと、載せる中身を返す
   POST … 証明番号を記録して発行する（1受講に1枚）

   出せるかどうかの判断はサーバで行う。
   クライアントの言い分で修了証を出さないため。 */

type Body = { name?: string; birth?: string };

type Gathered =
  | { ok: false; status: number; reason: string }
  | {
      ok: true;
      enrollmentId: string;
      userId: string;
      name: string;
      birth: string;
      exam: { score: number; total: number };
      subjects: { id: number; name: string; min: number }[];
      issuedAt: Date;
      no: string;
      already: string | null;
    };

async function gather(): Promise<Gathered> {
  const cur = await getCurriculum();
  const subjects = cur.subjects.map((s) => ({
    id: s.id,
    name: s.name,
    min: s.lessons.reduce((n, l) => n + l.legal_min, 0),
  }));
  const lessons = cur.subjects.reduce((n, s) => n + s.lessons.length, 0);

  const supabase = getServiceClient();
  const who = await currentEnrollment();
  if (!supabase || !who) {
    return {
      ok: false,
      status: 409,
      reason: "記録の置き場所がまだ用意されていません。修了証は発行できません。",
    };
  }

  const { data: prog } = await supabase
    .from("progress")
    .select("lesson_id, quiz_passed_at")
    .eq("enrollment_id", who.enrollmentId);
  const lessonsPassed = (prog ?? []).filter((p) => p.quiz_passed_at).length;

  const { data: exam } = await supabase
    .from("exams")
    .select("score, total, passed")
    .eq("enrollment_id", who.enrollmentId)
    .eq("passed", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const v = eligible({ lessons, lessonsPassed, examPassed: !!exam });
  if (!v.ok) return { ok: false, status: 409, reason: v.reason };

  const { data: user } = await supabase
    .from("users")
    .select("name, birth_date")
    .eq("id", who.userId)
    .maybeSingle();

  const { data: cert } = await supabase
    .from("certificates")
    .select("cert_no, issued_at")
    .eq("enrollment_id", who.enrollmentId)
    .is("revoked_at", null)
    .maybeSingle();

  const issuedAt = cert?.issued_at ? new Date(cert.issued_at as string) : new Date();
  /* 番号は発行するまで決まらない（データベースで採る）。
     先に見せてしまうと、出したものと違う番号を見せることになる */
  return {
    ok: true,
    enrollmentId: who.enrollmentId,
    userId: who.userId,
    name: (user?.name as string) ?? "",
    birth: (user?.birth_date as string) ?? "",
    exam: { score: (exam?.score as number) ?? 0, total: (exam?.total as number) ?? 0 },
    subjects,
    issuedAt,
    no: (cert?.cert_no as string) ?? "",
    already: (cert?.cert_no as string) ?? null,
  };
}

export async function GET() {
  const r = await gather();
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: r.status });
  return NextResponse.json({
    ok: true,
    issued: !!r.already,
    certNo: r.no,
    name: r.name,
    birth: r.birth,
    date: r.issuedAt.toISOString(),
    exam: r.exam,
    subjects: r.subjects,
    /* 名義は決まっている。教育を実施したのは東北三上機材。
       受講者がどの会社の人かは、名簿の分け方であって名義ではない */
    company: issuerName(),
    responsible: issuerResponsible(),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const r = await gather();
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: r.status });

  const supabase = getServiceClient()!;

  /* 氏名・生年月日をこの場で直せるようにしておく
     （登録のときに仮の名前で入っていることがあるため） */
  const patch: Record<string, string> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  const d = body.birth ? Date.parse(body.birth) : NaN;
  if (!Number.isNaN(d)) patch.birth_date = new Date(d).toISOString().slice(0, 10);
  if (Object.keys(patch).length && r.userId) {
    await supabase.from("users").update(patch).eq("id", r.userId);
  }

  if (r.already) {
    return NextResponse.json({ ok: true, issued: true, certNo: r.already });
  }

  /* 番号はデータベースで採る。ぶつからないように通し番号にしてある */
  const { data: no, error: noErr } = await supabase.rpc("next_cert_no");
  if (noErr || typeof no !== "string") {
    return NextResponse.json(
      { ok: false, reason: "証明番号を採れませんでした。apply-all.sql を流し直してください。" },
      { status: 500 },
    );
  }

  const { error } = await supabase
    .from("certificates")
    .insert({ enrollment_id: r.enrollmentId, cert_no: no });
  if (error) {
    /* 入金前などで断られた場合。理由をそのまま伝える */
    return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
  }
  return NextResponse.json({ ok: true, issued: true, certNo: no });
}
