/* 修了証の発行申請の決まりのテスト。
   実行: npm run test:issue */

import {
  SLOT_LEAD_DAYS,
  SLOT_MAX,
  canRequest,
  checkRoom,
  checkSlots,
  gateCleared,
  gateReason,
  nextAction,
  sortQueue,
  waitingCount,
  type IssueState,
  type IssueStatus,
} from "../src/lib/issue";
import { eligible } from "../src/lib/cert";
import { COURSES, drillMinOf, gateOf, needsRequest, findCourse } from "../src/content/courses";
import { readFileSync } from "node:fs";
import { DRILL_GUIDE_IDS, drillGuideOf } from "../src/content/drill";
import { KOUSHO_JITSUGI } from "../src/content/kousho";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`); }
};

const st = (status: IssueStatus, more: Partial<IssueState> = {}): IssueState => ({
  gate: "talk",
  status,
  slots: [],
  note: "",
  replyNote: "",
  drillOn: null,
  drillBy: "",
  ...more,
});

console.log("── どの講座に関門が付くか ──");
{
  /* 討議のある講座だけ。学科だけで修了する講座は、その場で出してよい */
  const shokucho = findCourse("shokucho")!;
  const ashiba = findCourse("ashiba")!;
  check(gateOf(shokucho) === "talk", "職長教育には討議の関門が付く", `${gateOf(shokucho)}`);
  check(gateOf(ashiba) === null, "足場の特別教育には関門が無い（学科だけで修了）");
  check(needsRequest(shokucho), "職長教育は発行申請が要る");
  check(!needsRequest(ashiba), "足場の特別教育は申請なしで出せる");

  /* 討議のある講座（type が ondemand でない）は、必ず関門を持つこと。
     持たせ忘れると、討議が済んでいない人に修了証が出る */
  for (const c of COURSES) {
    const live = (c.type ?? "ondemand") !== "ondemand";
    check(!live || gateOf(c) !== null, `${c.id}: 討議のある講座に関門が付いている`);
  }
}

console.log("\n── 学科が終わるまで申請できない ──");
{
  check(!canRequest({ lessons: 13, lessonsPassed: 12, examPassed: true }).ok, "1単元でも残っていれば出せない");
  const r = canRequest({ lessons: 13, lessonsPassed: 10, examPassed: true });
  check(!r.ok && r.reason.includes("3単元"), "残りの数を出す", !r.ok ? r.reason : "");
  check(!canRequest({ lessons: 13, lessonsPassed: 13, examPassed: false }).ok, "修了試験が残っていれば出せない");
  check(canRequest({ lessons: 13, lessonsPassed: 13, examPassed: true }).ok, "全部終わっていれば出せる");
  check(!canRequest({ lessons: 0, lessonsPassed: 0, examPassed: true }).ok, "教材が読めていなければ出せない");
}

console.log("\n── 申請しただけでは修了証は出ない ──");
{
  /* ここがこの回の肝。学科が終わって申請しても、討議が済むまでは出さない */
  const base = { lessons: 13, lessonsPassed: 13, examPassed: true };
  for (const s of ["none", "open", "offered", "picked", "declined"] as IssueStatus[]) {
    const e = eligible({ ...base, gate: { reason: gateReason("talk", st(s)) } });
    check(!e.ok, `${s}：修了証は出せない`, e.ok ? "" : e.reason);
  }
  const done = eligible({ ...base, gate: { reason: gateReason("talk", st("cleared")) } });
  check(done.ok, "cleared：はじめて出せる");

  /* 関門の無い講座は、いままでどおりその場で出せる */
  check(eligible(base).ok, "関門の無い講座は、そのまま出せる");
  check(gateCleared(st("cleared")), "cleared だけが通った状態");
  check(!gateCleared(null), "申請していなければ通っていない");
}

console.log("\n── 状態ごとの案内と、次にやること ──");
{
  check(gateReason("talk", null).includes("発行申請"), "未申請：申請を促す", gateReason("talk", null));
  check(gateReason("talk", st("open")).includes("候補日"), "申請中：候補日を待つ、と伝える");
  check(gateReason("talk", st("offered")).includes("選んで"), "候補日が来たら、選ぶよう伝える");
  check(gateReason("talk", st("picked")).includes("討議"), "日が決まったら、討議の案内");
  check(gateReason("talk", st("cleared")) === "", "通ったら理由は空");

  /* 断ったときは、こちらの一言をそのまま返す */
  const d = gateReason("talk", st("declined", { replyNote: "実技の日が入っていません" }));
  check(d.includes("実技の日が入っていません"), "断った理由が本人に届く", d);

  check(nextAction("talk", null) === "request", "未申請なら、まず申請");
  check(nextAction("talk", st("open")) === "wait", "申請中は待つ");
  check(nextAction("talk", st("offered")) === "pick", "候補日が来たら選ぶ");
  check(nextAction("talk", st("picked")) === "talk", "日が決まったら討議へ");
  check(nextAction("talk", st("cleared")) === "none", "通ったらやることは無い");
  check(nextAction("talk", st("declined")) === "request", "返されたら出し直せる");

  /* 実技の講座には候補日を出さない。日を決めるのはこちらではない */
  check(nextAction("drill", st("open", { gate: "drill" })) === "wait", "実技：申請中は待つ");
  check(
    !gateReason("drill", null).includes("候補日"),
    "実技：候補日の話をしない",
    gateReason("drill", null),
  );
  check(gateReason("drill", null).includes("事業者"), "実技：事業者で行うと伝える");
}

console.log("\n── 候補日の検査 ──");
{
  const now = new Date("2026-09-01T00:00:00Z");
  const at = (d: number, h = 10) =>
    new Date(Date.UTC(2026, 8, 1 + d, h, 0, 0)).toISOString();

  check(!checkSlots([], now).ok, "候補日が空なら出せない");

  const many = Array.from({ length: SLOT_MAX + 1 }, (_, i) => ({ startsAt: at(5 + i), minutes: 45 }));
  const m = checkSlots(many, now);
  check(!m.ok && m.reason.includes(`${SLOT_MAX}件`), "多すぎる候補は断る", !m.ok ? m.reason : "");

  /* 明日いきなりは都合がつかない。過ぎた日はもってのほか */
  const soon = checkSlots([{ startsAt: at(0, 12), minutes: 45 }], now);
  check(!soon.ok, "今日の日付は出せない", !soon.ok ? soon.reason : "");
  const past = checkSlots([{ startsAt: at(-3), minutes: 45 }], now);
  check(!past.ok, "過ぎた日は出せない");
  const lead = checkSlots([{ startsAt: at(SLOT_LEAD_DAYS + 1), minutes: 45 }], now);
  check(lead.ok, `${SLOT_LEAD_DAYS}日より先なら出せる`, lead.ok ? "" : lead.reason);

  const dup = checkSlots(
    [{ startsAt: at(5), minutes: 45 }, { startsAt: at(5), minutes: 45 }],
    now,
  );
  check(!dup.ok && dup.reason.includes("同じ日時"), "同じ日時を2つ出せない");

  const bad = checkSlots([{ startsAt: "きのう", minutes: 45 }], now);
  check(!bad.ok, "日時の形が読めなければ断る");

  const zero = checkSlots([{ startsAt: at(5), minutes: 0 }], now);
  check(!zero.ok, "長さ0分は出せない");
  const long = checkSlots([{ startsAt: at(5), minutes: 999 }], now);
  check(!long.ok, "長すぎる回は出せない");

  /* 並べ替えて返す。入れた順に出すと、画面で前後する */
  const sorted = checkSlots(
    [{ startsAt: at(9), minutes: 45 }, { startsAt: at(5), minutes: 45 }],
    now,
  );
  check(
    sorted.ok && sorted.slots[0].startsAt < sorted.slots[1].startsAt,
    "早い順に並べて返す",
  );
  check(sorted.ok && sorted.slots.every((s) => s.startsAt.endsWith("Z")), "UTCで揃えて返す");
}

console.log("\n── つなぎ先（Zoom）の検査 ──");
{
  check(!checkRoom("").ok, "空では入れられない");
  check(!checkRoom("   ").ok, "空白だけでも入れられない");
  check(!checkRoom("ここに貼る").ok, "URL の形でなければ断る");
  /* http は使わせない。討議の部屋の場所が、途中で読まれる */
  const http = checkRoom("http://zoom.example.com/j/123");
  check(!http.ok && http.reason.includes("https"), "http は断る", !http.ok ? http.reason : "");
  const ok1 = checkRoom(" https://zoom.example.com/j/123?pwd=x ");
  check(ok1.ok, "https なら入れられる", ok1.ok ? "" : ok1.reason);
  check(ok1.ok && ok1.url === "https://zoom.example.com/j/123?pwd=x", "前後の空白を落とす");
  check(!checkRoom("https://x.example.com/" + "a".repeat(2100)).ok, "長すぎる URL は断る");
}

console.log("\n── 本部の一覧の並び ──");
{
  /* 待たせている人が上。日付順にすると、返事をしていない申請が下に埋もれる */
  const rows = [
    { status: "cleared" as IssueStatus, requestedAt: "2026-08-01T00:00:00Z", id: "c" },
    { status: "open" as IssueStatus, requestedAt: "2026-08-20T00:00:00Z", id: "o2" },
    { status: "picked" as IssueStatus, requestedAt: "2026-08-05T00:00:00Z", id: "p" },
    { status: "open" as IssueStatus, requestedAt: "2026-08-10T00:00:00Z", id: "o1" },
  ];
  const s = sortQueue(rows);
  check(s[0].id === "o1" && s[1].id === "o2", "返事待ちが先。同じなら古い順", s.map((r) => r.id).join(","));
  check(s.at(-1)!.id === "c", "済んだものは最後");
  check(waitingCount(rows) === 2, "返事待ちの数を数える", `${waitingCount(rows)}`);
  check(sortQueue(rows) !== rows, "元の配列を書き換えない");
}

console.log("\n── 実技の残る講座（高所作業車）──");
{
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const code = (p: string) =>
    read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

  const k = findCourse("kousho");
  check(!!k, "高所作業車が講座になっている");
  check(gateOf(k!) === "drill", "関門は実技（drill）", `${gateOf(k!)}`);
  check(needsRequest(k!), "押した瞬間には修了証を出さない");

  /* 実技のある講座は、何時間残るかを必ず持つこと。
     持っていないと、画面に「3時間」と書き込むことになる */
  for (const c of COURSES.filter((x) => gateOf(x) === "drill")) {
    check(drillMinOf(c) > 0, `${c.id}: 実技の時間が入っている`, `${drillMinOf(c)}`);
  }
  check(drillMinOf(k!) === 180, "高所作業車の実技は3時間（規程第13条）");
  /* 実技の無い講座から実技の時間が出ない */
  check(drillMinOf(findCourse("ashiba")!) === 0, "学科だけの講座は0分");
  check(drillMinOf(findCourse("shokucho")!) === 0, "討議の講座は実技0分");

  /* **学科を見終わってから「まだ修了ではない」と知るのでは遅い。**
     単元一覧の前に出ていること */
  const ui = code("src/app/edu/[courseId]/LessonList.tsx");
  check(ui.includes('data-testid="drill-note"'), "単元一覧の画面に実技の案内がある");
  check(ui.indexOf("drill-note") < ui.indexOf("subjects.map"), "単元の並びより前に出す");
  check(ui.includes("学科だけでは修了になりません"), "学科だけでは修了しないと書く");
  check(ui.includes("hoursText(drillMin)"), "時間は講座から出す（画面に書き込まない）");
  check(!ui.includes("実技（3時間）"), "「3時間」を画面に書き込んでいない");
  check(ui.includes('drillMin > 0 ? "修了証と発行申請"'), "実技の講座では修了証の入口が発行申請になる");

  /* 申請の口に、実技の日と人の欄があること */
  const panel = code("src/components/edu/IssuePanel.tsx");
  check(panel.includes('data-testid="issue-drill-on"'), "実技を行った日の欄がある");
  check(panel.includes('data-testid="issue-drill-by"'), "実技を行った人の欄がある");
  check(panel.includes('gate === "drill" && ('), "実技の講座だけに出す");
  /* 本部が確かめられること。見えなければ通してよいか分からない */
  const owner = code("src/app/owner/IssueClient.tsx");
  check(owner.includes("drillOn") && owner.includes("drillBy"), "本部の一覧に実技の日と人が出る");
}

console.log("\n── 実技の手引き ──");
{
  /* 「実技をやってください」だけでは、何を何分やればいいか分からない。
     実技のある講座には、手引きが必ず付いていること */
  for (const c of COURSES.filter((x) => gateOf(x) === "drill")) {
    check(!!drillGuideOf(c.id), `${c.id}: 実技の手引きがある`);
  }
  for (const id of DRILL_GUIDE_IDS) {
    const c = findCourse(id);
    check(!!c && gateOf(c) === "drill", `${id}: 手引きは実技のある講座にだけ付く`);
  }
  check(drillGuideOf("ashiba") === null, "学科だけの講座に手引きは無い");

  const g = drillGuideOf("kousho")!;
  /* **法定は「あわせて3時間」。割り振りの合計がそれを下回ってはいけない** */
  check(g.legalMin === 180, "高所作業車の実技は180分", `${g.legalMin}`);
  check(g.totalMin === g.legalMin, "割り振りの合計が法定と同じ", `${g.totalMin}`);
  check(g.legalMin === drillMinOf(findCourse("kousho")!), "courses.ts の drillMin と同じ");
  /* 告示の範囲（中欄）に、段取りが1つも当たっていない、が無いこと */
  for (const sc of KOUSHO_JITSUGI.scope) {
    check(g.steps.some((s) => s.scope === sc), `範囲「${sc}」に段取りがある`);
  }
  check(g.steps.every((s) => KOUSHO_JITSUGI.scope.includes(s.scope)), "告示に無い範囲を指していない");
  check(g.steps.every((s) => s.min > 0 && s.items.length >= 3), "段取りごとに中身がある");
  check(new Set(g.steps.map((s) => s.no)).size === g.steps.length, "番号が重なっていない");
  /* 学科と結びつける先が、実在する単元であること */
  const cur = JSON.parse(readFileSync(new URL("../content/courses/kousho.json", import.meta.url), "utf8"));
  const ids = new Set<string>(cur.subjects.flatMap((s: { lessons: { id: string }[] }) => s.lessons.map((l) => l.id)));
  for (const s of g.steps) for (const l of s.gakka) check(ids.has(l), `${s.no}: 学科 ${l} は実在する`);
  /* 非常停止と緊急降下を、全員が自分の手で操作する段があること。
     ここを見学で済ませると、慌てた場面で探すことになる */
  check(g.steps.some((s) => s.items.join("").includes("緊急降下")), "緊急降下装置を実際に操作する");
  check(g.teacher.rule.includes("資格の定めはありません"), "講師の資格が法令に無いことを正直に書く");
  check(g.teacher.who.length >= 2 && g.teacher.not.length >= 1, "誰がやるか・やらないかの両方がある");
  check(g.keepYears === 3, "記録は3年保存（安衛則38条）");

  /* 画面。受講者・本部・会社の担当者、三方から辿れること。
     辿れない画面は、作っていないのと同じ */
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const code = (p: string) =>
    read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const page = code("src/app/edu/[courseId]/drill/page.tsx");
  check(page.includes("notFound()") && page.includes("drillGuideOf"), "実技の無い講座では出さない（404）");
  const view = code("src/app/edu/[courseId]/drill/DrillGuideView.tsx");
  check(view.includes('data-testid="drill-form"'), "実施記録の様式がある");
  check(view.includes("window.print()"), "印刷できる");
  check(view.includes("うちの案") && view.includes("告示ではありません"), "割り振りは案であって告示ではないと書く");
  check(view.includes("下回らないこと"), "合計を下回らないことだけ守れと書く");
  check(view.includes("第38条"), "記録の根拠を書く");
  check(code("src/app/edu/[courseId]/LessonList.tsx").includes('data-testid="go-drill"'), "受講者の一覧から辿れる");
  check(code("src/components/edu/IssuePanel.tsx").includes('data-testid="issue-go-drill"'), "発行申請の口から辿れる");
  check(code("src/app/admin/AdminClient.tsx").includes('data-testid="admin-go-drill"'), "教育担当者の画面から辿れる");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
