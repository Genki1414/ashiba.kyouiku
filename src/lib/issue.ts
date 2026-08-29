import type { CourseGate } from "@/content/courses";

/* 修了証の発行申請。

   ── なぜ申請を挟むか ──
   学科だけで修了する講座は、条件を満たした時点で修了しているので、
   その場で紙を出してよい。

   ところが、学科のあとに討議や実技が残る講座で同じことをすると、
   **まだ修了していない人に修了証が出る**。職長教育の討議は
   オンラインの同時双方向でやる決めなので、いつやるかを決めないと
   先へ進めない。そこで、学科を終えた人に発行申請を出してもらい、
   こちらが討議の候補日を返す形にした。

   先に討議の回を立てておく作りにはしない。立てるまで誰も申し込めず、
   誰が待っているのかも分からないため。申請が来てから日を出す。

   ── 実技のある講座 ──
   実技は事業者が自社で行う。日を決めるのはこちらではないので、
   候補日は出さない。済んでから申請してもらい、実施日と実施者を控える。

   ここは画面にもデータベースにも触らない、ただの決まり。
   サーバ・本部の画面・受講の画面から、同じものを使う。 */

/** 申請の状態。データベースの status と同じ字を使う */
export type IssueStatus =
  /** まだ申請していない */
  | "none"
  /** 申請が出ている。こちらの返事待ち */
  | "open"
  /** 候補日を出した。本人が選ぶのを待っている（talk のみ） */
  | "offered"
  /** 日が決まった。討議を待っている（talk のみ） */
  | "picked"
  /** 関門を通った。修了証を出せる */
  | "cleared"
  /** 断った。理由を添えて返す */
  | "declined";

export const ISSUE_STATUS: IssueStatus[] = [
  "none",
  "open",
  "offered",
  "picked",
  "cleared",
  "declined",
];

/** 候補日は1回に何件まで出すか。多すぎると選べない */
export const SLOT_MAX = 5;
/** 討議の候補日は、何日先から出すか。明日いきなりは都合がつかない */
export const SLOT_LEAD_DAYS = 2;

export type Slot = {
  id: string;
  startsAt: string;
  minutes: number;
  note: string;
  /** 本人が選んだ候補 */
  picked: boolean;
};

export type IssueState = {
  gate: CourseGate;
  status: IssueStatus;
  /** 出してある候補日 */
  slots: Slot[];
  /** 本人が申請に添えた一言（都合の悪い日など） */
  note: string;
  /** こちらからの返事 */
  replyNote: string;
  /** 実技（drill）の実施日 */
  drillOn: string | null;
  /** 実技を行った人 */
  drillBy: string;
};

/* ── 学科が終わったか ─────────────────────────
   申請できるのは、学科を全部終えてから。
   途中で申請できると、こちらが日を出したあとに学科が終わらない、
   という宙ぶらりんが出る。 */

export type StudyDone = {
  /** 単元の総数 */
  lessons: number;
  /** 確認問題に合格した単元の数 */
  lessonsPassed: number;
  /** 修了試験に合格しているか */
  examPassed: boolean;
};

export type CanRequest = { ok: true } | { ok: false; reason: string };

/** 発行申請を出せるか。学科の全単元に合格し、修了試験にも受かっていること */
export function canRequest(s: StudyDone): CanRequest {
  if (s.lessons <= 0) return { ok: false, reason: "教材が読み込めていません。" };
  const left = s.lessons - s.lessonsPassed;
  if (left > 0) {
    return { ok: false, reason: `確認問題が残り${left}単元あります。全部に合格してください。` };
  }
  if (!s.examPassed) return { ok: false, reason: "修了試験にまだ合格していません。" };
  return { ok: true };
}

/* ── 関門を通ったか ───────────────────────────
   ここが false のあいだは、修了証を出さない。 */

/** その申請の状態で、修了証を出してよいか */
export const gateCleared = (st: IssueState | null): boolean => st?.status === "cleared";

/** 修了証がまだ出せない理由。画面にそのまま出す */
export function gateReason(gate: CourseGate, st: IssueState | null): string {
  const s = st?.status ?? "none";
  if (s === "cleared") return "";
  if (gate === "drill") {
    if (s === "none") {
      return "実技が残っています。事業者で実技を行ってから、発行申請を出してください。";
    }
    if (s === "declined") {
      return st?.replyNote?.trim()
        ? `発行申請をお返ししています。${st.replyNote.trim()}`
        : "発行申請をお返ししています。内容を直してもう一度出してください。";
    }
    return "発行申請をお預かりしています。実技の記録を確かめてからご連絡します。";
  }
  /* talk */
  switch (s) {
    case "none":
      return "討議が残っています。発行申請を出してください。こちらから候補日をお送りします。";
    case "open":
      return "発行申請をお預かりしています。討議の候補日が決まりしだいお知らせします。";
    case "offered":
      return "討議の候補日が届いています。都合のよい日を選んでください。";
    case "picked":
      return "討議の日が決まっています。当日は時間になったら討議の画面から入ってください。";
    case "declined":
      return st?.replyNote?.trim()
        ? `発行申請をお返ししています。${st.replyNote.trim()}`
        : "発行申請をお返ししています。内容を直してもう一度出してください。";
    default:
      return "修了証はまだ出せません。";
  }
}

