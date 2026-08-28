import type { SupabaseClient } from "@supabase/supabase-js";

/* その請求書を、その人に見せてよいか。

   見せてよいのは3通り。
   ・本部（売っている側）… どの注文でも
   ・教育担当者 … 自分の事業者の注文
   ・個人 … 自分が申し込んだ注文

   よその会社の請求書には、宛名も金額も相手の会社名も載っている。
   注文の番号さえ分かれば誰でも開ける、という形にしてはいけない。

   ログインのクッキーを読む所とは分けてある。
   分けておくと、本物のスキーマに当てて確かめられる（tests/admin-db.mts）。 */

export type InvoiceWho =
  | { owner: true }
  /** 教育担当者。その事業者の注文だけ */
  | { owner: false; companyId: string | null; userId: string };

export type MayInvoice =
  | { ok: true; as: "owner" | "admin" | "solo" }
  | { ok: false; reason: string };

export function maySeeInvoice(
  order: { company_id: string | null; user_id: string | null },
  who: InvoiceWho,
): MayInvoice {
  if (who.owner) return { ok: true, as: "owner" };

  /* 個人の注文は、申し込んだ本人だけ。
     会社の担当者でも、よその人の個人の注文は見せない */
  if (order.user_id) {
    return order.user_id === who.userId
      ? { ok: true, as: "solo" }
      : { ok: false, reason: "その請求書は見られません。" };
  }

  if (order.company_id && who.companyId && order.company_id === who.companyId) {
    return { ok: true, as: "admin" };
  }
  return { ok: false, reason: "その請求書は見られません。" };
}

/** 買った側に「請求書が届いています」を出す注文。送ってあって、まだ払っていないもの */
export async function unpaidInvoices(
  supabase: SupabaseClient,
  who: { companyId: string | null; userId: string },
): Promise<{ id: string; amount: number; invoicedAt: string }[]> {
  const pick = (rows: Record<string, unknown>[] | null) =>
    (rows ?? []).map((o) => ({
      id: o.id as string,
      amount: (o.amount as number) ?? 0,
      invoicedAt: (o.invoiced_at as string) ?? "",
    }));

  const cols = "id, amount, invoiced_at";
  const [mine, ours] = await Promise.all([
    supabase
      .from("orders")
      .select(cols)
      .eq("user_id", who.userId)
      .eq("status", "pending")
      .not("invoiced_at", "is", null),
    who.companyId
      ? supabase
          .from("orders")
          .select(cols)
          .eq("company_id", who.companyId)
          .eq("status", "pending")
          .not("invoiced_at", "is", null)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  /* 同じ注文が2回出ることはない（個人の注文と会社の注文は別物）が、
     念のため番号でまとめる */
  const all = [...pick(mine.data), ...pick(ours.data as Record<string, unknown>[] | null)];
  const seen = new Set<string>();
  return all.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}
