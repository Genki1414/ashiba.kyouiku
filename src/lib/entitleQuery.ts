import type { SupabaseClient } from "@supabase/supabase-js";

/* 受講してよい人かどうかの判断。

   この教材は売り物。受講コード（席）を引き換えた人だけが、
   学科と実務トレーニングを開ける。
   画面の出し分けではなく、サーバでここを通してから中身を作る。
   通さないと、登録しただけの人に教材が全部見えてしまう。

   通すのは、
   ・受講コードを引き換えた人（seats.used_by が自分）
   ・無償利用の事業者の人（companies.trial）
     … 試用・社内利用。運営が /owner で立てる

   教育担当者だからといって通さない。
   登録すれば誰でも自分の事業者を作って担当者になれるので、
   そこを通すと「登録すればタダで見られる」のと同じになる。
   下見をさせたい相手には、運営が無償利用を立てる。

   参加コード（8文字）は名簿に入るだけのもの。これでは受講できない。

   ログインのクッキーを読む所とは分けてある。
   分けておくと、本物のスキーマに当てて確かめられる（tests/admin-db.mts）。 */

export type Learn =
  | { ok: true; by: "seat" | "trial" | "open" }
  /* why: signin=ログインが無い／seat=受講コードを引き換えていない */
  | { ok: false; why: "signin" | "seat"; company: string };

export async function learnFor(supabase: SupabaseClient, userId: string): Promise<Learn> {
  const { data: me } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  const companyId = (me?.company_id as string | null) ?? null;

  let company = "";
  if (companyId) {
    const { data: co } = await supabase
      .from("companies")
      .select("name, trial")
      .eq("id", companyId)
      .maybeSingle();
    company = (co?.name as string) ?? "";
    if (co?.trial) return { ok: true, by: "trial" };
  }

  /* 引き換えた席が1枚でもあれば受講できる。
     期限は引き換えのときに DB（redeem_seat）が見ている */
  const { data: seat } = await supabase
    .from("seats")
    .select("id")
    .eq("used_by", userId)
    .limit(1)
    .maybeSingle();
  if (seat?.id) return { ok: true, by: "seat" };

  return { ok: false, why: "seat", company };
}
