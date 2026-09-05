/* 特別教育の目録の決まり。
   実行: npm run test:tokubetsu */

import { readFileSync } from "node:fs";
import {
  ALIAS,
  LISTED_ON,
  SOURCES,
  TOKUBETSU,
  findTokubetsu,
  hasJitsugi,
  isBuilding,
  isReady,
  sourceOf,
  splitReady,
  matches,
  norm,
  searchTokubetsu,
  toCsv,
  toRows,
  tokubetsuOfCourse,
  totalMinOf,
  trustedHours,
  withSubjects,
  withJikou,
  hasVariants,
  unknownHours,
} from "../src/content/tokubetsu";
import { COURSES, findCourse, hoursText } from "../src/content/courses";
import {
  ISHIWATA_BASIS,
  ISHIWATA_NAME,
  ISHIWATA_SUBJECTS,
  ISHIWATA_TOTAL_MIN,
} from "../src/content/ishiwata";

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
  /* 65件で始めて、条文を読んで1件見つけた（no.66 再圧室を操作する業務）。
     まとめの一覧は抜けることがある、という記録でもある */
  check(TOKUBETSU.length === 66, `66種類ある（いま ${TOKUBETSU.length}）`);
  const slugs = TOKUBETSU.map((t) => t.slug);
  check(new Set(slugs).size === slugs.length, "目印が重なっていない");
  const nos = TOKUBETSU.map((t) => t.no);
  check(new Set(nos).size === nos.length, "番号が重なっていない");
  check(Math.min(...nos) === 1 && Math.max(...nos) === 66, "番号は1から66まで");
  /* 名前が空だと、一覧で何の教育か分からない行になる */
  check(TOKUBETSU.every((t) => t.name.trim().length > 0), "全部に名前がある");
  check(TOKUBETSU.every((t) => /^[a-z0-9_]+$/.test(t.slug)), "目印は英小文字と数字だけ",
    TOKUBETSU.filter((t) => !/^[a-z0-9_]+$/.test(t.slug)).map((t) => t.slug).join("／"));
  check(TOKUBETSU.every((t) => t.basis.trim().length > 0), "全部に根拠がある");
  check(/^\d{4}-\d{2}-\d{2}$/.test(LISTED_ON), "写した日が入っている", LISTED_ON);
}

console.log("\n── 時間 ──");
{
  /* 0分の教育は無い。0のまま講座にすると、見た瞬間に修了証が出る。
     **時間がまだ分からない行（hoursUnknown）だけが 0。**
     その行は講座にできないようにしてある（下の「教育すべき事項」の節） */
  check(TOKUBETSU.every((t) => t.gakkaMin > 0 || unknownHours(t)),
    "学科の時間が0の行は、時間がまだ分からない行だけ",
    TOKUBETSU.filter((t) => !t.gakkaMin && !unknownHours(t)).map((t) => t.slug).join("／"));
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
  /* 再圧室（no.66）は、実技があるはずだが時間が分からないので 0。
     「学科だけ」に数えないよう、時間の分からない行を除いて数える */
  const known = TOKUBETSU.filter((t) => !unknownHours(t));
  check(known.filter((t) => !hasJitsugi(t)).length === 13, "学科だけのものが13件",
    `${known.filter((t) => !hasJitsugi(t)).length}`);
}

