import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";
import { getCurriculum } from "@/lib/curriculum";
import { eligible } from "@/lib/cert";
import { issuerName, issuerResponsible } from "@/lib/issuer";
import { gateReason } from "@/lib/issue";
import { requestOf, slotsOf, toState } from "@/lib/issueQuery";
import { myLive, doneOf, mySessions } from "@/lib/liveQuery";
import {
  findCourse,
  gateOf,
  kindOf,
  lawVersionOf,
  totalNoteOf,
  type CourseKind,
} from "@/content/courses";

/* 修了証。
   GET  … 出せるかどうかと、載せる中身を返す
   POST … 証明番号を記録して発行する（1受講に1枚）

   出せるかどうかの判断はサーバで行う。
   クライアントの言い分で修了証を出さないため。 */

type Body = { name?: string; birth?: string; courseId?: string };

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
      course: {
        id: string;
        name: string;
        basis: string;
        kind: CourseKind;
        totalNote: string;
        totalMin: number;
        lawVersion: string;
      };
      issuedAt: Date;
      no: string;
      already: string | null;
      /** もう出してある紙に焼き付いている中身。空なら 0026 より前に出した紙 */
      snap: Snapshot | null;
    };

/** 出した時点の中身。**あとから教材を直しても、ここは書き換えない**
    （migrations/0026）。修了証の再表示も照会も、これを使う */
type Snapshot = {
  courseName: string;
  basis: string;
  totalMin: number;
  lawVersion: string;
  subjects: { id: number; name: string; min: number }[];
};

async function gather(courseId: string): Promise<Gathered> {
  const course = findCourse(courseId);
  const cur = course ? await getCurriculum(courseId) : null;
  if (!course || !cur) {
    return { ok: false, status: 404, reason: "その講座はありません。" };
  }
  /* 修了証に載せるのは**法定時間**。

     各自で見るぶん（legal_min）だけを載せると、討議のある講座で
     時間が足りない紙が出る。職長教育は 795分 + 討議45分 = 840分（14時間）。
     討議を落とすと「13時間15分」と書いた修了証になり、
     法定時間を満たしていない証明書を出すことになる。 */
  const subjects = cur.subjects.map((s) => ({
    id: s.id,
    name: s.name,
    min: s.legal_min + (s.talk_min ?? 0),
  }));
  const lessons = cur.subjects.reduce((n, s) => n + s.lessons.length, 0);

  const supabase = getServiceClient();
  const who = await currentEnrollment(courseId);
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

  /* 学科のあとに残る関門（討議・実技）。
     ここを見ないと、討議が済んでいない人に職長教育の修了証が出る。 */
  const gate = gateOf(course);
  let gateBlock: { reason: string } | null = null;
  if (gate) {
    const row = await requestOf(supabase, who.enrollmentId);
    let st = row ? toState(row, await slotsOf(supabase, row.id)) : null;

    /* 討議の日が決まっている人は、済んだかどうかをその場で見る。
       時間・課題への回答・講師の確認の3つがそろっていれば通す。
       本部がボタンを押すまで修了にならない作りにすると、
       押し忘れた人がいつまでも修了できない。
       講師の確認（teacher_ok）は judgeTalk の中で見ている。 */
    if (row && row.status === "picked" && row.sessionId) {
      const [ses] = await mySessions(supabase, [row.sessionId]);
      const mine = await myLive(supabase, who.userId);
      const m = ses ? mine.get(ses.id) : null;
      if (ses && m && doneOf(m, ses.minutes).ok) {
        await supabase.rpc("clear_request", { p_request: row.id, p_note: "", p_by: "" });
        st = st ? { ...st, status: "cleared" } : st;
      }
    }
    const reason = gateReason(gate, st);
    if (reason) gateBlock = { reason };
  }

  const v = eligible({ lessons, lessonsPassed, examPassed: !!exam, gate: gateBlock });
  if (!v.ok) return { ok: false, status: 409, reason: v.reason };

  const { data: user } = await supabase
    .from("users")
    .select("name, birth_date")
    .eq("id", who.userId)
    .maybeSingle();

  const { data: cert } = await supabase
    .from("certificates")
    .select("cert_no, issued_at, course_name, basis, total_min, subjects, law_version")
    .eq("enrollment_id", who.enrollmentId)
    .is("revoked_at", null)
    .maybeSingle();

  const issuedAt = cert?.issued_at ? new Date(cert.issued_at as string) : new Date();

  /* 出した紙に中身が焼き付いていれば、それを使う。
     **法令が変わって講座を直しても、前に出した紙は変わらない。**
     0026 より前に出した紙は空なので、そのときだけ今の教材で補う */
  const snap: Snapshot | null = cert?.course_name
    ? {
        courseName: cert.course_name as string,
        basis: (cert.basis as string) ?? course.basis,
        totalMin: (cert.total_min as number) ?? course.totalMin,
        lawVersion: (cert.law_version as string) ?? "",
        subjects: Array.isArray(cert.subjects)
          ? (cert.subjects as { id: number; name: string; min: number }[])
          : subjects,
      }
    : null;
  /* 番号は発行するまで決まらない（データベースで採る）。
     先に見せてしまうと、出したものと違う番号を見せることになる */
  return {
    ok: true,
    enrollmentId: who.enrollmentId,
    userId: who.userId,
    name: (user?.name as string) ?? "",
    birth: (user?.birth_date as string) ?? "",
    exam: { score: (exam?.score as number) ?? 0, total: (exam?.total as number) ?? 0 },
    subjects: snap ? snap.subjects : subjects,
    course: {
      id: course.id,
      name: snap ? snap.courseName : course.name,
      basis: snap ? snap.basis : course.basis,
      kind: kindOf(course),
      /* 討議のある講座に「（学科）」と書くと嘘になる */
      totalNote: totalNoteOf(course),
      totalMin: snap ? snap.totalMin : course.totalMin,
      lawVersion: snap ? snap.lawVersion : lawVersionOf(course),
    },
    issuedAt,
    no: (cert?.cert_no as string) ?? "",
    already: (cert?.cert_no as string) ?? null,
    snap,
  };
}

export async function GET(req: NextRequest) {
  const r = await gather(req.nextUrl.searchParams.get("courseId") ?? "");
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
    /* 修了証には、どの特別教育かを載せる。講座は増えていく。
       もう出してある紙は、出したときの中身をそのまま返す */
    course: r.course,
    /* 出した紙に中身が焼き付いているか。
       false で issued なら、0026 より前に出した紙（画面に断りを出す） */
    snapshot: !!r.snap,
    /* 名義は決まっている。教育を実施したのは東北三上機材。
       受講者がどの会社の人かは、名簿の分け方であって名義ではない */
    company: issuerName(),
    responsible: issuerResponsible(),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const r = await gather(typeof body.courseId === "string" ? body.courseId : "");
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

  /* **出した瞬間の中身を焼き付ける**（migrations/0026）。
     ここを入れないと、法令が変わって講座を直した日に、
     前に出した修了証の中身まで変わってしまう */
  const { error } = await supabase.from("certificates").insert({
    enrollment_id: r.enrollmentId,
    cert_no: no,
    course_id: r.course.id,
    course_name: r.course.name,
    basis: r.course.basis,
    total_min: r.course.totalMin,
    subjects: r.subjects,
    law_version: r.course.lawVersion,
  });
  if (error) {
    /* 入金前などで断られた場合。理由をそのまま伝える */
    return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
  }
  return NextResponse.json({ ok: true, issued: true, certNo: no });
}
