import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { currentAdmin } from "@/lib/admin";
import { currentOwner } from "@/lib/owner";
import { myCompany } from "@/lib/tenant";
import { openSessions, myLive, minOf, doneOf } from "@/lib/liveQuery";
import { SHOKUCHO } from "@/content/shokucho";
import { findCourse, needsLive } from "@/content/courses";
import { TALK_MAX } from "@/lib/hours";

/* 討議の回。

   申し込む・入る・出るは、すべてサーバで立てる。
   画面から「何分居た」を送らせない。送らせると、
   繋がずに時間だけ積んで修了できてしまう。 */

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 401 });
  }
  const courseId = (req.nextUrl.searchParams.get("courseId") ?? "").trim();
  const course = findCourse(courseId);
  if (!course || !needsLive(course)) {
    return NextResponse.json({ ok: false, reason: "討議のある講座ではありません。" }, { status: 400 });
  }

  const co = await myCompany();
  const [sessions, mine] = await Promise.all([
    openSessions(supabase, course.id, co?.id ?? null),
    myLive(supabase, user.id),
  ]);

  const now = new Date();
  return NextResponse.json({
    ok: true,
    course: { id: course.id, name: course.name, short: course.short },
    max: TALK_MAX,
    /* 科目の名前と、その科目に要る討議の時間 */
    subjects: SHOKUCHO.map((s) => ({ id: s.id, name: s.name, need: s.plan.talk, question: s.talkQuestion })),
    sessions: sessions.map((s) => {
      const m = mine.get(s.id);
      const d = m ? doneOf(m, s.minutes, now) : null;
      return {
        ...s,
        /* 満席かどうかは、こちらで決める。画面の数を信じない */
        full: s.booked >= s.capacity,
        mine: !!m,
        min: m ? minOf(m, now) : 0,
        answered: !!m?.answer?.trim(),
        teacherOk: m?.teacherOk === true,
        done: d?.ok === true,
        why: d && !d.ok ? d.why : null,
      };
    }),
  });
}

type Body =
  | { action: "book"; sessionId: string }
  | { action: "in" | "out"; sessionId: string }
  | { action: "answer"; sessionId: string; answer: string };

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as Partial<Body>;
  const id = (b.sessionId ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, reason: "回が分かりません。" }, { status: 400 });
  }

  /* その回に入ってよい人か。よその会社の回には入れない
     （討議の中身が、その会社の外に出る） */
  const { data: ses } = await supabase
    .from("live_sessions")
    .select("id, company_id, closed_at")
    .eq("id", id)
    .maybeSingle();
  if (!ses || ses.closed_at) {
    return NextResponse.json({ ok: false, reason: "その回はありません。" }, { status: 404 });
  }
  const co = await myCompany();
  if (ses.company_id && ses.company_id !== (co?.id ?? null)) {
    return NextResponse.json({ ok: false, reason: "その回には入れません。" }, { status: 403 });
  }

  if (b.action === "book") {
    const { data, error } = await supabase.rpc("book_live", { p_session: id, p_user: user.id });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    if (data === false) {
      return NextResponse.json(
        { ok: false, reason: `いっぱいです（1回 ${TALK_MAX}人まで）。別の回を選んでください。` },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (b.action === "in" || b.action === "out") {
    /* 時刻はデータベースが付ける。画面から送らせない */
    const { error } = await supabase.rpc(b.action === "in" ? "live_in" : "live_out", {
      p_session: id,
      p_user: user.id,
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "answer") {
    const text = (b.answer ?? "").trim().slice(0, 4000);
    if (!text) {
      return NextResponse.json({ ok: false, reason: "何か書いてください。" }, { status: 400 });
    }
    const { error } = await supabase
      .from("live_attend")
      .update({ answer: text })
      .eq("session_id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, reason: "その操作は分かりません。" }, { status: 400 });
}

/* 講師と本部だけ：回を立てる／出欠と講評を付ける */
export async function PUT(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const owner = await currentOwner();
  const admin = owner ? null : await currentAdmin();
  if (!owner && !admin) {
    return NextResponse.json({ ok: false, reason: "本部か教育担当者だけの操作です。" }, { status: 403 });
  }
  return NextResponse.json({ ok: false, reason: "まだ作っていません。" }, { status: 501 });
}
