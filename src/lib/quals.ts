import type { SupabaseClient } from "@supabase/supabase-js";
import { OTHER, qualName, findQual } from "@/content/quals";

/* 取得済みの資格の読み書き。

   この仕組みの外で取ったもの（前の会社の特別教育、教習機関の技能講習）を
   本人が入れる。この仕組みで出した修了証は certificates 側にあるので、
   画面に出すときは両方をならべる。

   マイページ（本人）と、教育担当者の名簿（会社）から使う。
   1か所にまとめておかないと、片方に足した項目がもう片方から抜ける。

   ログインのクッキーを読む所とは分けてある。
   分けておくと、本物のスキーマに当てて確かめられる（tests/admin-db.mts）。 */

export type Held = {
  id: string;
  qualId: string;
  name: string;
  kind: string;
  /** 一覧に無いものを自分で書いた分 */
  own: boolean;
  issuer: string;
  gotOn: string | null;
  certNo: string;
  /** 会社が現物を見て確かめた日。空なら自己申告のまま */
  confirmedAt: string | null;
};

type Row = Record<string, unknown>;

/* 取った日は日付だけ。年月日より細かいものは持たない。
   返ってくる形が「2024-03-11」のことも
   「2024-03-11T00:00:00.000Z」のこともあるので、ここで揃える */
const dateOnly = (v: unknown): string | null => {
  const s = typeof v === "string" ? v : "";
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

const toHeld = (r: Row): Held => {
  const id = (r.qual_id as string) ?? "";
  const q = findQual(id);
  return {
    id: r.id as string,
    qualId: id,
    name: qualName(id, r.label as string | null),
    kind: q?.kind ?? "その他",
    own: id === OTHER,
    issuer: (r.issuer as string) ?? "",
    gotOn: dateOnly(r.got_on),
    certNo: (r.cert_no as string) ?? "",
    confirmedAt: (r.confirmed_at as string) ?? null,
  };
};

/* 確かめたものが先。次に新しく取ったもの。名前で最後を決める */
const order = (a: Held, b: Held) =>
  Number(!!b.confirmedAt) - Number(!!a.confirmedAt) ||
  `${b.gotOn ?? ""}`.localeCompare(`${a.gotOn ?? ""}`) ||
  a.name.localeCompare(b.name, "ja");

/** その人がよそで取った資格 */
export async function heldFor(supabase: SupabaseClient, userId: string): Promise<Held[]> {
  const { data } = await supabase
    .from("held_quals")
    .select("id, qual_id, label, issuer, got_on, cert_no, confirmed_at")
    .eq("user_id", userId);
  return ((data ?? []) as Row[]).map(toHeld).sort(order);
}

/** 何人ぶんかまとめて。名簿は人が並ぶので、1人ずつ引くと問い合わせが増える */
export async function heldForMany(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, Held[]>> {
  const out = new Map<string, Held[]>();
  if (!userIds.length) return out;
  const { data } = await supabase
    .from("held_quals")
    .select("id, user_id, qual_id, label, issuer, got_on, cert_no, confirmed_at")
    .in("user_id", userIds);
  for (const r of (data ?? []) as Row[]) {
    const k = r.user_id as string;
    if (!out.has(k)) out.set(k, []);
    out.get(k)!.push(toHeld(r));
  }
  for (const v of out.values()) v.sort(order);
  return out;
}
