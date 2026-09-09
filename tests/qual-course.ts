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

import { QUALS, NOT_MAPPED, byKind, findQual } from "../src/content/quals";
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
  /* いまは**全部の講座に資格がある。**
     講座を足したのに資格を足さなければ、ここで落ちる。
     どうしても結べない講座が出たら、理由を書いてここに並べること */
  const KNOWN_NO_QUAL = new Set<string>([]);

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

console.log("\n── 講座と、選べる資格が1対1か ──");
{
  /* げんきさん（2026-09-09）
       「講座と保有資格選択を一致させなければならない。
         そうしないと除染のような現象が起きる」 */
  const pick = [...byKind("特別教育"), ...byKind("その他")];
  check(pick.every((q) => !q.legacy), "まとめていたほうは、選ぶ一覧に出さない");

  /* 1つの講座に、選べる資格が2つ以上ぶら下がっていないか。
     ぶら下がっていてよいのは、うちが1本にまとめている講座だけ */
  const MERGED: Record<string, number> = {
    crane: 2,   // 5t未満クレーンと5t以上跨線テルハを1本に
    dioxin: 3,  // ダイオキシン類の3業務は同じ特別教育
  };
  const count = new Map<string, number>();
  for (const q of pick) {
    if (!q.courseId) continue;
    count.set(q.courseId, (count.get(q.courseId) ?? 0) + 1);
  }
  for (const [courseId, n] of count) {
    check(n === (MERGED[courseId] ?? 1), `${courseId} に結ぶ資格は ${MERGED[courseId] ?? 1} 件（いま ${n} 件）`);
  }

  /* 割った資格が、ちゃんと選べること（除染の5本） */
  for (const id of ["SE-061a", "SE-061b", "SE-061c", "SE-061d", "SE-061e"]) {
    check(pick.some((q) => q.id === id), `${id} を選べる`);
  }
  check(!pick.some((q) => q.id === "SE-061"), "まとめていた「除染等業務」は選べない");
  check(!!findQual("SE-061"), "ただし、過去に登録された行の名前は出せる");
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
