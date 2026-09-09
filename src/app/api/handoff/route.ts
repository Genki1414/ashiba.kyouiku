import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/session";
import { getServiceClient } from "@/lib/supabase/server";
import { HANDOFF_MIN } from "@/lib/handoff";

/* 引き換えコードを作る（0036）。**入っている本人だけ。**

   ブラウザで入ったあと、ここでコードをもらい、
   ホーム画面のアプリで打つと、そちらにもログインが立つ。

   決まり（1回きり・5分・作り直すと前のは消える）は SQL 側（make_handoff）。
   ここで持つと、入口が増えたときに食い違う。 */
export async function POST() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "ログインが必要です。" }, { status: 403 });
  }
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "接続の設定がありません。" }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("make_handoff", { p_user: user.id });
  if (error || typeof data !== "string") {
    return NextResponse.json(
      { ok: false, reason: error?.message ?? "コードを作れませんでした。" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, code: data, minutes: HANDOFF_MIN });
}