/** 本人が次にやること。画面のボタンを決めるのに使う */
export type NextAction = "request" | "pick" | "wait" | "talk" | "none";

export function nextAction(gate: CourseGate, st: IssueState | null): NextAction {
  const s = st?.status ?? "none";
  if (s === "cleared") return "none";
  if (s === "none" || s === "declined") return "request";
  if (gate === "drill") return "wait";
  if (s === "offered") return "pick";
  if (s === "picked") return "talk";
  return "wait";
}

/* ── 候補日 ─────────────────────────────────
   出すのはこちら（本部）。本人は選ぶだけ。 */

export type SlotIn = { startsAt: string; minutes?: number; note?: string };

export type SlotCheck = { ok: true; slots: { startsAt: string; minutes: number; note: string }[] }
  | { ok: false; reason: string };

/** 出そうとしている候補日が使えるか。
    ここで弾いておかないと、過ぎた日や重なった日を出してしまう。 */
export function checkSlots(
  input: SlotIn[],
  now: Date = new Date(),
  leadDays: number = SLOT_LEAD_DAYS,
): SlotCheck {
  if (!input.length) return { ok: false, reason: "候補日を1つ以上入れてください。" };
  if (input.length > SLOT_MAX) {
    return { ok: false, reason: `候補日は${SLOT_MAX}件までです。多すぎると選べません。` };
  }
  const floor = now.getTime() + leadDays * 86400000;
  const seen = new Set<string>();
  const out: { startsAt: string; minutes: number; note: string }[] = [];
  for (const s of input) {
    const t = Date.parse(s.startsAt ?? "");
    if (!Number.isFinite(t)) return { ok: false, reason: "日時の形が読めません。" };
    if (t < floor) {
      return { ok: false, reason: `候補日は${leadDays}日より先にしてください。都合がつきません。` };
    }
    const iso = new Date(t).toISOString();
    if (seen.has(iso)) return { ok: false, reason: "同じ日時が2つ入っています。" };
    seen.add(iso);
    const min = Math.trunc(s.minutes ?? 0);
    if (min <= 0 || min > 480) {
      return { ok: false, reason: "長さは1分から480分のあいだで入れてください。" };
    }
    out.push({ startsAt: iso, minutes: min, note: (s.note ?? "").trim().slice(0, 200) });
  }
  out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { ok: true, slots: out };
}

/* ── つなぎ先（Zoom などの部屋） ────────────
   回ごとに入れる。一覧には出さない。
   「入る」を押した人にだけ渡す（src/app/api/live/route.ts）。 */

export type RoomCheck = { ok: true; url: string } | { ok: false; reason: string };

/** 入れようとしている URL が使えるか */
export function checkRoom(v: string): RoomCheck {
  const url = (v ?? "").trim();
  if (!url) return { ok: false, reason: "つなぎ先を入れてください。" };
  if (url.length > 2000) return { ok: false, reason: "URL が長すぎます。" };
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, reason: "URL の形になっていません。https で始まる形で入れてください。" };
  }
  /* http は使わせない。討議の部屋の場所が、途中で読まれる */
  if (u.protocol !== "https:") {
    return { ok: false, reason: "https で始まる URL にしてください。" };
  }
  return { ok: true, url: u.toString() };
}

/* ── 本部の一覧の並び ────────────────────────
   待たせている人から先に出す。日付順にすると、
   返事をしていない申請が下に埋もれる。 */

export const QUEUE_ORDER: Record<IssueStatus, number> = {
  open: 0,
  offered: 1,
  picked: 2,
  declined: 3,
  cleared: 4,
  none: 5,
};

export type QueueRow = { status: IssueStatus; requestedAt: string };

export function sortQueue<T extends QueueRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const d = QUEUE_ORDER[a.status] - QUEUE_ORDER[b.status];
    return d !== 0 ? d : a.requestedAt.localeCompare(b.requestedAt);
  });
}

/** 返事をしていない申請の数。本部の画面の見出しに出す */
export const waitingCount = (rows: QueueRow[]): number =>
  rows.filter((r) => r.status === "open").length;
