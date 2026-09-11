import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin";
import { memberState, myCompany } from "@/lib/tenant";
import { currentOwner } from "@/lib/owner";
import { canLearn } from "@/lib/entitle";
import { currentUser } from "@/lib/supabase/session";
import { readyCourses } from "@/content/courses";
import { getServiceClient } from "@/lib/supabase/server";
import { unpaidInvoices } from "@/lib/invoiceAccess";
import { courseMarks, heldCourseIds } from "@/lib/held";

/* いまの自分の立場。ホームの出し分けに使う。

   ホームを静的なまま置いておきたいので、サーバ側で読まずにここから聞く
   （AccountBar と同じやり方）。 */

export async function GET() {
  /* ── 並べて聞く（2026-09-10）──
     ここは**どの画面からも呼ばれる**（上の帯・下の札・講座の札）。
     前は上から順に await していたので、聞く先が10か所あれば
     10回ぶん順番待ちしていた。互いに要らないものは、同時に聞く。

     誰かを見るのは1回だけ（currentUser は cache 済み。session.ts）。 */
  const me = await currentUser();
  const [owner, admin] = await Promise.all([currentOwner(), currentAdmin()]);
  const gathered = await Promise.all([
    /* 受講コードを持っているか。持っていない人に学科の札を押させると、
       開いた先で断られるだけなので、ホームで先に知らせる */
    canLearn(),
    /* 取得済みの講座。講座一覧の札に「取得済」を出す
       （この仕組みの修了証と、よそで取ったと本人が入れたもの） */
    heldOf(me?.id ?? null),
    /* 講座の札に出す様子（げんきさん 2026-09-09
       「講座一覧にも受講可能、受講中表示」）。
         受講可能 … 受講コードを持っているが、まだ開いていない
         受講中   … 持っていて、もう開いている */
    marksOf(me?.id ?? null),
    /* 画面の上に出す「受講者：◯◯」。別に聞きに行かせると往復が増える */
    whoOf(me?.id),
  ]).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));
  /* どれか1つでも読めなかったら、名前が空の人として描かせない（2026-09-11） */
  if (gathered instanceof Error) return NextResponse.json({ ok: false, reason: gathered.message }, { status: 500 });
  const [learn, held, marks, who] = gathered;
  /* 請求書だけは、担当者かどうかが決まってからでないと聞けない */
  const bills = await billsFor(me?.id ?? null, admin?.companyId ?? null);
  if (admin) {
    return NextResponse.json({
      ok: true,
      userId: me?.id ?? null,
      email: me?.email ?? null,
      ...who,
      admin: true,
      owner: !!owner,
      member: "active" as const,
      needsJoin: false,
      canLearn: learn.ok,
      courses: readyCourses().length,
      company: admin.companyName,
      bills,
      held,
      ...marks,
    });
  }
  const [member, co] = await Promise.all([memberState(), myCompany()]);
  return NextResponse.json({
    ok: true,
    userId: me?.id ?? null,
    email: me?.email ?? null,
    ...who,
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
    held,
    ...marks,
  });
}

/** 受講コードを持っている講座と、もう開いている講座 */
async function marksOf(userId: string | null): Promise<{ owned: string[]; learning: string[] }> {
  const supabase = getServiceClient();
  if (!supabase || !userId) return { owned: [], learning: [] };
  return courseMarks(supabase, userId);
}

/** 画面の上に出す氏名。登録のときの仮の名前のままなら、それが出る */
/* 修了証に載る氏名と生年月日。**マイページで入れた1か所だけを見る。**

   前は、受講の準備の画面でも同じものを入力させていた。
   端末の中に別に持っていたので、
     ・端末を替えると、また入れ直しになる
     ・マイページの値と食い違う。どちらが修了証に載るのか分からない
   という2つが起きていた。入り口はマイページだけにする。 */
async function whoOf(userId?: string | null): Promise<{ name: string; birth: string }> {
  const supabase = getServiceClient();
  if (!supabase || !userId) return { name: "", birth: "" };
  const { data , error: whoErr } = await supabase
    .from("users")
    .select("name, birth_date")
    .eq("id", userId)
    .maybeSingle();
  if (whoErr) throw new Error(`氏名を読めませんでした（${whoErr.message}）`);
  return {
    name: (data?.name as string) ?? "",
    birth: (data?.birth_date as string) ?? "",
  };
}


/** 取得済みの講座の id。Supabase が未設定・ログインが無ければ空 */
async function heldOf(userId: string | null): Promise<string[]> {
  const supabase = getServiceClient();
  if (!supabase || !userId) return [];
  return (await heldCourseIds(supabase, [userId])).get(userId) ?? [];
}

/** 届いている請求書。Supabase が未設定・ログインが無ければ空 */
async function billsFor(userId: string | null, companyId: string | null) {
  const supabase = getServiceClient();
  if (!supabase || !userId) return [];
  return unpaidInvoices(supabase, { userId, companyId });
}
