/* 石綿の教材を、単元ごとの json から1本に組み立てる。

   科目・範囲・時間の正本は src/content/ishiwata.ts（告示の表そのまま）。
   ここで突き合わせるので、**ずれていれば組み立てが止まる。**

   止めたいのは3つ。
     ・範囲（告示の中欄）に、単元が1つも当たっていない
       → その中身が抜けたまま公開される
     ・単元の合計が、科目の法定時間と違う
       → 合計だけ合わせて中身が足りない教育になる
     ・単元の legal_min が、割り付けと違う
       → 視聴時間の関門が法定より短くなる

   実行: npm run build:ishiwata */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { CurriculumSchema, LessonSchema } from "../src/types/curriculum";
import {
  ISHIWATA_BASIS,
  ISHIWATA_LESSONS,
  ISHIWATA_NAME,
  ISHIWATA_SUBJECTS,
  ISHIWATA_TOTAL_MIN,
} from "../src/content/ishiwata";

const root = process.cwd();
const src = path.join(root, "content", "ishiwata");

const die = (m: string): never => {
  console.error(`NG ${m}`);
  process.exit(1);
};

const subjects = [];
let missing = 0;

for (const s of ISHIWATA_SUBJECTS) {
  const plan = ISHIWATA_LESSONS[s.id] ?? [];
  if (!plan.length) die(`科目${s.id}: 単元の割り付けがない`);

  /* 告示の範囲に、単元が1つも当たっていないものがないか。
     抜けていると、その中身が入らないまま4時間30分ぶんが出来上がる */
  const covered = new Set(plan.map((l) => l.scope));
  const miss = s.scope.filter((x) => !covered.has(x));
  if (miss.length) die(`科目${s.id}: 単元の当たっていない範囲がある\n    ${miss.join("\n    ")}`);
  const extra = [...covered].filter((x) => !s.scope.includes(x));
  if (extra.length) die(`科目${s.id}: 告示に無い範囲を指している単元がある\n    ${extra.join("\n    ")}`);

  const lessons = [];
  for (const want of plan) {
    const f = path.join(src, `${want.id}.json`);
    if (!existsSync(f)) {
      missing++;
      console.error(`まだ無い: ${want.id}.json（${want.title}）`);
      continue;
    }
    const l = LessonSchema.parse(JSON.parse(readFileSync(f, "utf-8")));
    if (l.id !== want.id) die(`${want.id}: id が違う（${l.id}）`);
    /* 範囲は告示の言い回しのまま。言い換えると突き合わせられなくなる */
    if (l.legal_scope !== want.scope) {
      die(
        `${want.id}: legal_scope が告示の範囲と違う\n    いま　　「${l.legal_scope}」\n    あるべき「${want.scope}」`,
      );
    }
    /* ここが視聴時間の関門になる。短いと法定より短い時間で先へ進める */
    if (l.legal_min !== want.min) {
      die(`${want.id}: legal_min が割り付けと違う（${l.legal_min} ≠ ${want.min}）`);
    }
    lessons.push(l);
  }

  const sum = lessons.reduce((n, l) => n + l.legal_min, 0);
  if (!missing && sum !== s.legalMin) {
    die(`科目${s.id}: 単元の合計 ${sum}分 ≠ 法定 ${s.legalMin}分`);
  }
  /* 石綿に討議は無い（学科のみ）。talk_min は 0 で固定 */
  subjects.push({ id: s.id, name: s.name, legal_min: s.legalMin, talk_min: 0, lessons });
}

if (missing) {
  console.error(`\nまだ ${missing} 単元できていないので、組み立てません。`);
  process.exit(1);
}

const all = subjects.flatMap((s) => s.lessons);
const total = subjects.reduce((n, s) => n + s.legal_min, 0);
if (total !== ISHIWATA_TOTAL_MIN) die(`合計 ${total}分 ≠ 法定 ${ISHIWATA_TOTAL_MIN}分`);

const out = {
  meta: {
    title: `${ISHIWATA_NAME}（学科）`,
    basis: ISHIWATA_BASIS,
    total_min: total,
    generated: new Date().toISOString().slice(0, 10),
    stats: {
      narration_lines: all.reduce((n, l) => n + l.script.length, 0),
      narration_chars: all.reduce((n, l) => n + l.script.join("").length, 0),
      figures: all.reduce((n, l) => n + l.figures.length, 0),
      cases: all.reduce((n, l) => n + l.cases.length, 0),
      quiz: all.reduce((n, l) => n + l.quiz.length, 0),
    },
  },
  subjects,
};

CurriculumSchema.parse(out);
const dest = path.join(root, "content", "courses", "ishiwata.json");
writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`, "utf-8");
console.log(
  `できた: ${dest}\n  ${subjects.length}科目 ${all.length}単元 計${total}分` +
    `\n  ナレーション ${out.meta.stats.narration_lines}行 / ${out.meta.stats.narration_chars}字` +
    `\n  図解 ${out.meta.stats.figures} 事例 ${out.meta.stats.cases} 確認問題 ${out.meta.stats.quiz}`,
);
