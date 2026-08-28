import type { SupabaseClient } from "@supabase/supabase-js";
import { attendedMin, judgeTalk, TALK_MAX, type Attend } from "./hours";

/* 討議の回。データベースへの問い合わせと、その決まり。

   ログインのクッキーを読む所とは分けてある。
   分けておくと、本物のスキーマに当てて確かめられる（tests/admin-db.mts）。 */

export type Span = { in: string; out: string | null };

export type LiveSession = {
  id: string;
  courseId: string;
  subjectId: number;
  companyId: string | null;
  startsAt: string;
  minutes: number;
  capacity: number;
  teacher: string | null;
  roomUrl: string | null;
  note: string;
  closedAt: string | null;
  /** いま申し込んでいる人数 */
  booked: number;
};

export type LiveMine = {
  sessionId: string;
  spans: Span[];
  awayMin: number;
  answer: string | null;
  teacherOk: boolean;
  teacherNote: string | null;
};

const toSession = (o: Record<string, unknown>, booked: number): LiveSession => ({
  id: o.id as string,
  courseId: o.course_id as string,
  subjectId: (o.subject_id as number) ?? 0,
  companyId: (o.company_id as string | null) ?? null,
  startsAt: o.starts_at as string,
  minutes: (o.minutes as number) ?? 0,
  capacity: (o.capacity as number) ?? TALK_MAX,
  teacher: (o.teacher as string | null) ?? null,
  roomUrl: (o.room_url as string | null) ?? null,
  note: (o.note as string) ?? "",
  closedAt: (o.closed_at as string | null) ?? null,
  booked,
});

const COLS =
  "id, course_id, subject_id, company_id, starts_at, minutes, capacity, teacher, room_url, note, closed_at";

/** 申し込める回。自分の事業者の回と、誰でも入れる回（company_id が空）だけ。
    よその会社の回に入れると、討議の中身がその会社の外に出る */
export async function openSessions(
  supabase: SupabaseClient,
  courseId: string,
  companyId: string | null,
  from: Date = new Date(),
): Promise<LiveSession[]> {
  /* 「誰でも入れる回」と「自分の会社の回」を、別々に引いて足す。

     1本の or で書くと、会社の番号を文字列に埋め込むことになる。
     いまは自分のデータベースから来た値なので実害は無いが、
     **見せてよい範囲を文字列の組み立てで決める**のは筋が悪い。
     ここを間違えると、よその会社の討議が見える。 */
  const base = () =>
    supabase
      .from("live_sessions")
      .select(COLS)
      .eq("course_id", courseId)
      .is("closed_at", null)
      .gte("starts_at", from.toISOString());

  const [pub, ours] = await Promise.all([
    base().is("company_id", null),
    companyId
      ? base().eq("company_id", companyId)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const rows = [
    ...((pub.data ?? []) as unknown as Record<string, unknown>[]),
    ...((ours.data ?? []) as unknown as Record<string, unknown>[]),
  ].sort((a, b) => `${a.starts_at}`.localeCompare(`${b.starts_at}`));
  if (!rows.length) return [];

  /* 何人入っているかを1回でまとめて数える */
  const ids = rows.map((r) => r.id as string);
  const { data: att } = await supabase.from("live_attend").select("session_id").in("session_id", ids);
  const n = new Map<string, number>();
  for (const a of att ?? []) {
    const k = a.session_id as string;
    n.set(k, (n.get(k) ?? 0) + 1);
  }
  return rows.map((r) => toSession(r, n.get(r.id as string) ?? 0));
}

/** その人が申し込んでいる回 */
export async function myLive(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, LiveMine>> {
  const { data } = await supabase
    .from("live_attend")
    .select("session_id, spans, away_min, answer, teacher_ok, teacher_note")
    .eq("user_id", userId);
  const out = new Map<string, LiveMine>();
  for (const a of data ?? []) {
    out.set(a.session_id as string, {
      sessionId: a.session_id as string,
      spans: (a.spans as Span[]) ?? [],
      awayMin: (a.away_min as number) ?? 0,
      answer: (a.answer as string | null) ?? null,
      teacherOk: a.teacher_ok === true,
      teacherNote: (a.teacher_note as string | null) ?? null,
    });
  }
  return out;
}

/** 出た記録を、時間の判定にかけられる形へ */
export const toAttend = (m: LiveMine): Attend => ({
  spans: m.spans.map((s) => ({ inAt: s.in, outAt: s.out })),
  awayMin: m.awayMin,
});

/** その回を終えたと見てよいか。必要時間は回の長さで見る */
export function doneOf(m: LiveMine, need: number, now: Date = new Date()) {
  return judgeTalk(toAttend(m), need, { answered: !!m.answer?.trim(), teacherOk: m.teacherOk }, now);
}

/** いま居た時間（分） */
export const minOf = (m: LiveMine, now: Date = new Date()): number =>
  attendedMin(toAttend(m), now);

/** 討議を終えたか。討議は講座に1回だけなので、
    申し込んだどれか1つが通っていればよい。

    「科目ごとに1回」にすると、5回も日を合わせて集まることになる。
    受ける人にも講師にも重すぎるので、45分の回を1度だけにした
    （src/content/shokucho.ts の TALK_MIN / TALK_SUBJECT）。 */
export function talkDone(
  sessions: LiveSession[],
  mine: Map<string, LiveMine>,
  now: Date = new Date(),
): { ok: boolean; sessionId: string | null } {
  for (const s of sessions) {
    const m = mine.get(s.id);
    if (!m) continue;
    if (doneOf(m, s.minutes, now).ok) return { ok: true, sessionId: s.id };
  }
  return { ok: false, sessionId: null };
}

/** その回に申し込んでいるか。つなぎ先を出してよいかの前提 */
export const booked = (mine: Map<string, LiveMine>, sessionId: string): boolean =>
  mine.has(sessionId);

/* ── つなぎ先（Zoom）を渡してよい時間帯 ──────────────

   一覧に URL を混ぜると、申し込んでいない人にも渡ってしまう。
   URL は「入る」を押したときだけ返し、その時点で入室を記録する。
   始まるずっと前や、終わったあとに渡すと、
   回に居なかった人の手元に部屋の場所だけが残る。 */
export const EARLY_MIN = 15;
export const LATE_MIN = 30;

/** 入室の記録が付いてよい時間帯か */
export function inWindow(startsAt: string, minutes: number, now: Date = new Date()): boolean {
  const t = new Date(startsAt).getTime();
  if (!Number.isFinite(t)) return false;
  const from = t - EARLY_MIN * 60000;
  const to = t + (Math.max(0, minutes) + LATE_MIN) * 60000;
  return now.getTime() >= from && now.getTime() <= to;
}
