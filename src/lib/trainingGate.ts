import type { SupabaseClient } from "@supabase/supabase-js";

/* 実務トレーニングを、どこまで使ってよいか。

   第1章 … ログインすれば誰でも（試し）
           資材カタログと通し見学も、第1章に入る前に見るものなので一緒
   第2章から先 … 利用権を持っている人だけ

   特別教育（学科）とは別の売り物にしてある。
   学科は「1人1枚の席」で、修了証が出る決まりのもの。
   実務トレーニングは修了証の要件ではないので、席とは分ける。

   利用権は**人**に付く。会社ではない。
   教育担当者を通さずに本人が買えるようにするためで、
   会社を移っても持っていける（自分で買ったものだから）。

   無償利用の事業者に在籍している人は、利用権が無くても全部使える。

   ログインのクッキーを読む所とは分けてある。
   分けておくと、本物のスキーマに当てて確かめられる（tests/admin-db.mts）。 */

export type TrainMay =
  /* 第2章から先も使える。by は根拠（画面に出す言い方を変えるため） */
  | { ok: true; by: "paid" | "trial" | "open" }
  /* 第1章だけ。why=free は「まだ買っていない」 */
  | { ok: false; why: "free" | "signin" };

/** 誰でも使える章（試し） */
export const FREE_CHAPTERS = ["ch1"];

export const isFreeChapter = (ch: string) => FREE_CHAPTERS.includes(ch);

export async function trainFor(
  supabase: SupabaseClient,
  userId: string,
): Promise<TrainMay> {
  /* 自分で買った（または本部が付けた）利用権 */
  const { data: got } = await supabase
    .from("training_access")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (got?.user_id) return { ok: true, by: "paid" };

  /* 無償利用の事業者に在籍していれば、利用権が無くても全部使える。
     在籍で見る（申し込んだだけの人は通さない）。
     会社の名前は誰でも探せるので、申し込むだけで通ると意味が無くなる */
  const { data: mem } = await supabase
    .from("memberships")
    .select("company_id")
    .eq("user_id", userId)
    .not("approved_at", "is", null)
    .is("left_at", null)
    .limit(1)
    .maybeSingle();
  const companyId = (mem?.company_id as string | null) ?? null;
  if (companyId) {
    const { data: co } = await supabase
      .from("companies")
      .select("trial")
      .eq("id", companyId)
      .maybeSingle();
    if (co?.trial) return { ok: true, by: "trial" };
  }

  return { ok: false, why: "free" };
}
