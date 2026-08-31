import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { newJoinCode } from "@/training/joinCode";
import { likeCompany, sameCompany } from "@/training/companyName";
import { notify } from "@/lib/notify.server";

/* 事業者を新しく作り、作った人が最初の教育担当者になる。

   この仕組みは外販するので、事業者はいくつでも並ぶ。
   「まだどこにも属していない人」だけが作れる。
   すでにどこかに属している人は、その会社の担当者に頼んでもらう
   （勝手に会社を増やして自社の名簿を分断させないため）。

   同じ会社が2つ登録されると、名簿が割れる。
   片方に申し込んだ人が、もう片方を見ている担当者からは見えない。
   なので、作る前にもう一度探す。
     ・書き方を揃えてぴったり同じ … 作らずに「申し込んでください」と返す
     ・法人格を外した所だけ同じ　 … 「もしかしてこれ？」と候補を返す
       （前株と後株は別の会社のことがあるので、止めはしない） */

/* force … 似た名前を見たうえで「それでも作る」と押した */
type Body = { company?: string; force?: boolean };

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

  /* もう同じ会社が登録されていないか。
     名前の一覧はそう長くならないので、まとめて引いて突き合わせる */
  const { data: all } = await supabase.from("companies").select("id, name");
  const rows = all ?? [];

  const hit = rows.find((c) => sameCompany(name, (c.name as string) ?? ""));
  if (hit) {
    return NextResponse.json(
      {
        ok: false,
        /* 画面はこれを見て「申し込む」に切り替える */
        exists: { id: hit.id as string, name: (hit.name as string) ?? "" },
        reason: `「${hit.name}」はもう登録されています。新しく作らずに、そちらへ申し込んでください。`,
      },
      { status: 409 },
    );
  }

  /* 前株と後株など、似ているもの。止めはしないが、先に見せる。
     「作る」を押し直してもらえば、そのまま作れる */
  if (!body.force) {
    const like = rows
      .filter((c) => likeCompany(name, (c.name as string) ?? ""))
      .map((c) => ({ id: c.id as string, name: (c.name as string) ?? "" }));
    if (like.length) {
      return NextResponse.json(
        {
          ok: false,
          maybe: like,
          reason: "似た名前の事業者がすでにあります。同じ会社なら、そちらへ申し込んでください。",
        },
        { status: 409 },
      );
    }
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
  /* 運営に知らせる。新しい会社が使い始めた */
  await notify("company");

  /* 作った人は、その事業者に在籍する。
     users.company_id を直に書くだけでは在籍（memberships）が立たず、
     自分が名簿に出ない。無償利用の判定も在籍で見るので、
     ここを通しておかないと、作った本人が教材を開けない */
  const { error: joinErr } = await supabase.rpc("join_company", {
    p_user: user.id,
    p_company: companyId,
  });
  if (joinErr) {
    return NextResponse.json({ ok: false, reason: joinErr.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("users")
    .update({ role: "admin" })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, company: name, joinCode: code });
}
