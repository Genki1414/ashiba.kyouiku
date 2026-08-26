import { NextResponse } from "next/server";
import { getSessionClient } from "@/lib/supabase/session";

/* ログアウト。

   画面側で Supabase の道具を持たずに済ませるため、ここでやる。
   持たせると、名前を出すだけのホームとマイページに
   Supabase の一式（60kB あまり）が付いてくる。
   現場は電波の悪い所も多いので、その分だけ開くのが遅くなる。

   クッキーはこの取りに行きの中で消える（@supabase/ssr が書き換える）。 */

export async function POST() {
  const supabase = await getSessionClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
