/* 照合の記録（受講中に本人が画面の前に居たか）のまとめ。

   これは「本人が受けた証拠」そのもの。
   監督署や元請に聞かれたとき、事業者が出せないと意味が無いので、
   教育担当者の画面に出すために、ここで人ごとにまとめる。

   画面にもデータベースにも触らない、ただの計算（tests/verify-log.ts）。 */

export const REASON_LABEL: Record<string, string> = {
  no_face: "顔が写っていない",
  multi_face: "複数人が写っている",
  blocked: "カメラが遮られている",
  no_motion: "動きがない",
  not_me: "登録した人と違う",
};

/** 記録1行（データベースから読んだそのまま） */
export type RawLog = {
  enrollment_id: string;
  lesson_id: string | null;
  result: "ok" | "ng";
  reason: string | null;
  created_at: string;
};

export type LogRow = {
  at: string;
  /** 単元番号。講座の頭（ashiba:）は外して出す */
  lesson: string | null;
  ok: boolean;
  /** 止まった理由。日本語に直したもの */
  why: string | null;
};

export type CheckRow = {
  userId: string;
  name: string;
  email: string | null;
  /** 本人と確認できた回数 */
  ok: number;
  /** 止まった回数 */
  ng: number;
  /** 理由ごとの回数。多い順 */
  reasons: { reason: string; label: string; n: number }[];
  first: string | null;
  last: string | null;
  /** 明細（新しい順） */
  rows: LogRow[];
};

export type CheckInput = {
  users: { id: string; name: string; email: string | null }[];
  enrollments: { id: string; user_id: string }[];
  logs: RawLog[];
  /** 1人あたり、明細を何件まで出すか */
  limit?: number;
};

export function buildCheck(inp: CheckInput): CheckRow[] {
  const limit = inp.limit ?? 50;
  const userOf = new Map(inp.enrollments.map((e) => [e.id, e.user_id]));

  const mine = new Map<string, RawLog[]>();
  for (const l of inp.logs) {
    const u = userOf.get(l.enrollment_id);
    if (!u) continue;
    const list = mine.get(u);
    if (list) list.push(l);
    else mine.set(u, [l]);
  }

  const rows = inp.users.map((u): CheckRow => {
    /* 新しい順。同じ時刻なら並びは崩さない */
    const logs = (mine.get(u.id) ?? [])
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

    const count = new Map<string, number>();
    let ok = 0;
    let ng = 0;
    for (const l of logs) {
      if (l.result === "ok") {
        ok++;
        continue;
      }
      ng++;
      const r = l.reason ?? "no_face";
      count.set(r, (count.get(r) ?? 0) + 1);
    }

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      ok,
      ng,
      reasons: [...count.entries()]
        .map(([reason, n]) => ({ reason, label: REASON_LABEL[reason] ?? reason, n }))
        .sort((a, b) => b.n - a.n || a.reason.localeCompare(b.reason)),
      first: logs.at(-1)?.created_at ?? null,
      last: logs[0]?.created_at ?? null,
      rows: logs.slice(0, limit).map((l) => ({
        at: l.created_at,
        lesson: shortLesson(l.lesson_id),
        ok: l.result === "ok",
        why: l.result === "ok" ? null : (REASON_LABEL[l.reason ?? ""] ?? l.reason),
      })),
    };
  });

  /* 止まった回数が多い人を上に。担当者が見るのはそこなので */
  return rows.sort((a, b) => b.ng - a.ng || a.name.localeCompare(b.name, "ja"));
}

/** 画面の上に出す数字 */
export function checkTotals(rows: CheckRow[]) {
  return {
    people: rows.filter((r) => r.ok + r.ng > 0).length,
    ok: rows.reduce((n, r) => n + r.ok, 0),
    ng: rows.reduce((n, r) => n + r.ng, 0),
    /* 1度でも止まった人。担当者が事情を聞く相手 */
    stopped: rows.filter((r) => r.ng > 0).length,
  };
}

/** 'ashiba:1-1' → '1-1'。画面には単元番号だけ出す */
export function shortLesson(id: string | null): string | null {
  if (!id) return null;
  const i = id.indexOf(":");
  return i >= 0 ? id.slice(i + 1) : id;
}
