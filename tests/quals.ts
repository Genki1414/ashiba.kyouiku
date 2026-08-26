/* よそで取った資格の一覧（選ぶ元）の試験。
   実行: npx tsx tests/quals.ts

   一覧は増えていく。id を変えると、すでに足した人のものが
   行方不明になるので、そこを見張る。 */

import { QUALS, KINDS, OTHER, byKind, findQual, qualName } from "@/content/quals";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

console.log("── 一覧の形 ──");
check(QUALS.length >= 25, `そこそこの数がある（いま ${QUALS.length}件）`);
{
  const seen = new Set<string>();
  const dup: string[] = [];
  for (const q of QUALS) { if (seen.has(q.id)) dup.push(q.id); seen.add(q.id); }
  check(!dup.length, `id がぶつかっていない（${dup.join(" ")}）`);
}
{
  const names = new Set(QUALS.map((q) => q.name));
  check(names.size === QUALS.length, "同じ名前が2つ並んでいない");
}
check(
  QUALS.every((q) => KINDS.includes(q.kind)),
  "種類は決まった3つのどれか",
);
check(!QUALS.some((q) => q.id === OTHER), "『その他』は一覧に入れない（自分で書く枠）");
check(
  QUALS.every((q) => q.id.length > 2 && !/\s/.test(q.id)),
  "id に空白が入っていない（URL や JSON で崩れる）",
);

console.log("── 種類で分ける ──");
for (const k of KINDS) {
  check(byKind(k).length > 0, `${k} が1つ以上ある（いま ${byKind(k).length}件）`);
  check(byKind(k).every((q) => q.kind === k), `${k} には ${k} だけが入る`);
}
check(
  KINDS.reduce((n, k) => n + byKind(k).length, 0) === QUALS.length,
  "どの種類にも入らない資格が無い",
);

console.log("── 引く ──");
check(findQual("se-ashiba")?.name.includes("足場"), "id から引ける");
check(findQual("ないもの") === null, "無い id は null");
check(qualName("se-ashiba") === findQual("se-ashiba")!.name, "名前は一覧のものを使う");
check(qualName(OTHER, "うちの独自講習") === "うちの独自講習", "その他は本人が書いた名前");
check(qualName("ないもの", "書いた名前") === "書いた名前", "一覧に無ければ書いた名前");

console.log("── この仕組みで受けられるもの ──");
{
  /* 足場の特別教育は、この仕組みでも受けられる。
     よそで取った人が受け直さなくてよいことを示すため、講座と結んでおく */
  const a = findQual("se-ashiba");
  check(a?.courseId === "ashiba", `足場は講座と結んである（${a?.courseId}）`);
  check(a?.kind === "特別教育", "足場は特別教育");
}

console.log(`\n通り ${ok} ／ だめ ${ng}`);
process.exit(ng ? 1 : 0);
