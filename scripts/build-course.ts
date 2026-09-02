/* 単元ごとの json から、講座を1本に組み立てる。

   科目・範囲・時間の正本は src/content/<講座>.ts（告示の表そのまま）。
   ここで突き合わせるので、**ずれていれば組み立てが止まる。**

   止めたいのは3つ。
     ・範囲（告示の中欄）に、単元が1つも当たっていない
       → その中身が抜けたまま、法定時間ぶんが出来上がる
     ・単元の合計が、科目の法定時間と違う
     ・単元の legal_min が、割り付けと違う
       → 視聴時間の関門が法定より短くなる

   実行:
     npm run build:ishiwata   # 石綿
     npm run build:kousho     # 高所作業車
     npm run build:harness    # フルハーネス
     npm run build:rope       # ロープ高所作業 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { CurriculumSchema, LessonSchema } from "../src/types/curriculum";
import {
  ISHIWATA_BASIS, ISHIWATA_LESSONS, ISHIWATA_NAME, ISHIWATA_SUBJECTS, ISHIWATA_TOTAL_MIN,
} from "../src/content/ishiwata";
import {
  KOUSHO_BASIS, KOUSHO_LESSONS, KOUSHO_NAME, KOUSHO_SUBJECTS, KOUSHO_TOTAL_MIN,
} from "../src/content/kousho";
import {
  ROPE_BASIS, ROPE_LESSONS, ROPE_NAME, ROPE_SUBJECTS, ROPE_TOTAL_MIN,
} from "../src/content/rope";
import {
  HARNESS_BASIS, HARNESS_LESSONS, HARNESS_NAME, HARNESS_SUBJECTS, HARNESS_TOTAL_MIN,
} from "../src/content/harness";

type Plan = {
  /** 講座の目印。content/<id>/ に単元の json を置き、content/courses/<id>.json に書き出す */
  id: string;
  name: string;
  basis: string;
  subjects: { id: number; name: string; scope: string[]; legalMin: number }[];
  lessons: Record<number, { id: string; title: string; scope: string; min: number }[]>;
  totalMin: number;
};

const PLANS: Record<string, Plan> = {
  ishiwata: {
    id: "ishiwata",
    name: `${ISHIWATA_NAME}（学科）`,
    basis: ISHIWATA_BASIS,
    subjects: ISHIWATA_SUBJECTS,
    lessons: ISHIWATA_LESSONS,
    totalMin: ISHIWATA_TOTAL_MIN,
  },
  rope: {
    id: "rope",
    name: `${ROPE_NAME}（学科）`,
    basis: ROPE_BASIS,
    subjects: ROPE_SUBJECTS,
    lessons: ROPE_LESSONS,
    totalMin: ROPE_TOTAL_MIN,
  },
  harness: {
    id: "harness",
    name: `${HARNESS_NAME}（学科）`,
    basis: HARNESS_BASIS,
    subjects: HARNESS_SUBJECTS,
    lessons: HARNESS_LESSONS,
    totalMin: HARNESS_TOTAL_MIN,
  },
  kousho: {
    id: "kousho",
    name: `${KOUSHO_NAME}（学科）`,
    basis: KOUSHO_BASIS,
    subjects: KOUSHO_SUBJECTS,
    lessons: KOUSHO_LESSONS,
    totalMin: KOUSHO_TOTAL_MIN,
  },
};

const want = process.argv[2] ?? "";
const plan = PLANS[want];
if (!plan) {
  console.error(`NG どの講座か分かりません（${want}）。ある講座: ${Object.keys(PLANS).join("／")}`);
  process.exit(1);
}

const root = process.cwd();
const src = path.join(root, "content", plan.id);

const die = (m: string): never => {
  console.error(`NG ${m}`);
  process.exit(1);
};

const subjects = [];
let missing = 0;

for (const s of plan.subjects) {
  const layout = plan.lessons[s.id] ?? [];
  if (!layout.length) die(`科目${s.id}: 単元の割り付けがない`);

  /* 告示の範囲に、単元が1つも当たっていないものがないか。
     抜けていると、その中身が入らないまま法定時間ぶんが出来上がる */
  const covered = new Set(layout.map((l) => l.scope));
  const miss = s.scope.filter((x) => !covered.has(x));
  if (miss.length) die(`科目${s.id}: 単元の当たっていない範囲がある\n    ${miss.join("\n    ")}`);
  const extra = [...covered].filter((x) => !s.scope.includes(x));
  if (extra.length) die(`科目${s.id}: 告示に無い範囲を指している単元がある\n    ${extra.join("\n    ")}`);

  const lessons = [];
  for (const w of layout) {
    const f = path.join(src, `${w.id}.json`);
    if (!existsSync(f)) {
      missing++;
      console.error(`まだ無い: ${w.id}.json（${w.title}）`);
      continue;
    }
    const l = LessonSchema.parse(JSON.parse(readFileSync(f, "utf-8")));
    if (l.id !== w.id) die(`${w.id}: id が違う（${l.id}）`);
    /* 範囲は告示の言い回しのまま。言い換えると突き合わせられなくなる */
    if (l.legal_scope !== w.scope) {
      die(`${w.id}: legal_scope が告示の範囲と違う\n    いま　　「${l.legal_scope}」\n    あるべき「${w.scope}」`);
    }
    /* ここが視聴時間の関門になる。短いと法定より短い時間で先へ進める */
    if (l.legal_min !== w.min) die(`${w.id}: legal_min が割り付けと違う（${l.legal_min} ≠ ${w.min}）`);
    lessons.push(l);
  }

  const sum = lessons.reduce((n, l) => n + l.legal_min, 0);
  if (!missing && sum !== s.legalMin) die(`科目${s.id}: 単元の合計 ${sum}分 ≠ 法定 ${s.legalMin}分`);
  /* 学科だけの講座なので talk_min は 0。実技は事業者が行うもので、
     ここ（各自で見るぶん）には入らない */
  subjects.push({ id: s.id, name: s.name, legal_min: s.legalMin, talk_min: 0, lessons });
}

if (missing) {
  console.error(`\nまだ ${missing} 単元できていないので、組み立てません。`);
  process.exit(1);
}

const all = subjects.flatMap((s) => s.lessons);
const total = subjects.reduce((n, s) => n + s.legal_min, 0);
if (total !== plan.totalMin) die(`合計 ${total}分 ≠ 法定 ${plan.totalMin}分`);

const out = {
  meta: {
    title: plan.name,
    basis: plan.basis,
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
const dest = path.join(root, "content", "courses", `${plan.id}.json`);
writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`, "utf-8");
console.log(
  `できた: ${dest}\n  ${subjects.length}科目 ${all.length}単元 計${total}分` +
    `\n  ナレーション ${out.meta.stats.narration_lines}行 / ${out.meta.stats.narration_chars}字` +
    `\n  図解 ${out.meta.stats.figures} 事例 ${out.meta.stats.cases} 確認問題 ${out.meta.stats.quiz}`,
);
