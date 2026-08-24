/* 教育担当者の一覧の組み立ての試験。
   画面もデータベースも要らない。 実行: npx tsx tests/roster.ts */

import { buildRoster, rosterTotals, type RosterInput } from "@/training/roster";
import { PASS } from "@/training/score";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };
const eq = (a: unknown, b: unknown, m: string) =>
  check(JSON.stringify(a) === JSON.stringify(b), `${m}（${JSON.stringify(a)} ≠ ${JSON.stringify(b)}）`);

const base = (o: Partial<RosterInput> = {}): RosterInput => ({
  users: [],
  enrollments: [],
  progress: [],
  exams: [],
  attempts: [],
  certs: [],
  lessonsTotal: 13,
  ...o,
});

const U = (id: string, name: string, role = "learner") => ({ id, name, email: `${id}@x`, role });
const E = (id: string, user: string) => ({ id, user_id: user });

/* ── 誰も居ない ── */
{
  const rows = buildRoster(base());
  eq(rows.length, 0, "受講者が居なければ空");
  eq(rosterTotals(rows), { people: 0, done: 0, issued: 0, waiting: 0 }, "数字も0");
}

/* ── 学科の進み具合 ── */
{
  const rows = buildRoster(base({
    users: [U("u1", "山田")],
    enrollments: [E("e1", "u1")],
    progress: [
      { enrollment_id: "e1", quiz_passed_at: "2026-01-01T00:00:00Z" },
      { enrollment_id: "e1", quiz_passed_at: null },
      { enrollment_id: "e1", quiz_passed_at: "2026-01-02T00:00:00Z" },
    ],
  }));
  eq(rows[0].lessonsPassed, 2, "受かった単元だけ数える");
  eq(rows[0].lessonsTotal, 13, "全単元数が入る");
  check(!rows[0].canIssue, "全単元に届いていなければ修了証は出せない");
  eq(rows[0].exam, null, "修了試験を受けていなければ null");
}

/* ── 修了試験。合格があれば合格を出す ── */
{
  const ex = (n: number, score: number, passed: boolean) => ({
    enrollment_id: "e1", score, total: 20, passed,
    created_at: `2026-01-0${n}T00:00:00Z`,
  });
  const rows = buildRoster(base({
    users: [U("u1", "山田")],
    enrollments: [E("e1", "u1")],
    exams: [ex(1, 11, false), ex(2, 18, true), ex(3, 9, false)],
  }));
  eq(rows[0].exam, { score: 18, total: 20, passed: true }, "後で落ちても、受かった記録を出す");
}
{
  const rows = buildRoster(base({
    users: [U("u1", "山田")],
    enrollments: [E("e1", "u1")],
    exams: [
      { enrollment_id: "e1", score: 5, total: 20, passed: false, created_at: "2026-01-01T00:00:00Z" },
      { enrollment_id: "e1", score: 9, total: 20, passed: false, created_at: "2026-01-05T00:00:00Z" },
    ],
  }));
  eq(rows[0].exam, { score: 9, total: 20, passed: false }, "全部不合格なら、いちばん新しいものを出す");
}

/* ── 修了証を出せる条件 ── */
{
  const prog = Array.from({ length: 13 }, () => ({
    enrollment_id: "e1", quiz_passed_at: "2026-01-01T00:00:00Z",
  }));
  const withExam = (passed: boolean) => buildRoster(base({
    users: [U("u1", "山田")],
    enrollments: [E("e1", "u1")],
    progress: prog,
    exams: [{ enrollment_id: "e1", score: 18, total: 20, passed, created_at: "2026-01-02T00:00:00Z" }],
  }))[0];
  check(withExam(true).canIssue, "全単元＋修了試験の合格で出せる");
  check(!withExam(false).canIssue, "修了試験に落ちていれば出せない");

  const issued = buildRoster(base({
    users: [U("u1", "山田")],
    enrollments: [E("e1", "u1")],
    progress: prog,
    exams: [{ enrollment_id: "e1", score: 18, total: 20, passed: true, created_at: "2026-01-02T00:00:00Z" }],
    certs: [{ enrollment_id: "e1", cert_no: "2601-0001", issued_at: "2026-01-03T00:00:00Z" }],
  }))[0];
  eq(issued.cert, { no: "2601-0001", at: "2026-01-03T00:00:00Z" }, "出した修了証が入る");
  check(issued.canIssue, "出したあとも「出せる人」ではある");
  eq(rosterTotals([issued]), { people: 1, done: 1, issued: 1, waiting: 0 }, "出したら未発行は0");
}

