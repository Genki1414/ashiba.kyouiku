/* 先に数えた単元の表が、教材とずれていないか。
   実行: npx tsx tests/lesson-stats.mts

   ── なぜ要るか ──
   マイページと受講管理は、73講座ぶんの教材（15MB）を毎回読んで
   単元の名前と時間を数えていた（手元で 272ms、本番はもっと）。
   2026-09-10 に、先に数えて src/content/lessonStats.ts に書き出す形にした。

   **書き出したものが古いと、画面に嘘の数字が出る。**
   「13単元中12合格」なのに「12単元中12合格」で修了に見える、が起きうる。
   だから、いつでも教材と突き合わせる。ずれていたら
   npm run build:stats で書き出し直すこと（npm run build も呼んでいる）。 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { COURSES } from "@/content/courses";
import { LESSON_STATS, statOf } from "@/content/lessonStats";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string, extra?: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${m}${extra ? `\n    ${extra}` : ""}`); }
};

const root = process.cwd();
const ready = COURSES.filter((c) => c.ready);

console.log("── 教材と突き合わせる ──");
let counted = 0;
for (const c of ready) {
  let raw: string;
  try {
    raw = readFileSync(path.join(root, "content", "courses", c.file), "utf-8");
  } catch {
    check(!LESSON_STATS[c.id], `${c.id}: 教材が無い講座を表に入れていない`);
    continue;
  }
  counted++;
  const cur = JSON.parse(raw) as {
    subjects: { lessons: { id: string; title: string; legal_min: number }[] }[];
  };
  const lessons = cur.subjects.flatMap((s) => s.lessons);
  const got = statOf(c.id);

  check(got.lessons === lessons.length,
    `${c.id}: 単元の数が合っている`, `表 ${got.lessons} ／ 教材 ${lessons.length}`);
  const want = lessons.reduce((n, l) => n + l.legal_min * 60, 0);
  check(got.requiredSec === want,
    `${c.id}: 学科の時間が合っている`, `表 ${got.requiredSec} ／ 教材 ${want}`);
  check(got.list.length === lessons.length, `${c.id}: 並びの数が合っている`);
  check(
    got.list.map((l) => `${l.id}/${l.title}/${l.legal_min}`).join("|")
      === lessons.map((l) => `${l.id}/${l.title}/${l.legal_min}`).join("|"),
    `${c.id}: 単元の並び・名前・分が、そのまま合っている`,
  );
}
check(counted >= 70, `教材のある講座を数えている（${counted}）`);

console.log("\n── 表に無いものを聞かれても落ちない ──");
{
  const none = statOf("そんな講座は無い");
  check(none.lessons === 0 && none.requiredSec === 0 && none.list.length === 0,
    "知らない講座は 0 で返す");
}

console.log("\n── 中身は持たない（重くしない）──");
{
  const src = readFileSync(new URL("../src/content/lessonStats.ts", import.meta.url), "utf-8");
  check(!/"narration"|"figures"|"cases"|"quiz"/.test(src),
    "台本・図・災害事例・確認問題は入れない（名前と分だけ）");
  check(src.length < 400_000, `表そのものが重くない（${Math.round(src.length / 1024)}KB）`);
  check(/手で書かないこと/.test(src), "手で書かないと書いてある");
}

console.log("\n── 読む所が、教材を開き直していないか ──");
{
  const cur = readFileSync(new URL("../src/lib/curriculum.ts", import.meta.url), "utf-8");
  check(/return statOf\(courseId\)\.list;/.test(cur),
    "単元の一覧は、先に数えた表から返す");
  /* 中身が要るときは、1講座ぶんだけ読む。ここは残す */
  check(/export async function getCurriculum/.test(cur), "中身を読む道は残っている");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
