/* LINE のリッチメニューを作って、公式アカウントに付ける。

   実行（トークンは環境変数から。**画面にもコードにも書かない**）：
     LINE_MENU_TOKEN=… npx tsx scripts/line-richmenu.ts
     LINE_MENU_TOKEN=… npx tsx scripts/line-richmenu.ts --dry   （画像だけ作る）

   ── なぜ要るか ──
   げんきさん（2026-09-09）「リッチメニューも使って利用難易度下げたい」。
   現場の方は、アプリを開くところで止まる。LINE のトーク画面の下に
   大きな札が3つ出ていれば、押すだけで受講に入れる。

   ── 作り方 ──
   画像は Chromium で描いて撮る（playwright-core はもう入っている）。
   絵の道具を新しく足さないため。2500×843（低いほうの型）。

   ── 決めたこと ──
   ・**押す所は3つまで。**小さい札を6つ並べても、手袋をした指では押せない
   ・行き先は店の住所（NEXT_PUBLIC_SITE_URL か src/content/brand.ts）
   ・トークンは LINE_MENU_TOKEN。**NEXT_PUBLIC_ を付けない。**
     Messaging API のチャネルアクセストークン（長期）を使う */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { BRAND } from "../src/content/brand";

const TOKEN = (process.env.LINE_MENU_TOKEN ?? "").trim();
const DRY = process.argv.includes("--dry");
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.site ?? "").replace(/\/+$/, "");
/* 置き場所は public。**運営管理の画面から配るときに、ここを読む。**
   Vercel では絵を描く道具（Chromium）が動かないので、
   画像は手元で作って置いておき、配るのは画面から押すだけにする */
const OUT = path.join(process.cwd(), "public", "richmenu.png");

/** 押す所。左から順に並ぶ */
const AREAS = [
  { t: "受講する", d: "講座を開く", href: "/edu", icon: "▤" },
  { t: "受講コード", d: "コードを入れる", href: "/join", icon: "▦" },
  { t: "マイページ", d: "進み具合・修了証", href: "/me", icon: "◉" },
];

const W = 2500;
const H = 843;

function html(): string {
  const cell = AREAS.map(
    (a) => `
      <div class="cell">
        <div class="icon">${a.icon}</div>
        <div class="t">${a.t}</div>
        <div class="d">${a.d}</div>
      </div>`,
  ).join("");
  return `<!doctype html><meta charset="utf-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { width:${W}px; height:${H}px; display:flex; background:#14171B;
           font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN",sans-serif; color:#E8EAED; }
    .cell { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
            gap:24px; border-right:4px solid #2A2F36; }
    .cell:last-child { border-right:none; }
    .icon { font-size:150px; line-height:1; color:#F5C518; }
    .t { font-size:96px; font-weight:900; letter-spacing:2px; }
    .d { font-size:44px; color:#9AA3AE; }
  </style>
  <body>${cell}</body>`;
}

async function drawImage(): Promise<Buffer> {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(html(), { waitUntil: "load" });
  const png = await page.screenshot({ type: "png" });
  await browser.close();
  return png;
}

async function api(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${TOKEN}`, ...(init.headers ?? {}) },
  });
}

async function main() {
  if (!SITE) {
    console.error("行き先が決まっていません。NEXT_PUBLIC_SITE_URL か brand.ts の site を入れてください。");
    process.exit(1);
  }
  const png = await drawImage();
  writeFileSync(OUT, png);
  console.log(`OK  画像を作りました（${OUT}／${(png.length / 1024).toFixed(0)}KB）`);
  if (DRY) return;

  if (!TOKEN) {
    console.error("LINE_MENU_TOKEN がありません。Messaging API のチャネルアクセストークンを渡してください。");
    process.exit(1);
  }

  /* 押す所の四角。画像の座標で指す */
  const w = Math.floor(W / AREAS.length);
  const menu = {
    size: { width: W, height: H },
    selected: true,
    name: `${BRAND.shortName} メニュー`,
    chatBarText: "メニュー",
    areas: AREAS.map((a, i) => ({
      bounds: { x: i * w, y: 0, width: w, height: H },
      action: { type: "uri", label: a.t, uri: `${SITE}${a.href}` },
    })),
  };

  const made = await api("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(menu),
  });
  if (!made.ok) {
    console.error("作れませんでした", made.status, await made.text());
    process.exit(1);
  }
  const { richMenuId } = (await made.json()) as { richMenuId: string };
  console.log("OK  メニューを作りました", richMenuId);

  const up = await api(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { "content-type": "image/png" },
    body: png as unknown as BodyInit,
  });
  if (!up.ok) {
    console.error("画像を送れませんでした", up.status, await up.text());
    process.exit(1);
  }
  console.log("OK  画像を送りました");

  const set = await api(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST" });
  if (!set.ok) {
    console.error("既定にできませんでした", set.status, await set.text());
    process.exit(1);
  }
  console.log("OK  友だち全員のメニューにしました");
  console.log(`\n行き先：${AREAS.map((a) => `${a.t}→${SITE}${a.href}`).join(" ／ ")}`);
}

void main();
