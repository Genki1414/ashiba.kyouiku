import type { SupabaseClient } from "@supabase/supabase-js";

/* 受講してよい人かどうかの判断。

   この教材は売り物。**その講座の受講コード（席）を引き換えた人だけ**が、
   その講座の学科を開ける。実務トレーニングは別の売り物で、
   決まりは src/lib/trainingGate.ts にある（第1章は誰でも）。
   画面の出し分けではなく、サーバでここを通してから中身を作る。
   通さないと、登録しただけの人に教材が全部見えてしまう。

   ── 席は「講座ごと」（2026-09-09）──
   げんきさん「有償利用に切り替えてもどんな講座でも受けれてしまう」。

   前は「席が1枚でもあれば通す」だった。席に講座が書いていないので
   （seats には order_id しかない）、そこで止めていた。
   だから**足場の受講コードを1枚持っているだけで、73講座すべてが開いた。**
   1講座ぶんの代金で全部見られる、ということ。

   席の講座は、注文（orders.course_id）が持っている。
   席 → 注文 とたどって、**その講座のものか**を見る。

   ── 無償利用は撤廃した（2026-09-09）──
   げんきさん「無償利用は撤廃する」。
   companies.trial で会社ごとに無料にする仕組みがあったが、やめた。
   下見をさせたい相手にも、受講コードを配る形にそろえる。
   （列は残してある。過去に立てた記録を消さないため。**もう見ない**）

   教育担当者だからといって通さない。
   登録すれば誰でも自分の事業者を作って担当者になれるので、
   そこを通すと「登録すればタダで見られる」のと同じになる。

   参加コード（8文字）は名簿に入るだけのもの。これでは受講できない。

   ログインのクッキーを読む所とは分けてある。
   分けておくと、本物のスキーマに当てて確かめられる（tests/admin-db.mts）。 */

export type Learn =
  | { ok: true; by: "seat" | "open" }
  /* why: signin=ログインが無い／seat=受講コードを引き換えていない */
  | { ok: false; why: "signin" | "seat"; company: string };

/** 受講してよいか。

    @param courseId その講座の席を見る。**省くと「どれか1講座でも
                    持っているか」**になる（ホームの案内など、
                    講座が決まっていない場所だけで使うこと）。
                    教材そのものを出す所では、必ず講座を渡す。 */
export async function learnFor(
  supabase: SupabaseClient,
  userId: string,
  courseId?: string,
): Promise<Learn> {
  /* 画面に出す所属の名前。断り文に「◯◯の教育担当者に聞いてください」と
     出すために使う。**これで受講を通してはいけない** */
  const { data: mem } = await supabase
    .from("memberships")
    .select("company_id")
    .eq("user_id", userId)
    .not("approved_at", "is", null)
    .is("left_at", null)
    .limit(1)
    .maybeSingle();

  let companyId = (mem?.company_id as string | null) ?? null;
  if (!companyId) {
    const { data: me } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    companyId = (me?.company_id as string | null) ?? null;
  }

  let company = "";
  if (companyId) {
    const { data: co } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();
    company = (co?.name as string) ?? "";
  }

  /* 引き換えた席。**期限は引き換えのときに DB（redeem_seat）が見ている** */
  const { data: seats } = await supabase
    .from("seats")
    .select("id, order_id")
    .eq("used_by", userId);

  const orderIds = (seats ?? [])
    .map((s) => (s.order_id as string | null) ?? "")
    .filter(Boolean);
  if (orderIds.length === 0) return { ok: false, why: "seat", company };

  /* 講座を指していなければ、1枚でもあれば通す（ホームの案内など） */
  const want = (courseId ?? "").trim();
  if (!want) return { ok: true, by: "seat" };

  /* **その講座の席か。**席には講座が書いていないので、注文まで見る。
     ここを省いていたのが「どの講座でも開く」の正体 */
  const { data: hit } = await supabase
    .from("orders")
    .select("id")
    .in("id", orderIds)
    .eq("course_id", want)
    .limit(1)
    .maybeSingle();

  if (hit?.id) return { ok: true, by: "seat" };
  return { ok: false, why: "seat", company };
}
