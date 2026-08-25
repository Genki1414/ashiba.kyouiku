/* 画面が読む項目を、返す側が本当に返しているかの試験。
   実行: npx tsx tests/api-shape.mts

   なぜ要るか。
   教育担当者の画面で「参加の申し込み」が出ないことがあった。
   問い合わせは合っていて、返す所が2つに分かれていたのが原因。
   名簿が空のときの返しには requests が入っていて、
   人が1人でも居るときの返しには入っていなかった。
   受講者が1人居る会社では、申し込みが**絶対に出ない**形になっていた。

   型では捕まらない。fetch の戻りは any で、画面は j.requests ?? [] と
   受けているので、抜けていても 0件 として静かに出る。
   だから、書いてある字を突き合わせて見る。 */

import { readFileSync } from "node:fs";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/* { … } の中を、対応する括弧まで取り出す */
const body = (src: string, from: number) => {
  let d = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(from, i + 1); }
  }
  return "";
};

/* NextResponse.json({ … }) のうち、ok: true を返しているもの */
const successBodies = (src: string) => {
  const out: string[] = [];
  const re = /NextResponse\.json\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const b = body(src, src.indexOf("{", m.index));
    if (/\bok:\s*true\b/.test(b) || /\.\.\.base\b/.test(b)) out.push(b);
  }
  return out;
};

/* いちばん外側にある「key:」と「...展開」を拾う */
const keysOf = (b: string) => {
  const inner = b.slice(1, -1);
  const keys = new Set<string>();
  let d = 0;
  let line = "";
  const flush = () => {
    const m = /^\s*(?:\.\.\.)?([A-Za-z_$][\w$]*)\s*(:|,|$)/.exec(line);
    if (m) keys.add(m[1]);
    line = "";
  };
  for (const ch of inner) {
    if (ch === "{" || ch === "[" || ch === "(") d++;
    if (ch === "}" || ch === "]" || ch === ")") d--;
    if (ch === "," && d === 0) { flush(); continue; }
    line += ch;
  }
  flush();
  return keys;
};

console.log("── /api/admin/summary が返す形 ──");
{
  const src = read("src/app/api/admin/summary/route.ts");
  const bodies = successBodies(src);
  check(bodies.length >= 2, `うまくいったときの返しが2つ以上ある（いま ${bodies.length}）`);

  /* base に集めた分を、それぞれの返しに足して見る */
  const baseMatch = /const base = \{/.exec(src);
  const baseKeys = baseMatch ? keysOf(body(src, src.indexOf("{", baseMatch.index))) : new Set<string>();
  check(baseKeys.size > 0, "共通の形（base）が置いてある");

  const sets = bodies.map((b) => {
    const k = keysOf(b);
    if (k.has("base")) for (const x of baseKeys) k.add(x);
    k.delete("base");
    return k;
  });

  /* 画面が読む項目 */
  const client = read("src/app/admin/AdminClient.tsx");
  const load = client.slice(client.indexOf("const load ="), client.indexOf("const load =") + 1600);
  const wants = new Set<string>();
  for (const m of load.matchAll(/\bj\.([A-Za-z_$][\w$]*)/g)) wants.add(m[1]);
  /* うまくいかなかったときだけのもの */
  for (const x of ["canSetup", "reason", "signedIn", "ok"]) wants.delete(x);
  check(wants.size >= 8, `画面が読む項目を拾えている（いま ${[...wants].join(" ")}）`);

  for (const want of [...wants].sort()) {
    for (let i = 0; i < sets.length; i++) {
      check(sets[i].has(want), `${want} が ${i + 1}つめの返しに入っている`);
    }
  }

  /* 返しどうしで食い違っていないか（片方にだけ足した、を捕まえる） */
  for (let i = 1; i < sets.length; i++) {
    const a = sets[0];
    const b = sets[i];
    const miss = [...a].filter((k) => !b.has(k)).concat([...b].filter((k) => !a.has(k)));
    check(!miss.length, `返しどうしで項目が揃っている（食い違い: ${miss.join(" ")}）`);
  }
}

console.log("── /api/member が返す形 ──");
{
  /* 受講者側。state が3つとも返っていないと、許可待ちが出ない */
  const src = read("src/app/api/member/route.ts");
  for (const s of ["none", "active", "pending"]) {
    check(src.includes(`state: "${s}"`), `state: "${s}" を返している`);
  }
  check(/\bpending:\s*rows\.map/.test(src), "許可待ちは、開いている申し込みを並べて返す");
}

console.log(`\n通り ${ok} ／ だめ ${ng}`);
process.exit(ng ? 1 : 0);