console.log("\n── 確かめた行だけ信じる ──");
{
  /* 目録の元にした一覧は、65件中11件しか条番号が入っていない。
     確かめていない時間で修了証を出すと、法定時間に足りない紙になる。

     **ここは一度、こちらが間違えた場所。**
     一覧の「第1種＝4時間」を、よその講習の頁（どこも第2種を売っている）を根拠に
     5時間30分へ「直した」。あとで告示の条文が出てきて、**一覧のほうが正しかった。**
     第1種は告示第1条で4時間、第2種は第2条で5時間30分。別の時間。
     → **よその講習の頁で目録を直さない。条文が出るまで直さない。** */
  const t1 = findTokubetsu("oxygen_deficiency_type1");
  check(!!t1 && t1.gakkaMin === 240,
    "第1種酸素欠乏は4時間（告示第1条。条文で確かめた）",
    t1 ? hoursText(t1.gakkaMin) : "無し");
  check(!!t1 && trustedHours(t1), "確かめた行には、確かめた印が付いている");
  /* 第1種と第2種は違う時間。同じにするとどちらかが嘘になる */
  const t2 = findTokubetsu("oxygen_deficiency_type2");
  check(!!t2 && t2.gakkaMin === 330, "第2種酸素欠乏は5時間30分（告示第2条）",
    t2 ? hoursText(t2.gakkaMin) : "無し");
  check(!!t2 && !!t1 && t2.gakkaMin > t1.gakkaMin, "第2種のほうが長い（硫化水素が乗るぶん）");

  const un = TOKUBETSU.filter((t) => !trustedHours(t));
  check(un.length > 0, "まだ確かめていない行がある（それを隠さない）", `${un.length}件`);
}

