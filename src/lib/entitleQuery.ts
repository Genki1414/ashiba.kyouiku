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
  const want = (courseId ?? "").trim();

  /* ── 通る人は、この1回で終わる（2026-09-10）──

     前は5回、順番に聞いていた。
       ① 所属 → ② 利用者の会社 → ③ 会社の名前 → ④ 席 → ⑤ その注文
     ①〜③は**断り文の「◯◯の教育担当者に聞いてください」にしか使わない**のに、
     断ると決まる前に聞いていた。受けられる人（ほとんどの人）には丸ごと無駄で、
     しかも順番待ちなので、往復のぶんだけ画面が出るのが遅れる。

     席と注文は外部キーで繋がっているので、ひと息に聞ける。
     **その講座の席があるか**を、1回の問い合わせで確かめる。 */
  let q = supabase
    .from("seats")
    .select("id, orders!inner(course_id)")
    .eq("used_by", userId);
  if (want) q = q.eq("orders.course_id", want);
  const { data: seat } = await q.limit(1).maybeSingle();
  if (seat) return { ok: true, by: "seat" };

  /* ここから下は、断るときだけ通る。会社の名前は断り文のためだけ */
  return { ok: false, why: "seat", company: await companyNameOf(supabase, userId) };
}

/** 断り文に出す会社の名前。**これで受講を通してはいけない** */
async function companyNameOf(supabase: SupabaseClient, userId: string): Promise<string> {
  /* 在籍している会社。名前まで一緒に取る（外部キーで繋がっている） */
  const { data: mem } = await supabase
    .from("memberships")
    .select("companies(name)")
    .eq("user_id", userId)
    .not("approved_at", "is", null)
    .is("left_at", null)
    .limit(1)
    .maybeSingle();
  const byMem = nameOf(mem);
  if (byMem) return byMem;

  /* 名簿に入る前の人。利用者の欄に会社が入っていることがある */
  const { data: me } = await supabase
    .from("users")
    .select("companies(name)")
    .eq("id", userId)
    .maybeSingle();
  return nameOf(me);
}

const nameOf = (row: unknown): string => {
  const co = (row as { companies?: { name?: string } | { name?: string }[] } | null)?.companies;
  const one = Array.isArray(co) ? co[0] : co;
  return String(one?.name ?? "");
};
