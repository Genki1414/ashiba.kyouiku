/* 資格の一覧（選ぶ元）の試験。
   実行: npx tsx tests/quals.ts

   一覧は増えていく。id を変えると、すでに足した人のものが
   行方不明になるので、そこを見張る。
   特別教育は時間と実技の有無も持たせてあるので、その辻褄も見る。 */

import {
  QUALS, KINDS, OTHER, SE_BASIS,
  byKind, findQual, qualName, search, totalH,
} from "@/content/quals";
import { COURSES } from "@/content/courses";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

console.log("── 一覧の形 ──");
{
  const seen = new Set<string>();
  const dup: string[] = [];
  for (const q of QUALS) { if (seen.has(q.id)) dup.push(q.id); seen.add(q.id); }
  check(!dup.length, `id がぶつかっていない（${dup.join(" ")}）`);
}
{
  const seen = new Set<string>();
  const dup: string[] = [];
  for (const q of QUALS) { if (seen.has(q.slug)) dup.push(q.slug); seen.add(q.slug); }
  check(!dup.length, `見出しもぶつかっていない（${dup.join(" ")}）`);
}
{
  const names = new Map<string, number>();
  for (const q of QUALS) names.set(q.name, (names.get(q.name) ?? 0) + 1);
  const dup = [...names].filter(([, n]) => n > 1).map(([k]) => k);
  check(!dup.length, `同じ名前が2つ並んでいない（${dup.join(" ")}）`);
}
check(QUALS.every((q) => KINDS.includes(q.kind)), "種類は決まった3つのどれか");
check(!QUALS.some((q) => q.id === OTHER), "『その他』は一覧に入れない（自分で書く枠）");
check(
  QUALS.every((q) => !/\s/.test(q.id) && !/\s/.test(q.slug)),
  "id と見出しに空白が入っていない（URL や JSON で崩れる）",
);

console.log("── 特別教育（安衛則 第36条）──");
{
  const se = byKind("特別教育");
  check(se.length === 65, `65件ある（いま ${se.length}件）`);

  /* 番号は SE-001 から抜けなく並ぶ。抜けると、あとで足すときに迷う */
  const ids = se.map((q) => q.id);
  const want = Array.from({ length: 65 }, (_, i) => `SE-${String(i + 1).padStart(3, "0")}`);
  check(JSON.stringify(ids) === JSON.stringify(want), "SE-001 から SE-065 まで、順に抜けなく並ぶ");

  check(se.every((q) => typeof q.theoryH === "number" && q.theoryH > 0), "学科の時間が全部に入っている");
  check(se.every((q) => typeof q.practicalH === "number"), "実技の時間も全部に入っている");
  check(
    se.every((q) => q.practical === ((q.practicalH ?? 0) > 0)),
    "実技が要るかどうかは、実技の時間と食い違わない",
  );
  check(
    se.every((q) => totalH(q) === (q.theoryH ?? 0) + (q.practicalH ?? 0)),
    "合計は学科＋実技",
  );
  check(se.every((q) => (q.basis ?? "").length > 10), "根拠が全部に入っている");

  /* 根拠が違うもの（エックス線・ガンマ線）だけ、別の文になっている */
  const xray = findQual("SE-047")!;
  check(xray.basis !== SE_BASIS, "エックス線・ガンマ線は別の根拠");
  check(xray.basis!.includes("電離放射線障害防止規則"), `根拠に電離則が入る（${xray.basis?.slice(0, 20)}…）`);
  check(
    se.filter((q) => q.basis !== SE_BASIS).length === 1,
    "根拠が違うのは1件だけ",
  );

  /* いつから要るようになったか。分かっているものだけ入れる */
  const dated = se.filter((q) => q.from);
  check(dated.length === 6, `適用日の分かっているものが6件（いま ${dated.length}件）`);
  check(
    dated.every((q) => /^\d{4}-\d{2}-\d{2}$/.test(q.from!)),
    "適用日は年月日の形",
  );
  check(findQual("SE-065")?.from === "2019-02-01", "フルハーネスは2019年2月から");
  check(findQual("SE-011")?.from === "2024-02-01", "テールゲートリフターは2024年2月から");
  check(findQual("SE-047")?.from === "2026-04-01", "エックス線は2026年4月から");
}

console.log("── この仕組みで受けられるもの ──");
{
  const ours = QUALS.filter((q) => q.courseId);
  check(ours.length >= 1, `講座と結んであるものがある（いま ${ours.length}件）`);
  const ids = new Set(COURSES.map((c) => c.id));
  check(
    ours.every((q) => ids.has(q.courseId!)),
    `結んだ先の講座が実在する（${ours.map((q) => q.courseId).join(" ")}）`,
  );

  /* 足場。この仕組みの学科は6時間で、実技は要らない */
  const a = findQual("SE-063")!;
  check(a.courseId === "ashiba", "足場は ashiba の講座と結んである");
  check(a.theoryH === 6 && a.practicalH === 0, `足場は学科6時間・実技なし（${a.theoryH}／${a.practicalH}）`);
  check(!a.practical, "足場は実技が要らない（画面だけで終わる）");
  const c = COURSES.find((x) => x.id === "ashiba")!;
  check(c.totalMin === a.theoryH! * 60, `講座の時間と法定時間が合う（${c.totalMin}分 ＝ ${a.theoryH}時間）`);
}

console.log("── 種類で分ける ──");
for (const k of KINDS) {
  check(byKind(k).length > 0, `${k} が1つ以上ある（いま ${byKind(k).length}件）`);
  check(byKind(k).every((q) => q.kind === k), `${k} には ${k} だけが入る`);
}
check(
  KINDS.reduce((n, k) => n + byKind(k).length, 0) === QUALS.length,
  "どの種類にも入らない資格が無い",
);

console.log("── さがす ──");
check(search("特別教育", "").length === 65, "空なら全部出る");
check(search("特別教育", "足場").some((q) => q.id === "SE-063"), "名前の一部で当たる");
check(search("特別教育", "ハーネス").some((q) => q.id === "SE-065"), "途中の言葉でも当たる");
check(search("特別教育", "se-063").some((q) => q.id === "SE-063"), "見出し（英字）でも当たる");
check(search("特別教育", "SE-063").some((q) => q.id === "SE-063"), "番号でも当たる");
check(search("特別教育", "玉掛け").every((q) => q.kind === "特別教育"), "種類をまたいで拾わない");
check(search("特別教育", "ありえない言葉").length === 0, "当たらなければ空");
check(search("技能講習", "玉掛け").length === 1, "技能講習の玉掛けは1件");

console.log("── 引く ──");
check(findQual("SE-063")?.name.includes("足場"), "id から引ける");
check(findQual("ないもの") === null, "無い id は null");
check(qualName("SE-063") === findQual("SE-063")!.name, "名前は一覧のものを使う");
check(qualName(OTHER, "うちの独自講習") === "うちの独自講習", "その他は本人が書いた名前");
check(qualName("ないもの", "書いた名前") === "書いた名前", "一覧に無ければ書いた名前");

console.log(`\n通り ${ok} ／ だめ ${ng}`);
process.exit(ng ? 1 : 0);
