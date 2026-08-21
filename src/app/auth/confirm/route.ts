import { NextResponse, type NextRequest } from "next/server";
import { getSessionClient } from "@/lib/supabase/session";

/* メールの確認リンクの戻り先。
   リンクに付いてくる合図をログインに引き換えて、中へ通す。 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const next = q.get("next") ?? "/";
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

  const to = new URL("/login", req.url);
  to.searchParams.set("next", next);
  return NextResponse.redirect(to);
}
