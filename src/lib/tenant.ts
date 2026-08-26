import { getServiceClient } from "./supabase/server";
import { currentUser } from "./supabase/session";

/* 事業者（テナント）まわり。サーバ専用（ログインのクッキーを読む）。

   参加コードそのものの決まりは src/training/joinCode.ts。
   画面（クライアント）からはそちらを読むこと。
   ここを読ませると next/headers が混ざって画面が動かなくなる。

   この仕組みは外販する。同じ画面を複数の会社が使うので、
   修了証の名義は「その受講者が属する事業者」から取る。
   ここを取り違えると、他社の名義で書類を出すことになる。 */

/** 会社との紐付けが、いまどうなっているか。

    none    … まだどこにも申し込んでいない
    pending … 申し込んだが、まだ許可が下りていない
    active  … 在籍している

    ホームの札を出し分けるのに使う。
    申し込んだ人に「会社とつなぐ」と出し続けると、
    押しても同じ画面に戻るだけで、進んだのかどうか分からない。 */
export type MemberState = "none" | "pending" | "active";

export async function memberState(): Promise<MemberState> {
  const supabase = getServiceClient();
  if (!supabase) return "none";
  const user = await currentUser();
  if (!user) return "none";

  const { data } = await supabase
    .from("memberships")
    .select("approved_at")
    .eq("user_id", user.id)
    .is("left_at", null);
  const rows = data ?? [];
  if (rows.some((m) => m.approved_at)) return "active";
  return rows.length ? "pending" : "none";
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
