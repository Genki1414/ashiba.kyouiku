import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";

/* 受講者から見た「会社との紐付け」。

   GET  … いまの状態（在籍・申請中・どこにも属していない）
   POST … 申し込む（request）／自分から外す（leave）

   外すのに許可は要らない。辞めるときに会社の返事を待てないため。
   受けた記録は消えない。受講が「どの会社の席で受けたか」を
   自分で持っているので、前の会社の名簿には残る。 */

type Body = { action?: "request" | "leave"; companyId?: string };

export async function GET() {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }

  const { data } = await supabase
    .from("memberships")
    .select("id, company_id, approved_at, requested_at")
    .eq("user_id", user.id)
    .is("left_at", null);
  const rows = data ?? [];
  if (!rows.length) return NextResponse.json({ ok: true, state: "none" });

  const ids = rows.map((r) => r.company_id as string);
  const { data: cos } = await supabase.from("companies").select("id, name").in("id", ids);
  const nameOf = new Map((cos ?? []).map((c) => [c.id as string, c.name as string]));

  const active = rows.find((r) => r.approved_at);
  if (active) {
    return NextResponse.json({
      ok: true,
      state: "active",
      company: { id: active.company_id, name: nameOf.get(active.company_id as string) ?? "" },
    });
  }
  return NextResponse.json({
    ok: true,
    state: "pending",
    pending: rows.map((r) => ({
      id: r.id,
      company: { id: r.company_id, name: nameOf.get(r.company_id as string) ?? "" },
      at: r.requested_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const companyId = typeof b.companyId === "string" ? b.companyId : "";
  if (!companyId) {
    return NextResponse.json({ ok: false, reason: "事業者を選んでください。" }, { status: 400 });
  }

  if (b.action === "leave") {
    const { error } = await supabase.rpc("leave_company", {
      p_user: user.id,
      p_company: companyId,
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, state: "none" });
  }

  const { error } = await supabase.rpc("request_membership", {
    p_user: user.id,
    p_company: companyId,
  });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, state: "pending" });
}
