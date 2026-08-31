/* はじめて使う人への案内の決まり。
   実行: npm run test:onboarding */

import { readFileSync } from "node:fs";
import {
  adminSteps,
  guideFor,
  learnerSteps,
  nowStep,
  showGuide,
  type Who,
} from "../src/lib/onboarding";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`); }
};
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const who = (m: Partial<Who> = {}): Who => ({
  admin: false, member: "none", canLearn: false, company: "", ...m,
});

console.log("── いつ出すか ──");
{
  check(showGuide(who()), "まだ受講できない人には出す");
  check(!showGuide(who({ canLearn: true })), "受講できるようになったら出さない");
  check(!showGuide(null), "誰か分からないうちは出さない");
  /* 済んだ人に案内を出し続けると、次からは読まれなくなる */
  check(!showGuide(who({ member: "active", canLearn: true })), "在籍して受講できる人には出さない");
}

console.log("\n── いま居る所 ──");
{
  const at = (m: Partial<Who>) => {
    const s = learnerSteps(who(m));
    return s.findIndex((x) => x.state === "now");
  };
  check(at({ member: "none" }) === 1, "未所属なら「会社とつなぐ」", `${at({ member: "none" })}`);
  check(at({ member: "pending" }) === 2, "申込み中なら「許可を待つ」");
  check(at({ member: "active" }) === 3, "在籍したら次の段へ");

  /* now は必ず1つ。2つあると、どちらをやればいいか分からない */
  for (const m of ["none", "pending", "active"] as const) {
    const s = learnerSteps(who({ member: m }));
    check(s.filter((x) => x.state === "now").length === 1, `${m}: いまやることは1つだけ`);
    /* 手前は済み、あとはこれから。飛び飛びにならないこと */
    const i = s.findIndex((x) => x.state === "now");
    check(s.slice(0, i).every((x) => x.state === "done"), `${m}: 手前は全部 done`);
    check(s.slice(i + 1).every((x) => x.state === "todo"), `${m}: 先は全部 todo`);
  }
}

console.log("\n── 道のりの中身 ──");
{
  const s = learnerSteps(who({ member: "none" }));
  const all = s.map((x) => x.t).join("／");
  check(s.length >= 6, "修了証まで並べる", all);
  check(all.includes("修了証"), "終わりが修了証だと分かる");
  check(s.some((x) => x.t.includes("許可")), "許可を待つ段がある");
  /* ここを飛ばして「開かない」と詰まるのが、いちばん多い所 */
  check(
    s.some((x) => x.d.includes("名簿")),
    "つながっていないと名簿に載らないことを書く",
  );
  check(s.some((x) => x.t.includes("修了試験")), "修了試験がある");
  /* 討議のある講座があるので、修了証がすぐ出ない場合に触れる */
  check(s.at(-1)!.d.includes("討議"), "討議のことに触れる", s.at(-1)!.d);

  /* 在籍しても受講コードが要るときは、案内をそちらに差し替える */
  const seat = learnerSteps(who({ member: "active" }));
  check(seat[3].t.includes("受講") && seat[3].d.includes("12文字"),
    "在籍していて受講できないなら、受講コードの案内", seat[3].t);
}

console.log("\n── 担当者の道のり ──");
{
  const a = adminSteps(who({ admin: true, company: "東北三上機材株式会社" }));
  check(a[0].d.includes("東北三上機材株式会社"), "自社の名前が出る", a[0].d);
  check(a.filter((x) => x.state === "now").length === 1, "いまやることは1つだけ");
  /* 許可を出し忘れると、受講者の教材が開かない。いちばん忘れられる所 */
  const approve = a.find((x) => x.t.includes("許可"));
  check(!!approve, "申し込みを許可する段がある");
  check(!!approve && approve.d.includes("開きません"), "忘れるとどうなるかを書く", approve?.d);
  check(a.some((x) => x.t.includes("受講コード")), "受講コードを申し込む段がある");
  check(a.some((x) => x.d.includes("8文字")), "参加コードは8文字だと書く");

  /* 会社の名前が無くても文が壊れないこと */
  const noco = adminSteps(who({ admin: true }));
  check(noco[0].d.includes("自社"), "社名が空でも文になる", noco[0].d);
}

console.log("\n── 立場で出し分ける ──");
{
  check(guideFor(who({ admin: true })).title.includes("教育担当者"), "担当者には担当者の道");
  /* 添え書きも立場で変える。担当者は修了証を「出してもらう」側ではない */
  check(!guideFor(who({ admin: true })).lead.includes("修了証"),
    "担当者の添え書きに「修了証が出るまで」と出さない",
    guideFor(who({ admin: true })).lead);
  check(guideFor(who()).lead.includes("修了証"), "受講する人には修了証までと書く");
  const ui = code("src/components/FirstSteps.tsx");
  check(!ui.includes("修了証が出るまで"), "添え書きを画面側で決め打ちにしていない");
  check(guideFor(who()).title === "はじめての方へ", "受講する人には受講の道");
  const g = guideFor(who({ admin: true }));
  check(!g.steps.some((s) => s.t.includes("修了試験")), "担当者に受講者の段は出さない");
}

console.log("\n── 押せるのは、いまやることだけ ──");
{
  /* 先の段を押せると、順番を飛ばして「開かない」と詰まる */
  const c = code("src/components/FirstSteps.tsx");
  check(c.includes('s.state === "now" && s.href'), "now でリンクが付いている物だけ押せる");
  check(c.includes("open"), "開いた状態で出す（閉じていると読まれない）");
  check(c.includes("showGuide"), "出すかどうかは showGuide で決める");

  const n = nowStep(learnerSteps(who({ member: "none" })));
  check(!!n && n.t === "会社とつなぐ", "いまやることを1つ取り出せる", n?.t);
  check(nowStep([]) === null, "空でも落ちない");
}

console.log("\n── ホームの札 ──");
{
  const page0 = code("src/app/page.tsx");
  check(page0.includes("<FirstSteps"), "ホームに出している");
  /* 講座の札より上に出す。押してから断られたのでは遅い */
  check(
    page0.indexOf("<FirstSteps") < page0.indexOf("ready.map"),
    "道のりは講座の札より上に出す",
  );
  const h = code("src/components/HomeCards.tsx");
  check(!h.includes("<FirstSteps"), "HomeCards では出さない（二重に出る）");
  /* 次の一手の札は残す。道のりと両方あって困らない
     （道のりは全体、札はいまやること） */
  check(h.includes("home-join") && h.includes("home-pending"), "今までの札も残っている");

  /* 講座の札。「学科」で決め打ちにすると職長教育で嘘になる（/edu と同じ） */
  const page = code("src/app/page.tsx");
  check(!page.includes("学科 計"), "「学科」で決め打ちにしていない");
  check(page.includes("totalNoteOf(c)"), "学科か学科・討議かは講座から出す");
  check(!page.includes("Math.round(c.totalMin / 60)"), "時間の丸めをやめた");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