console.log("\n── 作ってある講座とのつながり ──");
{
  /* いちばん大事な決まり。
     **講座の学科は、つないだ行の法定時間を下回らないこと。**
     下回れば、法定時間に足りない紙が出る。

     ふつうは一致する。上の資格を1つの講座で兼ねるときだけ、講座のほうが長い。
     いまは第1種酸素欠乏（4時間）を、第2種の講座（5時間30分）で兼ねている。
     第2種は第1種を含むので、これで第1種の業務にも就ける。 */
  const COVERS: Record<string, string> = {
    oxygen_deficiency_type1: "第2種（5時間30分）は第1種（4時間）を含む",
  };
  for (const t of TOKUBETSU.filter(isReady)) {
    const c = findCourse(t.courseId!);
    check(!!c, `${t.slug}: つないだ講座が実在する`, t.courseId);
    if (!c) continue;
    check(c.totalMin >= t.gakkaMin,
      `${t.slug}: 講座の学科が法定時間を下回らない`,
      `目録 ${hoursText(t.gakkaMin)} ／ 講座 ${hoursText(c.totalMin)}`);
    check(c.totalMin === t.gakkaMin || !!COVERS[t.slug],
      `${t.slug}: 時間が違うなら、兼ねる理由が書いてある`,
      COVERS[t.slug] ?? `目録 ${hoursText(t.gakkaMin)} ／ 講座 ${hoursText(c.totalMin)}`);
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

console.log("\n── いま作っているもの ──");
{
  /* 「準備中」だけだと、いつになるか分からないものと同じに見える。
     待てるかどうかは、この差で決まる */
  const b = TOKUBETSU.filter(isBuilding);
  check(b.every((t) => !isReady(t)), "作り終えたら、この印は落ちる");
  /* 調べ直しを防ぐ。条文に当たった記録は、行から辿れること */
  check(b.every((t) => !!t.doc), "作っている行には裏取りの記録がある",
    b.filter((t) => !t.doc).map((t) => t.slug).join("／"));

  /* 高所作業車。**実技が3時間あるので、この仕組みだけでは修了しない。**
     学科だけで修了証を出せば、実技を受けていない人が
     「資格がある」と思って高所作業車に乗る。
     だから講座にはしたが gate: "drill" で、学科のあとに関門が残る */
  const kousho = findTokubetsu("aerial_work_platform_under_10m");
  check(!!kousho && !isBuilding(kousho), "高所作業車は作り終えた（印が落ちている）");
  check(!!kousho && kousho.basis.includes("第36条第10号の5"), "安衛則の号まで入っている",
    kousho?.basis);
  check(!!kousho && kousho.basis.includes("第13条"), "規程の条番号まで入っている");
  check(!!kousho && kousho.gakkaMin === 360 && kousho.jitsugiMin === 180,
    "学科6時間・実技3時間");
  check(!!kousho && hasJitsugi(kousho), "実技のある講座として扱う");
  /* 規程第13条の表で科目ごとの時間まで確かめた（装置3・原動機1・一般1・法令1） */
  check(!!kousho && trustedHours(kousho), "科目ごとの時間まで確かめた");
  check(!!kousho && isReady(kousho) && kousho.courseId === "kousho",
    "高所作業車は講座になっている", kousho?.courseId);
  check(!!kousho && !!kousho.doc, "作り終えても、裏取りの記録は残す");
  const d26 = read("docs/26-高所作業車の根拠と裏取り.md");
  check(d26.includes("この仕組みだけでは修了しない"), "実技があることが書いてある");
  check(d26.includes("gate: \"drill\""), "どう扱うかが書いてある");
  /* 学科だけ出すのだから、実技をどう確かめるかが書いてあること */
  check(d26.includes("実技の実施日"), "実技をどう確かめるかが書いてある");

  const ishi = findTokubetsu("asbestos_demolition");
  /* 石綿は作り終えて講座になった。印は落ちて、courseId が入っている */
  check(!!ishi && !isBuilding(ishi), "石綿は作り終えた（印が落ちている）");
  check(!!ishi && isReady(ishi) && ishi.courseId === "ishiwata", "石綿は講座になっている",
    ishi?.courseId);
  check(!!ishi && !!ishi.doc, "作り終えても、裏取りの記録は残す");
  /* 渡された一覧の根拠は第3条第1項（事前調査の条）だった。
     特別教育を義務づけているのは第27条第1項。
     そのまま修了証に載せていたら、根拠の条文が違う紙が出ていた */
  check(!!ishi && ishi.basis.includes("第27条第1項"), "石綿の根拠は第27条第1項", ishi?.basis);
  check(!!ishi && !ishi.basis.includes("第3条第1項"), "第3条（事前調査の条）ではない");
  check(!!ishi && ishi.basis.includes("第36条第37号"), "安衛則の号まで入っている");
  /* 告示の名前に合わせる。「石綿障害予防規則第3条第1項の…」は業務の説明であって
     教育の名前ではない */
  check(!!ishi && ishi.name === "石綿使用建築物等解体等業務に係る特別教育",
    "教育の名前は告示に合わせる", ishi?.name);
  check(!!ishi && ishi.gakkaMin === 270 && ishi.jitsugiMin === 0,
    "学科4時間30分、実技なし");
  check(!!ishi && trustedHours(ishi), "合計は確かめてある");

  const ui = code("src/components/OtherCourses.tsx");
  check(ui.includes("いま作っています"), "受ける人にも、作っていることを出す");
  check(ui.includes("isBuilding"), "作っているものを先頭に出す");

  const doc = read("docs/25-石綿の根拠と裏取り.md");
  check(doc.includes("第27条第1項"), "直した根拠が書いてある");
  check(doc.includes("成形板"), "例をどう選ぶかが書いてある");
  check(doc.includes("時間以上"), "告示が「時間以上」であることが書いてある");
  check(doc.includes("保護具は1時間"), "食い違っていた所と、決まった値が書いてある");
  /* 作ったあとの記録。次に別の講座を作る人が、同じ道をたどれるように */
  check(doc.includes("単元の割り付け"), "単元の割り方が書いてある");
  check(doc.includes("解説文は書き下ろし"), "写していないことが書いてある");
  check(doc.includes("4,500円"), "値段と、その決め方が書いてある");
}

console.log("\n── 石綿の科目（告示の表） ──");
{
  /* 告示の下欄。**単元ごとの視聴時間の関門**になる数字。
     web の資料は保護具が 0.5時間 と 1時間 で食い違っていた。
     合計だけ合わせて進めると、その科目だけ法定の半分で先へ進める */
  check(ISHIWATA_SUBJECTS.length === 5, `5科目（${ISHIWATA_SUBJECTS.length}）`);
  check(ISHIWATA_TOTAL_MIN === 270, `合計4時間30分（${ISHIWATA_TOTAL_MIN}分）`);
  const min = ISHIWATA_SUBJECTS.map((x) => x.legalMin).join("／");
  check(min === "30／60／60／60／60", "告示の割り振りどおり", min);
  const hogo = ISHIWATA_SUBJECTS.find((x) => x.name === "保護具の使用方法");
  check(!!hogo && hogo.legalMin === 60, "保護具は1時間（0.5時間ではない）", `${hogo?.legalMin}分`);

  /* 科目名は告示のまま。言い換えると突き合わせられなくなる */
  const names = ISHIWATA_SUBJECTS.map((x) => x.name);
  check(names[0] === "石綿の有害性" && names[4] === "その他石綿等のばく露の防止に関し必要な事項",
    "科目名は告示のまま", names.join("／"));
  check(ISHIWATA_SUBJECTS.every((x) => x.scope.length >= 1), "範囲（中欄）も入っている");
  check(ISHIWATA_SUBJECTS.every((x) => x.legalMin > 0 && x.legalMin % 30 === 0), "時間は30分刻み");
  check(ISHIWATA_SUBJECTS.map((x) => x.id).join() === "1,2,3,4,5", "番号が通っている");

  /* 目録・出どころと食い違わないこと。食い違えば、どれかが嘘 */
  const ishi2 = findTokubetsu("asbestos_demolition")!;
  check(ishi2.gakkaMin === ISHIWATA_TOTAL_MIN, "目録の時間と一致する");
  check(ishi2.name === ISHIWATA_NAME, "目録の名前と一致する");
  check(ishi2.basis.includes("第36条第37号") && ISHIWATA_BASIS.includes("第36条第37号"),
    "根拠が一致する");
}

console.log("\n── 科目ごとの時間（げんきさんの講座マスターから入れた行）──");
{
  /* 科目の内訳を持つ行は、**足したら合計と一致すること。**
     ここがずれていると、単元を割り付けるときに気付かないまま短い講座になる */
  for (const t of withSubjects()) {
    const g = (t.gakka ?? []).reduce((n, r) => n + r.min, 0);
    check(g === t.gakkaMin, `${t.slug}: 学科の科目の合計が学科の法定時間と合う`,
      `科目 ${hoursText(g)} ／ 合計 ${hoursText(t.gakkaMin)}`);
    const j = (t.jitsugi ?? []).reduce((n, r) => n + r.min, 0);
    check(j === t.jitsugiMin, `${t.slug}: 実技の科目の合計が実技の法定時間と合う`,
      `科目 ${hoursText(j)} ／ 合計 ${hoursText(t.jitsugiMin)}`);
    check((t.gakka ?? []).every((r) => r.min > 0 && r.name.length > 1),
      `${t.slug}: 学科の科目に名前と時間がある`);
    /* 実技がある行は、実技の科目も書いてあること */
    check(t.jitsugiMin === 0 || (t.jitsugi ?? []).length > 0,
      `${t.slug}: 実技があるなら実技の科目も書いてある`);
  }
  check(withSubjects().length >= 12,
    `科目まで分かっている行（いま ${withSubjects().length}件）`);

  /* **業務区分で変わる行を、一つの固定時間の講座にしない。**
     除染等業務がこれ。全員一律で修了証を出すと、区分によっては足りない紙になる */
  for (const t of TOKUBETSU.filter(hasVariants)) {
    check(!t.courseId, `${t.slug}: 業務区分で変わる行は、まだ講座にしていない`,
      t.variants!.join("、"));
    check(!trustedHours(t), `${t.slug}: 区分で変わるので、一つの時間を確かめた扱いにしない`);
  }

  /* 講座マスターの数字で直した行は、確かめた印か、食い違いの断り書きのどちらかがある */
  const master = TOKUBETSU.filter((t) => t.fromMaster);
  check(master.length >= 12, `講座マスターから入れた行（いま ${master.length}件）`);
  check(master.every((t) => !trustedHours(t) || !!t.checkedOn),
    "確かめた印を付けた行には、確かめた日が入っている");
  check(TOKUBETSU.every((t) => !t.checkedOn || t.fromMaster || trustedHours(t)),
    "確かめた日だけが独り歩きしていない");

  /* 42番。前の版の「学科540分＋実技180分」を使っていないこと */
  const kou = findTokubetsu("hyperbaric_work");
  check(!!kou && kou.gakkaMin === 420 && kou.jitsugiMin === 0,
    "高圧室内は学科420分・実技なし（前の版の540分＋180分は使わない）",
    kou ? `${hoursText(kou.gakkaMin)} ／ 実技 ${kou.jitsugiMin}分` : "無し");
  /* 61番。690分＋390分を一律の法定最低時間にしない */
  const jo = findTokubetsu("decontamination_work");
  check(!!jo && jo.gakkaMin === 240 && jo.jitsugiMin === 90,
    "除染等業務は通常区分で学科240分・実技90分",
    jo ? `${hoursText(jo.gakkaMin)} ／ 実技 ${jo.jitsugiMin}分` : "無し");
  check(!!jo && hasVariants(jo), "除染等業務は業務区分を持っている");
}

console.log("\n── 告示の全文を見た行と、作ってある講座を突き合わせる ──");
{
  /* **ここがこの目録でいちばん強い見張り。**
     告示の全文が手元にある行は、科目名・中欄・時間を、
     作ってある講座と一字ずつ突き合わせる。

     講座の側の中欄は、単元の legal_scope を並べたもの。
     ずれたら、法定の範囲を外した講座を売っていることになる。 */
  const full = TOKUBETSU.filter((t) => t.fullText);
  check(full.length >= 6, `告示の全文で裏を取った行（いま ${full.length}件）`);
  for (const t of full) {
    check(!!t.gakka, `${t.slug}: 告示を見た行には、科目と中欄が入っている`);
    check((t.gakka ?? []).every((g) => !!g.scope),
      `${t.slug}: 学科の科目に、中欄が入っている`);
    check((t.jitsugi ?? []).every((g) => !!g.scope),
      `${t.slug}: 実技の科目に、中欄が入っている`);
    check(!!t.checkedOn, `${t.slug}: 告示を読んだ日が入っている`);
    if (!t.courseId) continue;

    const c = JSON.parse(read(`content/courses/${t.courseId}.json`)) as { subjects: { name: string; legal_min: number; lessons: { legal_scope: string }[] }[] };
    check(c.subjects.length === (t.gakka ?? []).length,
      `${t.slug}: 講座の科目の数が、告示と同じ`,
      `講座 ${c.subjects.length} ／ 告示 ${(t.gakka ?? []).length}`);
    (t.gakka ?? []).forEach((g, i) => {
      const sub = c.subjects[i];
      if (!sub) return;
      check(sub.name === g.name, `${t.slug} 科目${i + 1}: 科目名が告示のまま`,
        `講座「${sub.name}」／ 告示「${g.name}」`);
      check(sub.legal_min === g.min, `${t.slug} 科目${i + 1}: 時間が告示のまま`,
        `講座 ${sub.legal_min}分 ／ 告示 ${g.min}分`);
      /* 単元に割り付けた中欄を、告示の中欄に戻して比べる */
      const joined = [...new Set(sub.lessons.map((l) => l.legal_scope))].join("　");
      check(joined === g.scope, `${t.slug} 科目${i + 1}: 中欄が告示のまま`,
        `講座「${joined}」\n    告示「${g.scope}」`);
    });
  }
}

console.log("\n── 省令が定めている「教育すべき事項」──");
{
  /* 告示（時間）を見る前でも、省令の側に「何を教えるか」が書いてある。
     ここが入っていれば、告示が手に入ったときに突き合わせられる */
  const jk = withJikou();
  check(jk.length >= 6, `教育すべき事項まで分かっている行（いま ${jk.length}件）`);
  check(jk.every((t) => t.jikou!.every((x) => x.trim().length > 2)),
    "事項が空でない");
  check(jk.every((t) => /第\d+条/.test(t.basis)), "事項が分かっている行は、根拠に条番号がある");

  /* 高気圧の六つ。**規則第11条第1項が挙げているのは六つ。**
     元の目録には五つしか無く、再圧室が抜けていた */
  const kouki = TOKUBETSU.filter((t) => t.basis.includes("高気圧作業安全衛生規則"));
  check(kouki.length === 6, `高気圧作業安全衛生規則第11条の業務が六つある（いま ${kouki.length}）`,
    kouki.map((t) => t.slug).join("／"));
  const saiatsu = findTokubetsu("recompression_chamber");
  check(!!saiatsu, "再圧室を操作する業務が目録にある");
  check(!!saiatsu && unknownHours(saiatsu), "再圧室は、時間がまだ分からない行");

  /* **時間の分からない行を、そのまま講座にしない。**
     0分を法定時間として使うと、法定時間に足りない紙が出る */
  for (const t of TOKUBETSU.filter(unknownHours)) {
    check(t.gakkaMin === 0 && t.jitsugiMin === 0,
      `${t.slug}: 時間が分からない行は 0 にしてある`);
    check(!t.courseId, `${t.slug}: 時間が分からない行は、まだ講座にしていない`);
    check(!trustedHours(t), `${t.slug}: 時間が分からない行に、確かめた印を付けない`);
  }
  /* 逆に、時間が入っている行が 0 のままになっていないこと */
  check(TOKUBETSU.every((t) => unknownHours(t) || t.gakkaMin > 0),
    "時間の入っている行は、学科が0分でない",
    TOKUBETSU.filter((t) => !unknownHours(t) && t.gakkaMin === 0).map((t) => t.slug).join("／"));
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
  check(ready.length + todo.length === 66, "作ってあるもの＋これから＝66");
  check(ready.length >= 1, `もう受けられるもの（いま ${ready.length}件）`);
  check(todo.every((t) => !t.courseId), "これからの行は講座を指していない");
}

console.log("\n── 探す ──");
{
  /* 法令の名前と現場の言い方は違う。正式名称でしか引けないと、
     **有るのに無いと思われる** */
  const one = (q: string) => searchTokubetsu(q);
  const hit = (q: string, want: string) => {
    const r = one(q);
    check(r.length > 0 && r.some((t) => t.slug === want),
      `「${q}」で ${want} が出る`, `${r.length}件 ${r.map((t) => t.slug).join("／")}`);
  };
  hit("アスベスト", "asbestos_demolition");
  hit("せきめん", "asbestos_demolition");
  hit("酸欠", "oxygen_deficiency_type1");
  hit("ユンボ", "small_vehicle_construction_leveling");
  hit("ハーネス", "full_harness");
  hit("たまがけ", "slinging_under_1t");
  hit("トンネル", "tunnel_excavation_lining");
  hit("ふんじん", "specified_dust_work");
  hit("足場", "scaffolding_assembly");

  /* カタカナとひらがなで結果が変わってはいけない */
  check(one("サンケツ").length === one("さんけつ").length, "カタカナとひらがなで同じ");
  check(one("ＥＶ").length === one("ev").length, "全角と半角で同じ");
  check(one("フォークリフト").length === one("ふぉーくりふと").length, "長音も含めて同じ");
  check(norm("　アスベスト　") === "あすべすと", "前後の空白を落として、かなに寄せる", norm("　アスベスト　"));

  /* 空白で区切った語は、全部を含むもの。絞るために足した語で増えるのはおかしい */
  const two = one("ロボット 検査");
  check(two.length === 1 && two[0].slug === "industrial_robot_inspection",
    "語を足すと絞れる", `${two.length}件`);
  check(one("ロボット").length === 2, "語がひとつなら広い");

  check(one("").length === 66, "空なら全部");
  check(one("   ").length === 66, "空白だけでも全部");
  check(one("そんな教育").length === 0, "無いものは0件");

  /* 目印（slug）は探す対象に入れない。人が打つものではないうえ、
     英字の切れ端が中で当たる（「EV」が leveling に当たっていた） */
  check(one("ev").length === 1, "「EV」で leveling を拾わない",
    one("ev").map((t) => t.slug).join("／"));
  check(!matches(TOKUBETSU[0], "machine_grinding_wheel"),
    "目印そのものでは当たらない");

  /* 別名は、探すためだけのもの。画面に出る名前ではない */
  check(Object.keys(ALIAS).every((k) => TOKUBETSU.some((t) => t.slug === k)),
    "別名の宛先が全部ある",
    Object.keys(ALIAS).filter((k) => !TOKUBETSU.some((t) => t.slug === k)).join("／"));
  check(Object.keys(ALIAS).length >= 60, `ほとんどの行に別名がある（${Object.keys(ALIAS).length}件）`);
  const ui = code("src/components/OtherCourses.tsx");
  check(!ui.includes("ALIAS"), "別名を画面に出していない（探すためだけ）");
}

console.log("\n── その他特別教育に出す ──");
{
  /* **ホームに出ていること。** はじめ講座の一覧（/edu）だけに置いたが、
     ホームの札は各講座へ直接飛ぶので、一覧に辿り着く道がどこにも無かった。
     置いたのに、誰にも見えていなかった */
  const home = code("src/app/page.tsx");
  check(home.includes("<OtherTokubetsu"), "ホームに出している");
  const links = read("src/app/page.tsx");
  check(!/href="\/edu"/.test(links), "ホームから講座の一覧へは飛ばない（札が直接飛ぶ）");
  /* 教育の札のすぐ下。実務トレーニングより上に置く（種類が違う） */
  check(home.indexOf("<OtherTokubetsu") < home.indexOf('href="/training"'),
    "実務トレーニングより上に出す");

  const sec = code("src/components/OtherTokubetsu.tsx");
  check(sec.includes("<details"), "開け閉めは details（JS が動かなくても開く）");
  check(sec.includes("その他特別教育"), "見出しが「その他特別教育」");
  check(sec.includes("<OtherCourses"), "中身は目録");

  const page = code("src/app/edu/page.tsx");
  check(page.includes("<OtherCourses"), "講座の一覧にも出している");
  /* 開く前は出さない。64件がいきなり並ぶと、足場を受けに来た人が迷う */
  check(page.indexOf("<OtherCourses") > page.indexOf("course-other-open"),
    "開いてから出す");
  check(page.includes("TOKUBETSU.filter((t) => !isReady(t)).length"),
    "件数に、まだ作っていないものを数える");

  const ui = code("src/components/OtherCourses.tsx");
  check(ui.includes("!isReady(t)"), "もう受けられるものは、ここに二重に出さない");
  /* 受けられるように見せない。押せる札にすると、押した先が無い */
  check(!ui.includes("<Link") && !ui.includes("href={`/edu/"), "作っていないものを押せる札にしない");
  check(ui.includes("準備中"), "準備中と書く");
  /* 実技は事業者が自社でやる。黙って並べると「ここで全部済む」と思われる */
  check(ui.includes("実技は事業者で"), "実技のものは、そう書く");
  check(ui.includes("学科だけで修了"), "学科だけのものも分かる");
  check(ui.includes('data-testid="other-search"'), "探す所がある");
  /* 空で終わらせない。打ち方が悪いのか無いのかが分からない */
  check(ui.includes("見つからないとき"), "見つからないときの案内がある");
}

console.log("\n── 持ち出す ──");
{
  /* 単体で事業にするときに、丸ごと移せること */
  const rows = toRows();
  check(rows.length === 66, "全部が出る");
  check(rows.every((r) => typeof r.hours_verified === "boolean"),
    "確かめたかどうかも一緒に出す（出した先で誤解されないため）");
  check(rows.filter((r) => r.hours_verified).length === TOKUBETSU.filter(trustedHours).length,
    "確かめた件数が合う");
  check(rows.find((r) => r.slug === "oxygen_deficiency_type1")?.theory_minutes === 240,
    "第1種は4時間で出る（告示第1条）");
  check(rows.find((r) => r.slug === "oxygen_deficiency_type2")?.theory_minutes === 330,
    "第2種は5時間30分で出る（告示第2条）");
  check(rows.find((r) => r.slug === "scaffolding_assembly")?.course_slug === "ashiba",
    "作ってある講座がつながって出る");
  check(rows.every((r) => r.theory_minutes + r.practical_minutes === r.total_minutes),
    "合計が合う");
  check(rows.every((r) => r.source_url.startsWith("https://")), "出典の住所も出る");

  /* 渡された一覧と同じ列から始まる。行って戻れる */
  const csv = toCsv();
  const lines = csv.split("\n");
  check(lines.length === 67, `CSV は66行＋見出し（${lines.length}）`);
  check(lines[0].startsWith("course_id,slug,title_ja,theory_minutes,practical_minutes,total_minutes"),
    "渡された一覧と同じ列の並び", lines[0].slice(0, 60));
  /* 名前に「,」や「"」が入る日が来ても崩れないこと */
  const tricky = ['a,b', 'a"b', "ふつう"].map((v) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  check(tricky[0] === '"a,b"' && tricky[1] === '"a""b"' && tricky[2] === "ふつう",
    "カンマと引用符の逃がし方");
  check(lines.every((l) => l.split(",").length >= 14 || l.includes('"')),
    "どの行も列が欠けていない");

  const api = code("src/app/api/tokubetsu/route.ts");
  check(api.includes("toCsv") && api.includes("toRows"), "API から両方の形で出せる");
  check(api.includes("\ufeff") || api.includes("\u{feff}") || /`\W?\$\{toCsv\(\)\}`/.test(api),
    "CSV に BOM を付ける（Excel が文字化けする）");
  check(api.includes("hours_verified"), "API の説明に、確かめた印のことが書いてある");
  /* 目録は何にも依存しない。コピーすればそのまま別の仕組みで動く */
  const cat = read("src/content/tokubetsu.ts");
  check(!/^import /m.test(cat), "目録は何も import していない（丸ごと持ち出せる）");
}

console.log("\n── 業種を、ひとつに寄せない ──");
{
  /* 一度、足場屋に寄せて書いてしまった（docs/19 ⑤）。
     石綿を扱うのは足場屋だけではない。解体・内装・設備・電気・塗装・
     防水・屋根・外装・ビル保全・工場の設備保全。どの職種も受ける。
     足場の話ばかり出てくれば、ほかの職種の人は自分の話として聞けない。 */
  const cur = read("content/courses/ishiwata.json");
  const n = (cur.match(/足場/g) ?? []).length;
  check(n === 0, `石綿の教材に「足場」が出てこない（いま ${n}回）`);

  /* 事例の業種が散っていること。1つの業種に偏ると、同じことが起きる */
  type C = { meta: Record<string, string> };
  type L = { cases: C[] };
  const j = JSON.parse(cur) as { subjects: { lessons: L[] }[] };
  const jobs = j.subjects.flatMap((sub) => sub.lessons.flatMap((l) => l.cases))
    .map((c) => c.meta["作業"] ?? "");
  check(jobs.length >= 8, `事例が8件以上ある（${jobs.length}件）`);
  /* 同じ言葉が事例の半分を超えたら、寄っている */
  for (const w of ["内装", "屋根", "設備", "外壁", "床"]) {
    const k = jobs.filter((x) => x.includes(w)).length;
    check(k <= jobs.length / 2, `「${w}」に寄っていない（${k}/${jobs.length}）`);
  }

  /* 決まりを docs に残す。次に講座を足す人が、同じ道をたどらないように */
  const d19 = read("docs/19-教材の章立ての決まり.md");
  check(d19.includes("「ある業種向け」ではない"), "docs/19 に決まりが書いてある");
  check(d19.includes("どの業種が含まれるかを先に数える"), "判断の目安が書いてある");
}

console.log("\n── 書き残し ──");
{
  /* 見つけた間違いは、docs にも残す。コードのコメントだけだと、
     次に一覧をもらったときに同じものを写す */
  const doc = read("docs/24-特別教育の目録.md");
  check(doc.includes("5時間30分"), "確かめた時間が書いてある");
  check(doc.includes("第1種酸素欠乏"), "どの行を確かめたか書いてある");
  check(doc.includes("規程の条文から"), "条文から取り直す決まりが書いてある");
  /* こちらが一度、よその講習の頁を根拠に目録を「直して」間違えた。
     同じことを繰り返さないために、失敗そのものを残す */
  check(doc.includes("戻した"), "いったん直して戻したことが書いてある");
  /* 実技の要らないものから作る、という順番の理由 */
  check(doc.includes("実技の要らないものが13種類"), "どこから手を付けるかが書いてある");
  /* 探し方と持ち出し方も、コードの外に残す */
  check(doc.includes("/api/tokubetsu"), "持ち出し先が書いてある");
  check(doc.includes("BOM"), "Excel が文字化けする話が書いてある");
  check(doc.includes("hours_verified"), "確かめた印も持ち出すことが書いてある");
  check(doc.includes("アスベスト"), "別名で探せることが書いてある");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
