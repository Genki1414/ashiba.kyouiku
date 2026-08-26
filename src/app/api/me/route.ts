import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin";
import { memberState, myCompany } from "@/lib/tenant";
import { currentOwner } from "@/lib/owner";
import { canLearn } from "@/lib/entitle";
import { currentUser } from "@/lib/supabase/session";
import { readyCourses } from "@/content/courses";
import { getServiceClient } from "@/lib/supabase/server";

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
