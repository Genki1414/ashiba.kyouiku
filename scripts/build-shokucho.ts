/* 職長教育の教材を、単元ごとの json から1本に組み立てる。

   足場（学科）は1本の大きな json を手で持っているが、
   職長教育は12時間ぶんあって1本では手に負えない。
   単元ごとに content/shokucho/<単元>.json を置き、ここでまとめる。

   科目と時間の割り振りは src/content/shokucho.ts が正本。
   ここでそれと突き合わせるので、時間がずれていれば組み立てが止まる。

   実行: npm run build:shokucho */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { CurriculumSchema, LessonSchema } from "../src/types/curriculum";
import { SHOKUCHO, SEKININSHA, COURSE_TOTAL_MIN, TALK_MIN } from "../src/content/shokucho";
import { findCourse } from "../src/content/courses";

/* どの科目に、どの単元が入るか。時間は各単元の json が持つ。

   **単元は、法定の細目に1つずつ対応させる**（安衛則第40条第2項の表の左欄）。
   細目の数＝単元の数。だから並びは shokucho.ts の saimoku から作る。
   こうしておくと、細目のどれかが抜けたまま公開されることが無い。 */
const ALL = [...SHOKUCHO, SEKININSHA];

const LAYOUT: Record<number, string[]> = Object.fromEntries(
  ALL.map((s) => [s.id, s.saimoku.map((_, i) => `${s.id}-${i + 1}`)]),
);

const root = process.cwd();
const src = path.join(root, "content", "shokucho");

const subjects = [];
let missing = 0;
for (const s of ALL) {
  const lessons = [];
  for (const id of LAYOUT[s.id] ?? []) {
    const f = path.join(src, `${id}.json`);
    if (!existsSync(f)) { missing++; console.error(`まだ無い: ${id}.json`); continue; }
    const l = LessonSchema.parse(JSON.parse(readFileSync(f, "utf-8")));
    /* その単元が、どの細目のものかを突き合わせる。
       ずれていると、12時間の中身に穴が空いたまま公開される */
    const want = s.saimoku[lessons.length];
    if (l.legal_scope !== want) {
      console.error(`NG ${id}: legal_scope が細目と違う\n    いま  「${l.legal_scope}」\n    あるべき「${want}」`);
      process.exit(1);
    }
    lessons.push(l);
  }
  /* 討議のぶんは、各自で見る単元には入らない。
     科目の法定時間から討議を引いたものが、単元の合計になる */
  const onDemand = s.legalMin - s.plan.talk;
  const sum = lessons.reduce((n, l) => n + l.legal_min, 0);
  if (!missing && sum !== onDemand) {
    console.error(`NG 科目${s.id}: 単元の合計 ${sum}分 ≠ 各自で見るぶん ${onDemand}分（法定${s.legalMin} − 討議${s.plan.talk}）`);
    process.exit(1);
  }
  /* 討議のぶんも書き出す。修了証は法定時間（legal_min + talk_min）を載せる。
     ここを落とすと、14時間の講座に「13時間15分」と書いた紙が出る */
  subjects.push({ id: s.id, name: s.name, legal_min: onDemand, talk_min: s.plan.talk, lessons });
}

if (missing) {
  console.error(`\n${missing} 単元がまだありません。書けたぶんだけでは組み立てません。`);
  process.exit(1);
}

const total = subjects.reduce((n, s) => n + s.legal_min, 0);
if (total + TALK_MIN !== COURSE_TOTAL_MIN) {
  console.error(`NG 各自で見るぶん ${total}分 ＋ 討議 ${TALK_MIN}分 ≠ ${COURSE_TOTAL_MIN}分`);
  process.exit(1);
}

/* 修了証に載る法定時間。ここが法定の合計と合わないと、
   足りない時間の紙が出る */
const legal = subjects.reduce((n, s) => n + s.legal_min + s.talk_min, 0);
if (legal !== COURSE_TOTAL_MIN) {
  console.error(`NG 修了証に載る合計 ${legal}分 ≠ 法定 ${COURSE_TOTAL_MIN}分`);
  process.exit(1);
}

const course = findCourse("shokucho")!;
const stats = {
  narration_lines: subjects.reduce((n, s) => n + s.lessons.reduce((m, l) => m + l.script.length, 0), 0),
  narration_chars: subjects.reduce((n, s) => n + s.lessons.reduce((m, l) => m + l.script.reduce((k, x) => k + x.length, 0), 0), 0),
  figures: subjects.reduce((n, s) => n + s.lessons.reduce((m, l) => m + l.figures.length, 0), 0),
  cases: subjects.reduce((n, s) => n + s.lessons.reduce((m, l) => m + l.cases.length, 0), 0),
  quiz: subjects.reduce((n, s) => n + s.lessons.reduce((m, l) => m + l.quiz.length, 0), 0),
};

const out = CurriculumSchema.parse({
  meta: {
    title: course.name,
    basis: course.basis,
    /* 各自で見るぶんの合計。討議45分は live_sessions 側で数える */
    total_min: total,
    generated: new Date().toISOString().slice(0, 10),
    stats,
  },
  subjects,
});

writeFileSync(path.join(root, "content", "courses", "shokucho.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`OK  content/courses/shokucho.json（各自 ${total}分 ＋ 討議 ${TALK_MIN}分 = ${COURSE_TOTAL_MIN}分＝14時間）`);
console.log(`    台本 ${stats.narration_lines}行 / ${stats.narration_chars}字　図解 ${stats.figures}　事例 ${stats.cases}　確認 ${stats.quiz}`);
