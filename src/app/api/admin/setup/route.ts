import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { noAdminYet } from "@/lib/admin";

/* 最初の教育担当者を決める。
   まだ担当者が1人も居ないときだけ通す。2人目からは担当者の画面で任命する。

   ここで事業者（会社）も1社作り、まだどこにも属していない人を全員そこへ入れる。
   ログインした人がばらばらに宙に浮いたままだと、担当者から誰も見えないため。 */

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "Supabase がまだ設定されていません。" },
      { status: 503 },
    );
  }
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "ログインしてください。" }, { status: 401 });
  }
  if (!(await noAdminYet())) {
    return NextResponse.json(
      { ok: false, reason: "すでに教育担当者が居ます。担当者の画面から任命してください。" },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { company?: string };
  const name = (body.company ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, reason: "事業者名を入れてください。" }, { status: 400 });
  }

  /* すでに1社だけあるならそれを使う。無ければ作る */
  const { data: exist } = await supabase.from("companies").select("id").limit(2);
  let companyId = (exist ?? []).length === 1 ? ((exist ?? [])[0].id as string) : null;
  if (!companyId) {
    const { data, error } = await supabase
      .from("companies")
      .insert({ name })
      .select("id")
      .single();
    if (error || !data) {
      return NextResponse.json({ ok: false, reason: error?.message ?? "作れません" }, { status: 500 });
    }
    companyId = data.id as string;
  } else {
    await supabase.from("companies").update({ name }).eq("id", companyId);
  }

  /* まだどこにも属していない人を、この会社へ入れる */
  await supabase.from("users").update({ company_id: companyId }).is("company_id", null);
  const { error } = await supabase
    .from("users")
    .update({ role: "admin", company_id: companyId })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, company: name });
}
