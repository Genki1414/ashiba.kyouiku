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

/* ── ⑧ 実技のある講座（高所作業車）── ─────────────────
   **この関門を使う講座は高所作業車が初めて。**
   学科だけで修了証を出せば、実技を受けていない人が
   「資格がある」と思って高所作業車に乗る。
   だから、実技の欄が出ること、日付と名前が無いと通らないことを見る。 */
console.log("⑧ 実技のある講座（高所作業車）");
const DRILL = {
  ok: true,
  gate: "drill",
  gateText: { label: "実技", what: "学科のあとに、実技があります。実技は事業者で行い、済んでから発行申請を出してください。" },
  study: { lessons: 8, lessonsPassed: 8, examPassed: true, can: true, why: "" },
  status: "none",
  slots: [],
  note: "",
  replyNote: "",
  drillOn: null,
  drillBy: "",
  sessionId: null,
  reason: "実技が残っています。事業者で実技を行ってから、発行申請を出してください。",
  next: "request",
};
const showDrill = async (body) => {
  await page.unroute("**/api/issue*");
  await page.route("**/api/issue*", (r) => {
    if (r.request().method() !== "GET") return r.fallback();
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(`${BASE}/edu/kousho/cert`);
  await dismissNotice();
  await page.waitForTimeout(400);
};

await showDrill(DRILL);
await page.getByTestId("issue-drill-on").waitFor({ timeout: 6000 })
  .catch(() => check(false, "実技を行った日の欄が出る"));
check(await page.getByTestId("issue-drill-by").count() === 1, "実技を行った人の欄が出る");
check(await page.getByTestId("issue-slots").count() === 0, "実技の講座に、候補日は出さない");
check(await page.getByTestId("issue-go-talk").count() === 0, "実技の講座に、討議の入口は出さない");
const t8 = await page.getByTestId("issue-panel").textContent();
check(t8.includes("その場では発行されません"), "押しても発行されないと、先に書いてある");
check(t8.includes("実技の記録を確かめてから"), "実技の講座の言い方になっている");
check(await page.getByTestId("cert-issue").count() === 0, "実技が済むまで、発行ボタンを出さない");
check(await page.getByTestId("issue-go-drill").count() === 1, "実技の手引きへの入口がある");
await page.screenshot({ path: `${SC}/issue-08-drill.png` });

/* 実技の手引き。会社の人が見る画面なので、ログイン無しで開けること。
   **実技のある講座は増える。決め打ちにせず、全部を回す。** */
for (const [id, mins] of [["kousho", 180], ["harness", 90], ["rope", 180], ["kogata", 360], ["forklift", 360], ["tailgate", 120], ["toishi", 120], ["teiatsu", 420], ["winch", 240], ["roller", 240], ["chainsaw", 540], ["arc", 600], ["kikaitoishi", 180], ["shovel", 360], ["fuseichi", 360], ["kouatsu", 900], ["ev", 60], ["press", 120], ["youka", 240], ["batsuboku", 360], ["soukou", 360], ["kikaishuzai", 480], ["kanikasen", 480], ["kisokouji", 360], ["kaitai", 420], ["kisokenki", 300], ["kisosousa", 240], ["concrete", 300], ["boring", 300], ["jack", 240], ["kidou", 240], ["robotkyoji", 180], ["robotkensa", 240], ["tire", 240], ["tokushu", 900], ["tamakake", 240], ["crane", 240], ["mobilecrane", 240], ["kensetsulift", 240], ["derrick", 240]]) {
  await page.goto(`${BASE}/edu/${id}/drill`);
  await dismissNotice();
  await page.getByTestId("drill-guide").waitFor({ timeout: 6000 })
    .catch(() => check(false, `${id}: 手引きが開く`));
  check((await page.getByTestId("drill-step").count()) >= 3, `${id}: 割り振りが並ぶ`);
  check(await page.getByTestId("drill-form").count() === 1, `${id}: 実施記録の様式がある`);
  check(await page.getByTestId("drill-print").count() === 1, `${id}: 印刷ボタンがある`);
  const g = await page.getByTestId("drill-guide").textContent();
  check(g.includes(`計 ${mins}分`), `${id}: 合計が法定と同じ（計 ${mins}分）`);
  check(g.includes("うちの案"), `${id}: 案であって告示ではないと書いてある`);
  check(g.includes("3年間保存"), `${id}: 記録を3年残すと書いてある`);
  /* 段取りに時間が入っていること。0分の段があると合計が合わない */
  check(!g.includes("　0分"), `${id}: 0分の段が無い`);
  /* 太字の印が、そのまま紙に刷られていないか。
     段取りの中身だけ bold() を通していて、講師・用意するものが素通りしていた */
  check(!g.includes("**"), `${id}: 「**」がそのまま出ていない`);
  /* 様式が講座のものになっているか（流用すると関係のない欄が紙に残る） */
  const form = await page.getByTestId("drill-form").textContent();
  if (id === "harness") {
    check(!form.includes("作業床の高さ"), "フルハーネスの様式に「作業床の高さ」が無い");
    check(form.includes("ランヤード"), "フルハーネスの様式にランヤードの欄がある");
  } else if (id === "rope") {
    check(form.includes("ライフライン") && form.includes("支持物"), "ロープの様式にライフラインと支持物の欄がある");
    check(!form.includes("作業床の高さ"), "ロープの様式に「作業床の高さ」が無い");
  } else if (id === "forklift") {
    check(form.includes("最大荷重") && form.includes("1トン未満"), "フォークリフトの様式に最大荷重と1トン未満の但し書きがある");
    check(form.includes("カウンター式") && form.includes("リーチ式"), "フォークリフトの様式に型式の欄がある");
    check(!form.includes("作業床の高さ"), "フォークリフトの様式に「作業床の高さ」が無い");
  } else if (id === "ev") {
    check(form.includes("サービスプラグ"), "電気自動車の様式にサービスプラグの欄がある");
    check(form.includes("待ち時間") && form.includes("整備要領書"), "電気自動車の様式に待ち時間と整備要領書の欄がある");
    check(form.includes("端子間") && form.includes("自己点検"), "電気自動車の様式に検電（端子間・自己点検）の欄がある");
    check(!form.includes("作業床の高さ"), "電気自動車の様式に「作業床の高さ」が無い");
  } else if (id === "kouatsu") {
    check(form.includes("接近限界距離"), "高圧の様式に接近限界距離の欄がある");
    check(form.includes("検電器の自己点検") && form.includes("短絡接地器具"), "高圧の様式に検電器の自己点検と短絡接地器具の欄がある");
    check(form.includes("充電電路の操作のみ"), "高圧の様式に実技1時間（操作のみ）の区分がある");
    check(!form.includes("作業床の高さ"), "高圧の様式に「作業床の高さ」が無い");
  } else if (id === "jack") {
    check(form.includes("保持機構") && form.includes("同時開放防止機構"), "ジャッキ式つり上げ機械の様式に保持機構と同時開放防止機構の欄がある");
    check(form.includes("同調") && form.includes("地切り"), "ジャッキ式つり上げ機械の様式に調整（同調）の欄がある");
    check(form.includes("台数") && form.includes("第10号の4"), "ジャッキ式つり上げ機械の様式に台数と対象の確認の欄がある");
    check(form.includes("仮受け") && form.includes("保持を解く"), "ジャッキ式つり上げ機械の様式に途中で置くときと保持を解く順の欄がある");
    check(!form.includes("作業床の高さ"), "ジャッキ式つり上げ機械の様式に「作業床の高さ」が無い");
  } else if (id === "derrick") {
    check(form.includes("控え索") && form.includes("アンカー"), "デリックの様式に控え索とアンカーの欄がある");
    check(form.includes("マスト") && form.includes("ベースプレート"), "デリックの様式にマストとベースプレートの欄がある");
    check(form.includes("荷が見えない位置で運転した"), "デリックの様式に、見えない位置での合図の欄がある");
    check(form.includes("ブーム角度") && form.includes("定格荷重表"), "デリックの様式にブーム角度と定格荷重表の欄がある");
    check(form.includes("5トン未満"), "デリックの様式に5トン未満の欄がある");
    check(!form.includes("作業床の高さ"), "デリックの様式に「作業床の高さ」が無い");
  } else if (id === "kensetsulift") {
    check(form.includes("人は乗せない") && form.includes("工事用エレベーターではない"), "建設用リフトの様式に、人を乗せないことの欄がある");
    check(form.includes("囲い") && form.includes("扉が開かない"), "建設用リフトの様式に囲いと扉の欄がある");
    check(form.includes("電鈴") && form.includes("非常"), "建設用リフトの様式に電鈴の合図の欄がある");
    check(form.includes("漏電遮断器") && form.includes("キャブタイヤケーブル"), "建設用リフトの様式に仮設の電路の欄がある");
    check(form.includes("積載荷重"), "建設用リフトの様式に積載荷重の欄がある");
    check(!form.includes("作業床の高さ"), "建設用リフトの様式に「作業床の高さ」が無い");
  } else if (id === "mobilecrane") {
    check(form.includes("1トン未満") && form.includes("小型移動式クレーン運転技能講習"), "移動式クレーンの様式に1トン未満と技能講習の欄がある");
    check(form.includes("アウトリガ") && form.includes("敷板"), "移動式クレーンの様式に据え付け（アウトリガ・敷板）の欄がある");
    check(form.includes("送電線") && form.includes("離隔"), "移動式クレーンの様式に上方の確認（送電線・離隔）の欄がある");
    check(form.includes("作業半径") && form.includes("定格総荷重表"), "移動式クレーンの様式に作業半径と定格総荷重表の欄がある");
    check(form.includes("定められた経路") && form.includes("人の頭の上を通さない"), "移動式クレーンの様式に運搬の経路の欄がある");
    check(!form.includes("作業床の高さ"), "移動式クレーンの様式に「作業床の高さ」が無い");
  } else if (id === "crane") {
    check(form.includes("跨線テルハ") && form.includes("5トン未満"), "クレーンの様式に跨線テルハと5トン未満の欄がある");
    check(form.includes("巻過防止装置") && form.includes("トロリー線"), "クレーンの様式に巻過防止装置と電路の欄がある");
    check(form.includes("重量の確認") && form.includes("定格荷重を超えない"), "クレーンの様式に重量の確認の欄がある");
    check(form.includes("定められた経路") && form.includes("人の頭の上を通さない"), "クレーンの様式に運搬の経路の欄がある");
    check(!form.includes("作業床の高さ"), "クレーンの様式に「作業床の高さ」が無い");
  } else if (id === "tamakake") {
    check(form.includes("1トン未満") && form.includes("技能講習"), "玉掛けの様式に1トン未満と技能講習の欄がある");
    check(form.includes("重量目測") && form.includes("実測"), "玉掛けの様式に重量目測の欄がある");
    check(form.includes("地切りで一度止めた") && form.includes("掛け直した"), "玉掛けの様式に地切りの欄がある");
    check(form.includes("吊り荷の下に入らない") && form.includes("緩んでから外した"), "玉掛けの様式に立ち位置と外しの欄がある");
    check(!form.includes("作業床の高さ"), "玉掛けの様式に「作業床の高さ」が無い");
  } else if (id === "tokushu") {
    check(form.includes("第27号") && form.includes("整備又は修理のみ"), "特殊化学設備の様式に対象の確認とただし書きの区分の欄がある");
    check(form.includes("盲板") && form.includes("入れた数"), "特殊化学設備の様式に盲板の数の欄がある");
    check(form.includes("ガス検知") && form.includes("入っている間も継続"), "特殊化学設備の様式にガス検知の欄がある");
    check(form.includes("通風及び換気") && form.includes("送気マスク"), "特殊化学設備の様式に換気と呼吸用保護具の欄がある");
    check(!form.includes("作業床の高さ"), "特殊化学設備の様式に「作業床の高さ」が無い");
  } else if (id === "tire") {
    check(form.includes("分割リム") && form.includes("第33号"), "自動車用タイヤの様式にリムの形と対象の確認の欄がある");
    check(form.includes("安全囲い") && form.includes("正面に立たなかった"), "自動車用タイヤの様式に安全囲いと立ち位置の欄がある");
    check(form.includes("空気を完全に抜いた") && form.includes("バルブコア"), "自動車用タイヤの様式に分解の前の措置の欄がある");
    check(form.includes("圧力調節装置") && form.includes("指定の圧力で止めた"), "自動車用タイヤの様式に圧力の欄がある");
    check(!form.includes("作業床の高さ"), "自動車用タイヤの様式に「作業床の高さ」が無い");
  } else if (id === "robotkensa") {
    check(form.includes("第32号") && form.includes("教示等"), "産業用ロボット（検査等）の様式に対象の確認と隣の教育の区別の欄がある");
    check(form.includes("施錠") && form.includes("検電"), "産業用ロボット（検査等）の様式に電源を切る欄がある");
    check(form.includes("コンデンサの放電待ち") && form.includes("残圧"), "産業用ロボット（検査等）の様式に残っているエネルギーの欄がある");
    check(form.includes("カバーと安全装置を全部戻した") && form.includes("通電"), "産業用ロボット（検査等）の様式に戻しと通電の欄がある");
    check(!form.includes("作業床の高さ"), "産業用ロボット（検査等）の様式に「作業床の高さ」が無い");
  } else if (id === "robotkyoji") {
    check(form.includes("可動範囲") && form.includes("第31号"), "産業用ロボット（教示等）の様式に可動範囲と対象の確認の欄がある");
    check(form.includes("インターロック") && form.includes("連動している機械"), "産業用ロボット（教示等）の様式にインターロックと連動の欄がある");
    check(form.includes("教示中") && form.includes("鍵は中に入る人が持った"), "産業用ロボット（教示等）の様式に表示と施錠の欄がある");
    check(form.includes("検査等") && form.includes("第19条"), "産業用ロボット（教示等）の様式に隣の教育との区別の欄がある");
    check(!form.includes("作業床の高さ"), "産業用ロボット（教示等）の様式に「作業床の高さ」が無い");
  } else if (id === "kidou") {
    check(form.includes("歯止め") && form.includes("逸走防止装置"), "軌道装置の動力車の様式に歯止めと逸走防止装置の欄がある");
    check(form.includes("第13号") && form.includes("バッテリー"), "軌道装置の動力車の様式に対象の確認と動力の種類の欄がある");
    check(form.includes("連結") && form.includes("退避場所"), "軌道装置の動力車の様式に連結と退避場所の欄がある");
    check(form.includes("分岐") && form.includes("下り勾配"), "軌道装置の動力車の様式に分岐と下り勾配の欄がある");
    check(!form.includes("作業床の高さ"), "軌道装置の動力車の様式に「作業床の高さ」が無い");
  } else if (id === "boring") {
    check(form.includes("ロータリー式") && form.includes("第10号の3"), "ボーリングマシンの様式に機械の種類と対象の確認の欄がある");
    check(form.includes("回転部の覆い") && form.includes("袖を締めた"), "ボーリングマシンの様式に覆いと服装の欄がある");
    check(form.includes("ロッドの継ぎ足し") && form.includes("必ず停止してから"), "ボーリングマシンの様式にロッドの継ぎ足しの欄がある");
    check(form.includes("孔の処置") && form.includes("逸泥"), "ボーリングマシンの様式に孔の処置と逸泥の欄がある");
    check(!form.includes("作業床の高さ"), "ボーリングマシンの様式に「作業床の高さ」が無い");
  } else if (id === "concrete") {
    check(form.includes("アウトリガ") && form.includes("最大張り出し"), "コンクリート打設用の様式にアウトリガの欄がある");
    check(form.includes("輸送管") && form.includes("肉厚"), "コンクリート打設用の様式に輸送管の摩耗の欄がある");
    check(form.includes("閉塞") && form.includes("圧を抜いてから"), "コンクリート打設用の様式に閉塞の処置の欄がある");
    check(form.includes("アルカリ") && form.includes("洗眼"), "コンクリート打設用の様式に生コンの扱いの欄がある");
    check(!form.includes("作業床の高さ"), "コンクリート打設用の様式に「作業床の高さ」が無い");
  } else if (id === "kisosousa") {
    check(form.includes("三者の役割") && form.includes("荷掛け"), "作業装置の操作の様式に三者の役割の欄がある");
    check(form.includes("第9号の3") && form.includes("メーカー"), "作業装置の操作の様式に対象の確認の欄がある");
    check(form.includes("小旗") && form.includes("法定1時間"), "作業装置の操作の様式に合図の実技（法定1時間）の欄がある");
    check(form.includes("鉛直（二方向）") && form.includes("役割を交代"), "作業装置の操作の様式に据付けと役割交代の欄がある");
    check(!form.includes("作業床の高さ"), "作業装置の操作の様式に「作業床の高さ」が無い");
  } else if (id === "kisokenki") {
    check(form.includes("巻上げ装置") && form.includes("二巻き以上残"), "基礎工事用建設機械の様式に巻上げ装置とワイヤロープの欄がある");
    check(form.includes("第9号の2") && form.includes("メーカー"), "基礎工事用建設機械の様式に対象の確認の欄がある");
    check(form.includes("小旗") && form.includes("法定1時間"), "基礎工事用建設機械の様式に合図の実技（法定1時間）の欄がある");
    check(form.includes("鉛直（二方向）") && form.includes("アウトリガ全接地"), "基礎工事用建設機械の様式に据付けの欄がある");
    check(!form.includes("作業床の高さ"), "基礎工事用建設機械の様式に「作業床の高さ」が無い");
  } else if (id === "kaitai") {
    check(form.includes("ブレーカ") && form.includes("3トン未満"), "小型車両系（解体用）の様式にアタッチメントと3トン未満の但し書きがある");
    check(form.includes("前面ガード") && form.includes("飛来落下物防護"), "小型車両系（解体用）の様式に運転室のガードの欄がある");
    check(form.includes("がれきの上") && form.includes("尾振り"), "小型車両系（解体用）の様式にがれきの上と尾振りの欄がある");
    check(form.includes("散水") && form.includes("石綿"), "小型車両系（解体用）の様式に粉じん対策と石綿の欄がある");
    check(!form.includes("作業床の高さ"), "小型車両系（解体用）の様式に「作業床の高さ」が無い");
  } else if (id === "kisokouji") {
    check(form.includes("アースオーガー") && form.includes("3トン未満"), "小型車両系（基礎工事用）の様式に機械の種類と3トン未満の但し書きがある");
    check(form.includes("アウトリガ") && form.includes("水準器"), "小型車両系（基礎工事用）の様式に据付け（アウトリガ・水平）の欄がある");
    check(form.includes("架空電線") && form.includes("埋設物"), "小型車両系（基礎工事用）の様式に上と下の確認の欄がある");
    check(form.includes("小旗") && form.includes("合図者は一人"), "小型車両系（基礎工事用）の様式に合図の欄がある");
    check(!form.includes("作業床の高さ"), "小型車両系（基礎工事用）の様式に「作業床の高さ」が無い");
  } else if (id === "kanikasen") {
    check(form.includes("スイングヤーダ") && form.includes("走行コース"), "簡易架線集材装置等の様式に機械の種類と走行コースの欄がある");
    check(form.includes("控索") && form.includes("アンカー"), "簡易架線集材装置等の様式に据付け（控索・アンカー）の欄がある");
    check(form.includes("継ぎ方") && form.includes("アイスプライス"), "簡易架線集材装置等の様式に止め方・継ぎ方の実習の欄がある");
    check(!form.includes("作業床の高さ"), "簡易架線集材装置等の様式に「作業床の高さ」が無い");
  } else if (id === "kikaishuzai") {
    check(form.includes("索張り方式") && form.includes("タワーヤーダ"), "機械集材装置の様式に索張り方式と集材機の種類の欄がある");
    check(form.includes("主索") && form.includes("安全係数"), "機械集材装置の様式に主索と安全係数の欄がある");
    check(form.includes("継ぎ方") && form.includes("アイスプライス"), "機械集材装置の様式に止め方・継ぎ方の実習の欄がある");
    check(!form.includes("作業床の高さ"), "機械集材装置の様式に「作業床の高さ」が無い");
  } else if (id === "soukou") {
    check(form.includes("フォワーダ") && form.includes("最大積載量"), "走行集材機械の様式に機械の種類と最大積載量の欄がある");
    check(form.includes("ウインチ") && form.includes("グラップル"), "走行集材機械の様式にウインチとグラップルの欄がある");
    check(form.includes("積車") && form.includes("路肩"), "走行集材機械の様式に積車と路肩の欄がある");
    check(!form.includes("作業床の高さ"), "走行集材機械の様式に「作業床の高さ」が無い");
  } else if (id === "batsuboku") {
    check(form.includes("ハーベスタ") && form.includes("フェラーバンチャ"), "伐木等機械の様式に機械の種類の欄がある");
    check(form.includes("立入禁止の範囲") && form.includes("伐倒した立木"), "伐木等機械の様式に立入禁止の範囲と伐倒した立木の欄がある");
    check(form.includes("ヘッドガード") && form.includes("傾斜地"), "伐木等機械の様式にヘッドガードと傾斜地の欄がある");
    check(!form.includes("作業床の高さ"), "伐木等機械の様式に「作業床の高さ」が無い");
  } else if (id === "youka") {
    check(form.includes("制限荷重") && form.includes("5トン未満"), "揚貨装置の様式に制限荷重と5トン未満の但し書きがある");
    check(form.includes("デリック") && form.includes("デッキクレーン"), "揚貨装置の様式に装置の種類の欄がある");
    check(form.includes("小旗") && form.includes("合図者"), "揚貨装置の様式に合図の方法と合図者の欄がある");
    check(!form.includes("作業床の高さ"), "揚貨装置の様式に「作業床の高さ」が無い");
  } else if (id === "press") {
    check(form.includes("ダイハイト") && form.includes("安全ブロック"), "動力プレスの様式にダイハイトと安全ブロックの欄がある");
    check(form.includes("確動クラッチ") && form.includes("光線式"), "動力プレスの様式にクラッチと安全装置の種類の欄がある");
    check(form.includes("安全距離"), "動力プレスの様式に安全距離の実測の欄がある");
    check(!form.includes("作業床の高さ"), "動力プレスの様式に「作業床の高さ」が無い");
  } else if (id === "fuseichi") {
    check(form.includes("最大積載量") && form.includes("1トン未満"), "不整地運搬車の様式に最大積載量と1トン未満の但し書きがある");
    check(form.includes("クローラ式") && form.includes("ホイール式"), "不整地運搬車の様式に機械の型式の欄がある");
    check(form.includes("履帯の張り") && form.includes("不整地"), "不整地運搬車の様式に履帯の張りと不整地の欄がある");
    check(!form.includes("作業床の高さ"), "不整地運搬車の様式に「作業床の高さ」が無い");
  } else if (id === "shovel") {
    check(form.includes("最大荷重") && form.includes("1トン未満"), "ショベルローダー等の様式に最大荷重と1トン未満の但し書きがある");
    check(form.includes("ショベルローダー") && form.includes("フォークローダー"), "ショベルローダー等の様式に機械の型式の欄がある");
    check(form.includes("中折れ") && form.includes("ヘッドガード"), "ショベルローダー等の様式に中折れとヘッドガードの欄がある");
    check(!form.includes("作業床の高さ"), "ショベルローダー等の様式に「作業床の高さ」が無い");
  } else if (id === "kikaitoishi") {
    check(form.includes("主軸回転数") && form.includes("最高使用周速度"), "機械研削の様式に主軸回転数と最高使用周速度の欄がある");
    check(form.includes("バランス取り") && form.includes("試運転の時間"), "機械研削の様式にバランス取りと試運転の時間の欄がある");
    check(!form.includes("作業床の高さ"), "機械研削の様式に「作業床の高さ」が無い");
  } else if (id === "arc") {
    check(form.includes("自動電撃防止装置"), "アーク溶接の様式に自動電撃防止装置の欄がある");
    check(form.includes("換気の方法") && form.includes("呼吸用保護具"), "アーク溶接の様式に換気と呼吸用保護具の欄がある");
    check(!form.includes("作業床の高さ"), "アーク溶接の様式に「作業床の高さ」が無い");
  } else if (id === "chainsaw") {
    check(form.includes("伐倒した立木") && form.includes("伐根直径"), "チェーンソーの様式に伐倒した立木の欄がある");
    check(form.includes("下肢の切創防止用保護衣"), "チェーンソーの様式に下肢の切創防止用保護衣の欄がある");
    check(!form.includes("作業床の高さ"), "チェーンソーの様式に「作業床の高さ」が無い");
  } else if (id === "roller") {
    check(form.includes("機械の質量") && form.includes("締め固めた材料"), "ローラーの様式に質量と材料の欄がある");
    check(form.includes("公道は使えません"), "ローラーの様式に公道は使えないと書いてある");
    check(!form.includes("作業床の高さ"), "ローラーの様式に「作業床の高さ」が無い");
  } else if (id === "winch") {
    check(form.includes("定格荷重") && form.includes("使ったワイヤロープ"), "巻上げ機の様式に定格荷重とワイヤロープの欄がある");
    check(form.includes("長物") && form.includes("丸物"), "巻上げ機の様式に荷の種類の欄がある");
    check(!form.includes("作業床の高さ"), "巻上げ機の様式に「作業床の高さ」が無い");
  } else if (id === "teiatsu") {
    check(form.includes("業務の区分") && form.includes("7時間以上") && form.includes("1時間以上"), "低圧電気の様式に業務の区分（7時間／1時間）の欄がある");
    check(form.includes("絶縁手袋") && form.includes("検電器"), "低圧電気の様式に安全作業用具の欄がある");
    check(!form.includes("作業床の高さ"), "低圧電気の様式に「作業床の高さ」が無い");
  } else if (id === "toishi") {
    check(form.includes("最高使用周速度") && form.includes("試運転の時間"), "自由研削の様式に最高使用周速度と試運転の時間の欄がある");
    check(form.includes("3分以上") && form.includes("1分以上"), "自由研削の様式に3分・1分の但し書きがある");
    check(!form.includes("作業床の高さ"), "自由研削の様式に「作業床の高さ」が無い");
  } else if (id === "tailgate") {
    check(form.includes("リフターの種類") && form.includes("垂直式"), "テールゲートリフターの様式にリフターの種類の欄がある");
    check(form.includes("最大積載荷重") && form.includes("使った台車"), "テールゲートリフターの様式に最大積載荷重と台車の欄がある");
    check(!form.includes("作業床の高さ"), "テールゲートリフターの様式に「作業床の高さ」が無い");
  } else if (id === "kogata") {
    /* 3トン未満かどうかが、この講座のいちばんの分かれ目。様式にも残す */
    check(form.includes("機体重量") && form.includes("3トン未満"), "小型車両系の様式に機体重量と3トン未満の但し書きがある");
    check(form.includes("走行のコース"), "小型車両系の様式に走行のコースの欄がある");
    check(!form.includes("作業床の高さ"), "小型車両系の様式に「作業床の高さ」が無い");
  } else {
    check(form.includes("作業床の高さ"), "高所作業車の様式に作業床の高さがある");
  }
  await page.screenshot({ path: `${SC}/issue-08b-drill-${id}.png`, fullPage: true });
}
/* 実技の無い講座では出ない */
const r404 = await page.goto(`${BASE}/edu/ashiba/drill`);
check(r404 && r404.status() === 404, "学科だけの講座には手引きが無い（404）");

/* 様式のダウンロード。実技をやるのは会社の人で、
   その人はうちの画面を開いたままにしておかない */
{
  const res = await page.request.get(`${BASE}/api/drill-record?courseId=mobilecrane`);
  check(res.status() === 200, "様式をダウンロードできる");
  const cd = res.headers()["content-disposition"] ?? "";
  check(cd.includes("attachment"), "添付として返る", cd);
  check(cd.includes("mobilecrane"), "講座ごとのファイル名", cd);
  const body = await res.text();
  for (const k of ["実施内容", "参加者", "実施事業者名", "実施事業者印", "☐"]) {
    check(body.includes(k), `様式に「${k}」がある`);
  }
  check(
    body.includes("つり上げ荷重1トン未満の移動式クレーン"),
    "様式に、その講座の名前が入っている",
  );
  check(!body.includes("**"), "強調の印が、そのまま紙に刷られない");
  const none = await page.request.get(`${BASE}/api/drill-record?courseId=ashiba`);
  check(none.status() === 404, "学科だけの講座に様式は無い（404）");
}

/* 日と名前を入れずに押したら、サーバが断ること。
   ここは本物の /api/issue に当てる（POST だけ素通しにしてある）。
   ログインしていないので 401 になるが、**画面が理由を出すこと**を見る */
let sent = null;
await page.unroute("**/api/issue*");
await page.route("**/api/issue*", (r) => {
  const req = r.request();
  if (req.method() === "GET") {
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DRILL) });
  }
  sent = JSON.parse(req.postData() ?? "{}");
  return r.fulfill({ status: 400, contentType: "application/json",
    body: JSON.stringify({ ok: false, reason: "実技を行った日を入れてください。" }) });
});
await page.goto(`${BASE}/edu/kousho/cert`);
await dismissNotice();
await page.getByTestId("issue-request").waitFor({ timeout: 6000 });
await page.getByTestId("issue-request").click();
await page.waitForTimeout(600);
check(!!sent && sent.action === "request", "発行申請を送っている");
check(!!sent && "drillOn" in sent && "drillBy" in sent, "実技の日と人を一緒に送っている");
check(
  (await page.getByTestId("issue-panel").textContent()).includes("実技を行った日を入れてください"),
  "断られた理由が画面に出る",
);
await page.screenshot({ path: `${SC}/issue-09-drill-ng.png` });

