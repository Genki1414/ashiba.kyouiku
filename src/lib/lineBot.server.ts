import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { LINE_PUSH_URL, LINE_REPLY_URL, checkLine } from "./lineBot";

/* 公式アカウントから送る・届いたものを確かめる。鍵を使うのでサーバだけ。

   決めたこと（src/lib/lineBot.ts に理由）
   ・**送れなくても、元の操作は通す。**LINE が落ちていたら
     受講コードが配れない、では本末転倒。失敗は握りつぶす
   ・待ち時間を足しすぎない。3秒で諦める
   ・署名は**必ず**確かめる。確かめないと、誰でも偽の
     「友だち追加」や「運営からの指示」を投げ込める */

const token = () => (process.env.LINE_MENU_TOKEN ?? "").trim();

/** その人の LINE 番号。結んでいなければ空 */
export async function lineIdOf(userId: string | null | undefined): Promise<string> {
  const id = (userId ?? "").trim();
  if (!id) return "";
  const supabase = getServiceClient();
  if (!supabase) return "";
  try {
    const { data, error } = await supabase
      .from("users")
      .select("line_user_id")
      .eq("id", id)
      .maybeSingle();
    if (error) return "";
    return (data?.line_user_id as string | null) ?? "";
  } catch {
    return "";
  }
}

/** LINE 番号から、この仕組みの利用者を引く。運営かどうかを見るのに使う */
export async function userByLineId(
  lineUserId: string | null | undefined,
): Promise<{ id: string; email: string } | null> {
  const line = (lineUserId ?? "").trim();
  if (!line) return null;
  const supabase = getServiceClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email")
      .eq("line_user_id", line)
      .maybeSingle();
    if (error || !data) return null;
    return { id: String(data.id), email: String(data.email ?? "") };
  } catch {
    return null;
  }
}

async function send(url: string, body: unknown): Promise<boolean> {
  const t = token();
  if (!t) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
      /* 元の操作をここで待たせない。落ちていたら諦める */
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      /* 本文には鍵が入らない。理由が分からないと直しようがないので残す */
      console.error(`LINE への送信が失敗（${res.status}）`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("LINE への送信が失敗:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** LINE 番号あてに送る。**失敗しても投げない** */
export async function pushLine(lineUserId: string, text: string): Promise<boolean> {
  const to = (lineUserId ?? "").trim();
  if (!to) return false;
  const ok = checkLine(text);
  if (!ok.ok) {
    console.error("LINE に送れません:", ok.reason);
    return false;
  }
  return send(LINE_PUSH_URL, { to, messages: [{ type: "text", text: text.trim() }] });
}

/** 届いたものへの返事。**返事は1回きり**（replyToken は使い捨て） */
export async function replyLine(replyToken: string, text: string): Promise<boolean> {
  const tk = (replyToken ?? "").trim();
  if (!tk) return false;
  const ok = checkLine(text);
  if (!ok.ok) return false;
  return send(LINE_REPLY_URL, { replyToken: tk, messages: [{ type: "text", text: text.trim() }] });
}

/** この仕組みの利用者あてに送る。LINE を結んでいない人には送らない */
export async function pushToUser(userId: string, text: string): Promise<boolean> {
  const line = await lineIdOf(userId);
  if (!line) return false;
  return pushLine(line, text);
}
