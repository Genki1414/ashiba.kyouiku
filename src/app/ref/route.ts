import { NextRequest, NextResponse } from "next/server";
import { REF_COOKIE, normalizeRefCode } from "@/lib/membership";
import { membershipEnabled } from "@/lib/membership.server";

/* 紹介 URL の入口（0040）。/ref?code=XXXXXXXX

   営業パートナーが配る URL。押した人のブラウザにコードを覚えさせて、
   法人会員の案内（/members）へ送る。申込み（/api/member/contract）が
   このクッキーを読む。**ログインは要らない**（まだ登録していない人が押す。authGate で開けてある）。

   覚えるのは 90 日。紹介した会社が申し込むまでに間が空いても拾えるように。
   コードの形が合わなければ、覚えずに案内へ送るだけ（壊れた URL で止めない）。 */
export async function GET(req: NextRequest) {
  const to = new URL(membershipEnabled() ? "/members" : "/", req.url);
  const res = NextResponse.redirect(to);
  const code = normalizeRefCode(req.nextUrl.searchParams.get("code"));
  if (code && membershipEnabled()) {
    res.cookies.set(REF_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  }
  return res;
}
