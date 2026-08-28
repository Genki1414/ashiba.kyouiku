import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { currentAdmin } from "@/lib/admin";
import { currentOwner } from "@/lib/owner";
import { myCompany } from "@/lib/tenant";
import { currentEnrollment } from "@/lib/enrollment";
import { openSessions, myLive, minOf, doneOf, talkDone, inWindow, EARLY_MIN } from "@/lib/liveQuery";
import { SHOKUCHO, TALK_MIN, TALK_SUBJECT } from "@/content/shokucho";
import { findCourse, needsLive } from "@/content/courses";
import { TALK_MAX } from "@/lib/hours";

/* 討議の回。

   申し込む・入る・出るは、すべてサーバで立てる。
   画面から「何分居た」を送らせない。送らせると、
   繋がずに時間だけ積んで修了できてしまう。

   ── 討議は講座に1回だけ ──
   科目ごとに討議を置くと、科目の数だけ日を合わせて集まることになる。
   受ける人にも講師にも重すぎるので、45分の回を1度だけにした。
   その45分は12時間の中に入り、TALK_SUBJECT の科目の時間として数える。

   ── つなぎ先（Zoom）は一覧に出さない ──
   一覧に URL を混ぜると、申し込んでいない人にも渡ってしまう。
   URL は「入る」を押したときだけ返す。押した時点で入室を記録する。
   顔の照合は受講中と同じで端末の中でやり（特徴量は端末から出さない）、
   通ってはじめて画面が「入る」を押せるようにする。
   外れたら /api/verify-log に残るのも、受講中と同じ。 */

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
  const done = talkDone(sessions, mine, now);
  return NextResponse.json({
    ok: true,
    course: { id: course.id, name: course.name, short: course.short },
    max: TALK_MAX,
    /* 討議は1回・45分。どの科目の時間として数えるかも返す */
    talk: {
      minutes: TALK_MIN,
      subjectId: TALK_SUBJECT,
      subject: SHOKUCHO.find((s) => s.id === TALK_SUBJECT)?.name ?? "",
      question: SHOKUCHO.find((s) => s.id === TALK_SUBJECT)?.talkQuestion ?? "",
      done: done.ok,
      sessionId: done.sessionId,
    },
    sessions: sessions.map((s) => {
      const m = mine.get(s.id);
      const d = m ? doneOf(m, s.minutes, now) : null;
      /* つなぎ先はここでは返さない。「入る」を押したときだけ渡す */
      const { roomUrl: _hidden, ...open } = s;
      return {
        ...open,
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
    .select("id, course_id, company_id, starts_at, minutes, room_url, closed_at")
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

  if (b.action === "in") {
    /* 討議の始まる前や、終わったずっとあとに URL を渡さない。
       渡すと、回に居なかった人に部屋の場所だけが残る */
    if (!inWindow(ses.starts_at as string, ses.minutes as number, new Date())) {
      return NextResponse.json(
        { ok: false, reason: `入れるのは、始まる${EARLY_MIN}分前からです。` },
        { status: 409 },
      );
    }

    /* 受講の準備（同意・本人確認）が済んでいない人は入れない。
       顔の特徴量そのものは端末から出さないので、ここで見られるのは
       「登録を済ませたか」まで。顔が本人かどうかを比べるのは端末側で、
       受講中の照合とまったく同じ作りにしてある。 */
    const who = await currentEnrollment(ses.course_id as string);
    if (!who) {
      return NextResponse.json({ ok: false, reason: "受講の準備が要ります。" }, { status: 403 });
    }
    const { data: en } = await supabase
      .from("enrollments")
      .select("consented_at, face_registered_at")
      .eq("id", who.enrollmentId)
      .maybeSingle();
    if (!en?.consented_at || !en?.face_registered_at) {
      return NextResponse.json(
        { ok: false, reason: "受講の準備（同意と顔の登録）を先に済ませてください。" },
        { status: 403 },
      );
    }

    /* 時刻はデータベースが付ける。画面から送らせない */
    const { error } = await supabase.rpc("live_in", { p_session: id, p_user: user.id });
    if (error) {
      /* 申し込んでいない人はここで断られる（live_in が raise する） */
      return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
    }
    /* 入室を記録できた人にだけ、つなぎ先を渡す */
    return NextResponse.json({ ok: true, roomUrl: (ses.room_url as string | null) ?? null });
  }

  if (b.action === "out") {
    /* 時刻はデータベースが付ける。画面から送らせない */
    const { error } = await supabase.rpc("live_out", { p_session: id, p_user: user.id });
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
