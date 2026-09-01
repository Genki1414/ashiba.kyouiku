/* 特別教育の目録の決まり。
   実行: npm run test:tokubetsu */

import { readFileSync } from "node:fs";
import {
  LISTED_ON,
  SOURCES,
  TOKUBETSU,
  findTokubetsu,
  hasJitsugi,
  isReady,
  sourceOf,
  splitReady,
  tokubetsuOfCourse,
  totalMinOf,
  trustedHours,
} from "../src/content/tokubetsu";
import { COURSES, findCourse, hoursText } from "../src/content/courses";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`); }
};
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

console.log("── 目録そのもの ──");
{
  check(TOKUBETSU.length === 65, `65種類ある（いま ${TOKUBETSU.length}）`);
  const slugs = TOKUBETSU.map((t) => t.slug);
  check(new Set(slugs).size === slugs.length, "目印が重なっていない");
  const nos = TOKUBETSU.map((t) => t.no);
  check(new Set(nos).size === nos.length, "番号が重なっていない");
  check(Math.min(...nos) === 1 && Math.max(...nos) === 65, "番号は1から65まで");
  /* 名前が空だと、一覧で何の教育か分からない行になる */
  check(TOKUBETSU.every((t) => t.name.trim().length > 0), "全部に名前がある");
  check(TOKUBETSU.every((t) => /^[a-z0-9_]+$/.test(t.slug)), "目印は英小文字と数字だけ",
    TOKUBETSU.filter((t) => !/^[a-z0-9_]+$/.test(t.slug)).map((t) => t.slug).join("／"));
  check(TOKUBETSU.every((t) => t.basis.trim().length > 0), "全部に根拠がある");
  check(/^\d{4}-\d{2}-\d{2}$/.test(LISTED_ON), "写した日が入っている", LISTED_ON);
}

console.log("\n── 時間 ──");
{
  /* 0分の教育は無い。0のまま講座にすると、見た瞬間に修了証が出る */
  check(TOKUBETSU.every((t) => t.gakkaMin > 0), "学科の時間が0の行は無い",
    TOKUBETSU.filter((t) => !t.gakkaMin).map((t) => t.slug).join("／"));
  check(TOKUBETSU.every((t) => t.jitsugiMin >= 0), "実技の時間が負でない");
  /* 15分刻み。半端な分は写し間違いの印 */
  check(TOKUBETSU.every((t) => t.gakkaMin % 30 === 0 && t.jitsugiMin % 30 === 0),
    "時間は30分刻み",
    TOKUBETSU.filter((t) => t.gakkaMin % 30 || t.jitsugiMin % 30).map((t) => t.slug).join("／"));
  check(TOKUBETSU.every((t) => totalMinOf(t) === t.gakkaMin + t.jitsugiMin), "合計は学科＋実技");
  /* 丸1日を超える学科は写し間違いを疑う。いちばん長いのは特殊化学設備の13時間 */
  const long = TOKUBETSU.filter((t) => t.gakkaMin > 13 * 60);
  check(long.length === 0, "学科が13時間を超える行は無い", long.map((t) => t.slug).join("／"));

  check(TOKUBETSU.filter(hasJitsugi).length === 52, "実技のあるものが52件",
    `${TOKUBETSU.filter(hasJitsugi).length}`);
  check(TOKUBETSU.filter((t) => !hasJitsugi(t)).length === 13, "学科だけのものが13件");
}

console.log("\n── 確かめた行だけ信じる ──");
{
  /* 目録の元にした一覧は、65件中11件しか条番号が無く、実際に1件間違っていた。
     確かめていない時間で修了証を出すと、法定時間に足りない紙になる */
  const t1 = findTokubetsu("oxygen_deficiency_type1");
  check(!!t1 && t1.gakkaMin === 330,
    "第1種酸素欠乏は5時間30分（渡された一覧の4時間は誤り）",
    t1 ? hoursText(t1.gakkaMin) : "無し");
  check(!!t1 && trustedHours(t1), "直した行には、確かめた印が付いている");
  /* 第2種と同じ時間。片方だけ短いのは、写し間違いの形 */
  const t2 = findTokubetsu("oxygen_deficiency_type2");
  check(!!t2 && !!t1 && t1.gakkaMin === t2.gakkaMin, "第1種と第2種は同じ学科時間");

  const un = TOKUBETSU.filter((t) => !trustedHours(t));
  check(un.length > 0, "まだ確かめていない行がある（それを隠さない）", `${un.length}件`);
}

console.log("\n── 作ってある講座とのつながり ──");
{
  /* いちばん大事な決まり。
     講座になっている行は、時間が courses.ts と一致していること。
     食い違えば、目録か教材のどちらかが嘘をついている */
  for (const t of TOKUBETSU.filter(isReady)) {
    const c = findCourse(t.courseId!);
    check(!!c, `${t.slug}: つないだ講座が実在する`, t.courseId);
    if (!c) continue;
    check(c.totalMin === t.gakkaMin,
      `${t.slug}: 学科の時間が講座と一致する`,
      `目録 ${hoursText(t.gakkaMin)} ／ 講座 ${hoursText(c.totalMin)}`);
    /* 確かめていない行を、そのまま講座にしない */
    check(trustedHours(t), `${t.slug}: 講座にした行は確かめてある`);
  }

  /* 足場は作ってある。つないでいなければ、目録と教材が別々に育つ */
  check(!!tokubetsuOfCourse("ashiba"), "足場は目録とつないである");
  check(findTokubetsu("scaffolding_assembly")?.courseId === "ashiba", "足場の行が講座を指す");

  /* 職長教育は特別教育ではない（安衛法60条）。目録に入れない */
  check(!tokubetsuOfCourse("shokucho"), "職長教育は特別教育の目録に入れない");
  const names = TOKUBETSU.map((t) => t.name).join("／");
  check(!names.includes("職長"), "目録に職長教育が混ざっていない");

  /* 特別教育の講座は、全部どこかの行につながっていること。
     つながっていない講座があると、法定時間の裏取りが宙に浮く */
  const orphan = COURSES.filter(
    (c) => (c.kind ?? "special") === "special" && !tokubetsuOfCourse(c.id),
  );
  check(orphan.length === 0, "特別教育の講座は全部が目録につながっている",
    orphan.map((c) => c.id).join("／"));
}

console.log("\n── 出典 ──");
{
  check(TOKUBETSU.every((t) => !!SOURCES[t.src]), "出典の記号が全部そろっている",
    TOKUBETSU.filter((t) => !SOURCES[t.src]).map((t) => t.src).join("／"));
  check(Object.values(SOURCES).every((s) => s.url.startsWith("https://")), "出典は https");
  check(Object.values(SOURCES).every((s) => /mhlw\.go\.jp/.test(s.url)),
    "出典は厚生労働省（まとめサイトを根拠にしない）");
  check(sourceOf(TOKUBETSU[0]).name.length > 0, "出典の名前が引ける");

  /* 条番号まで分かっている行の数。増えるのが正しい向き */
  const withArticle = TOKUBETSU.filter((t) => t.basis.includes("第"));
  check(withArticle.length >= 11, `条番号まで分かっている行（いま ${withArticle.length}件）`);
}

console.log("\n── 目録の時間を、修了証に混ぜない ──");
{
  /* 修了証も受講の判定も courses.ts の totalMin を使う。
     目録を読み始めたら、確かめていない時間が紙に載る */
  for (const p of [
    "src/components/edu/drawCert.ts",
    "src/lib/cert.ts",
    "src/lib/hours.ts",
    "src/app/api/admin/cert/route.ts",
    "src/app/api/issue/route.ts",
  ]) {
    const c = code(p);
    check(!c.includes("tokubetsu") && !c.includes("TOKUBETSU"),
      `${p}: 目録を読んでいない`);
  }
  const cat = code("src/content/tokubetsu.ts");
  check(cat.includes("trustedHours"), "確かめたかどうかを出せる");
  check(!cat.includes("import"), "目録は何にも依存しない（どこからでも読める）");
}

console.log("\n── 数え方 ──");
{
  const { ready, todo } = splitReady();
  check(ready.length + todo.length === 65, "作ってあるもの＋これから＝65");
  check(ready.length >= 1, `もう受けられるもの（いま ${ready.length}件）`);
  check(todo.every((t) => !t.courseId), "これからの行は講座を指していない");
}

console.log("\n── 書き残し ──");
{
  /* 見つけた間違いは、docs にも残す。コードのコメントだけだと、
     次に一覧をもらったときに同じものを写す */
  const doc = read("docs/24-特別教育の目録.md");
  check(doc.includes("5時間30分"), "直した時間が書いてある");
  check(doc.includes("第1種酸素欠乏"), "どの行を直したか書いてある");
  check(doc.includes("規程の条文から"), "条文から取り直す決まりが書いてある");
  /* 実技の要らないものから作る、という順番の理由 */
  check(doc.includes("実技の要らないものが13種類"), "どこから手を付けるかが書いてある");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
