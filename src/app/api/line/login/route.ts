import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { authorizeUrl, lineLoginReady, LINE_CALLBACK_PATH } from "@/lib/line";
import { siteUrl } from "@/lib/siteUrl";

/* LINE のログイン画面へ送り出す。

   **state と nonce を、こちらで作ってクッキーに残す。**
   戻ってきたときに同じものが付いていなければ受け取らない。
   確かめないと、よそのサイトからログインの流れを差し込まれる。

   クッキーは httpOnly（画面から読めない）で10分だけ。 */

export async function GET(req: NextRequest) {
  if (!lineLoginReady()) {
    /* 設定が無い店では、ふつうのログインへ戻す。
       押せる所も出していないが、直に叩かれても落ちないようにする */
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const state = randomUUID();
  const nonce = randomUUID();
  /* 戻ったあとに行きたい所。開いていた画面を覚えておく */
  const next = (req.nextUrl.searchParams.get("next") ?? "/").trim();

  const base = siteUrl(req.nextUrl.origin);
  const url = authorizeUrl({
    redirectUri: `${base}${LINE_CALLBACK_PATH}`,
    state,
    nonce,
  });

  const res = NextResponse.redirect(url);
  const opt = {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  res.cookies.set("line_state", state, opt);
  res.cookies.set("line_nonce", nonce, opt);
  /* 行き先は中の道だけ。よそへ飛ばす道具にされないように、
     「/」で始まるものしか覚えない */
  res.cookies.set("line_next", next.startsWith("/") ? next : "/", opt);
  return res;
}
