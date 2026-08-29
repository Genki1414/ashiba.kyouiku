import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseGate } from "@/content/courses";
import type { IssueState, IssueStatus, Slot } from "./issue";

/* 発行申請の問い合わせ。

   ログインのクッキーを読む所とは分けてある。
   分けておくと、本物のスキーマに当てて確かめられる（tests/admin-db.mts）。 */

export type RequestRow = {
  id: string;
  enrollmentId: string;
  courseId: string;
  userId: string;
  kind: CourseGate;
  talkSubject: number;
  status: IssueStatus;
  note: string;
  requestedAt: string;
  drillOn: string | null;
  drillBy: string;
  repliedAt: string | null;
  replyNote: string;
  repliedBy: string;
  sessionId: string | null;
  decidedAt: string | null;
  clearedAt: string | null;
};

const COLS =
  "id, enrollment_id, course_id, user_id, kind, talk_subject, status, note, requested_at, " +
  "drill_on, drill_by, replied_at, reply_note, replied_by, session_id, decided_at, cleared_at";

const toRow = (o: Record<string, unknown>): RequestRow => ({
  id: o.id as string,
  enrollmentId: o.enrollment_id as string,
  courseId: o.course_id as string,
  userId: o.user_id as string,
  kind: (o.kind as CourseGate) ?? "talk",
  talkSubject: (o.talk_subject as number) ?? 1,
  status: (o.status as IssueStatus) ?? "open",
  note: (o.note as string) ?? "",
  requestedAt: o.requested_at as string,
  drillOn: (o.drill_on as string | null) ?? null,
  drillBy: (o.drill_by as string) ?? "",
  repliedAt: (o.replied_at as string | null) ?? null,
  replyNote: (o.reply_note as string) ?? "",
  repliedBy: (o.replied_by as string) ?? "",
  sessionId: (o.session_id as string | null) ?? null,
  decidedAt: (o.decided_at as string | null) ?? null,
  clearedAt: (o.cleared_at as string | null) ?? null,
});

const toSlot = (o: Record<string, unknown>): Slot => ({
  id: o.id as string,
  startsAt: o.starts_at as string,
  minutes: (o.minutes as number) ?? 0,
  note: (o.note as string) ?? "",
  picked: !!o.picked_at,
});

/** その受講の申請。無ければ null */
export async function requestOf(
  supabase: SupabaseClient,
  enrollmentId: string,
): Promise<RequestRow | null> {
  const { data } = await supabase
    .from("cert_requests")
    .select(COLS)
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();
  return data ? toRow(data as unknown as Record<string, unknown>) : null;
}

/** その申請に出してある候補日 */
export async function slotsOf(supabase: SupabaseClient, requestId: string): Promise<Slot[]> {
  const { data } = await supabase
    .from("cert_request_slots")
    .select("id, starts_at, minutes, note, picked_at")
    .eq("request_id", requestId)
    .order("starts_at");
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toSlot);
}

/** 画面に返す形へ */
export const toState = (r: RequestRow, slots: Slot[]): IssueState => ({
  gate: r.kind,
  status: r.status,
  slots,
  note: r.note,
  replyNote: r.replyNote,
  drillOn: r.drillOn,
  drillBy: r.drillBy,
});

/* ── 本部の一覧 ──────────────────────────────
   誰が待っているのかが分かればよい。
   受講の中身までは、ここでは引かない。 */

export type QueueItem = RequestRow & {
  name: string;
  email: string | null;
  company: string | null;
  slots: Slot[];
};

/** 申請の一覧。済んだものも出すが、並びは待たせている順（sortQueue） */
export async function queue(
  supabase: SupabaseClient,
  limit = 200,
): Promise<QueueItem[]> {
  const { data } = await supabase
    .from("cert_requests")
    .select(COLS)
    .order("requested_at", { ascending: false })
    .limit(limit);
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map(toRow);
  if (!rows.length) return [];

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, company_id")
    .in("id", userIds);
  const byUser = new Map<string, Record<string, unknown>>();
  for (const u of users ?? []) byUser.set(u.id as string, u as Record<string, unknown>);

  const coIds = [
    ...new Set(
      (users ?? []).map((u) => u.company_id as string | null).filter((x): x is string => !!x),
    ),
  ];
  const byCo = new Map<string, string>();
  if (coIds.length) {
    const { data: cos } = await supabase.from("companies").select("id, name").in("id", coIds);
    for (const c of cos ?? []) byCo.set(c.id as string, c.name as string);
  }

  const { data: sl } = await supabase
    .from("cert_request_slots")
    .select("id, request_id, starts_at, minutes, note, picked_at")
    .in("request_id", rows.map((r) => r.id))
    .order("starts_at");
  const slotsBy = new Map<string, Slot[]>();
  for (const s of (sl ?? []) as unknown as Record<string, unknown>[]) {
    const k = s.request_id as string;
    slotsBy.set(k, [...(slotsBy.get(k) ?? []), toSlot(s)]);
  }

  return rows.map((r) => {
    const u = byUser.get(r.userId);
    const co = (u?.company_id as string | null) ?? null;
    return {
      ...r,
      name: (u?.name as string) ?? "",
      email: (u?.email as string | null) ?? null,
      company: co ? (byCo.get(co) ?? null) : null,
      slots: slotsBy.get(r.id) ?? [],
    };
  });
}
