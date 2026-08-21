/* 小さい画面でも場面のボタンに手が届くか */
import { chromium } from "playwright-core";
const SC = process.env.SC ?? ".";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let ng = 0;

for (const [w, h, name] of [[390, 640, "small"], [360, 600, "tiny"], [390, 844, "normal"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto("http://localhost:3100/training/ch1");
  /* 更新のお知らせが出ていたら閉じる */
  {
    const b = page.getByTestId("update-close");
    await b.waitFor({ timeout: 2000 }).catch(() => {});
    if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
  }
  await page.waitForSelector("text=段取りと根がらみ");
  // 段取りを一気に済ませて建方へ
  const tap = async (key) => {
    const b = await page.locator(`[data-node="${key}"]`).boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(40);
  };
  const tool = (t) => page.getByRole("button", { name: t, exact: true }).click();
  await tool("根がらみ手摺");
  for (const id of ["C-S1", "S1-S2", "S2-S3", "C-E1", "E1-E2"]) await tap(`span:${id}`);
  await tool("600手摺");
  for (const id of ["S3", "E2", "S1"]) await tap(`inner:${id}`);
  await tool("ジャッキ");
  for (const id of ["C", "S1", "S2", "S3", "E1", "E2"]) await tap(`post:${id}`);
  for (const id of ["S3", "E2", "S1"]) await tap(`inner:${id}`);
  await page.getByRole("button", { name: "建方へ進む" }).click();
  await page.waitForTimeout(200);
  await tool("支柱");
  await tap("post:C");
  await page.waitForSelector("text=ハンドルの高さ");
  await page.screenshot({ path: `${SC}/scene-jack-${name}.png` });

  // ボタンが画面内にあり、押せるか
  for (const label of ["上げる（10）", "下げる（10）"]) {
    const btn = page.getByRole("button", { name: label });
    const box = await btn.boundingBox();
    if (!box) { console.error(`NG ${name}: ${label} が見つからない`); ng++; continue; }
    if (box.y < 0 || box.y + box.height > h) {
      console.error(`NG ${name}: ${label} が画面外 (y=${Math.round(box.y)}, h=${h})`);
      ng++;
    }
  }
  // 目標まで押して確定できるか
  for (let i = 0; i < 40; i++) {
    const now = Number(await page.getByTestId("jack-now").getAttribute("data-value"));
    if (Math.abs(now - 150) <= 15) break;
    await page.getByRole("button", { name: now < 150 ? "上げる（10）" : "下げる（10）" }).click();
    await page.waitForTimeout(15);
  }
  const ok = page.getByRole("button", { name: "柱を挿す" });
  const okBox = await ok.boundingBox();
  if (!okBox) { console.error(`NG ${name}: 確定ボタンが無い`); ng++; }
  else {
    await ok.scrollIntoViewIfNeeded();
    await ok.click();
    await page.waitForTimeout(200);
    if (await page.locator("text=ハンドルの高さ").count()) { console.error(`NG ${name}: 場面が閉じない`); ng++; }
    else console.log(`OK ${name} (${w}x${h}): ジャッキ合わせを操作できた`);
  }
  await page.close();
}
await browser.close();
if (ng) process.exit(1);
console.log("ALL OK");
