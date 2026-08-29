/* 修了証の発行申請の画面。

   状態ごとに、何が出て何が出ないかを見る。
   ・学科が終わるまで、申請の口を開けない
   ・申請しても、その場では発行しない
   ・候補日は選べるが、作れない
   ・関門の無い講座には、この枠ごと出さない

   本物のログインは要らないように、/api/issue の返事を差し替える。
   見たいのは画面の側の組み立てなので、それで足りる。
   （データベース側は tests/admin-db.mts が本物のスキーマに当てている）

   実行: npm run dev -- -p 3100 のあと node tests/e2e-issue.mjs */
import { chromium } from "playwright-core";

const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (c) { console.log("  ok", m); } else { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

const dismissNotice = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 2000 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
};

const at = (days) => new Date(Date.now() + days * 86400000).toISOString();

/* 修了証そのものは、この試験の対象ではない。
   出せない理由だけ返させて、申請の枠に集中する */
await page.route("**/api/cert*", (r) =>
  r.fulfill({ status: 409, contentType: "application/json",
    body: JSON.stringify({ ok: false, reason: "討議が残っています。" }) }));

const show = async (body) => {
  await page.route("**/api/issue*", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }));
  await page.goto(`${BASE}/edu/shokucho/cert`);
  await dismissNotice();
  await page.waitForTimeout(400);
};

const BASE_BODY = {
  ok: true,
  gate: "talk",
  gateText: { label: "討議", what: "学科のあとに、オンラインの討議があります。" },
  study: { lessons: 13, lessonsPassed: 13, examPassed: true, can: true, why: "" },
  status: "none",
  slots: [],
  note: "",
  replyNote: "",
  drillOn: null,
  drillBy: "",
  sessionId: null,
  reason: "討議が残っています。発行申請を出してください。",
  next: "request",
};

/* ── ① 学科が途中：申請の口を開けない ── */
console.log("① 学科が途中");
await show({
  ...BASE_BODY,
  study: { lessons: 13, lessonsPassed: 9, examPassed: false, can: false, why: "確認問題が残り4単元あります。全部に合格してください。" },
  reason: "",
});
await page.getByTestId("issue-panel").waitFor({ timeout: 6000 })
  .catch(() => check(false, "申請の枠が出る"));
check(await page.getByTestId("issue-locked").count() === 1, "何が残っているかを出す");
check((await page.getByTestId("issue-locked").textContent()).includes("9 ／ 13"), "残りの単元数を出す");
check(await page.getByTestId("issue-request").count() === 0, "学科が途中なら、申請ボタンを出さない");
await page.screenshot({ path: `${SC}/issue-01-locked.png` });

/* ── ② 学科が終わった：申請できる ── */
console.log("② 学科が終わった");
await show(BASE_BODY);
await page.getByTestId("issue-request").waitFor({ timeout: 6000 })
  .catch(() => check(false, "申請ボタンが出る"));
check(await page.getByTestId("issue-locked").count() === 0, "残りの案内は消える");
check(await page.getByTestId("issue-note").count() === 1, "都合の悪い日を書ける");
check(await page.getByTestId("issue-drill-on").count() === 0, "討議の講座に、実技の欄は出さない");
const t2 = await page.getByTestId("issue-panel").textContent();
check(t2.includes("その場では発行されません"), "押しても発行されないと、先に書いてある");
check((await page.getByTestId("issue-status").textContent()).includes("未申請"), "状態が「未申請」");
check(await page.getByTestId("cert-reason").count() === 0, "同じ理由を上下に2回出さない");
await page.screenshot({ path: `${SC}/issue-02-canrequest.png` });

/* ── ③ 申請した：返事待ち。まだ発行されない ── */
console.log("③ 申請した");
await show({
  ...BASE_BODY,
  status: "open",
  note: "平日の夕方だと助かります",
  reason: "発行申請をお預かりしています。討議の候補日が決まりしだいお知らせします。",
  next: "wait",
});
await page.getByTestId("issue-reason").waitFor({ timeout: 6000 })
  .catch(() => check(false, "いまの状態が出る"));
