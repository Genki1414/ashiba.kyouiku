import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { noticeView } from "@/lib/noticeText";

/* ホームのお知らせ。

   GET  … 自分あての知らせと、未読の数
   POST … 読んだ印を付ける（開いたら全部）

   宛先はログインしている本人で決める。**画面から誰あてかを受け取らない。**
   受け取ると、他人の user_id を書いて、よその人の知らせが読める。

   書き込む道はここに置かない。知らせを作るのは
   こちらが返事をしたときだけ（src/lib/notice.server.ts）。 */

/** 一度に返す数。古いものは捨てる（sweep_notices）ので、
    ここに溜まり続けることはない。それでも上限は置く */
const LIMIT = 30;

export async function GET() {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  /* ログインしていない人には、空を返して 200 にする。
     403 にすると、ログイン前のホームで赤い字が出る */
  if (!supabase || !user) {
    return NextResponse.json({ ok: true, unread: 0, notices: [] });
  }

  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("notices")
      .select("id, kind, course_id, note, created_at, read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("notices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);

  return NextResponse.json({
    ok: true,
    unread: count ?? 0,
    notices: (data ?? []).map((n) => {
      const v = noticeView({
        kind: n.kind as string,
        courseId: n.course_id as string | null,
      });
      return {
        id: n.id,
        kind: n.kind,
        t: v.t,
        d: v.d,
        href: v.href,
        /* こちらが書いた一言。断った理由がここに入る */
        note: (n.note as string) ?? "",
        at: n.created_at,
        read: !!n.read_at,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  if (b.action !== "read") {
    return NextResponse.json({ ok: false, reason: "その操作は分かりません。" }, { status: 400 });
  }
  /* 自分の未読を全部読んだことにする。1件ずつにすると、
     押し忘れた古い1件がいつまでも数に残る */
  const { data, error } = await supabase.rpc("read_notices", { p_user: user.id });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, n: (data as number) ?? 0 });
}
