/* 画面に出ている行き先を、全部たどって開いてみる。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-links.mjs

   ── なぜ要るか ──
   2026-09-08 に、**行き先の無い札**が3つ見つかった。

     ・受講コードが要る画面の「実務トレーニングの第1章は…」
     ・お知らせの一覧の「章の一覧へ」
     ・実務トレーニングの知らせ

   どれも足場屋革命では正しく開くので、あちらの試験では出ない。
   **特別教育ドットコムでだけ死んでいた。**店が増えると、
   片方でだけ死ぬ札ができる。1画面ずつの試験では拾えない。

   ここは「押せる所を押したら、どこかへ着くか」だけを見る。
   中身は各 e2e が見ている。

   ── 形の同じ画面は1つだけ見る ──
   はじめは集めた行き先を全部たどったら、**7分かかっても終わらなかった。**
   講座が73本あるので /edu/◯◯ が73枚、その先の単元が900枚あって、
   同じ作りの画面を何百回も開いていた。

   だから**住所の形**でまとめる。/edu/ashiba と /edu/toishi は
   同じ形（/edu/*）なので、1枚見れば足りる。死んでいる札は
   「その形の画面が丸ごと無い」か「その札の行き先が違う」かなので、
   形ごとに1枚見れば見つかる。

   形の数え方を間違えると素通りになるので、
   **最後に「いくつの形を見たか」を出す。** */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3100";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

/* 更新のお知らせが出ていたら閉じる（札に重なって拾えなくなる） */
const dismiss = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 1200 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(120); }
};

/* 回り始める所。ログインしていない人が着ける画面 */
const SEEDS = [
  "/",
  "/edu",
  "/updates",
  "/legal/tokushoho",
  "/legal/terms",
  "/legal/privacy",
  "/verify",
  "/login",
];

/* 開いても 404 でよい所。
   **ここに足すときは理由を書くこと。**理由なく足すと、
   死んだ札を「そういうもの」として見逃す入れ物になる */
const OK_404 = [];

/** 住所の形。講座の id や単元の番号は星印にまとめる。

    /edu/ashiba      … 講座が1つぶんの形
    /edu/ashiba/1-1  … 単元が1つぶんの形
    /legal/terms     … 決まった名前なので、そのまま

    （ここに星印そのものを書くと、この注釈が途中で終わってしまう） */
const shapeOf = (href) => {
  const p = href.split("/").filter(Boolean);
  if (p[0] === "edu" && p.length > 1) return `/edu/${p.slice(1).map(() => "*").join("/")}`;
  if (p[0] === "training" && p.length > 1) return `/training/${p.slice(1).map(() => "*").join("/")}`;
  if (p[0] === "invoice" && p.length > 1) return "/invoice/*";
  return "/" + p.join("/");
};

/* 押して開く所（<details>）の中にも札がある。開かないと拾えない */
const openAll = async () => {
  const sums = page.locator("summary");
  const n = await sums.count();
  for (let i = 0; i < n; i++) await sums.nth(i).click().catch(() => {});
  if (n) await page.waitForTimeout(120);
};

/** その画面に出ている、この仕組みの中への行き先 */
const linksOn = async (path) => {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await dismiss();
  await openAll();
  const hrefs = await page.locator("a[href]").evaluateAll((as) =>
    as.map((a) => a.getAttribute("href") ?? ""),
  );
  return [...new Set(hrefs)]
    /* よそ（https://…）・電話・メール・目印だけ（#）は見ない */
    .filter((h) => h.startsWith("/") && !h.startsWith("//"))
    /* 目印（#）と絞り込み（?）は落として、画面だけで数える */
    .map((h) => h.split("#")[0].split("?")[0])
    .filter(Boolean);
};

console.log(`── 押せる所を集める（${BASE}）──`);
/** 住所 → どの画面から来たか */
const from = new Map();
/** もう見た「形」 */
const seen = new Set(SEEDS.map(shapeOf));

const add = (hrefs, src) => {
  for (const h of hrefs) if (!from.has(h)) from.set(h, src);
};

for (const s of SEEDS) {
  const hs = await linksOn(s);
  add(hs, s);
  console.log(`  ${s} … ${hs.length}件`);
}

/* もう1段だけ深く。ただし**形ごとに1枚**しか開かない */
console.log("── 形の違う画面だけ、もう1段たどる ──");
for (const [href, ] of [...from]) {
  const sh = shapeOf(href);
  if (seen.has(sh)) continue;
  seen.add(sh);
  const hs = await linksOn(href).catch(() => []);
  add(hs, href);
  console.log(`  ${sh}（${href}）… ${hs.length}件`);
}

/* 開いて確かめるのも、形ごとに1枚 */
const pick = new Map();
for (const [href, src] of from) {
  const sh = shapeOf(href);
  if (!pick.has(sh)) pick.set(sh, { href, src });
}

console.log(`\n── ${from.size}件を ${pick.size}通りの形にまとめて、1つずつ開く ──`);
console.log(`  形: ${[...pick.keys()].join(" ")}`);
const dead = [];
for (const [sh, { href, src }] of pick) {
  const res = await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" }).catch(() => null);
  const st = res?.status() ?? 0;
  /* ログインが要る画面は、ログインへ送られる（それは死んでいない）。
     見るのは「着かない」ことだけ */
  if (st === 200) continue;
  if (st === 404 && OK_404.includes(href)) continue;
  dead.push({ sh, href, src, st });
}

if (dead.length) {
  for (const d of dead) console.error(`NG: ${d.href} が ${d.st}（${d.src} に出ている札）`);
  ng += dead.length;
} else {
  console.log(`OK: ${pick.size}通り、どれも着く（行き先の無い札は0）`);
}

/* まとめすぎ・拾い漏れの見張り。
   ここが小さいと、この試験は上っ面だけ見て通ってしまう */
check(from.size > 40, `集まった行き先が少なすぎないか（${from.size}件）`);
/* 数で見張らない。数はページの作りで変わるので、**必ず在るはずの形**で見る。
   ここを拾えていないと、この試験は上っ面だけ見て通ってしまう。

   講座が1つぶんの形 … 押して開く所の中の73講座（拾えないと1つも見ていない）
   単元が1つぶんの形 … その先の中身
   売るために要る3枚は、買う前に読まれるので必ず着けること
   （注釈に星印そのものは書かない。書くとここで注釈が終わる） */
for (const must of ["/edu/*", "/edu/*/*", "/legal/tokushoho", "/legal/terms", "/legal/privacy"]) {
  check([...pick.keys()].includes(must), `「${must}」の形まで拾えている`);
}

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
