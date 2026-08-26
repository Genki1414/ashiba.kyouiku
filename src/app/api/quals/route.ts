import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { heldFor } from "@/lib/quals";
import { OTHER, findQual } from "@/content/quals";

/* よそで取った資格。本人が足す・外す。

   自分のぶんしか触らない。誰かの id を受け取ったりしない。
   ここで足せるのは自己申告まで。「確かめた」印は会社側が立てる
   （/api/admin/qual）。自分で確かめたことにできると、印の意味が無くなる。 */

type Body = {
  action?: "add" | "drop";
  id?: string;
  qualId?: string;
  label?: string;
  issuer?: string;
  gotOn?: string;
  certNo?: string;
};

const clip = (v: unknown, n: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;

export async function GET() {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, held: await heldFor(supabase, user.id) });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;

  if (b.action === "drop") {
    const id = clip(b.id, 64);
    if (!id) {
      return NextResponse.json({ ok: false, reason: "どれを外すのか分かりません。" }, { status: 400 });
    }
    /* 自分のぶんだけ消える（drop_qual が user_id で絞っている） */
    const { error } = await supabase.rpc("drop_qual", { p_user: user.id, p_id: id });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, held: await heldFor(supabase, user.id) });
  }

  const qualId = clip(b.qualId, 64);
  if (!qualId) {
    return NextResponse.json({ ok: false, reason: "資格を選んでください。" }, { status: 400 });
  }
  /* 一覧に無い id を送られても取らない。'その他' だけは本人が名前を書く */
  if (qualId !== OTHER && !findQual(qualId)) {
    return NextResponse.json({ ok: false, reason: "その資格は一覧にありません。" }, { status: 400 });
  }
  const label = clip(b.label, 100);
  if (qualId === OTHER && !label) {
    return NextResponse.json(
      { ok: false, reason: "その他を選んだときは、資格の名前を書いてください。" },
      { status: 400 },
    );
  }

  /* 取った日。未来の日付は受けない（打ち間違い） */
  let gotOn: string | null = null;
  if (typeof b.gotOn === "string" && b.gotOn) {
    const t = Date.parse(b.gotOn);
    if (Number.isNaN(t)) {
      return NextResponse.json({ ok: false, reason: "取った日が読めません。" }, { status: 400 });
    }
    if (t > Date.now()) {
      return NextResponse.json({ ok: false, reason: "取った日が先の日付になっています。" }, { status: 400 });
    }
    gotOn = new Date(t).toISOString().slice(0, 10);
  }

  const { error } = await supabase.rpc("add_qual", {
    p_user: user.id,
    p_qual: qualId,
    p_label: label,
    p_issuer: clip(b.issuer, 100),
    p_got: gotOn,
    p_cert: clip(b.certNo, 60),
  });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, held: await heldFor(supabase, user.id) });
}
