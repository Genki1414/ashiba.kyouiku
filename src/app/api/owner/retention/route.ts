import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentOwner } from "@/lib/owner";
import { KEEP_YEARS, erasable } from "@/lib/retention";

/* 3年たった記録の、個人の部分を消す（本部だけ）。

   特別教育の記録は3年保存の決まり（安衛則 第38条）。
   過ぎたぶんの個人情報は、要らなくなったものなので消せるようにする。

   GET  … 誰が消せるか。押す前に、必ず見えるようにしておく
   POST … 1人ぶん消す

   自動では消さない。決まりの記録を、気づかないうちに消してはいけない。
   まとめて消すボタンも作らない。1人ずつ、名前を見てから押してもらう。 */

export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ ok: false, reason: "本部だけの操作です。" }, { status: 403 });
  }
  const rows = await erasable(supabase);
  return NextResponse.json({ ok: true, years: KEEP_YEARS, rows });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ ok: false, reason: "本部だけの操作です。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as { userId?: string };
  const userId = typeof b.userId === "string" ? b.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "誰の話か分かりません。" }, { status: 400 });
  }

  /* 画面が古いまま押されることがある。消す直前にもう一度、
     いまの決まりで「消してよい人か」を確かめる */
  const rows = await erasable(supabase);
  if (!rows.some((r) => r.userId === userId)) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          "その人はいま消せません。保存期間が残っているか、事業者に在籍しているか、もう消してあります。",
        rows,
      },
      { status: 409 },
    );
  }

  const { data, error } = await supabase.rpc("erase_learner", { p_user: userId });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  if (data === false) {
    return NextResponse.json({ ok: false, reason: "その人が見つかりません。" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, rows: await erasable(supabase) });
}
