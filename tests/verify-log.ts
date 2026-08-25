/* 照合の記録のまとめの試験。画面もデータベースも要らない。
   実行: npx tsx tests/verify-log.ts */

import { buildCheck, checkTotals, REASON_LABEL, type RawLog } from "@/training/verifyLog";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };
const eq = (a: unknown, b: unknown, m: string) =>
  check(JSON.stringify(a) === JSON.stringify(b), `${m}（${JSON.stringify(a)} ≠ ${JSON.stringify(b)}）`);

const U = (id: string, name: string) => ({ id, name, email: `${id}@x` });
const E = (id: string, user: string) => ({ id, user_id: user });
const L = (en: string, at: string, reason: string | null, lesson = "1-1"): RawLog => ({
  enrollment_id: en, lesson_id: lesson, result: reason ? "ng" : "ok", reason, created_at: at,
});

/* ── 誰も居ない ── */
{
  const rows = buildCheck({ users: [], enrollments: [], logs: [] });
  eq(rows.length, 0, "受講者が居なければ空");
  eq(checkTotals(rows), { people: 0, ok: 0, ng: 0, stopped: 0 }, "数字も0");
}

/* ── 通った回と、止まった回を分けて数える ── */
{
  const rows = buildCheck({
    users: [U("u1", "山田")],
    enrollments: [E("e1", "u1")],
    logs: [
      L("e1", "2026-08-01T09:00:00Z", null),
      L("e1", "2026-08-01T09:05:00Z", null),
      L("e1", "2026-08-01T09:07:00Z", "no_face"),
      L("e1", "2026-08-01T09:20:00Z", "not_me"),
      L("e1", "2026-08-01T09:22:00Z", "no_face"),
    ],
  });
  const r = rows[0];
  eq(r.ok, 2, "通った回を数える");
  eq(r.ng, 3, "止まった回を数える");
  eq(r.reasons.map((x) => [x.reason, x.n]), [["no_face", 2], ["not_me", 1]], "理由ごとに、多い順");
  eq(r.reasons[0].label, REASON_LABEL.no_face, "理由は日本語で出す");
  eq(r.first, "2026-08-01T09:00:00Z", "はじめの記録");
  eq(r.last, "2026-08-01T09:22:00Z", "おわりの記録");
  eq(r.rows[0].at, "2026-08-01T09:22:00Z", "明細は新しい順");
  eq(r.rows[0].why, REASON_LABEL.no_face, "明細にも理由を日本語で");
  eq(r.rows.at(-1)!.ok, true, "通った回も明細に出す（受けた証になる）");
  eq(r.rows.at(-1)!.why, null, "通った回に理由は付けない");
}

/* ── 明細の件数を絞れる ── */
{
  const logs = Array.from({ length: 120 }, (_, i) =>
    L("e1", `2026-08-01T09:${String(i % 60).padStart(2, "0")}:00Z`, null),
  );
  const r = buildCheck({ users: [U("u1", "山田")], enrollments: [E("e1", "u1")], logs, limit: 50 })[0];
  eq(r.ok, 120, "数は全部数える");
  eq(r.rows.length, 50, "明細だけ絞る");
}

/* ── 他人の記録が混ざらない ── */
{
  const rows = buildCheck({
    users: [U("u1", "山田"), U("u2", "鈴木")],
    enrollments: [E("e1", "u1"), E("e2", "u2")],
    logs: [L("e2", "2026-08-01T09:00:00Z", "blocked")],
  });
  const yamada = rows.find((r) => r.name === "山田")!;
  eq(yamada.ng, 0, "他人の記録は数えない");
  eq(yamada.rows, [], "他人の明細も出ない");
}

/* ── 知らない受講の記録は捨てる（消された受講の残り） ── */
{
  const r = buildCheck({
    users: [U("u1", "山田")],
    enrollments: [E("e1", "u1")],
    logs: [L("e9", "2026-08-01T09:00:00Z", "no_face")],
  })[0];
  eq(r.ng, 0, "紐づかない記録は数えない");
}

/* ── 止まった人が上に来る（担当者が事情を聞く相手） ── */
{
  const list = ["あ", "い", "う"];
  const rows = buildCheck({
    users: list.map((n, i) => U(`u${i}`, n)),
    enrollments: list.map((_, i) => E(`e${i}`, `u${i}`)),
    logs: [
      L("e0", "2026-08-01T09:00:00Z", null),
      L("e2", "2026-08-01T09:00:00Z", "not_me"),
      L("e2", "2026-08-01T09:01:00Z", "not_me"),
      L("e1", "2026-08-01T09:00:00Z", "no_face"),
    ],
  });
  eq(rows.map((r) => r.name), ["う", "い", "あ"], "止まった回数が多い順");
  eq(checkTotals(rows), { people: 3, ok: 1, ng: 3, stopped: 2 }, "上の数字も合う");
}

/* ── 記録がまったく無い人 ── */
{
  const rows = buildCheck({ users: [U("u1", "山田")], enrollments: [], logs: [] });
  eq(rows[0].ok + rows[0].ng, 0, "記録が無い人は0");
  eq(checkTotals(rows).people, 0, "受講者の数は、記録がある人だけ数える");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
