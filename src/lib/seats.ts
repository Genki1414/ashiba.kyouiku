import type { SupabaseClient } from "@supabase/supabase-js";

/* 受講コード（席）の発行。

   請求書払いでも受講コードは即時発行する（SPEC 5章）。
   受講は始められるが、修了証は入金が済むまで出ない（0009 のトリガ）。 */

/** 注文に、人数ぶんの席を作る。作れた枚数を返す */
export async function issueSeats(
  supabase: SupabaseClient,
  orderId: string,
  seats: number,
): Promise<number> {
  let made = 0;
  for (let i = 0; i < seats; i++) {
    /* コードはまれにぶつかる。ぶつかったら取り直す */
    for (let t = 0; t < 5; t++) {
      const { data: code } = await supabase.rpc("gen_seat_code");
      if (typeof code !== "string") break;
      const { error } = await supabase.from("seats").insert({ order_id: orderId, code });
      if (!error) {
        made++;
        break;
      }
      if (!`${error.message}`.includes("code")) break;
    }
  }
  return made;
}

/** 注文の席の使い具合 */
export async function seatCounts(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<{ total: number; used: number }> {
  if (!orderIds.length) return { total: 0, used: 0 };
  const { data } = await supabase.from("seats").select("used_by").in("order_id", orderIds);
  const rows = data ?? [];
  return { total: rows.length, used: rows.filter((r) => r.used_by).length };
}
