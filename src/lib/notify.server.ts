import "server-only";
import { notifyText, checkNotify, type NotifyKind } from "./notifyText";
import { siteUrl } from "./siteUrl";

/* 申込が来たことを、運営の LINE に知らせる。

   ── なぜ LINE か ──
   運営（げんきさん）は現場に出ている。メールは後回しになるが、
   LINE は見る。許可を出し忘れると、受講者の教材が開かないまま止まる。

   ── 使う仕組み ──
   LINE Notify は 2025年3月に終わった。いまは LINE 公式アカウントの
   Messaging API から push する。無料枠は月200通ほど（docs/22）。

   ── 決めたこと ──
   ・**知らせが送れなくても、申込そのものは通す。** LINE が落ちていたら
     申し込めない、では本末転倒。失敗は握りつぶして先へ進める
   ・待ち時間を足しすぎない。3秒で諦める
   ・氏名や会社名は送らない（src/lib/notifyText.ts に理由）
   ・鍵は LINE_TOKEN。NEXT_PUBLIC_ を付けない。付けると画面に埋まって、
     誰でも運営のアカウントから送れるようになる */

const API = "https://api.line.me/v2/bot/message/push";

/** 知らせを送る設定が入っているか。/setup で出す */
export const notifyReady = (): boolean =>
  !!(process.env.LINE_TOKEN ?? "").trim() && !!(process.env.LINE_TO ?? "").trim();

/** 申込が来たことを知らせる。

    **投げっぱなしにする。** 呼ぶ側は await しなくてよいし、
    await しても失敗で例外は出ない。 */
export async function notify(kind: NotifyKind, n = 1): Promise<boolean> {
  const token = (process.env.LINE_TOKEN ?? "").trim();
  const to = (process.env.LINE_TO ?? "").trim();
  /* 設定していなければ、何もしない。手元で動かすときはこちら */
  if (!token || !to) return false;

  const text = notifyText(kind, siteUrl(), n);
  const ok = checkNotify(text);
  if (!ok.ok) {
    console.error("知らせを送れません:", ok.reason);
    return false;
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
      /* 申込の返事をここで待たせない。落ちていたら諦める */
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      /* 本文には鍵が入らない。理由が分からないと直しようがないので残す */
      console.error(`LINE への知らせが失敗（${res.status}）`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("LINE への知らせが失敗:", e instanceof Error ? e.message : e);
    return false;
  }
}