/* 入れて押したら、その値が乗ること */
await page.getByTestId("issue-drill-on").fill("2026-08-20");
await page.getByTestId("issue-drill-by").fill("中川　元基");

/* 実技の実施記録。**これが無いと申請できない**（0027）。
   1×1 の PNG を選ばせて、端末の中で縮めてから乗るところまで見る */
check(await page.getByTestId("issue-drill-files").count() === 1, "実施記録を選ぶ口がある");
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
await page.getByTestId("issue-drill-files").setInputFiles({
  name: "kiroku.png",
  mimeType: "image/png",
  buffer: PNG,
});
await page.getByTestId("issue-drill-files-list").waitFor({ timeout: 6000 })
  .catch(() => check(false, "選んだ記録が画面に並ぶ"));
check(
  (await page.getByTestId("issue-drill-files-list").textContent()).includes("kiroku.png"),
  "選んだ記録の名前が出る",
);

sent = null;
await page.getByTestId("issue-request").click();
await page.waitForTimeout(600);
check(!!sent && sent.drillOn === "2026-08-20", "入れた日が乗る", );
check(!!sent && sent.drillBy === "中川　元基", "入れた名前が乗る");
check(Array.isArray(sent?.files) && sent.files.length === 1, "実施記録が一緒に乗る");
check(
  typeof sent?.files?.[0]?.data === "string" && sent.files[0].data.startsWith("data:image/"),
  "記録は端末で縮めてから送っている",
);
await page.screenshot({ path: `${SC}/issue-10-drill-sent.png` });

/* 申請したあと。実技の講座では候補日を待たない（そのまま返事待ち） */
await showDrill({
  ...DRILL,
  status: "open",
  drillOn: "2026-08-20",
  drillBy: "中川　元基",
  reason: "発行申請をお預かりしています。実技の記録を確かめてからご連絡します。",
  next: "wait",
});
await page.getByTestId("issue-reason").waitFor({ timeout: 6000 })
  .catch(() => check(false, "いまの状態が出る"));
check(await page.getByTestId("issue-request").count() === 0, "申請中に、もう一度出させない");
check(await page.getByTestId("issue-slots").count() === 0, "実技の講座に候補日は出ない");
check(await page.getByTestId("cert-issue").count() === 0, "申請しただけでは、発行ボタンを出さない");
await page.screenshot({ path: `${SC}/issue-11-drill-open.png` });

await browser.close();
if (ng) { console.error(`\n${ng} 件の不一致`); process.exit(1); }
console.log("\nOK: 発行申請の画面は、状態どおりに出る（討議・実技とも）");
