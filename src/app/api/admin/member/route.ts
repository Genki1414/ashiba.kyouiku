import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { addNotice } from "@/lib/notice.server";

/* 在籍の出し入れ。教育担当者だけ。

   退職しても名簿からは消さない。「退職」として残る。
   その会社が「誰に受けさせたか」を後から示せるようにするため。
   受けた記録そのものは、教育を行っているこの仕組みの側に残る。

   よその会社の人には触れない。自社に在籍しているか、
   自社の席で受けた記録がある人だけを動かせる。 */

type Body = { userId?: string; action?: "leave" | "rejoin" | "approve" | "reject" };

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの操作です。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const userId = typeof b.userId === "string" ? b.userId : "";
  const action =
    b.action === "rejoin" || b.action === "approve" || b.action === "reject" ? b.action : "leave";
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "誰の話か分かりません。" }, { status: 400 });
  }
  if (userId === admin.userId) {
    return NextResponse.json(
      { ok: false, reason: "自分は動かせません。ほかの担当者に頼んでください。" },
      { status: 409 },
    );
  }

  /* 参加の申し込みを許可する。よその会社に在籍していれば、そちらは閉じる（転職）。
     いちど断ったあとでも、同じ人からの申し込みがあったなら許可できる
     （押し間違いで消したまま戻せないと、担当者はどうにもできない） */
  if (action === "approve") {
    const { data: req0 } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("company_id", admin.companyId)
      .limit(1);
    if (!(req0 ?? []).length) {
      return NextResponse.json({ ok: false, reason: "その申し込みはもうありません。" }, { status: 409 });
    }
    const { error } = await supabase.rpc("join_company", {
      p_user: userId,
      p_company: admin.companyId,
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    /* 待っていた本人に返す。許可しても、相手には何も伝わらないままだった。
       宛先は申し込んだ人。押した担当者ではない */
    await addNotice(userId, "member_ok");
    return NextResponse.json({ ok: true, left: false });
  }

  /* 断る。申し込みを閉じるだけ（許可が要らないのは外すときと同じ） */
  if (action === "reject") {
    const { error } = await supabase.rpc("leave_company", {
      p_user: userId,
      p_company: admin.companyId,
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    await addNotice(userId, "member_ng");
    return NextResponse.json({ ok: true, left: true });
  }

  /* 自社と関わりのある人か。在籍か、自社の席で受けた記録があるか */
  const [{ data: mem }, { data: enr }] = await Promise.all([
    supabase.from("memberships").select("id").eq("user_id", userId).eq("company_id", admin.companyId).limit(1),
    supabase.from("enrollments").select("id").eq("user_id", userId).eq("company_id", admin.companyId).limit(1),
  ]);
  if (!(mem ?? []).length && !(enr ?? []).length) {
    return NextResponse.json({ ok: false, reason: "自社の名簿に居ない人です。" }, { status: 403 });
  }

  if (action === "leave") {
    const { error } = await supabase.rpc("leave_company", {
      p_user: userId,
      p_company: admin.companyId,
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, left: true });
  }

  /* 戻す。よその会社に在籍していれば、そちらは閉じられる */
  const { error } = await supabase.rpc("join_company", {
    p_user: userId,
    p_company: admin.companyId,
  });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, left: false });
}
