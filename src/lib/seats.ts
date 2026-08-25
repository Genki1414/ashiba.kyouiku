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

/** 画面に出す受講コード1枚 */
export type SeatRow = {
  code: string;
  orderId: string;
  /** 元の注文の状態。未入金でも受講は始められるが、修了証は出ない */
  status: string;
  /** 使った人の氏名。まだなら null */
  usedBy: string | null;
  usedAt: string | null;
  expiresAt: string | null;
};

/** 注文の席を、配れる形（コードの文字そのもの）で返す。
    数だけ見せても配れないので、ここで文字を取り出す。
    使っていないものを先に出す（担当者が次に配るのはそれなので）。 */
export async function listSeats(
  supabase: SupabaseClient,
  orders: { id: string; status: string }[],
): Promise<SeatRow[]> {
  const ids = orders.map((o) => o.id);
  if (!ids.length) return [];
  const statusOf = new Map(orders.map((o) => [o.id, o.status]));

  const { data } = await supabase
    .from("seats")
    .select("code, order_id, used_by, used_at, expires_at")
    .in("order_id", ids);
  const rows = data ?? [];

  /* 使った人の氏名を引く。行ごとに引くと数が増えるので、まとめて1回 */
  const userIds = [...new Set(rows.map((r) => r.used_by as string | null).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (userIds.length) {
    const { data: users } = await supabase.from("users").select("id, name").in("id", userIds);
    for (const u of users ?? []) names.set(u.id as string, (u.name as string) ?? "");
  }

  const out: SeatRow[] = rows.map((r) => ({
    code: (r.code as string) ?? "",
    orderId: (r.order_id as string) ?? "",
    status: statusOf.get(r.order_id as string) ?? "pending",
    usedBy: r.used_by ? (names.get(r.used_by as string) ?? "受講者") : null,
    usedAt: (r.used_at as string | null) ?? null,
    expiresAt: (r.expires_at as string | null) ?? null,
  }));

  /* 未使用が先。同じ組の中では、期限の近いものから配る */
  return out.sort((a, b) => {
    if (!!a.usedAt !== !!b.usedAt) return a.usedAt ? 1 : -1;
    return `${a.expiresAt ?? ""}`.localeCompare(`${b.expiresAt ?? ""}`) || a.code.localeCompare(b.code);
  });
}
