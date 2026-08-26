import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isOpenPath } from "@/lib/authGate";

/* ログインの見張り。

   ・Supabase を設定していないあいだは、ログインを求めない。
     記録は端末内に置く決まりなので、求めても意味がないため
     （手元で動かすとき・まだ繋いでいない環境）。
   ・設定してあるときは、ログインしていない人を /login へ送る。
     いまはログインが、外から開かれないための唯一の守りでもある。

   ── 速さの話 ──
   ここは取りに行きのたびに通る。素直に書くと、
   **画像や顔検出の重み（public/models、6.5MB）を1本読むたびに**
   Supabase の認証サーバまで往復していた。
   受講の画面を開くと、それが何本も重なって目に見えて遅くなる。

   ・下の matcher で、置いてあるだけのファイルは通さない
   ・ログインのクッキーが無ければ、聞きに行かずにその場で断る
   ・getUser() ではなく getClaims()。鍵が非対称なら手元で確かめられる */

/** 置いてあるだけのもの。見張っても意味が無く、通すと遅くなるだけ */
const isAsset = (p: string) =>
  p.startsWith("/models/") ||
  p.startsWith("/sfx/") ||
  p.startsWith("/icons/") ||
  /\.[a-z0-9]+$/i.test(p);

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  const path0 = req.nextUrl.pathname;
  if (isAsset(path0)) return NextResponse.next();

  /* ログインのクッキーが1枚も無ければ、聞きに行くまでもない。
     ログインしていない人の取りに行きから、往復が丸ごと消える */
  if (!req.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    if (isOpenPath(path0)) return NextResponse.next();
    if (path0.startsWith("/api/")) {
      return NextResponse.json({ error: "ログインが要ります", mode: "local" }, { status: 401 });
    }
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    to.searchParams.set("next", path0 + req.nextUrl.search);
    return NextResponse.redirect(to);
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });

  /* ここで見ることで、期限が近いログインが延長される。
     getClaims は、鍵が非対称なら手元で確かめて終わる（往復が消える） */
  const { data, error } = await supabase.auth.getClaims();
  let signedIn = !error && !!data?.claims?.sub;
  if (error) {
    const { data: u } = await supabase.auth.getUser();
    signedIn = !!u.user;
  }

  const path = req.nextUrl.pathname;
  if (!signedIn && !isOpenPath(path)) {
    /* 画面の取りに行きは、ログイン画面のHTMLを返しても読めない。
       断りだと分かる形で返し、呼び出し側は端末内の記録へ切り替える */
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        { error: "ログインが要ります", mode: "local" },
        { status: 401 },
      );
    }
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    /* 元いた画面へ戻れるように覚えておく */
    to.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(to);
  }
  /* ログイン済みでログイン画面を開いたら、中へ通す */
  if (signedIn && path === "/login") {
    const to = req.nextUrl.clone();
    to.pathname = req.nextUrl.searchParams.get("next") ?? "/";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return res;
}

/* 置いてあるだけのファイルは、はじめから通さない。
   models（顔検出の重み・6.5MB）と sfx を通していたのが、
   受講の画面が遅かったいちばんの理由 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|models/|sfx/|icons/|manifest.webmanifest|sw.js|offline.html).*)",
  ],
};
