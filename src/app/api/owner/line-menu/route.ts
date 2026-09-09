import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/owner";
import { currentUser } from "@/lib/supabase/session";
import { lineIdOf } from "@/lib/lineBot.server";
import { MENU_IMAGE_PATH, lineMenuReady, richMenuBody } from "@/lib/line";
import { siteUrl } from "@/lib/siteUrl";
import { BRAND } from "@/content/brand";

/* LINE のリッチメニューを配る。運営だけ。

   ── なぜ画面から押す形にしたか ──
   手元でコマンドを流す形にしていたが、げんきさんは現場に出ている。
   パソコンを開いて node を動かす手順は、そこで止まる。
   **トークンを Vercel に入れて、運営管理の画面から1回押すだけ**にする。

   ── 絵はどこから ──
   Vercel では絵を描く道具（Chromium）が動かない。だから画像は手元で
   作って public/richmenu.png に置いてある（scripts/line-richmenu.ts）。
   ここはそれを読んで、LINE に送るだけ。

   ── 鍵 ──
   LINE_MENU_TOKEN（Messaging API のチャネルアクセストークン・長期）。
   **NEXT_PUBLIC_ を付けない。**付けると画面に埋まって、誰でも
   その公式アカウントから送れるようになる。 */

/* ── いまの様子（GET）──

   げんきさん（2026-09-09）「設定が帰ってこない」。

   LINE のトークに「設定」と送っても返らないとき、**理由が画面に出ない。**
   運営として結び付いていないのか、鍵が入っていないのかが分からない。
   ここで出す。

   **この店での自分の LINE 番号**も返す（運営だけ）。
   知らせの宛先（LINE_TO）に入れる値がこれなので、
   店を分けるときに、ここから写せる。 */
export async function GET() {
  if (!(await currentOwner())) {
    return NextResponse.json({ ok: false, reason: "運営のみが利用できます。" }, { status: 403 });
  }
  const user = await currentUser();
  const lineUserId = user?.id ? await lineIdOf(user.id) : "";
  return NextResponse.json({
    ok: true,
    brand: BRAND.id,
    brandName: BRAND.shortName,
    /* 送る鍵・受ける鍵。入っているかどうかだけ */
    menuReady: lineMenuReady(),
    hookReady: !!(process.env.LINE_BOT_SECRET ?? "").trim(),
    /* この店で、自分の LINE が結び付いているか */
    linked: !!lineUserId,
    lineUserId,
  });
}

const API = "https://api.line.me/v2/bot/richmenu";
const DATA = "https://api-data.line.me/v2/bot/richmenu";

export async function POST() {
  if (!(await currentOwner())) {
    return NextResponse.json({ ok: false, reason: "運営のみが利用できます。" }, { status: 403 });
  }
  const token = (process.env.LINE_MENU_TOKEN ?? "").trim();
  if (!lineMenuReady() || !token) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          "LINE_MENU_TOKEN が未設定です。LINE公式アカウントの Messaging API で" +
          "チャネルアクセストークン（長期）を発行し、Vercel の環境変数に入れて Redeploy してください。",
      },
      { status: 503 },
    );
  }
  const site = siteUrl();
  if (!site) {
    return NextResponse.json({ ok: false, reason: "この店の住所が決まっていません。" }, { status: 503 });
  }

  const auth = { authorization: `Bearer ${token}` };

  /* ① 中身を登録する */
  const made = await fetch(API, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify(richMenuBody(site, BRAND.shortName)),
  });
  if (!made.ok) {
    return NextResponse.json(
      { ok: false, reason: `メニューを作れませんでした（${made.status} ${await made.text()}）` },
      { status: 502 },
    );
  }
  const { richMenuId } = (await made.json()) as { richMenuId: string };

  /* ② 画像を送る。公開の場所に置いてあるものを、そのまま読む */
  const img = await fetch(`${site}${MENU_IMAGE_PATH}`, { cache: "no-store" });
  if (!img.ok) {
    return NextResponse.json(
      { ok: false, reason: `メニューの画像を読めませんでした（${MENU_IMAGE_PATH}）` },
      { status: 502 },
    );
  }
  const png = Buffer.from(await img.arrayBuffer());
  const up = await fetch(`${DATA}/${richMenuId}/content`, {
    method: "POST",
    headers: { ...auth, "content-type": "image/png" },
    body: png,
  });
  if (!up.ok) {
    return NextResponse.json(
      { ok: false, reason: `画像を送れませんでした（${up.status} ${await up.text()}）` },
      { status: 502 },
    );
  }

  /* ③ 友だち全員の既定にする */
  const set = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: "POST",
    headers: auth,
  });
  if (!set.ok) {
    return NextResponse.json(
      { ok: false, reason: `既定にできませんでした（${set.status} ${await set.text()}）` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, richMenuId });
}
