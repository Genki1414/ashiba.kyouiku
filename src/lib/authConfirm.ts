import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionClient } from "./supabase/session";

/* メールのリンクに付いてくる合図を、ログインに引き換える。

   2通り来る。
     code       … いまの作り（PKCE）。これしか付いてこない
     token_hash … 古い作り。type（signup / recovery …）も付いてくる

   **code の側には type が付いてこない。**
   だから「合言葉の決め直しかどうか」をリンクの中身から見分けられない。
   見分けようとすると、決め直さないまま中へ入ってしまい、
   次に閉じたときにまた入れなくなる。

   なので、**戻り先の道そのものを分ける**。
     /auth/confirm … 登録の確認。中へ通す
     /auth/reset   … 合言葉の決め直し。決め直しの画面へ送る

   行き先を問い合わせの文字で渡さないのは、Supabase が
   許した住所と突き合わせるときに、面倒が増えるため。 */

export async function confirmTo(req: NextRequest, fallback: string) {
  const q = req.nextUrl.searchParams;
  const next = q.get("next") ?? fallback;
  const supabase = await getSessionClient();
  if (!supabase) return NextResponse.redirect(new URL("/", req.url));

  const code = q.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, req.url));
  }

  const token_hash = q.get("token_hash");
  const type = q.get("type");
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "email" | "recovery" | "email_change",
      token_hash,
    });
    if (!error) return NextResponse.redirect(new URL(next, req.url));
  }

  /* 期限切れ・使い済み。黙って中へ入れない */
  const to = new URL("/login", req.url);
  to.searchParams.set("next", next);
  return NextResponse.redirect(to);
}
