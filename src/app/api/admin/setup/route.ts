import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { newJoinCode } from "@/training/joinCode";

/* 事業者を新しく作り、作った人が最初の教育担当者になる。

   この仕組みは外販するので、事業者はいくつでも並ぶ。
   「まだどこにも属していない人」だけが作れる。
   すでにどこかに属している人は、その会社の担当者に頼んでもらう
   （勝手に会社を増やして自社の名簿を分断させないため）。 */

type Body = { company?: string };

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

  const { data: me } = await supabase
    .from("users")
    .select("id, company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) {
    return NextResponse.json({ ok: false, reason: "受講者の登録が見つかりません。" }, { status: 409 });
  }
  if (me.company_id) {
    return NextResponse.json(
      { ok: false, reason: "すでに事業者に属しています。担当者にしてもらってください。" },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const name = (body.company ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, reason: "事業者名を入れてください。" }, { status: 400 });
  }

  /* 参加コードはまれにぶつかる。ぶつかったら取り直す */
  let companyId: string | null = null;
  let code = "";
  for (let i = 0; i < 5 && !companyId; i++) {
    code = newJoinCode();
    const { data, error } = await supabase
      .from("companies")
      .insert({
        name,
        join_code: code,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (data?.id) companyId = data.id as string;
    else if (error && !`${error.message}`.includes("join_code")) {
      return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    }
  }
  if (!companyId) {
    return NextResponse.json({ ok: false, reason: "作れませんでした。もう一度お試しください。" }, { status: 500 });
  }

  const { error } = await supabase
    .from("users")
    .update({ role: "admin", company_id: companyId })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, company: name, joinCode: code });
}