/* ── 実務トレーニング。本番の最高点で見る ── */
{
  const at = (chapter: string, skill: number, tutorial = false, n = 1) => ({
    enrollment_id: "e1", chapter, tutorial, skill, passed: skill >= PASS,
    created_at: `2026-02-0${n}T00:00:00Z`,
  });
  const r = buildRoster(base({
    users: [U("u1", "山田")],
    enrollments: [E("e1", "u1")],
    attempts: [
      at("ch1", 100, true, 1),   // チュートリアルは数えない
      at("ch1", 62, false, 2),
      at("ch1", 88, false, 3),
      at("ch2", 40, false, 4),
    ],
  }))[0];
  const ch1 = r.training.find((t) => t.ch === "ch1")!;
  eq({ times: ch1.times, best: ch1.best, passed: ch1.passed },
     { times: 2, best: 88, passed: true },
     "本番だけ数え、最高点で合否を見る");
  const ch2 = r.training.find((t) => t.ch === "ch2")!;
  check(!ch2.passed, `${PASS}点に届かなければ不合格`);
  const ch3 = r.training.find((t) => t.ch === "ch3")!;
  eq({ times: ch3.times, best: ch3.best }, { times: 0, best: null }, "やっていない章は空");
  check(r.training.every((t) => t.ch !== "ch4"), "準備中の章は並べない");
  eq(r.lastAt, "2026-02-04T00:00:00Z", "最後の記録はいちばん新しい日時");
}

/* ── 受講がまだ無い人 ── */
{
  const r = buildRoster(base({ users: [U("u9", "新人")] }))[0];
  eq(r.enrollmentId, null, "受講が無ければ null");
  eq(r.lessonsPassed, 0, "学科は0");
  check(!r.canIssue, "修了証は出せない");
  eq(r.lastAt, null, "記録は無い");
}

/* ── 並び順と担当者の印 ── */
{
  const rows = buildRoster(base({
    users: [U("u2", "渡辺"), U("u1", "青木", "admin")],
  }));
  eq(rows.map((r) => r.name), ["青木", "渡辺"], "名前順に並ぶ");
  check(rows[0].admin, "担当者に印が付く");
  check(!rows[1].admin, "受講者には付かない");
}

/* ── 他人の記録が混ざらない ── */
{
  const rows = buildRoster(base({
    users: [U("u1", "山田"), U("u2", "鈴木")],
    enrollments: [E("e1", "u1"), E("e2", "u2")],
    progress: [{ enrollment_id: "e2", quiz_passed_at: "2026-01-01T00:00:00Z" }],
    attempts: [{
      enrollment_id: "e2", chapter: "ch1", tutorial: false, skill: 90,
      passed: true, created_at: "2026-01-01T00:00:00Z",
    }],
  }));
  const yamada = rows.find((r) => r.name === "山田")!;
  eq(yamada.lessonsPassed, 0, "他人の学科は数えない");
  eq(yamada.training.find((t) => t.ch === "ch1")!.times, 0, "他人の実務は数えない");
}

/* ── 未発行が上に来るための数字 ── */
{
  const done = (id: string, name: string, cert: boolean) => ({
    u: U(id, name), e: E(`e${id}`, id), cert,
  });
  const list = [done("a", "あ", true), done("b", "い", false), done("c", "う", false)];
  const prog = list.flatMap((x) =>
    Array.from({ length: 13 }, () => ({ enrollment_id: x.e.id, quiz_passed_at: "2026-01-01T00:00:00Z" })),
  );
  const rows = buildRoster(base({
    users: list.map((x) => x.u),
    enrollments: list.map((x) => x.e),
    progress: prog,
    exams: list.map((x) => ({
      enrollment_id: x.e.id, score: 20, total: 20, passed: true,
      created_at: "2026-01-02T00:00:00Z",
    })),
    certs: list.filter((x) => x.cert).map((x) => ({
      enrollment_id: x.e.id, cert_no: "2601-0001", issued_at: "2026-01-03T00:00:00Z",
    })),
  }));
  eq(rosterTotals(rows), { people: 3, done: 3, issued: 1, waiting: 2 }, "未発行が2人と分かる");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
