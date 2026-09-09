import { NextResponse, type NextRequest } from "next/server";
import { lineEmail, lineLoginReady, LINE_CALLBACK_PATH } from "@/lib/line";
import { exchange } from "@/lib/line.server";
import { getServiceClient } from "@/lib/supabase/server";
import { getSessionClient } from "@/lib/supabase/session";
import { siteUrl } from "@/lib/siteUrl";

/* LINE から戻ってくる所。ここでログインが立つ。

   ── 手順 ──
   ① state を確かめる（よそから差し込まれていないか）
   ② code を LINE に渡して、本人だと確かめてもらう
   ③ その LINE 番号に結んである利用者を探す。無ければ作って結ぶ
   ④ サーバで1回きりの合図を作り、クッキーのログインに引き換える

   ── 決めたこと ──
   ・**氏名は上書きしない。**修了証に載るのはマイページで入れた氏名。
     LINE の表示名は本名とは限らない。空のときだけ、仮の名前として入れる
   ・失敗したら、理由を画面に出さずログインへ戻す。
     どこで落ちたかを外に教えない */

const back = (req: NextRequest, why: string) => {
  const to = new URL("/login", req.url);
  to.searchParams.set("line", why);
  return NextResponse.redirect(to);
};

export async function GET(req: NextRequest) {
  if (!lineLoginReady()) return back(req, "off");

  const q = req.nextUrl.searchParams;
  const state = q.get("state") ?? "";
  const code = q.get("code") ?? "";
  const saved = req.cookies.get("line_state")?.value ?? "";
  const next = req.cookies.get("line_next")?.value ?? "/";
  /* ① 差し込み対策。**必ず一致させる** */
  if (!code || !state || !saved || state !== saved) return back(req, "state");

  /* ② LINE に確かめてもらう */
  const base = siteUrl(req.nextUrl.origin);
  const who = await exchange(code, `${base}${LINE_CALLBACK_PATH}`);
  if (!who) return back(req, "verify");

  const admin = getServiceClient();
  const session = await getSessionClient();
  if (!admin || !session) return back(req, "setup");

  /* ③ この LINE 番号の人を探す */
  const { data: found } = await admin
    .from("users")
    .select("id, email, name")
    .eq("line_user_id", who.sub)
    .maybeSingle();

  let email = (found?.email as string) ?? "";
  if (!found) {
    /* まだ結ばれていない。LINE がメールを返していれば、
       同じメールの人に結ぶ（メールで登録済みの人が LINE から来た場合）。
       返さなければ、その人だけの届かない住所を作る */
    email = who.email ?? lineEmail(who.sub);
    const { data: byMail } = await admin
      .from("users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    let userId = (byMail?.id as string) ?? "";
    if (!userId) {
      /* 新しく作る。**確認メールは送らない**（届かない住所のことがある） */
      const { data: made, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: who.name || "（氏名未登録）", line: true },
      });
      if (error || !made?.user) return back(req, "create");
      userId = made.user.id;
    }
    /* 結ぶ。**ここだけがこの番号の持ち主を決める** */
    const { error: linkErr } = await admin
      .from("users")
      .update({ line_user_id: who.sub })
      .eq("id", userId);
    if (linkErr) return back(req, "link");
  }

  /* ④ 1回きりの合図を作って、クッキーのログインに引き換える。
     メールは送らない（作った合図をそのまま使う） */
  const { data: link, error: linkGen } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hash = link?.properties?.hashed_token;
  if (linkGen || !hash) return back(req, "token");

  const { error: otpErr } = await session.auth.verifyOtp({
    type: "magiclink",
    token_hash: hash,
  });
  if (otpErr) return back(req, "session");

  const to = next.startsWith("/") ? next : "/";
  const res = NextResponse.redirect(new URL(to, req.url));
  for (const k of ["line_state", "line_nonce", "line_next"]) res.cookies.delete(k);
  return res;
}
