/* 教育担当者の一覧の組み立ての試験。
   画面もデータベースも要らない。 実行: npx tsx tests/roster.ts */

import { buildRoster, rosterTotals, type RosterInput, mergePeople, peopleTotals } from "@/training/roster";
import { PASS } from "@/training/score";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };
const eq = (a: unknown, b: unknown, m: string) =>
  check(JSON.stringify(a) === JSON.stringify(b), `${m}（${JSON.stringify(a)} ≠ ${JSON.stringify(b)}）`);

/* 学科は13単元。1単元30分＝合計6時間30分。
   本物の並びと同じで、順番どおりに渡す（「いま何番目か」を出すため） */
const LESSONS = Array.from({ length: 13 }, (_, i) => ({
  id: `L${i + 1}`,
  title: `単元${i + 1}`,
  legal_min: 30,
}));

/** 視聴記録1行 */
const P = (en: string, lesson: string, sec: number, passedAt: string | null) => ({
  enrollment_id: en, lesson_id: lesson, watched_sec: sec, quiz_passed_at: passedAt,
});

const base = (o: Partial<RosterInput> = {}): RosterInput => ({
  users: [],
  enrollments: [],
  progress: [],
  exams: [],
  attempts: [],
  certs: [],
  lessons: LESSONS,
  ...o,
});

const U = (id: string, name: string, role = "learner", active = true) =>
  ({ id, name, email: `${id}@x`, role, active });
const E = (id: string, user: string) => ({ id, user_id: user });

/* ── 誰も居ない ── */
{
  const rows = buildRoster(base());
  eq(rows.length, 0, "受講者が居なければ空");
  eq(rosterTotals(rows), { people: 0, left: 0, pending: 0, done: 0, issued: 0, waiting: 0 }, "数字も0");
}

/* ── 学科の進み具合 ── */
{
  const rows = buildRoster(base({
    users: [U("u1", "山田")],
    enrollments: [E("e1", "u1")],
    progress: [
      P("e1", "L1", 1800, "2026-01-01T00:00:00Z"),
      P("e1", "L2", 600, null),
      P("e1", "L3", 1800, "2026-01-02T00:00:00Z"),
    ],
  }));
  eq(rows[0].lessonsPassed, 2, "受かった単元だけ数える");
  eq(rows[0].lessonsTotal, 13, "全単元数が入る");
  eq(rows[0].watchedSec, 4200, "見た時間は全単元の合計");
  eq(rows[0].requiredSec, 23400, "法定の合計は単元の合計（30分×13）");
  eq(rows[0].now, { id: "L2", title: "単元2", watchedSec: 600, needSec: 1800 },
     "いま受けているのは、受かっていない いちばん前の単元");
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
  const prog = LESSONS.map((l) => P("e1", l.id, 1800, "2026-01-01T00:00:00Z"));
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
  eq(issued.now, null, "全単元を終えていれば「いまここ」は出さない");
  check(issued.canIssue, "出したあとも「出せる人」ではある");
  eq(rosterTotals([issued]), { people: 1, left: 0, pending: 0, done: 1, issued: 1, waiting: 0 }, "出したら未発行は0");
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
  eq(r.watchedSec, 0, "見た時間も0");
  eq(r.now, { id: "L1", title: "単元1", watchedSec: 0, needSec: 1800 },
     "まだ何もしていなければ、次は1単元目");
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
    progress: [P("e2", "L1", 1800, "2026-01-01T00:00:00Z")],
    attempts: [{
      enrollment_id: "e2", chapter: "ch1", tutorial: false, skill: 90,
      passed: true, created_at: "2026-01-01T00:00:00Z",
    }],
  }));
  const yamada = rows.find((r) => r.name === "山田")!;
  eq(yamada.lessonsPassed, 0, "他人の学科は数えない");
  eq(yamada.watchedSec, 0, "他人の視聴時間も数えない");
  eq(yamada.training.find((t) => t.ch === "ch1")!.times, 0, "他人の実務は数えない");
}

