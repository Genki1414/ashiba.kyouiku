/* 資格と講座の対応を確かめる。実行: npx tsx tests/qual-course.ts

   ── なぜ要るか ──
   げんきさん（2026-09-09）「取得済なのに表示される」。
   フルハーネスを登録しているのに、マイページに「続きから受講」が出ていた。
   講座が1本しか無かった頃の対応表（足場だけ）が、73本になっても
   そのまま残っていた。**足し忘れても、誰も気づけなかった。**

   ── 間違える向き ──
   入れ忘れ   … 取得済みなのに講座が出る。うっとうしいだけ
   入れ間違い … 受けていないのに「取得済」になり、**法令で要る教育を
                受けないまま現場に出る。**取り返しがつかない

   だから、
     ① 対応先が本物の講座か（打ち間違いを通さない）
     ② 講座が増えたら、必ずどちらかに決める
        （資格に結ぶ／結ばない理由を書く）
   を機械に見張らせる。 */

import { QUALS, NOT_MAPPED, findQual } from "../src/content/quals";
import { readyCourses, findCourse } from "../src/content/courses";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

console.log("── 対応先が本物の講座か ──");
{
  const mapped = QUALS.filter((q) => q.courseId);
  check(mapped.length > 50, `結んである資格が十分ある（${mapped.length}件）`);
  for (const q of mapped) {
    check(!!findCourse(q.courseId!), `${q.id} ${q.name} → ${q.courseId} は実在する講座`);
  }
}

console.log("\n── 講座の側から見て、抜けが無いか ──");
{
  /* 講座に資格が結ばれていなければ、その講座は**永久に「取得済」にならない。**
     わざとそうしているものだけを、ここに並べておく。
     並べていない講座が出てきたら、そのとき決める（結ぶ／理由を書く）。 */
  const KNOWN_NO_QUAL = new Set([
    /* 資格の側が1つで、うちが装置・施設・業務区分ごとに分けている講座。
       どれを受けたのかが分からないので結べない（quals.ts の NOT_MAPPED） */
    "xrayki", "gammaki", "xraygammaki",
    "kakunenkakou", "kakunensaishori", "kakunenshiyou",
    "haikihasai", "haikishokyaku", "haikiumetate",
    "josendojo", "josenshushu", "josenhaiki", "josentokutei", "josentokuteigai",
    /* 資格の一覧に、対応する特別教育が無いもの */
    "saiatsushitsu",
  ]);
  const used = new Set(QUALS.map((q) => q.courseId).filter(Boolean) as string[]);
  for (const c of readyCourses()) {
    if (used.has(c.id)) { ok++; continue; }
    check(KNOWN_NO_QUAL.has(c.id), `${c.id}（${c.short}）は、資格に結ぶか、結ばない理由を書くこと`);
  }
  /* 並べたほうにも、消えた講座が残っていないか */
  for (const id of KNOWN_NO_QUAL) {
    check(!!findCourse(id), `${id} は実在する講座（消えた講座が残っていないか）`);
  }
}

console.log("\n── わざと結んでいないもの ──");
{
  for (const id of NOT_MAPPED) {
    const q = findQual(id);
    check(!!q, `${id} は資格の一覧にある`);
    check(!q?.courseId, `${id} は結ばれていない（${q?.name ?? ""}）`);
  }
  /* 第一種酸素欠乏は、うちの講座（第二種）とは別物。
     結ぶと、硫化水素の教育を受けないまま通してしまう */
  check(!findQual("SE-044")?.courseId, "第一種酸素欠乏を、酸欠・硫化水素の講座に結ばない");
  check(findQual("SE-045")?.courseId === "sanketsu", "第二種は、酸欠・硫化水素の講座に結ぶ");
}

console.log("\n── 今日出た不具合そのもの ──");
{
  check(findQual("SE-065")?.courseId === "harness", "フルハーネスが講座に結ばれている");
  check(findQual("SE-063")?.courseId === "ashiba", "足場が講座に結ばれている");
  check(findQual("OT-001")?.courseId === "shokucho", "職長・安責者が講座に結ばれている");
}

console.log(`\n${ok} 件通過 / ${ng} 件失敗`);
process.exit(ng ? 1 : 0);
