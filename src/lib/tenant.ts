import { getServiceClient } from "./supabase/server";
import { currentUser } from "./supabase/session";

/* 事業者（テナント）まわり。サーバ専用（ログインのクッキーを読む）。

   参加コードそのものの決まりは src/training/joinCode.ts。
   画面（クライアント）からはそちらを読むこと。
   ここを読ませると next/headers が混ざって画面が動かなくなる。

   この仕組みは外販する。同じ画面を複数の会社が使うので、
   修了証の名義は「その受講者が属する事業者」から取る。
   ここを取り違えると、他社の名義で書類を出すことになる。 */

export type Issuer = {
  /** 事業者名。決まっていなければ空（紙の上で書き入れてもらう） */
  name: string;
  /** 教育実施責任者。同上 */
  responsible: string;
};

const EMPTY: Issuer = { name: "", responsible: "" };

/** その受講の修了証に載せる名義。受講者の所属事業者から取る */
export async function issuerOf(enrollmentId: string): Promise<Issuer> {
  const supabase = getServiceClient();
  if (!supabase) return EMPTY;

  const { data: en } = await supabase
    .from("enrollments")
    .select("user_id")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!en?.user_id) return EMPTY;

  const { data: user } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", en.user_id as string)
    .maybeSingle();
  if (!user?.company_id) return EMPTY;

  const { data: co } = await supabase
    .from("companies")
    .select("name, responsible_name")
    .eq("id", user.company_id as string)
    .maybeSingle();

  return {
    name: (co?.name as string) ?? "",
    responsible: (co?.responsible_name as string) ?? "",
  };
}

/** いまログインしている人の所属。ログインしていなければ null */
export async function myCompany(): Promise<{ id: string; name: string } | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const user = await currentUser();
  if (!user) return null;
  const { data } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!data?.company_id) return null;
  const { data: co } = await supabase
    .from("companies")
    .select("name")
    .eq("id", data.company_id as string)
    .maybeSingle();
  return { id: data.company_id as string, name: (co?.name as string) ?? "" };
}

/** ログインしているのに、まだどこの事業者にも属していないか */
export async function needsJoin(): Promise<boolean> {
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
