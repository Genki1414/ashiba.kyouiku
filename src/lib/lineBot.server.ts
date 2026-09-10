import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { BRAND } from "@/content/brand";
import { LINE_PUSH_URL, LINE_REPLY_URL, LINE_PROFILE_URL, checkLine } from "./lineBot";

/* 公式アカウントから送る・届いたものを確かめる。鍵を使うのでサーバだけ。

   決めたこと（src/lib/lineBot.ts に理由）
   ・**送れなくても、元の操作は通す。**LINE が落ちていたら
     受講コードが配れない、では本末転倒。失敗は握りつぶす
   ・待ち時間を足しすぎない。3秒で諦める
   ・署名は**必ず**確かめる。確かめないと、誰でも偽の
     「友だち追加」や「運営からの指示」を投げ込める */

const token = () => (process.env.LINE_MENU_TOKEN ?? "").trim();

/* ── 番号は店ごと（0034）───────────────────

   足場屋革命-教育と特別教育ドットコムは、別のプロバイダーにある。
   LINE の利用者番号はプロバイダーごとに決まるので、
   **同じ人でも、店が違えば番号が違う。**
   だから line_links（人と店の組）で引く。 */

/** LINE 側に表示名を聞く。**失敗しても投げない**（名前が出ないだけ） */
async function askName(lineUserId: string): Promise<string> {
  const t = token();
  if (!t) return "";
  try {
    const res = await fetch(`${LINE_PROFILE_URL}${encodeURIComponent(lineUserId)}`, {
      headers: { authorization: `Bearer ${t}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return "";
    const v = (await res.json()) as { displayName?: string };
    return (v.displayName ?? "").trim();
  } catch {
    return "";
  }
}

/** この店での紐付け。番号と表示名をまとめて引く。繋いでいなければ空。

    ── 名前が入っていなければ、LINE に聞いて入れておく ──
    表示名を持つようにしたのは 0037。**それより前に繋いだ人は空のまま**で、
    マイページには「つながっています」としか出なかった
    （げんきさん 2026-09-10「どのLINEと繋がってるのか分からない」）。
    繋ぎ直してもらえば入るが、そのために押させる筋合いは無い。
    空のときだけ聞く。一度入れば、もう聞かない */
export async function lineLinkOf(
  userId: string | null | undefined,
): Promise<{ lineUserId: string; name: string }> {
  const none = { lineUserId: "", name: "" };
  const id = (userId ?? "").trim();
  if (!id) return none;
  const supabase = getServiceClient();
  if (!supabase) return none;
  try {
    const { data, error } = await supabase
      .from("line_links")
      .select("line_user_id, display_name")
      .eq("user_id", id)
      .eq("brand", BRAND.id)
      .maybeSingle();
    if (error || !data) return none;
    const lineUserId = String(data.line_user_id ?? "");
    if (!lineUserId) return none;
    const name = ((data.display_name as string | null) ?? "").trim();
    if (name) return { lineUserId, name };
    const asked = await askName(lineUserId);
    if (asked) await linkLine(id, lineUserId, asked);
    return { lineUserId, name: asked };
  } catch {
    return none;
  }
}

/** この店での、その人の LINE 番号。結んでいなければ空 */
export async function lineIdOf(userId: string | null | undefined): Promise<string> {
  const id = (userId ?? "").trim();
  if (!id) return "";
  const supabase = getServiceClient();
  if (!supabase) return "";
  try {
    const { data, error } = await supabase
      .from("line_links")
      .select("line_user_id")
      .eq("user_id", id)
      .eq("brand", BRAND.id)
      .maybeSingle();
    if (error) return "";
    return (data?.line_user_id as string | null) ?? "";
  } catch {
    return "";
  }
}

/** この店の LINE 番号から、利用者を引く。運営かどうかを見るのに使う。

    **店を必ず添える。**添えないと、よその店で同じ番号を使っている
    別人に当たりうる（番号はプロバイダーごとなので、
    たまたま同じ字になることがある） */
export async function userByLineId(
  lineUserId: string | null | undefined,
): Promise<{ id: string; email: string; name: string } | null> {
  const line = (lineUserId ?? "").trim();
  if (!line) return null;
  const supabase = getServiceClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("line_links")
      .select("user_id")
      .eq("brand", BRAND.id)
      .eq("line_user_id", line)
      .maybeSingle();
    if (error || !data) return null;
    const { data: u, error: e2 } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("id", String(data.user_id))
      .maybeSingle();
    if (e2 || !u) return null;
    return { id: String(u.id), email: String(u.email ?? ""), name: String(u.name ?? "") };
  } catch {
    return null;
  }
}

/** この店と、その人を結ぶ。すでにあれば入れ替える（同じ人・同じ店）。

    @param displayName LINE の表示名（0037）。
                       **どのLINEと繋がっているかを本人に見せるためだけ。**
                       修了証には使わない（本名とは限らない）。
                       **空のときは、いま入っている名前を消さない。**
                       LINE が名前を返さないことがあり、返らなかったせいで
                       「つながっています」だけに戻ってしまうと、
                       どのLINEか分からない元の状態に逆戻りする */
export async function linkLine(
  userId: string,
  lineUserId: string,
  displayName?: string,
): Promise<boolean> {
  const supabase = getServiceClient();
  if (!supabase) return false;
  const name = (displayName ?? "").trim();
  try {
    const { error } = await supabase
      .from("line_links")
      .upsert(
        {
          user_id: userId,
          brand: BRAND.id,
          line_user_id: lineUserId,
          /* 空なら列ごと送らない。送らなければ書き換わらない */
          ...(name ? { display_name: name } : {}),
        },
        { onConflict: "user_id,brand" },
      );
    if (error) {
      console.error("LINE の紐付けに失敗:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("LINE の紐付けに失敗:", e instanceof Error ? e.message : e);
    return false;
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