/* ── 未発行が上に来るための数字 ── */
{
  const done = (id: string, name: string, cert: boolean) => ({
    u: U(id, name), e: E(`e${id}`, id), cert,
  });
  const list = [done("a", "あ", true), done("b", "い", false), done("c", "う", false)];
  const prog = list.flatMap((x) =>
    LESSONS.map((l) => P(x.e.id, l.id, 1800, "2026-01-01T00:00:00Z")),
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
  eq(rosterTotals(rows), { people: 3, left: 0, pending: 0, done: 3, issued: 1, waiting: 2 }, "未発行が2人と分かる");
  /* 担当者がやることは「出せるのにまだ出していない人」。そこを上に置く */
  eq(rows.map((r) => r.name), ["い", "う", "あ"], "未発行が上、そのあと名前順");
}

/* ── 退職した人 ──
   消さないのは、教育を行った事業者がその記録を3年保存する決まりだから */
{
  const rows = buildRoster(base({
    users: [U("u1", "在籍A"), U("u2", "退職B", "learner", false), U("u3", "在籍C")],
    enrollments: [E("e1", "u1"), E("e2", "u2"), E("e3", "u3")],
    progress: [P("e2", "L1", 1800, "2026-01-01T00:00:00Z")],
  }));
  eq(rows.map((r) => r.name), ["在籍A", "在籍C", "退職B"], "退職した人は下に来る");
  check(rows.find((r) => r.name === "退職B")!.left, "退職の印が付く");
  check(!rows.find((r) => r.name === "在籍A")!.left, "在籍している人には付かない");
  eq(rows.find((r) => r.name === "退職B")!.lessonsPassed, 1, "退職しても記録は残る");
  eq(rosterTotals(rows).people, 2, "受講者の数は在籍している人だけ");
  eq(rosterTotals(rows).left, 1, "退職した人の数も分かる");
}

/* ── まだ許可していない申し込みの人 ──
   受講コードを使って受け始めているが、名簿への申し込みは
   まだ許可していない、という形が起きる。
   この人を「退職」と出すと、入ったこともないのに辞めたように見え、
   上の「参加の申し込み」と合わせて二人居るように見える */
{
  const rows = buildRoster(base({
    users: [
      U("u1", "在籍A"),
      { id: "u2", name: "申込B", email: "u2@x", role: "learner", active: false, pending: true },
      U("u3", "退職C", "learner", false),
    ],
    enrollments: [E("e1", "u1"), E("e2", "u2"), E("e3", "u3")],
    progress: [P("e2", "L1", 1800, "2026-01-01T00:00:00Z")],
  }));
  const b = rows.find((r) => r.name === "申込B")!;
  check(b.pending, "申し込み中の印が付く");
  check(!b.left, "申し込み中の人に「退職」は付かない");
  eq(b.lessonsPassed, 1, "許可前でも、受けた記録は出る");
  check(rows.find((r) => r.name === "退職C")!.left, "本当に抜けた人には退職が付く");
  check(!rows.find((r) => r.name === "在籍A")!.pending, "在籍している人には付かない");

  const t = rosterTotals(rows);
  eq(t.people, 1, "在籍に数えるのは、許可した人だけ");
  eq(t.pending, 1, "申し込み中の人の数が分かる");
  eq(t.left, 1, "抜けた人に、申し込み中の人は混ざらない");
}

/* ── 人ごとにまとめる ──
   特別教育は増えていく。1人が2つも3つも持つので、
   名簿は人で並べて、講座ぶんを「受講中」と「取得済み」に振り分ける */
{
  const C1 = { id: "ashiba", short: "足場", name: "足場の組立て等" };
  const C2 = { id: "fusegi", short: "ふせぎ", name: "よその特別教育" };

  /* 田中は足場を取り終えて（修了証あり）、よその方を受けている途中 */
  const a = buildRoster(base({
    users: [U("u1", "田中"), U("u2", "佐藤")],
    enrollments: [E("e1", "u1"), E("e2", "u2")],
    progress: LESSONS.map((l) => P("e1", l.id, l.legal_min * 60, "2026-01-01T00:00:00Z")),
    exams: [{ enrollment_id: "e1", score: 20, total: 20, passed: true, created_at: "2026-01-01T09:00:00Z" }],
    certs: [{ enrollment_id: "e1", cert_no: "TMK-2026-0001", issued_at: "2026-01-02T00:00:00Z" }],
  }));
  const b = buildRoster(base({
    users: [U("u1", "田中"), U("u2", "佐藤")],
    /* 佐藤はこちらを受けていない（席が無い） */
    enrollments: [E("e3", "u1")],
    progress: [P("e3", "L1", 900, null)],
  }));

  const people = mergePeople([{ course: C1, rows: a }, { course: C2, rows: b }]);
  eq(people.length, 2, "人の数だけ並ぶ（講座ぶんに増えない）");

  const t = people.find((p) => p.name === "田中")!;
  eq(t.done.map((c) => c.courseId), ["ashiba"], "修了証が出たものは取得済み");
  eq(t.doing.map((c) => c.courseId), ["fusegi"], "まだのものは受講中");
  eq(t.done[0].cert?.no, "TMK-2026-0001", "証明番号は取得済みの側に付く");
  check(!t.canIssue, "もう出してあるものは、出せる扱いにしない");

  const s2 = people.find((p) => p.name === "佐藤")!;
  eq(s2.doing.map((c) => c.courseId), ["ashiba"], "受けていない講座は並べない");
  eq(s2.done.length, 0, "取得済みは空");

  const tt = peopleTotals(people);
  eq(tt.people, 2, "受講者の数は人の数");
  eq(tt.issued, 1, "資格を取った人の数");
  eq(tt.doing, 2, "受講中の資格がある人の数");
}

/* 出せるのに出していない人が上。担当者がやることはそこなので */
{
  const C1 = { id: "ashiba", short: "足場", name: "足場の組立て等" };
  const rows = buildRoster(base({
    users: [U("u1", "あとから"), U("u2", "まだ途中")],
    enrollments: [E("e1", "u1"), E("e2", "u2")],
    progress: [
      ...LESSONS.map((l) => P("e1", l.id, l.legal_min * 60, "2026-01-01T00:00:00Z")),
      P("e2", "L1", 60, null),
    ],
    exams: [{ enrollment_id: "e1", score: 20, total: 20, passed: true, created_at: "2026-01-01T09:00:00Z" }],
  }));
  const people = mergePeople([{ course: C1, rows }]);
  eq(people[0].name, "あとから", "修了証を出せる人が上に来る（名前順より先）");
  check(people[0].canIssue, "その人には印が付く");
  eq(peopleTotals(people).waiting, 1, "未発行の数が出る");
}

/* ── よそで取った資格 ──
   この仕組みの外で取ったものも「持っている資格」。
   担当者が見たいのは「この人を現場に出せるか」で、出どころは関係ない */
{
  const C1 = { id: "ashiba", short: "足場", name: "足場の組立て等" };
  const rows = buildRoster(base({
    users: [U("u1", "持っている"), U("u2", "何も無い")],
    enrollments: [E("e1", "u1"), E("e2", "u2")],
    progress: [P("e1", "L1", 60, null), P("e2", "L1", 60, null)],
  }));
  const people = mergePeople([{ course: C1, rows }]);
  eq(people.every((p) => Array.isArray(p.held)), true, "入れ物は必ずある（返す側で足す）");
  eq(people[0].held.length, 0, "はじめは空");

  /* 返す側（/api/admin/summary）が足したあとの形で数える */
  const withHeld = people.map((p) =>
    p.name === "持っている"
      ? {
          ...p,
          held: [{
            id: "h1", name: "玉掛け（つり上げ荷重1t以上）", kind: "技能講習",
            issuer: "前の会社", gotOn: "2024-05-01", certNo: "", confirmedAt: null,
          }],
        }
      : p,
  );
  const t = peopleTotals(withHeld);
  eq(t.issued, 1, "よそで取った資格も、資格を持っている人に数える");
  eq(t.people, 2, "受講者の数は変わらない");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
