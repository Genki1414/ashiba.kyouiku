/* LINE の公式アカウント（Messaging API）で、本人に知らせを届ける。

   ── なぜ要るか ──
   受講コードを配っても、修了証を出しても、**相手が開くまで伝わらない。**
   ホームの「お知らせ」は開いた人にしか届かない。開くのをやめた人には
   永久に届かない。現場の方はメールを見ないが、LINE は見る
   （げんきさん 2026-09-09）。

   ── 送れる相手 ──
   LINE でログインした人だけ（users.line_user_id が入っている人）。
   メールで登録した人には送れない。**送れなくても、返事そのものは通す。**

   ── どのアカウントから送るか ──
   その店の公式アカウント（LINE_MENU_TOKEN）。リッチメニューを配ったのと
   同じ鍵で、同じアカウント。**店ごとに違う。**足場屋革命-教育と
   特別教育ドットコムは別の公式アカウント（げんきさん 2026-09-09）。

   LINE の利用者番号は**プロバイダーごと**に決まる。ログインチャネルと
   公式アカウントを同じプロバイダーに置いてあるので、ログインでもらった
   番号を、そのまま送り先に使える。分けて作ると番号が合わず、届かない。

   ── 鍵 ──
   ・LINE_MENU_TOKEN  … 送るための鍵（チャネルアクセストークン）
   ・LINE_BOT_SECRET  … 届いたものが本物か確かめる鍵（チャネルシークレット）
   どちらも同じ Messaging API チャネルのもの。
   **NEXT_PUBLIC_ を付けない。**付けると画面に埋まって、
   誰でもこのアカウントから送れるようになる。 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
export const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
/** 友だちの表示名を聞く所。末尾に LINE の利用者番号を付ける */
export const LINE_PROFILE_URL = "https://api.line.me/v2/bot/profile/";

/** 本人に知らせを送れるか（送る鍵が入っているか）。/setup で出す */
export const lineBotReady = (): boolean => !!(process.env.LINE_MENU_TOKEN ?? "").trim();

/** 届いたものを確かめられるか（受け取る鍵が入っているか）。/setup で出す */
export const lineHookReady = (): boolean => !!(process.env.LINE_BOT_SECRET ?? "").trim();

/** LINE から受け取る入口。LINE Developers に登録する住所の末尾 */
export const LINE_HOOK_PATH = "/api/line/webhook";

/* ── 運営が、LINE から様子を見るための合言葉 ──────────

   げんきさん（2026-09-09）
     「セットアップや設定とおくったらセットアップを表示させる」

   現場に出ているあいだ、パソコンを開かずに設定の様子を見たい。
   **運営だけ。**ほかの人が同じ字を送っても、ここは何も返さない
   （返すと、応答メッセージや手動チャットと二重になる）。 */
export const OPS_WORDS = ["セットアップ", "設定", "setup", "せっとあっぷ"];

/** 運営の合言葉か。

    打ち方の揺れを吸う。前後の空白、大文字小文字、全角の空白。
    **前方一致にしない。**「設定を変えたいのですが」まで拾うと、
    ふつうの相談に機械の返事をかぶせることになる。 */
export function isOpsWord(text: string | null | undefined): boolean {
  const t = (text ?? "").trim().replace(/[\s　]+/g, "").toLowerCase();
  if (!t) return false;
  return OPS_WORDS.some((w) => w.toLowerCase() === t);
}

/** LINE に送れる形か。1通5000字まで。
    長すぎるものは切らずに断る（切ると、行き先が消えることがある） */
export function checkLine(text: string): { ok: true } | { ok: false; reason: string } {
  const t = (text ?? "").trim();
  if (!t) return { ok: false, reason: "本文が空です" };
  if (t.length > 4900) return { ok: false, reason: "本文が長すぎます" };
  return { ok: true };
}

/** 届いたものが、本当に LINE から来たものか。

    LINE は本文（そのままの字）を、チャネルシークレットで
    HMAC-SHA256 にして base64 にしたものを x-line-signature に入れる。
    **本文を組み立て直してから照らさない。**受け取った字そのままで作る
    （組み立て直すと空白1つで合わなくなり、本物まで弾く）。

    1文字ずつ比べると、合っている所までの時間で中身が漏れる。
    長さが違うと timingSafeEqual は投げるので、先に長さを見る。

    鍵が入っていなければ、**必ず false。**開けっぱなしにしない。

    ここに置いてあるのは、本物の署名で試験できるようにするため
    （鍵を使う所は server-only で、試験から読めない）。 */
export function verifyLineSignature(
  rawBody: string,
  signature: string | null | undefined,
  channelSecret?: string,
): boolean {
  const key = (channelSecret ?? process.env.LINE_BOT_SECRET ?? "").trim();
  const sig = (signature ?? "").trim();
  if (!key || !sig) return false;
  const want = createHmac("sha256", key).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(want);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
