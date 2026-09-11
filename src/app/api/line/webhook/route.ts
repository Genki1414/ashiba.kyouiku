import { NextRequest, NextResponse } from "next/server";
import { replyLine, userByLineId, unlinkLineId } from "@/lib/lineBot.server";
import { isOpsWord, verifyLineSignature } from "@/lib/lineBot";
import { isOwnerEmail } from "@/lib/owner";
import { opsNotLinkedText, opsNotOwnerText, opsStatusText } from "@/lib/opsStatus.server";

/* LINE から届くもの（Webhook）。

   げんきさん（2026-09-09）
     「セットアップや設定とおくったらセットアップを表示させる自動化」

   現場に出ているあいだ、パソコンを開かずに設定の様子を見たい。
   LINE のトークに「設定」と送れば、そのまま返ってくる形にする。

   ── 決めたこと ──
   ・**署名を必ず確かめる。**確かめないと、この住所を知った人が
     偽の「運営からの指示」を投げ込める。鍵が入っていなければ、
     何も受け付けない（開けっぱなしにしない）
   ・**設定の様子は運営にしか返さない。**ただし、合言葉に当たったのに
     黙るのはやめた（げんきさん 2026-09-09「特別教育ドットコムでは応答ない」）。
     返らない理由が3つあり、外から切り分けられなかった。
     結び付いていない人・運営でない人には、**その人自身のことだけ**返す。
     鍵も、設定の中身も、よその人のことも出さない
   ・運営かどうかは、**LINE の番号 → 利用者 → メール → OWNER_EMAILS**
     の順で見る。LINE の表示名では見ない（名前は誰でも真似できる）
   ・**必ず 200 を返す。**LINE は 200 以外だと何度も送り直してくる。
     こちらの都合（設定漏れ・落ちている）で再送を招かない
   ・友だち追加（follow）には、ここでは何もしない。
     あいさつは LINE公式アカウントマネージャーの
     「あいさつメッセージ」で出す（docs/105）

   署名は本文そのままで作るので、node の crypto が要る。 */
export const runtime = "nodejs";
/* 届くたびに動かす。溜めて返すものではない */
export const dynamic = "force-dynamic";

type Event = {
  type?: unknown;
  replyToken?: unknown;
  source?: { userId?: unknown } | null;
  message?: { type?: unknown; text?: unknown } | null;
};

export async function POST(req: NextRequest) {
  /* **組み立て直さない。**署名は届いた字そのもので作られている */
  const raw = await req.text();
  const sig = req.headers.get("x-line-signature");

  if (!verifyLineSignature(raw, sig)) {
    /* ここだけは 200 を返さない。**偽物に「届いた」と教えない。**
       LINE の検証ボタンからは正しい署名で来るので、本物は通る */
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let events: Event[] = [];
  try {
    const body = JSON.parse(raw) as { events?: unknown };
    events = Array.isArray(body.events) ? (body.events as Event[]) : [];
  } catch {
    /* 読めない中身でも 200。再送されても、また読めない */
    return NextResponse.json({ ok: true });
  }

  for (const ev of events) {
    /* ブロック・友だち解除。結び付きを外して、送るのをやめる（2026-09-11） */
    if (ev?.type === "unfollow") {
      const gone = typeof ev.source?.userId === "string" ? ev.source.userId : "";
      if (gone) await unlinkLineId(gone);
      continue;
    }
    if (ev?.type !== "message") continue;
    if (ev.message?.type !== "text") continue;

    const text = typeof ev.message.text === "string" ? ev.message.text : "";
    if (!isOpsWord(text)) continue;

    const lineUserId = typeof ev.source?.userId === "string" ? ev.source.userId : "";
    const replyToken = typeof ev.replyToken === "string" ? ev.replyToken : "";
    if (!lineUserId || !replyToken) continue;

    /* 運営か。LINE でログインしたことのある運営だけが通る。
       一度もログインしていないと結び付きが無いので、ここで止まる */
    const who = await userByLineId(lineUserId);
    if (!who) {
      /* まだつないでいない。**番号を返す。**
         運営管理 → LINE に出る番号と食い違っていたら、
         ログインチャネルと公式アカウントのプロバイダーが分かれている */
      await replyLine(replyToken, opsNotLinkedText(lineUserId));
      continue;
    }
    if (!isOwnerEmail(who.email)) {
      /* つないでいる相手が違う。どのアカウントかを返す */
      await replyLine(replyToken, opsNotOwnerText(who));
      continue;
    }

    await replyLine(replyToken, await opsStatusText());
  }

  return NextResponse.json({ ok: true });
}
