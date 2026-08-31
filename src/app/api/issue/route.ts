import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";
import { getCurriculum } from "@/lib/curriculum";
import { canRequest, gateReason, nextAction, type StudyDone } from "@/lib/issue";
import { requestOf, slotsOf, toState } from "@/lib/issueQuery";
import { findCourse, gateOf, GATE_TEXT } from "@/content/courses";
import { TALK_SUBJECT } from "@/content/shokucho";
import { notify } from "@/lib/notify.server";

/* 修了証の発行申請（受講する人の側）。

   GET  … いまの状態。申請できるか、候補日が来ているか
   POST … 申請を出す／候補日を選ぶ

   ── なぜ申請を挟むか ──
   学科のあとに討議や実技が残る講座で、条件を満たした瞬間に紙を出すと、
   **まだ修了していない人に修了証が出る**。
   学科を終えた人に申請を出してもらい、こちらが討議の候補日を返す。

   日を決めるのはこちら。候補日を本人に作らせない。
   作らせると、講師の都合と関係なく日が入る。 */

async function study(courseId: string, enrollmentId: string): Promise<StudyDone> {
  const supabase = getServiceClient()!;
  const cur = await getCurriculum(courseId);
  const lessons = cur ? cur.subjects.reduce((n, s) => n + s.lessons.length, 0) : 0;

  const { data: prog } = await supabase
    .from("progress")
    .select("lesson_id, quiz_passed_at")
    .eq("enrollment_id", enrollmentId);
  const { data: exam } = await supabase
    .from("exams")
    .select("passed")
    .eq("enrollment_id", enrollmentId)
    .eq("passed", true)
    .limit(1)
    .maybeSingle();

  return {
    lessons,
    lessonsPassed: (prog ?? []).filter((p) => p.quiz_passed_at).length,
    examPassed: !!exam,
  };
}

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const courseId = (req.nextUrl.searchParams.get("courseId") ?? "").trim();
  const course = findCourse(courseId);
  if (!course) {
    return NextResponse.json({ ok: false, reason: "その講座はありません。" }, { status: 404 });
  }
  const gate = gateOf(course);
  if (!gate) {
    /* 関門の無い講座。学科だけで修了するので、申請は要らない */
    return NextResponse.json({ ok: true, gate: null });
  }
  const who = supabase ? await currentEnrollment(courseId) : null;
  if (!supabase || !who) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 401 });
  }

  const [s, row] = await Promise.all([study(courseId, who.enrollmentId), requestOf(supabase, who.enrollmentId)]);
  const slots = row ? await slotsOf(supabase, row.id) : [];
  const st = row ? toState(row, slots) : null;
  const can = canRequest(s);

  return NextResponse.json({
    ok: true,
    gate,
    gateText: GATE_TEXT[gate],
    /* 学科が終わっているか。終わるまで申請の口は開けない */
    study: { ...s, can: can.ok, why: can.ok ? "" : can.reason },
    status: st?.status ?? "none",
    slots: st?.slots ?? [],
    note: st?.note ?? "",
    replyNote: st?.replyNote ?? "",
    drillOn: st?.drillOn ?? null,
    drillBy: st?.drillBy ?? "",
    sessionId: row?.sessionId ?? null,
    reason: gateReason(gate, st),
    next: nextAction(gate, st),
  });
}

type Body =
  | { action: "request"; courseId: string; note?: string; drillOn?: string; drillBy?: string }
  | { action: "pick"; courseId: string; slotId: string };

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const b = (await req.json().catch(() => ({}))) as Partial<Body>;
  const course = findCourse((b.courseId ?? "").trim());
  if (!course) {
    return NextResponse.json({ ok: false, reason: "その講座はありません。" }, { status: 404 });
  }
  const gate = gateOf(course);
  if (!gate) {
    return NextResponse.json(
      { ok: false, reason: "この講座に発行申請は要りません。条件を満たせばそのまま出せます。" },
      { status: 400 },
    );
  }
  const who = supabase ? await currentEnrollment(course.id) : null;
  if (!supabase || !who) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 401 });
  }

  if (b.action === "request") {
    /* 学科が終わっていない人の申請は受けない。
       受けると、候補日を出したあとに学科が終わらないまま宙に浮く */
    const can = canRequest(await study(course.id, who.enrollmentId));
    if (!can.ok) return NextResponse.json({ ok: false, reason: can.reason }, { status: 409 });

    /* 実技のある講座は、事業者で実技を済ませてから申請してもらう。
       実施日と実施者を控える（あとから「やったのか」を示せるように） */
    let drillOn: string | null = null;
    if (gate === "drill") {
      const t = Date.parse(b.drillOn ?? "");
      if (!Number.isFinite(t)) {
        return NextResponse.json(
          { ok: false, reason: "実技を行った日を入れてください。" },
          { status: 400 },
        );
      }
      if (t > Date.now()) {
        return NextResponse.json(
          { ok: false, reason: "実技の日が先の日付になっています。" },
          { status: 400 },
        );
      }
      drillOn = new Date(t).toISOString().slice(0, 10);
      if (!(b.drillBy ?? "").trim()) {
        return NextResponse.json(
          { ok: false, reason: "実技を行った人の名前を入れてください。" },
          { status: 400 },
        );
      }
    }

    const { error } = await supabase.rpc("request_cert", {
      p_enrollment: who.enrollmentId,
      p_user: who.userId,
      p_course: course.id,
      p_kind: gate,
      p_subject: TALK_SUBJECT,
      p_note: (b.note ?? "").trim().slice(0, 1000),
      p_drill_on: drillOn,
      p_drill_by: (b.drillBy ?? "").trim().slice(0, 100),
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
    /* 運営に知らせる。候補日を出すまで、この人は先へ進めない */
    await notify("cert");
    return NextResponse.json({ ok: true });
  }

  if (b.action === "pick") {
    const slotId = (b.slotId ?? "").trim();
    if (!slotId) {
      return NextResponse.json({ ok: false, reason: "どの日か分かりません。" }, { status: 400 });
    }
    /* 自分の申請かどうかは、データベース側でも見る。
       ここだけで見ると、別の人の候補日を選べてしまう */
    const { error } = await supabase.rpc("pick_slot", { p_slot: slotId, p_user: who.userId });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, reason: "その操作は分かりません。" }, { status: 400 });
}
