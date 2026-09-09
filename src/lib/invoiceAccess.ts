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

/* ── 請求書の一覧（買った側）──

   げんきさん（2026-09-09）「請求書を発行すると過去の請求書が見れなくなるから、
   請求書ページ作って残して」。ホームの「請求書が届いています」は
   払っていないものしか出さないので、払ったあとは開く道が無かった。

   1回の申込み（group_id）を1件にまとめる。行は講座ごとに分かれているが、
   請求書は1枚（0029・0030）。 */
export type InvoiceEntry = {
  /** 請求書を開くときの注文の番号（その申込みのどれか1行。請求書は group で出る） */
  id: string;
  groupId: string;
  createdAt: string;
  method: string;
  /** pending=入金待ち／paid=入金済み／cancelled=取消 */
  status: "pending" | "paid" | "cancelled";
  seats: number;
  amount: number;
  /** 講座ごとの明細 */
  items: { courseId: string; seats: number; amount: number }[];
  /** 運営が請求書を出した日。空なら、まだ出ていない */
  invoicedAt: string | null;
  paidAt: string | null;
};

type OrderRow = {
  id: string; group_id: string | null; course_id: string; seats: number; amount: number;
  method: string; status: string; invoiced_at: string | null; paid_at: string | null; created_at: string;
};

/** 講座ごとの行を、申込みごとにまとめる。新しい申込みが先 */
export function groupInvoices(rows: OrderRow[]): InvoiceEntry[] {
  const by = new Map<string, InvoiceEntry>();
  /* 古い行から入れる。id は申込みの中でいちばん古い行（請求書の番号がぶれない） */
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const o of sorted) {
    const g = o.group_id ?? o.id;
    const cur = by.get(g);
    const st = (o.status === "paid" || o.status === "cancelled" ? o.status : "pending") as InvoiceEntry["status"];
    if (!cur) {
      by.set(g, {
        id: o.id, groupId: g, createdAt: o.created_at, method: o.method, status: st,
        seats: o.seats ?? 0, amount: o.amount ?? 0,
        items: [{ courseId: o.course_id, seats: o.seats ?? 0, amount: o.amount ?? 0 }],
        invoicedAt: o.invoiced_at ?? null, paidAt: o.paid_at ?? null,
      });
      continue;
    }
    cur.seats += o.seats ?? 0;
    cur.amount += o.amount ?? 0;
    cur.items.push({ courseId: o.course_id, seats: o.seats ?? 0, amount: o.amount ?? 0 });
    /* 1行でも入金待ちなら、申込みは入金待ち。取消は全部取消のときだけ */
    if (st === "pending" || cur.status === "pending") cur.status = "pending";
    else if (st === "paid" || cur.status === "paid") cur.status = "paid";
    /* 送った日はいちばん古いもの（1枚なので1つ）。入金日はいちばん新しいもの */
    if (o.invoiced_at && (!cur.invoicedAt || o.invoiced_at < cur.invoicedAt)) cur.invoicedAt = o.invoiced_at;
    if (o.paid_at && (!cur.paidAt || o.paid_at > cur.paidAt)) cur.paidAt = o.paid_at;
  }
  return [...by.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** その人が見てよい申込みを全部（個人の注文と、自分の事業者の注文） */
export async function invoicesFor(
  supabase: SupabaseClient,
  who: { companyId: string | null; userId: string },
): Promise<{ ok: true; list: InvoiceEntry[] } | { ok: false; reason: string }> {
  const cols = "id, group_id, course_id, seats, amount, method, status, invoiced_at, paid_at, created_at";
  const [mine, ours] = await Promise.all([
    supabase.from("orders").select(cols).eq("user_id", who.userId),
    who.companyId
      ? supabase.from("orders").select(cols).eq("company_id", who.companyId)
      : Promise.resolve({ data: [] as OrderRow[], error: null }),
  ]);
  /* 読めなかったことを「0件」に化けさせない（docs/100） */
  const err = mine.error ?? ours.error;
  if (err) return { ok: false, reason: err.message };
  const seen = new Set<string>();
  const rows = [...((mine.data ?? []) as OrderRow[]), ...((ours.data ?? []) as OrderRow[])]
    .filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
  return { ok: true, list: groupInvoices(rows) };
}

/** 買った側に「請求書が届いています」を出す注文。送ってあって、まだ払っていないもの */
export async function unpaidInvoices(
  supabase: SupabaseClient,
  who: { companyId: string | null; userId: string },
): Promise<{ id: string; amount: number; invoicedAt: string; courses: number }[]> {
  const pick = (rows: Record<string, unknown>[] | null) =>
    (rows ?? []).map((o) => ({
      id: o.id as string,
      group: ((o.group_id as string) ?? (o.id as string)),
      amount: (o.amount as number) ?? 0,
      invoicedAt: (o.invoiced_at as string) ?? "",
    }));

  const cols = "id, group_id, amount, invoiced_at";
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
  const rows = all.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));

  /* ── 申込みごとにまとめる（0029・0030）──

     複数の講座を一度に申し込めるので、1回の申込みが講座ごとの行に
     分かれている。**請求書は1枚。**行ごとに数えると、
     知らせの金額が請求書と食い違う。

     実際に食い違った（2026-09-09）。請求書は42,900円なのに、
     ホームには「4,950円」と出た。行ごとに数えていたため。 */
  const byGroup = new Map<string, { id: string; amount: number; invoicedAt: string; courses: number }>();
  for (const o of rows) {
    const g = byGroup.get(o.group);
    if (!g) {
      byGroup.set(o.group, { id: o.id, amount: o.amount, invoicedAt: o.invoicedAt, courses: 1 });
      continue;
    }
    g.amount += o.amount;
    g.courses += 1;
    /* いつ送ったかは、いちばん古い日付（請求書は1枚なので1つ） */
    if (o.invoicedAt && (!g.invoicedAt || o.invoicedAt < g.invoicedAt)) g.invoicedAt = o.invoicedAt;
  }
  return [...byGroup.values()];
}
