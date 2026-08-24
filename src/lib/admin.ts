import { getServiceClient } from "./supabase/server";
import { currentUser } from "./supabase/session";

/* 教育担当者かどうかを、サーバ側で確かめる。
   画面の出し分けではなく、ここを通さないとデータが出ない作りにする。

   担当者に見えるのは自社（company_id）の受講者だけ。
   これは 0002_rls.sql の方針と同じ。 */

export type Admin = {
  userId: string;
  companyId: string;
  companyName: string;
  /** 受講者を自社へ入れるための合言葉 */
  joinCode: string;
};

/** いまログインしている人が担当者なら、その人と事業者を返す。違えば null */
export async function currentAdmin(): Promise<Admin | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const user = await currentUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("id, role, company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!data || data.role !== "admin" || !data.company_id) return null;

  const companyId = data.company_id as string;
  const { data: company } = await supabase
    .from("companies")
    .select("name, join_code")
    .eq("id", companyId)
    .maybeSingle();
  return {
    userId: user.id,
    companyId,
    companyName: (company?.name as string) ?? "",
    joinCode: (company?.join_code as string) ?? "",
  };
}

/** その人がまだどこの事業者にも属していないか。
    属していなければ、自分の事業者を作れる（＝新しく使い始める人） */
export async function canCreateCompany(): Promise<boolean> {
  const supabase = getServiceClient();
  if (!supabase) return false;
  const user = await currentUser();
  if (!user) return false;
  const { data } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  return !!data && !data.company_id;
}
