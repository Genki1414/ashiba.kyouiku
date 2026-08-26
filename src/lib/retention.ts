import type { SupabaseClient } from "@supabase/supabase-js";

/* 3年たった記録の見極め。

   特別教育を行ったときは、受講者・科目等の記録を作成して
   3年間保存する決まり（安衛則 第38条）。
   教育を行っているのはこの仕組みなので、保存するのもこちら。

   一方で、要らなくなった個人情報は消すのが筋。
   3年を過ぎたら、個人の部分だけ消せるようにする。

   消せるのは、次の3つが揃った人だけ。
     ① どこの事業者にも在籍していない（まだ働いている人は消さない）
     ② その人の受講記録が**全部**3年より前
        よその会社でまだ1年目の受講が残っていたら消せない
     ③ まだ消していない

   起点は「その受講が終わった日」。
   終わっていなければ、いちばん新しい記録の日で見る。
   途中でやめた人の記録も、いつかは消えるようにしておかないと
   永久に残ってしまう。

   自動では消さない。ここは「誰が消せるか」を出すだけ。
   決まりの記録を、気づかないうちに消してはいけない。 */

/** 保存する年数。安衛則 第38条 */
export const KEEP_YEARS = 3;

export type Erasable = {
  userId: string;
  name: string;
  email: string | null;
  /** いちばん新しい記録の日。ここから3年 */
  lastAt: string | null;
  /** 保存期間が切れる日 */
  until: string | null;
  /** 受講の件数 */
  records: number;
  /** 修了証の枚数。番号と日付は消さずに残る */
  certs: number;
};

type Row = Record<string, unknown>;

const day = (v: unknown): string => {
  const s = typeof v === "string" ? v : "";
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
};

/** その日から KEEP_YEARS 年後 */
export function keepUntil(from: string): string {
  const d = new Date(from);
  if (Number.isNaN(d.getTime())) return "";
  d.setFullYear(d.getFullYear() + KEEP_YEARS);
  return d.toISOString().slice(0, 10);
}

/** 保存期間を過ぎていて、まだ消していない人。now は試験から差し込める */
export async function erasable(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<Erasable[]> {
  /* 受講の記録ぜんぶ。人ごとに、いちばん新しい日を出す */
  const { data: ens } = await supabase
    .from("enrollments")
    .select("id, user_id, completed_at, closed_at, created_at");
  const enrolls = (ens ?? []) as Row[];
  if (!enrolls.length) return [];

  const eids = enrolls.map((e) => e.id as string);
  const [{ data: mems }, { data: certs }, { data: us }] = await Promise.all([
    supabase.from("memberships").select("user_id, approved_at, left_at"),
    supabase.from("certificates").select("enrollment_id, issued_at, revoked_at"),
    supabase.from("users").select("id, name, email, erased_at"),
  ]);

  /* いま在籍している人は、そもそも消さない */
  const staying = new Set(
    ((mems ?? []) as Row[])
      .filter((m) => m.approved_at && !m.left_at)
      .map((m) => m.user_id as string),
  );

  const certOf = new Map<string, Row[]>();
  for (const c of (certs ?? []) as Row[]) {
    const k = c.enrollment_id as string;
    if (!certOf.has(k)) certOf.set(k, []);
    certOf.get(k)!.push(c);
  }

  const byUser = new Map<string, { last: string; records: number; certs: number }>();
  for (const e of enrolls) {
    const uid = e.user_id as string;
    /* 起点は「終わった日」。終わっていなければ、いちばん新しい記録の日。
       途中でやめた人の記録も、いつかは消えるようにしておく */
    const mine = (certOf.get(e.id as string) ?? []).filter((c) => !c.revoked_at);
    const at =
      day(e.completed_at) ||
      day(mine[0]?.issued_at) ||
      day(e.closed_at) ||
      day(e.created_at);
    if (!at) continue;
    const cur = byUser.get(uid) ?? { last: "", records: 0, certs: 0 };
    cur.records++;
    cur.certs += mine.length;
    if (at > cur.last) cur.last = at;
    byUser.set(uid, cur);
  }

  const limit = new Date(now);
  limit.setFullYear(limit.getFullYear() - KEEP_YEARS);
  const border = limit.toISOString().slice(0, 10);

  const person = new Map(((us ?? []) as Row[]).map((u) => [u.id as string, u]));

  const out: Erasable[] = [];
  for (const [uid, v] of byUser) {
    if (staying.has(uid)) continue;
    const u = person.get(uid);
    if (!u || u.erased_at) continue;
    /* 全部が3年より前。1件でも新しいものがあれば消さない */
    if (!v.last || v.last > border) continue;
    out.push({
      userId: uid,
      name: (u.name as string) ?? "",
      email: (u.email as string) ?? null,
      lastAt: v.last,
      until: keepUntil(v.last),
      records: v.records,
      certs: v.certs,
    });
  }

  /* 古いものが先。長く置いてあるものから片付ける */
  out.sort((a, b) => `${a.lastAt}`.localeCompare(`${b.lastAt}`));
  return out;
}
