/* 講座ごとの「単元の数」と「学科に要る時間」を、先に数えて書き出す。
   実行: npm run build:stats（npm run build から呼ばれる）

   ── なぜ要るか（2026-09-10）──
   げんきさん「マイページ開くのが遅い」。

   マイページと受講管理は、**73講座ぶんの教材（15MB）を毎回読んで**
   単元の数を数えていた。手元で 272ms、本番のサーバは冷えているので
   もっとかかる。欲しいのは数字2つだけなのに、教材ぜんぶを開いていた。

   中身は動かない（教材を直したときだけ変わる）ので、先に数えておく。
   **手で書かないこと。**ここが書き出す。
   ずれていないかは tests/lesson-stats.mts が見張る。 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COURSES } from "../src/content/courses";

const root = process.cwd();

type Lesson = { id: string; title: string; legal_min: number };
type Stat = { lessons: number; requiredSec: number; list: Lesson[] };

const out: Record<string, Stat> = {};
for (const c of COURSES) {
  if (!c.ready) continue;
  const file = path.join(root, "content", "courses", c.file);
  let raw: string;
  try {
    raw = readFileSync(file, "utf-8");
  } catch {
    /* 教材がまだ無い講座は、数えない（画面にも出ない） */
    continue;
  }
  const cur = JSON.parse(raw) as {
    subjects: { lessons: { id: string; title: string; legal_min: number }[] }[];
  };
  const lessons = cur.subjects.flatMap((s) => s.lessons);
  out[c.id] = {
    lessons: lessons.length,
    requiredSec: lessons.reduce((n, l) => n + l.legal_min * 60, 0),
    /* **単元の並び**も持つ。受講管理が「いま何番目の途中か」を出すのに要る。
       中身（台本・図・問題）は持たない。持つのは名前と時間だけ */
    list: lessons.map((l) => ({
      id: String(l.id),
      title: String(l.title),
      legal_min: Number(l.legal_min),
    })),
  };
}

const body = `/* 講座ごとの、単元の数と学科に要る時間。

   **手で書かないこと**（npm run build:stats が書き出す）。

   マイページと受講管理が、73講座ぶんの教材（15MB）を毎回読んで
   数えていたのをやめるために置いた（2026-09-10）。
   欲しいのは数字2つだけなので、先に数えておく。

   教材を直したら、書き出し直すこと。ずれていたら
   tests/lesson-stats.mts が止める。 */

export type LessonRow = { id: string; title: string; legal_min: number };
export type LessonStat = { lessons: number; requiredSec: number; list: LessonRow[] };

export const LESSON_STATS: Record<string, LessonStat> = ${
  JSON.stringify(out, null, 2)
};

/** その講座の単元の数と学科の時間。知らない講座なら 0 */
export const statOf = (courseId: string): LessonStat =>
  LESSON_STATS[courseId] ?? { lessons: 0, requiredSec: 0, list: [] };
`;

writeFileSync(path.join(root, "src/content/lessonStats.ts"), body, "utf-8");
console.log(`OK  src/content/lessonStats.ts を生成（${Object.keys(out).length}講座）`);
