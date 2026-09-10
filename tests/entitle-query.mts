/* 受けられるかを見る所が、**何回・どんな形で**聞いているか。
   実行: npx tsx tests/entitle-query.mts

   ── なぜ要るか ──
   ここは受講の関所。間違えると、受講コードを持っている人まで
   締め出される（お金をもらっているのに開かない、がいちばん悪い壊れ方）。

   2026-09-10 に、5回の順番待ちを1回にまとめた（げんきさん「遷移速度が遅い」）。
   席と注文を外部キーでひと息に取る形にしたので、**その形が正しいか**を
   ここで押さえる。手元に PostgREST は無いので、
   本物の supabase-js に組み立てさせて、出ていく住所を見る。 */

import { createClient } from "@supabase/supabase-js";
import { learnFor } from "@/lib/entitleQuery";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string, extra?: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${m}${extra ? `\n    ${extra}` : ""}`); }
};

/** 出ていく住所を覚えて、決めた中身を返す作り物 */
function fake(rows: Record<string, unknown[]>) {
  const seen: string[] = [];
  const f = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    seen.push(url);
    const table = url.split("/rest/v1/")[1]?.split("?")[0] ?? "";
    const body = rows[table] ?? [];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const client = createClient("https://example.supabase.co", "anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: f as unknown as typeof fetch },
  });
  return { client, seen };
}

const U = "11111111-1111-1111-1111-111111111111";

console.log("── その講座の席がある人 ──");
{
  /* 席が1枚あり、その注文が足場 */
  const { client, seen } = fake({ seats: [{ id: "s1", orders: { course_id: "ashiba" } }] });
  const r = await learnFor(client, U, "ashiba");
  check(r.ok === true, "受けられる", JSON.stringify(r));
  check(seen.length === 1, `**聞きに行くのは1回だけ**（いま ${seen.length}回）`, seen.join("\n    "));
  const u = decodeURIComponent(seen[0] ?? "");
  check(u.includes("/rest/v1/seats"), "席から引く");
  check(u.includes("orders!inner(course_id)"), "注文をひと息に取る（外部キー）", u);
  check(u.includes("used_by=eq." + U), "その人の席だけ");
  check(u.includes("orders.course_id=eq.ashiba"), "その講座の席だけ", u);
  check(u.includes("limit=1"), "1枚あれば足りる");
}

console.log("\n── 席はあるが、別の講座のものだった ──");
{
  /* PostgREST は、合わない席を返さない。作り物でも空で返す */
  const { client, seen } = fake({ seats: [], memberships: [], users: [] });
  const r = await learnFor(client, U, "ishiwata");
  check(r.ok === false, "受けられない");
  check(r.ok === false && r.why === "seat", "理由は受講コード");
  check(seen.length > 1, "断るときだけ、会社の名前を聞きに行く");
  check(seen.some((x) => x.includes("/rest/v1/memberships")), "所属から会社の名前を引く");
}

console.log("\n── 講座を指さないとき（ホームの案内など）──");
{
  const { client, seen } = fake({ seats: [{ id: "s1", orders: { course_id: "ashiba" } }] });
  const r = await learnFor(client, U, undefined);
  check(r.ok === true, "1枚でもあれば通す");
  check(seen.length === 1, "こちらも1回だけ");
  check(!decodeURIComponent(seen[0] ?? "").includes("orders.course_id=eq."),
    "講座で絞らない", decodeURIComponent(seen[0] ?? ""));
}

console.log("\n── 断り文に出す会社の名前 ──");
{
  const { client } = fake({
    seats: [],
    memberships: [{ companies: { name: "点検用工業" } }],
  });
  const r = await learnFor(client, U, "ashiba");
  check(r.ok === false && r.company === "点検用工業", "在籍している会社の名前が出る",
    JSON.stringify(r));
}
{
  /* 名簿に入る前の人。利用者の欄の会社を見る */
  const { client } = fake({
    seats: [],
    memberships: [],
    users: [{ companies: { name: "まだ名簿前工業" } }],
  });
  const r = await learnFor(client, U, "ashiba");
  check(r.ok === false && r.company === "まだ名簿前工業", "名簿前でも会社の名前が出る",
    JSON.stringify(r));
}
{
  /* 会社が分からなくても落ちない */
  const { client } = fake({ seats: [], memberships: [], users: [] });
  const r = await learnFor(client, U, "ashiba");
  check(r.ok === false && r.company === "", "会社が無ければ空で返す（落ちない）");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
