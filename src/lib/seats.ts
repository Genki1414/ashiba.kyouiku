import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeJoinCode } from "@/training/joinCode";

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
  /** 修了証を出した人の席か。出していたら引き換えは取り消せない */
  certified: boolean;
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
    .select("id, code, order_id, used_by, used_at, expires_at")
    .in("order_id", ids);
  const rows = data ?? [];

  /* 使った人の氏名を引く。行ごとに引くと数が増えるので、まとめて1回 */
  const userIds = [...new Set(rows.map((r) => r.used_by as string | null).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (userIds.length) {
    const { data: users } = await supabase.from("users").select("id, name").in("id", userIds);
    for (const u of users ?? []) names.set(u.id as string, (u.name as string) ?? "");
  }

  /* 修了証を出した人の席は取り消せない。どれがそうかをここで見ておく */
  const usedSeatIds = rows.filter((r) => r.used_by).map((r) => r.id as string);
  const certifiedSeats = new Set<string>();
  if (usedSeatIds.length) {
    const { data: ens } = await supabase
      .from("enrollments")
      .select("id, seat_id")
      .in("seat_id", usedSeatIds);
    const bySeat = new Map<string, string>();
    for (const e of ens ?? []) bySeat.set(e.id as string, e.seat_id as string);
    const eids = [...bySeat.keys()];
    if (eids.length) {
      const { data: certs } = await supabase
        .from("certificates")
        .select("enrollment_id, revoked_at")
        .in("enrollment_id", eids);
      for (const c of certs ?? []) {
        if (c.revoked_at) continue;
        const seatId = bySeat.get(c.enrollment_id as string);
        if (seatId) certifiedSeats.add(seatId);
      }
    }
  }

  const out: SeatRow[] = rows.map((r) => ({
    code: (r.code as string) ?? "",
    orderId: (r.order_id as string) ?? "",
    status: statusOf.get(r.order_id as string) ?? "pending",
    usedBy: r.used_by ? (names.get(r.used_by as string) ?? "受講者") : null,
    usedAt: (r.used_at as string | null) ?? null,
    expiresAt: (r.expires_at as string | null) ?? null,
    certified: certifiedSeats.has(r.id as string),
  }));

  /* 未使用が先。同じ組の中では、期限の近いものから配る */
  return out.sort((a, b) => {
    if (!!a.usedAt !== !!b.usedAt) return a.usedAt ? 1 : -1;
    return `${a.expiresAt ?? ""}`.localeCompare(`${b.expiresAt ?? ""}`) || a.code.localeCompare(b.code);
  });
}

/* 引き換えを取り消す。

   間違った人がコードを入れてしまった、受講前に辞めた、といったときに
   担当者が席を戻せるようにする。戻さないと、買った枚数が減ったまま
   どうにもできない（在庫が0なら手の打ちようがない）。

   ただし修了証を出した人の席は戻さない。
   戻すと、席の無い修了証が残る（0009 の決まりに反する）。
   その人の分は、先に修了証を取り消してもらう。

   戻すときは、その席で受けた学科と実務の記録も消して、
   受講そのものを最初からにする。
   残すと、次にその席を配られた人（あるいは同じ人）が、
   前の続きから始まってしまう。買い直した席で法定時間を
   引き継げるなら、席を売る意味が無くなる。

   修了証の行だけは残す（取り消した分も含めて）。
   出した書類の控えなので、消してはいけない。 */
export type Release = { ok: true; code: string } | { ok: false; reason: string };

export async function releaseSeat(
  supabase: SupabaseClient,
  rawCode: string,
  companyId: string,
): Promise<Release> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return { ok: false, reason: "受講コードを入れてください。" };

  const { data: seat } = await supabase
    .from("seats")
    .select("id, order_id, used_by")
    .eq("code", code)
    .maybeSingle();
  if (!seat?.id) return { ok: false, reason: "そのコードの受講コードがありません。" };

  /* よその事業者の席は触らせない */
  const { data: order } = await supabase
    .from("orders")
    .select("company_id")
    .eq("id", seat.order_id as string)
    .maybeSingle();
  if (!order || order.company_id !== companyId) {
    return { ok: false, reason: "よその事業者の受講コードです。" };
  }
  if (!seat.used_by) return { ok: false, reason: "その受講コードは、まだ使われていません。" };

  const { data: ens } = await supabase
    .from("enrollments")
    .select("id")
    .eq("seat_id", seat.id as string);
  const eids = (ens ?? []).map((e) => e.id as string);
  if (eids.length) {
    const { data: certs } = await supabase
      .from("certificates")
      .select("id, revoked_at")
      .in("enrollment_id", eids);
    if ((certs ?? []).some((c) => !c.revoked_at)) {
      return {
        ok: false,
        reason: "修了証を出した人の受講コードは取り消せません。先に修了証を取り消してください。",
      };
    }
    /* その席で受けた記録を消す。次の人は最初からになる。
       修了証（取り消した分も）は控えなので消さない */
    for (const table of ["progress", "exams", "training_attempts", "verify_logs"]) {
      const { error } = await supabase.from(table).delete().in("enrollment_id", eids);
      if (error) return { ok: false, reason: "取り消せませんでした。もう一度試してください。" };
    }

    const { error: unlink } = await supabase
      .from("enrollments")
      .update({ seat_id: null, started_at: new Date().toISOString() })
      .eq("seat_id", seat.id as string);
    if (unlink) return { ok: false, reason: "取り消せませんでした。もう一度試してください。" };
  }

  const { error } = await supabase
    .from("seats")
    .update({ used_by: null, used_at: null })
    .eq("id", seat.id as string);
  if (error) return { ok: false, reason: "取り消せませんでした。もう一度試してください。" };

  return { ok: true, code };
}
