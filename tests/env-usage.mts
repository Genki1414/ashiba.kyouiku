/* 「画面（ブラウザ）から、サーバだけの設定を読んでいないか」の点検。

   Next では、環境変数のうち NEXT_PUBLIC_ が付いたものだけがブラウザに届く。
   付いていないものを画面側で読むと、値は undefined になり、
   既定値のまま黙って動く。金額でこれをやると
   「見せている額」と「請求する額」が食い違う（実際に一度やらかした）。

   ここでは、"use client" のファイルから辿れる範囲を調べて、
   NEXT_PUBLIC_ の付かない process.env を読んでいないか見る。

   実行: npx tsx tests/env-usage.mts */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

/** src の下の .ts / .tsx を全部拾う */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const text = new Map(files.map((f) => [f, readFileSync(f, "utf-8")]));

/** import 先を実ファイルへ直す。@/… と 相対 だけ見る */
function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const cand of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (text.has(cand)) return cand;
  }
  return null;
}

const importsOf = (f: string): string[] => {
  const out: string[] = [];
  const re = /(?:from|import)\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text.get(f) ?? ""))) {
    const r = resolve(f, m[1]);
    if (r) out.push(r);
  }
  return out;
};

/* ── 画面から辿れるファイルを集める ── */
const isClient = (f: string) => /^\s*["']use client["']/m.test(text.get(f) ?? "");
const roots = files.filter(isClient);
check(roots.length > 0, `"use client" のファイルが見つかる（${roots.length}件）`);

const reachable = new Set<string>();
const stack = [...roots];
while (stack.length) {
  const f = stack.pop()!;
  if (reachable.has(f)) continue;
  reachable.add(f);
  for (const n of importsOf(f)) if (!reachable.has(n)) stack.push(n);
}
console.log(`── 画面から辿れるファイル ${reachable.size} / ${files.length}`);

/* ── その中で、NEXT_PUBLIC_ の付かない環境変数を読んでいないか ── */
const BAD: { file: string; name: string }[] = [];
for (const f of reachable) {
  const re = /process\.env\.([A-Z0-9_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text.get(f) ?? ""))) {
    const name = m[1];
    /* NODE_ENV は Next が組み立て時に埋めるので、画面で読んでよい */
    if (name.startsWith("NEXT_PUBLIC_") || name === "NODE_ENV") continue;
    BAD.push({ file: path.relative(ROOT, f), name });
  }
}
for (const b of BAD) {
  console.error(`   ${b.file} が ${b.name} を読んでいる`);
}
check(
  BAD.length === 0,
  `画面から辿れる所で、サーバだけの設定を読んでいない（${BAD.length}件）`,
);

/* ── サーバ専用のファイルは、画面から辿れてはいけない ── */
const serverOnly = files.filter((f) => /\.server\.tsx?$/.test(f) || /^\s*import\s+["']server-only["']/m.test(text.get(f) ?? ""));
check(serverOnly.length > 0, `サーバ専用の印が付いたファイルがある（${serverOnly.length}件）`);
for (const f of serverOnly) {
  const rel = path.relative(ROOT, f);
  check(!reachable.has(f), `${rel} は画面から辿れない`);
}

/* ── 単価は必ずサーバ側から来る ── */
{
  const pricing = readFileSync(path.join(SRC, "lib/pricing.ts"), "utf-8");
  check(!/process\.env/.test(pricing), "src/lib/pricing.ts は環境変数を読まない（画面からも使うため）");
  const server = readFileSync(path.join(SRC, "lib/price.server.ts"), "utf-8");
  check(/SEAT_UNIT_PRICE/.test(server), "単価を読むのは src/lib/price.server.ts");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