check(await page.getByTestId("issue-request").count() === 0, "申請中に、もう一度出させない");
check(await page.getByTestId("issue-slots").count() === 0, "候補日はまだ出ない");
check((await page.getByTestId("issue-status").textContent()).includes("申請中"), "状態が「申請中」");
check(await page.getByTestId("cert-issue").count() === 0, "申請しただけでは、発行ボタンを出さない");
await page.screenshot({ path: `${SC}/issue-03-open.png` });

/* ── ④ 候補日が届いた：選べる ── */
console.log("④ 候補日が届いた");
await show({
  ...BASE_BODY,
  status: "offered",
  slots: [
    { id: "s1", startsAt: at(5), minutes: 45, note: "", picked: false },
    { id: "s2", startsAt: at(7), minutes: 45, note: "夜の回です", picked: false },
  ],
  replyNote: "ご都合のよい日をお選びください",
  reason: "討議の候補日が届いています。都合のよい日を選んでください。",
  next: "pick",
});
await page.getByTestId("issue-slots").waitFor({ timeout: 6000 })
  .catch(() => check(false, "候補日が出る"));
const slots = page.getByTestId("issue-slot");
check(await slots.count() === 2, "候補日が2件並ぶ");
check(await slots.first().isEnabled(), "候補日を押せる");
const t4 = await page.getByTestId("issue-panel").textContent();
check(t4.includes("45分"), "1回の長さが出る");
check(t4.includes("夜の回です"), "添えた一言が出る");
check(t4.includes("ご都合のよい日を"), "こちらからの一言が出る");
check(await page.getByTestId("issue-request").count() === 0, "候補日が来たら、申請ボタンは出さない");
await page.screenshot({ path: `${SC}/issue-04-offered.png` });

/* ── ⑤ 日が決まった：討議へ。まだ発行されない ── */
console.log("⑤ 日が決まった");
await show({
  ...BASE_BODY,
  status: "picked",
  slots: [
    { id: "s1", startsAt: at(5), minutes: 45, note: "", picked: true },
    { id: "s2", startsAt: at(7), minutes: 45, note: "", picked: false },
  ],
  sessionId: "ses-1",
  reason: "討議の日が決まっています。当日は時間になったら討議の画面から入ってください。",
  next: "talk",
});
await page.getByTestId("issue-go-talk").waitFor({ timeout: 6000 })
  .catch(() => check(false, "討議の画面への入口が出る"));
const picked = page.getByTestId("issue-slot").and(page.locator('[data-picked="1"]'));
check(await picked.count() === 1, "選んだ日に印が付く");
check(!(await page.getByTestId("issue-slot").first().isEnabled()), "決まったあとは押し直せない");
check((await page.getByTestId("issue-status").textContent()).includes("決まりました"), "状態が「日が決まりました」");
check(await page.getByTestId("cert-issue").count() === 0, "討議の前に、発行ボタンを出さない");
await page.screenshot({ path: `${SC}/issue-05-picked.png` });

/* ── ⑥ 返された：理由が届いて、出し直せる ── */
console.log("⑥ 返された");
await show({
  ...BASE_BODY,
  status: "declined",
  replyNote: "その週は都合がつきません。別の週でお願いします。",
  reason: "発行申請をお返ししています。その週は都合がつきません。別の週でお願いします。",
  next: "request",
});
await page.getByTestId("issue-request").waitFor({ timeout: 6000 })
  .catch(() => check(false, "出し直せる"));
check(
  (await page.getByTestId("issue-panel").textContent()).includes("別の週でお願いします"),
  "返した理由が本人に届く",
);
await page.screenshot({ path: `${SC}/issue-06-declined.png` });

/* ── ⑦ 関門の無い講座：枠ごと出さない ── */
console.log("⑦ 関門の無い講座");
await page.unroute("**/api/issue*");
await page.route("**/api/issue*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, gate: null }) }));
await page.goto(`${BASE}/edu/ashiba/cert`);
await dismissNotice();
await page.waitForTimeout(500);
check(await page.getByTestId("issue-panel").count() === 0, "学科だけの講座には、申請の枠を出さない");
check(await page.getByTestId("cert-reason").count() === 1, "いままでどおり、出せない理由は出る");
await page.screenshot({ path: `${SC}/issue-07-nogate.png` });

await browser.close();
if (ng) { console.error(`\n${ng} 件の不一致`); process.exit(1); }
console.log("\nOK: 発行申請の画面は、状態どおりに出る");
