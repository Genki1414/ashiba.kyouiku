import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isOpenPath } from "@/lib/authGate";

/* ログインの見張り。

   ・Supabase を設定していないあいだは、ログインを求めない。
     記録は端末内に置く決まりなので、求めても意味がないため
     （手元で動かすとき・まだ繋いでいない環境）。
   ・設定してあるときは、ログインしていない人を /login へ送る。
     いまはログインが、外から開かれないための唯一の守りでもある。 */


export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

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

  /* ここで呼ぶことで、期限が近いログインが延長される */
  const { data } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  if (!data.user && !isOpenPath(path)) {
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
  if (data.user && path === "/login") {
    const to = req.nextUrl.clone();
    to.pathname = req.nextUrl.searchParams.get("next") ?? "/";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
