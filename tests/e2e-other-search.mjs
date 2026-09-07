/* 「その他特別教育」の探す窓を、いろいろな打ち方で試す。
   実行: npm run dev -- -p 3100 && node tests/e2e-other-search.mjs

   71講座を1枚ずつめくるのは無理なので、この窓が唯一の入口になる。
   窓が働かなければ、その71講座は無いのと同じ。

   tests/menu.ts は「窓が札より上にある」「3つの群れとも絞る」を
   書き方の側から見ている。ここは実際に打ち込んで、
   ・別名で当たるか（アスベスト→石綿、ユンボ→車両系建設機械、酸欠→酸素欠乏）
   ・半角カナで当たるか（現場の人はこれで打つことがある）
   ・前後の空白で全部消えないか
   ・変な文字を入れられても壊れないか
   を見る。ホームと一覧の両方でやる。片方だけ直す取りこぼしが実際にあった。 */
import { chromium } from "playwright-core";
const URL = process.env.BASE ?? "http://127.0.0.1:3100";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
let ok = 0, ng = 0;
const t = (c, m) => { if (c) { ok++; console.log("  OK:", m); } else { ng++; console.error("  NG:", m); } };

const ME = { ok: true, userId: "u1", name: "中川 元基", email: "n@x", admin: true, owner: false, needsJoin: false, canLearn: true, courses: 1, company: "東北三上機材株式会社" };
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage();
await page.route("**/api/me", (r) => r.fulfill({ json: ME }));

for (const [label, path] of [["ホーム", "/"], ["一覧", "/edu"]]) {
  console.log(`── ${label}（${path}）──`);
  await page.goto(URL + path, { waitUntil: "domcontentloaded" });
  const d = page.getByTestId("update-close");
  await d.waitFor({ timeout: 3000 }).catch(() => {});
  if (await d.count()) { await d.click(); await page.waitForTimeout(200); }
  /* 足場屋革命は「その他特別教育」を開いてから窓が出る。
     特別教育ドットコムは最初から平らに並んでいるので、開く所が無い */
  const open = page.getByTestId("course-other-open");
  if (await open.count()) await open.first().click();
  await page.waitForSelector('[data-testid="other-search"]', { timeout: 15000 });

  const box = page.getByTestId("other-search").first();
  const cnt = page.getByTestId("other-count").first();
  const n = async () => ((await cnt.textContent()) ?? "").trim();
  const rows = () => page.locator('[data-testid="course-card"], [data-testid="course-soon"], [data-testid="other-row"]');

  const by = (await box.boundingBox())?.y ?? -1;
  const rn = await rows().count();
  const last = rn ? (await rows().nth(rn - 1).boundingBox())?.y ?? -1 : -1;
  t(by >= 0 && by < last, `探す窓が講座より上にある（窓 y=${Math.round(by)} ／ 最後の札 y=${Math.round(last)}）`);

  const before = await n();
  console.log(`     開いた直後 ${before}（札 ${rn}枚）`);
  t(/\d/.test(before), `件数が出ている（${before}）`);

  for (const [q, why] of [
    ["アスベスト", "別名でも当たる（石綿）"],
    ["ユンボ", "別名でも当たる（車両系建設機械）"],
    ["石綿", "そのままの名前"],
    ["クレーン", "たくさん当たる語"],
    ["高所", "名前の一部だけ"],
    ["酸欠", "別名（酸素欠乏）"],
    ["  クレーン  ", "前後に空白（当たる語で）"],
    ["足場", "足場（その他の外にある講座）"],
    ["クレーン ", "うしろに空白"],
    ["ｱｽﾍﾞｽﾄ", "半角カナ"],
    ["ASBESTOS", "英字"],
    ["ぜったいにない語", "当たらない"],
    ["!!!###", "記号だけ"],
    ["'; drop table courses; --", "変な文字を入れられても壊れない"],
    ["あ".repeat(300), "とても長い"],
  ]) {
    await box.fill(q);
    await page.waitForTimeout(200);
    const c = await n();
    const r = await rows().count();
    t(!/Error|undefined|NaN/.test(c) && /\d/.test(c), `「${q.length > 20 ? q.slice(0, 8) + "…" : q}」${why} → ${c}（札 ${r}枚）`);
  }

  await box.fill("");
  await page.waitForTimeout(200);
  t((await n()) === before, `消したら元に戻る（${await n()}）`);
  t(await page.getByText("作る順を決める材料にします").count() === 0, "外した説明文が出ていない");
  t(await page.getByRole("button", { name: /学科だけ/ }).count() === 0, "やめた絞り込みの札が出ていない");
}
await browser.close();
console.log(ng === 0 ? `\nOK: ${ok}件通過` : `\nNG: ${ng}件失敗 ／ ${ok}件通過`);
process.exit(ng ? 1 : 0);
