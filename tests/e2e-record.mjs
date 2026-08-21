/* 成績の保存と間違いノートのE2E。
   章を通すと記録が残り、章の一覧に前回の成績が出て、
   言われたことが間違いノートに溜まるかを見る。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-record.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

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

await page.goto(`${BASE}/training`);
await dismissNotice();

/* ── まだ何も通していない ── */
check((await page.locator("text=まだ通していない").count()) >= 3, "はじめは3章とも「まだ通していない」");
check((await page.getByTestId("note-link").count()) === 0, "言われたことが無ければノートへの入口は出ない");
console.log("OK: はじめは記録が無い");

/* ── 記録を直接入れて、表示を確かめる ──
   （章を通すのは e2e-ch1/2/3 でやっているので、ここは残し方と見せ方を見る） */
await page.evaluate(() => {
  const err = (tag, message, why) => ({ tag, message, why });
  const at = (d) => `2026-08-${d}T09:00:00.000Z`;
  const a = (atv, skill, errs) => ({
    at: atv, tutorial: true, sk: false,
    skill, score: skill * 100, best: 4, sec: 151, hints: 0, asks: 2, errs,
  });
  localStorage.setItem("ashiba.training", JSON.stringify({
    ch1: [
      a(at("21"), 92, [err("離れを見ていない", "先に離れを見ろ。", "あとで柱ごと動かすことになる。")]),
      a(at("20"), 66, [
        err("離れを見ていない", "先に離れを見ろ。", "あとで柱ごと動かすことになる。"),
        err("建てる順序", "その柱の番じゃない。", "基準は出隅だ。順を飛ばすと割り付けが狂う。"),
      ]),
    ],
    ch2: [a(at("21"), 74, [err("取付位置の誤り", "そのスパンじゃない。", "筋交は一直線に上げる。")])],
  }));
});
await page.reload();
await page.waitForTimeout(500);

/* ── 章の一覧の「前回」 ── */
const ch1 = page.locator('[data-record="ch1"]');
await ch1.waitFor({ timeout: 3000 }).catch(() => check(false, "第1章に前回の成績が出る"));
const t1 = await ch1.textContent();
check(t1.includes("92"), `第1章の技能点が出る（${t1.trim()}）`);
check(t1.includes("A"), "段位が出る");
check(t1.includes("2回"), "通した回数が出る");
check(t1.includes("02:31"), "かかった時間が出る");
const t2 = await page.locator('[data-record="ch2"]').textContent();
check(t2.includes("74") && t2.includes("C"), `第2章は不合格の見せ方（${t2.trim()}）`);
check((await page.locator("text=まだ通していない").count()) === 1, "第3章だけ「まだ通していない」");
await page.screenshot({ path: `${SC}/record-01-list.png`, fullPage: true });
console.log("OK: 章の一覧に前回の成績が出る");

/* ── 間違いノート ── */
const link = page.getByTestId("note-link");
check((await link.count()) === 1, "ノートへの入口が出る");
check((await link.textContent()).includes("3件"), "件数が出る（章×中身で3件）");
await link.click();
await page.waitForSelector("text=間違いノート", { timeout: 5000 })
  .catch(() => check(false, "ノートが開く"));

const items = page.locator("[data-note-item]");
/* 端末から読み込んだあとに出るので、1件目が出るまで待つ */
await items.first().waitFor({ timeout: 5000 }).catch(() => check(false, "言われたことが出ない"));
check((await items.count()) === 3, `言われたことが3件並ぶ（${await items.count()}）`);
const first = await items.first().textContent();
check(first.includes("離れを見ていない"), `多く言われたものが上（${first.slice(0, 20)}）`);
check(first.includes("×2"), "回数が付く");
check(first.includes("あとで柱ごと動かす"), "なぜ駄目かも出る");

/* まだ言われる／直せた の分かれ方 */
check((await page.locator('[data-section="open"]').count()) === 1, "「まだ言われる」がある");
check((await page.locator('[data-section="fixed"]').count()) === 1, "「直せた」がある");
const fixed = await page.locator('[data-section="fixed"]').textContent();
check(fixed.includes("建てる順序"), "最後の1回で言われなかったものが「直せた」に入る");
check(!fixed.includes("取付位置の誤り"), "最後にも言われたものは「直せた」に入らない");

/* まとめ */
const body = await page.locator("main").textContent();
check(body.includes("言われた回数"), "合計の回数が出る");
check(body.includes("4回"), "合計は4回（1+2+1）");
await page.screenshot({ path: `${SC}/record-02-note.png`, fullPage: true });
console.log("OK: 間違いノートに溜まる");

/* ── 記録を消す ── */
await page.getByRole("button", { name: "記録を消す" }).click();
await page.waitForTimeout(200);
check((await page.locator("text=戻せません").count()) === 1, "消す前に確かめる");
await page.getByTestId("note-clear-yes").click();
await page.waitForTimeout(300);
check((await page.locator("[data-note-item]").count()) === 0, "消えた");
check(
  (await page.evaluate(() => localStorage.getItem("ashiba.training"))) === null,
  "端末からも消えた",
);
await page.goto(`${BASE}/training`);
await page.waitForTimeout(400);
check((await page.locator("text=まだ通していない").count()) >= 3, "章の一覧も元に戻る");
console.log("OK: 記録を消せる");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
