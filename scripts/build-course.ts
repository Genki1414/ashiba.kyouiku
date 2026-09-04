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
     npm run build:rope       # ロープ高所作業
     npm run build:funjin     # 特定粉じん作業
     npm run build:sanketsu   # 酸素欠乏・硫化水素
     npm run build:kogata     # 小型車両系建設機械（整地等）
     npm run build:forklift   # フォークリフト（1トン未満）
     npm run build:tailgate   # テールゲートリフター
     npm run build:toishi     # 自由研削用といし
     npm run build:teiatsu    # 低圧電気取扱
     npm run build:winch      # 巻上げ機
     npm run build:roller     # ローラー
     npm run build:chainsaw   # チェーンソー
     npm run build:arc        # アーク溶接
     npm run build:kikaitoishi # 機械研削用といし
     npm run build:shovel     # ショベルローダー等（1トン未満）
     npm run build:fuseichi   # 不整地運搬車（1トン未満）
     npm run build:kouatsu    # 高圧・特別高圧電気取扱
     npm run build:ev         # 電気自動車等の整備
     npm run build:zuidou     # ずい道等の掘削等（学科のみ）
     npm run build:dioxin     # ダイオキシン類（学科のみ）
     npm run build:press      # 動力プレスの金型等
     npm run build:youka      # 揚貨装置（5トン未満）
     npm run build:batsuboku  # 伐木等機械
     npm run build:soukou     # 走行集材機械
     npm run build:kikaishuzai # 機械集材装置
     npm run build:kanikasen  # 簡易架線集材装置等
     npm run build:kisokouji  # 小型車両系（基礎工事用）
     npm run build:kaitai     # 小型車両系（解体用）
     npm run build:kisokenki  # 基礎工事用建設機械 */

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
  FUNJIN_BASIS, FUNJIN_LESSONS, FUNJIN_NAME, FUNJIN_SUBJECTS, FUNJIN_TOTAL_MIN,
} from "../src/content/funjin";
import {
  KISOKENKI_BASIS, KISOKENKI_LESSONS, KISOKENKI_NAME, KISOKENKI_SUBJECTS, KISOKENKI_TOTAL_MIN,
} from "../src/content/kisokenki";
import {
  KAITAI_BASIS, KAITAI_LESSONS, KAITAI_NAME, KAITAI_SUBJECTS, KAITAI_TOTAL_MIN,
} from "../src/content/kaitai";
import {
  KISOKOUJI_BASIS, KISOKOUJI_LESSONS, KISOKOUJI_NAME, KISOKOUJI_SUBJECTS, KISOKOUJI_TOTAL_MIN,
} from "../src/content/kisokouji";
import {
  KANIKASEN_BASIS, KANIKASEN_LESSONS, KANIKASEN_NAME, KANIKASEN_SUBJECTS, KANIKASEN_TOTAL_MIN,
} from "../src/content/kanikasen";
import {
  KIKAISHUZAI_BASIS, KIKAISHUZAI_LESSONS, KIKAISHUZAI_NAME, KIKAISHUZAI_SUBJECTS, KIKAISHUZAI_TOTAL_MIN,
} from "../src/content/kikaishuzai";
import {
  SOUKOU_BASIS, SOUKOU_LESSONS, SOUKOU_NAME, SOUKOU_SUBJECTS, SOUKOU_TOTAL_MIN,
} from "../src/content/soukou";
import {
  BATSUBOKU_BASIS, BATSUBOKU_LESSONS, BATSUBOKU_NAME, BATSUBOKU_SUBJECTS, BATSUBOKU_TOTAL_MIN,
} from "../src/content/batsuboku";
import {
  YOUKA_BASIS, YOUKA_LESSONS, YOUKA_NAME, YOUKA_SUBJECTS, YOUKA_TOTAL_MIN,
} from "../src/content/youka";
import {
  PRESS_BASIS, PRESS_LESSONS, PRESS_NAME, PRESS_SUBJECTS, PRESS_TOTAL_MIN,
} from "../src/content/press";
import {
  DIOXIN_BASIS, DIOXIN_LESSONS, DIOXIN_NAME, DIOXIN_SUBJECTS, DIOXIN_TOTAL_MIN,
} from "../src/content/dioxin";
import {
  ZUIDOU_BASIS, ZUIDOU_LESSONS, ZUIDOU_NAME, ZUIDOU_SUBJECTS, ZUIDOU_TOTAL_MIN,
} from "../src/content/zuidou";
import {
  EV_BASIS, EV_LESSONS, EV_NAME, EV_SUBJECTS, EV_TOTAL_MIN,
} from "../src/content/ev";
import {
  KOUATSU_BASIS, KOUATSU_LESSONS, KOUATSU_NAME, KOUATSU_SUBJECTS, KOUATSU_TOTAL_MIN,
} from "../src/content/kouatsu";
import {
  FUSEICHI_BASIS, FUSEICHI_LESSONS, FUSEICHI_NAME, FUSEICHI_SUBJECTS, FUSEICHI_TOTAL_MIN,
} from "../src/content/fuseichi";
import {
  SHOVEL_BASIS, SHOVEL_LESSONS, SHOVEL_NAME, SHOVEL_SUBJECTS, SHOVEL_TOTAL_MIN,
} from "../src/content/shovel";
import {
  KIKAITOISHI_BASIS, KIKAITOISHI_LESSONS, KIKAITOISHI_NAME, KIKAITOISHI_SUBJECTS, KIKAITOISHI_TOTAL_MIN,
} from "../src/content/kikaitoishi";
import {
  ARC_BASIS, ARC_LESSONS, ARC_NAME, ARC_SUBJECTS, ARC_TOTAL_MIN,
} from "../src/content/arc";
import {
  CHAINSAW_BASIS, CHAINSAW_LESSONS, CHAINSAW_NAME, CHAINSAW_SUBJECTS, CHAINSAW_TOTAL_MIN,
} from "../src/content/chainsaw";
import {
  ROLLER_BASIS, ROLLER_LESSONS, ROLLER_NAME, ROLLER_SUBJECTS, ROLLER_TOTAL_MIN,
} from "../src/content/roller";
import {
  WINCH_BASIS, WINCH_LESSONS, WINCH_NAME, WINCH_SUBJECTS, WINCH_TOTAL_MIN,
} from "../src/content/winch";
import {
  TEIATSU_BASIS, TEIATSU_LESSONS, TEIATSU_NAME, TEIATSU_SUBJECTS, TEIATSU_TOTAL_MIN,
} from "../src/content/teiatsu";
import {
  TOISHI_BASIS, TOISHI_LESSONS, TOISHI_NAME, TOISHI_SUBJECTS, TOISHI_TOTAL_MIN,
} from "../src/content/toishi";
import {
  TAILGATE_BASIS, TAILGATE_LESSONS, TAILGATE_NAME, TAILGATE_SUBJECTS, TAILGATE_TOTAL_MIN,
} from "../src/content/tailgate";
import {
  FORKLIFT_BASIS, FORKLIFT_LESSONS, FORKLIFT_NAME, FORKLIFT_SUBJECTS, FORKLIFT_TOTAL_MIN,
} from "../src/content/forklift";
import {
  KOGATA_BASIS, KOGATA_LESSONS, KOGATA_NAME, KOGATA_SUBJECTS, KOGATA_TOTAL_MIN,
} from "../src/content/kogata";
import {
  SANKETSU_BASIS, SANKETSU_LESSONS, SANKETSU_NAME, SANKETSU_SUBJECTS, SANKETSU_TOTAL_MIN,
} from "../src/content/sanketsu";
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
  funjin: {
    id: "funjin",
    name: `${FUNJIN_NAME}（学科）`,
    basis: FUNJIN_BASIS,
    subjects: FUNJIN_SUBJECTS,
    lessons: FUNJIN_LESSONS,
    totalMin: FUNJIN_TOTAL_MIN,
  },
  kisokenki: {
    id: "kisokenki",
    name: `${KISOKENKI_NAME}（学科）`,
    basis: KISOKENKI_BASIS,
    subjects: KISOKENKI_SUBJECTS,
    lessons: KISOKENKI_LESSONS,
    totalMin: KISOKENKI_TOTAL_MIN,
  },
  kaitai: {
    id: "kaitai",
    name: `${KAITAI_NAME}（学科）`,
    basis: KAITAI_BASIS,
    subjects: KAITAI_SUBJECTS,
    lessons: KAITAI_LESSONS,
    totalMin: KAITAI_TOTAL_MIN,
  },
  kisokouji: {
    id: "kisokouji",
    name: `${KISOKOUJI_NAME}（学科）`,
    basis: KISOKOUJI_BASIS,
    subjects: KISOKOUJI_SUBJECTS,
    lessons: KISOKOUJI_LESSONS,
    totalMin: KISOKOUJI_TOTAL_MIN,
  },
  kanikasen: {
    id: "kanikasen",
    name: `${KANIKASEN_NAME}（学科）`,
    basis: KANIKASEN_BASIS,
    subjects: KANIKASEN_SUBJECTS,
    lessons: KANIKASEN_LESSONS,
    totalMin: KANIKASEN_TOTAL_MIN,
  },
  kikaishuzai: {
    id: "kikaishuzai",
    name: `${KIKAISHUZAI_NAME}（学科）`,
    basis: KIKAISHUZAI_BASIS,
    subjects: KIKAISHUZAI_SUBJECTS,
    lessons: KIKAISHUZAI_LESSONS,
    totalMin: KIKAISHUZAI_TOTAL_MIN,
  },
  soukou: {
    id: "soukou",
    name: `${SOUKOU_NAME}（学科）`,
    basis: SOUKOU_BASIS,
    subjects: SOUKOU_SUBJECTS,
    lessons: SOUKOU_LESSONS,
    totalMin: SOUKOU_TOTAL_MIN,
  },
  batsuboku: {
    id: "batsuboku",
    name: `${BATSUBOKU_NAME}（学科）`,
    basis: BATSUBOKU_BASIS,
    subjects: BATSUBOKU_SUBJECTS,
    lessons: BATSUBOKU_LESSONS,
    totalMin: BATSUBOKU_TOTAL_MIN,
  },
  youka: {
    id: "youka",
    name: `${YOUKA_NAME}（学科）`,
    basis: YOUKA_BASIS,
    subjects: YOUKA_SUBJECTS,
    lessons: YOUKA_LESSONS,
    totalMin: YOUKA_TOTAL_MIN,
  },
  press: {
    id: "press",
    name: `${PRESS_NAME}（学科）`,
    basis: PRESS_BASIS,
    subjects: PRESS_SUBJECTS,
    lessons: PRESS_LESSONS,
    totalMin: PRESS_TOTAL_MIN,
  },
  dioxin: {
    id: "dioxin",
    name: `${DIOXIN_NAME}（学科）`,
    basis: DIOXIN_BASIS,
    subjects: DIOXIN_SUBJECTS,
    lessons: DIOXIN_LESSONS,
    totalMin: DIOXIN_TOTAL_MIN,
  },
  zuidou: {
    id: "zuidou",
    name: `${ZUIDOU_NAME}（学科）`,
    basis: ZUIDOU_BASIS,
    subjects: ZUIDOU_SUBJECTS,
    lessons: ZUIDOU_LESSONS,
    totalMin: ZUIDOU_TOTAL_MIN,
  },
  ev: {
    id: "ev",
    name: `${EV_NAME}（学科）`,
    basis: EV_BASIS,
    subjects: EV_SUBJECTS,
    lessons: EV_LESSONS,
    totalMin: EV_TOTAL_MIN,
  },
  kouatsu: {
    id: "kouatsu",
    name: `${KOUATSU_NAME}（学科）`,
    basis: KOUATSU_BASIS,
    subjects: KOUATSU_SUBJECTS,
    lessons: KOUATSU_LESSONS,
    totalMin: KOUATSU_TOTAL_MIN,
  },
  fuseichi: {
    id: "fuseichi",
    name: `${FUSEICHI_NAME}（学科）`,
    basis: FUSEICHI_BASIS,
    subjects: FUSEICHI_SUBJECTS,
    lessons: FUSEICHI_LESSONS,
    totalMin: FUSEICHI_TOTAL_MIN,
  },
  shovel: {
    id: "shovel",
    name: `${SHOVEL_NAME}（学科）`,
    basis: SHOVEL_BASIS,
    subjects: SHOVEL_SUBJECTS,
    lessons: SHOVEL_LESSONS,
    totalMin: SHOVEL_TOTAL_MIN,
  },
  kikaitoishi: {
    id: "kikaitoishi",
    name: `${KIKAITOISHI_NAME}（学科）`,
    basis: KIKAITOISHI_BASIS,
    subjects: KIKAITOISHI_SUBJECTS,
    lessons: KIKAITOISHI_LESSONS,
    totalMin: KIKAITOISHI_TOTAL_MIN,
  },
  arc: {
    id: "arc",
    name: `${ARC_NAME}（学科）`,
    basis: ARC_BASIS,
    subjects: ARC_SUBJECTS,
    lessons: ARC_LESSONS,
    totalMin: ARC_TOTAL_MIN,
  },
  chainsaw: {
    id: "chainsaw",
    name: `${CHAINSAW_NAME}（学科）`,
    basis: CHAINSAW_BASIS,
    subjects: CHAINSAW_SUBJECTS,
    lessons: CHAINSAW_LESSONS,
    totalMin: CHAINSAW_TOTAL_MIN,
  },
  roller: {
    id: "roller",
    name: `${ROLLER_NAME}（学科）`,
    basis: ROLLER_BASIS,
    subjects: ROLLER_SUBJECTS,
    lessons: ROLLER_LESSONS,
    totalMin: ROLLER_TOTAL_MIN,
  },
  winch: {
    id: "winch",
    name: `${WINCH_NAME}（学科）`,
    basis: WINCH_BASIS,
    subjects: WINCH_SUBJECTS,
    lessons: WINCH_LESSONS,
    totalMin: WINCH_TOTAL_MIN,
  },
  teiatsu: {
    id: "teiatsu",
    name: `${TEIATSU_NAME}（学科）`,
    basis: TEIATSU_BASIS,
    subjects: TEIATSU_SUBJECTS,
    lessons: TEIATSU_LESSONS,
    totalMin: TEIATSU_TOTAL_MIN,
  },
  toishi: {
    id: "toishi",
    name: `${TOISHI_NAME}（学科）`,
    basis: TOISHI_BASIS,
    subjects: TOISHI_SUBJECTS,
    lessons: TOISHI_LESSONS,
    totalMin: TOISHI_TOTAL_MIN,
  },
  tailgate: {
    id: "tailgate",
    name: `${TAILGATE_NAME}（学科）`,
    basis: TAILGATE_BASIS,
    subjects: TAILGATE_SUBJECTS,
    lessons: TAILGATE_LESSONS,
    totalMin: TAILGATE_TOTAL_MIN,
  },
  forklift: {
    id: "forklift",
    name: `${FORKLIFT_NAME}（学科）`,
    basis: FORKLIFT_BASIS,
    subjects: FORKLIFT_SUBJECTS,
    lessons: FORKLIFT_LESSONS,
    totalMin: FORKLIFT_TOTAL_MIN,
  },
  kogata: {
    id: "kogata",
    name: `${KOGATA_NAME}（学科）`,
    basis: KOGATA_BASIS,
    subjects: KOGATA_SUBJECTS,
    lessons: KOGATA_LESSONS,
    totalMin: KOGATA_TOTAL_MIN,
  },
  sanketsu: {
    id: "sanketsu",
    name: `${SANKETSU_NAME}（学科）`,
    basis: SANKETSU_BASIS,
    subjects: SANKETSU_SUBJECTS,
    lessons: SANKETSU_LESSONS,
    totalMin: SANKETSU_TOTAL_MIN,
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
