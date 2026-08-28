import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin";
import { memberState, myCompany } from "@/lib/tenant";
import { currentOwner } from "@/lib/owner";
import { canLearn } from "@/lib/entitle";
import { currentUser } from "@/lib/supabase/session";
import { readyCourses } from "@/content/courses";
import { getServiceClient } from "@/lib/supabase/server";
import { unpaidInvoices } from "@/lib/invoiceAccess";

/* いまの自分の立場。ホームの出し分けに使う。

   ホームを静的なまま置いておきたいので、サーバ側で読まずにここから聞く
   （AccountBar と同じやり方）。 */

export async function GET() {
  const owner = await currentOwner();
  const admin = await currentAdmin();
  /* 画面の上に出す「受講者：◯◯」も、ここで一緒に返す。
     別に聞きに行かせると、そのぶん往復が増える */
  const me = await currentUser();
  /* 受講コードを持っているか。持っていない人に学科の札を押させると、
     開いた先で断られるだけなので、ホームで先に知らせる */
  const learn = await canLearn();
  /* 届いている請求書。買った側に「請求書が届いています」を出すため。
     送ってあって、まだ払っていないものだけ */
  const bills = await billsFor(me?.id ?? null, admin?.companyId ?? null);
  if (admin) {
    return NextResponse.json({
      ok: true,
      userId: me?.id ?? null,
      email: me?.email ?? null,
      name: await nameOf(me?.id),
      admin: true,
      owner: !!owner,
      member: "active" as const,
      needsJoin: false,
      canLearn: learn.ok,
      courses: readyCourses().length,
      company: admin.companyName,
      bills,
    });
  }
  const [member, co] = await Promise.all([memberState(), myCompany()]);
  return NextResponse.json({
    ok: true,
    userId: me?.id ?? null,
    email: me?.email ?? null,
    name: await nameOf(me?.id),
    admin: false,
    /* 申し込んだが、まだ許可が下りていない。
       ここを none と一緒にすると、申し込んだ人にも
       「会社とつなぐ」と出続けて、進んだのかどうか分からない */
    member,
    owner: !!owner,
    needsJoin: member === "none",
    canLearn: learn.ok,
    courses: readyCourses().length,
    company: co?.name ?? "",
    bills,
  });
}

/** 画面の上に出す氏名。登録のときの仮の名前のままなら、それが出る */
async function nameOf(userId?: string | null): Promise<string> {
  if (!userId) return "";
  const supabase = getServiceClient();
  if (!supabase) return "";
  const { data } = await supabase.from("users").select("name").eq("id", userId).maybeSingle();
  return (data?.name as string) ?? "";
}

/** 届いている請求書。Supabase が未設定・ログインが無ければ空 */
async function billsFor(userId: string | null, companyId: string | null) {
  const supabase = getServiceClient();
  if (!supabase || !userId) return [];
  return unpaidInvoices(supabase, { userId, companyId });
}
