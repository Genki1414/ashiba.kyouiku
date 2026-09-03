/* 実技の手引き。実技のある講座（gate: "drill"）ごとに1つ。

   学科はこの仕組みで見られるが、実技は事業者が自社で行う。
   「やってください」だけでは、何を何分やればいいか分からない。
   だから講座ごとに、3時間の割り振りの案と、誰がやるか、
   何を用意するか、記録の様式を、ここから出す。

   **法定で決まっているのは科目と合計の時間だけ。**
   割り振りはうちの案であって、告示ではない。画面にもそう書く。

   中身そのものは src/content/<講座>.ts が持つ（単体で持ち出せるように）。
   ここは、講座の id から手引きを引くだけ。 */

import {
  FORKLIFT_DRILL_FORM,
  FORKLIFT_DRILL_PREP,
  FORKLIFT_DRILL_STEPS,
  FORKLIFT_DRILL_TEACHER,
  FORKLIFT_DRILL_TOTAL_MIN,
  FORKLIFT_JITSUGI,
} from "./forklift";
import {
  EV_DRILL_FORM,
  EV_DRILL_PREP,
  EV_DRILL_STEPS,
  EV_DRILL_TEACHER,
  EV_DRILL_TOTAL_MIN,
  EV_JITSUGI,
} from "./ev";
import {
  KOUATSU_DRILL_FORM,
  KOUATSU_DRILL_PREP,
  KOUATSU_DRILL_STEPS,
  KOUATSU_DRILL_TEACHER,
  KOUATSU_DRILL_TOTAL_MIN,
  KOUATSU_JITSUGI,
} from "./kouatsu";
import {
  BATSUBOKU_DRILL_FORM,
  BATSUBOKU_DRILL_PREP,
  BATSUBOKU_DRILL_STEPS,
  BATSUBOKU_DRILL_TEACHER,
  BATSUBOKU_DRILL_TOTAL_MIN,
  BATSUBOKU_JITSUGI,
} from "./batsuboku";
import {
  YOUKA_DRILL_FORM,
  YOUKA_DRILL_PREP,
  YOUKA_DRILL_STEPS,
  YOUKA_DRILL_TEACHER,
  YOUKA_DRILL_TOTAL_MIN,
  YOUKA_JITSUGI,
} from "./youka";
import {
  PRESS_DRILL_FORM,
  PRESS_DRILL_PREP,
  PRESS_DRILL_STEPS,
  PRESS_DRILL_TEACHER,
  PRESS_DRILL_TOTAL_MIN,
  PRESS_JITSUGI,
} from "./press";
import {
  FUSEICHI_DRILL_FORM,
  FUSEICHI_DRILL_PREP,
  FUSEICHI_DRILL_STEPS,
  FUSEICHI_DRILL_TEACHER,
  FUSEICHI_DRILL_TOTAL_MIN,
  FUSEICHI_JITSUGI,
} from "./fuseichi";
import {
  SHOVEL_DRILL_FORM,
  SHOVEL_DRILL_PREP,
  SHOVEL_DRILL_STEPS,
  SHOVEL_DRILL_TEACHER,
  SHOVEL_DRILL_TOTAL_MIN,
  SHOVEL_JITSUGI,
} from "./shovel";
import {
  KIKAITOISHI_DRILL_FORM,
  KIKAITOISHI_DRILL_PREP,
  KIKAITOISHI_DRILL_STEPS,
  KIKAITOISHI_DRILL_TEACHER,
  KIKAITOISHI_DRILL_TOTAL_MIN,
  KIKAITOISHI_JITSUGI,
} from "./kikaitoishi";
import {
  ARC_DRILL_FORM,
  ARC_DRILL_PREP,
  ARC_DRILL_STEPS,
  ARC_DRILL_TEACHER,
  ARC_DRILL_TOTAL_MIN,
  ARC_JITSUGI,
} from "./arc";
import {
  CHAINSAW_DRILL_FORM,
  CHAINSAW_DRILL_PREP,
  CHAINSAW_DRILL_STEPS,
  CHAINSAW_DRILL_TEACHER,
  CHAINSAW_DRILL_TOTAL_MIN,
  CHAINSAW_JITSUGI,
} from "./chainsaw";
import {
  ROLLER_DRILL_FORM,
  ROLLER_DRILL_PREP,
  ROLLER_DRILL_STEPS,
  ROLLER_DRILL_TEACHER,
  ROLLER_DRILL_TOTAL_MIN,
  ROLLER_JITSUGI,
} from "./roller";
import {
  WINCH_DRILL_FORM,
  WINCH_DRILL_PREP,
  WINCH_DRILL_STEPS,
  WINCH_DRILL_TEACHER,
  WINCH_DRILL_TOTAL_MIN,
  WINCH_JITSUGI,
} from "./winch";
import {
  TEIATSU_DRILL_FORM,
  TEIATSU_DRILL_PREP,
  TEIATSU_DRILL_STEPS,
  TEIATSU_DRILL_TEACHER,
  TEIATSU_DRILL_TOTAL_MIN,
  TEIATSU_JITSUGI,
} from "./teiatsu";
import {
  TOISHI_DRILL_FORM,
  TOISHI_DRILL_PREP,
  TOISHI_DRILL_STEPS,
  TOISHI_DRILL_TEACHER,
  TOISHI_DRILL_TOTAL_MIN,
  TOISHI_JITSUGI,
} from "./toishi";
import {
  TAILGATE_DRILL_FORM,
  TAILGATE_DRILL_PREP,
  TAILGATE_DRILL_STEPS,
  TAILGATE_DRILL_TEACHER,
  TAILGATE_DRILL_TOTAL_MIN,
  TAILGATE_JITSUGI,
} from "./tailgate";
import {
  KOGATA_DRILL_FORM,
  KOGATA_DRILL_PREP,
  KOGATA_DRILL_STEPS,
  KOGATA_DRILL_TEACHER,
  KOGATA_DRILL_TOTAL_MIN,
  KOGATA_JITSUGI,
} from "./kogata";
import {
  ROPE_DRILL_FORM,
  ROPE_DRILL_PREP,
  ROPE_DRILL_STEPS,
  ROPE_DRILL_TEACHER,
  ROPE_DRILL_TOTAL_MIN,
  ROPE_JITSUGI,
} from "./rope";
import {
  HARNESS_DRILL_FORM,
  HARNESS_DRILL_PREP,
  HARNESS_DRILL_STEPS,
  HARNESS_DRILL_TEACHER,
  HARNESS_DRILL_TOTAL_MIN,
  HARNESS_JITSUGI,
} from "./harness";
import {
  KOUSHO_DRILL_FORM,
  KOUSHO_DRILL_PREP,
  KOUSHO_DRILL_STEPS,
  KOUSHO_DRILL_TEACHER,
  KOUSHO_DRILL_TOTAL_MIN,
  KOUSHO_JITSUGI,
  type KoushoDrillStep,
} from "./kousho";

export type DrillStep = KoushoDrillStep;

export type DrillGuide = {
  courseId: string;
  /** 告示の実技の科目名 */
  subject: string;
  /** 告示の範囲（中欄）。段取りの scope はこの字のどれか */
  scope: string[];
  /** 法定の合計（分） */
  legalMin: number;
  /** 割り振りの案。合計は legalMin と一致する */
  steps: DrillStep[];
  /** 割り振りの合計（分） */
  totalMin: number;
  teacher: { rule: string; who: string[]; not: string[] };
  prep: string[];
  /** 記録を何年残すか（安衛則第38条） */
  keepYears: number;
  /** 実施記録の、上半分の記入欄。**講座ごとに違う。**
      流用すると、その講座に関係のない欄が空のまま紙に残る */
  form: { k: string; v: string }[];
};

const GUIDES: Record<string, DrillGuide> = {
  rope: {
    courseId: "rope",
    subject: ROPE_JITSUGI.name,
    scope: ROPE_JITSUGI.scope,
    legalMin: ROPE_JITSUGI.legalMin,
    steps: ROPE_DRILL_STEPS,
    totalMin: ROPE_DRILL_TOTAL_MIN,
    teacher: ROPE_DRILL_TEACHER,
    prep: ROPE_DRILL_PREP,
    keepYears: 3,
    form: ROPE_DRILL_FORM,
  },
  harness: {
    courseId: "harness",
    subject: HARNESS_JITSUGI.name,
    scope: HARNESS_JITSUGI.scope,
    legalMin: HARNESS_JITSUGI.legalMin,
    steps: HARNESS_DRILL_STEPS,
    totalMin: HARNESS_DRILL_TOTAL_MIN,
    teacher: HARNESS_DRILL_TEACHER,
    prep: HARNESS_DRILL_PREP,
    keepYears: 3,
    form: HARNESS_DRILL_FORM,
  },
  forklift: {
    courseId: "forklift",
    subject: FORKLIFT_JITSUGI.name,
    scope: FORKLIFT_JITSUGI.scope,
    legalMin: FORKLIFT_JITSUGI.legalMin,
    steps: FORKLIFT_DRILL_STEPS,
    totalMin: FORKLIFT_DRILL_TOTAL_MIN,
    teacher: FORKLIFT_DRILL_TEACHER,
    prep: FORKLIFT_DRILL_PREP,
    keepYears: 3,
    form: FORKLIFT_DRILL_FORM,
  },
  kogata: {
    courseId: "kogata",
    subject: KOGATA_JITSUGI.name,
    scope: KOGATA_JITSUGI.scope,
    legalMin: KOGATA_JITSUGI.legalMin,
    steps: KOGATA_DRILL_STEPS,
    totalMin: KOGATA_DRILL_TOTAL_MIN,
    teacher: KOGATA_DRILL_TEACHER,
    prep: KOGATA_DRILL_PREP,
    keepYears: 3,
    form: KOGATA_DRILL_FORM,
  },
  ev: {
    courseId: "ev",
    subject: EV_JITSUGI.name,
    scope: EV_JITSUGI.scope,
    legalMin: EV_JITSUGI.legalMin,
    steps: EV_DRILL_STEPS,
    totalMin: EV_DRILL_TOTAL_MIN,
    teacher: EV_DRILL_TEACHER,
    prep: EV_DRILL_PREP,
    keepYears: 3,
    form: EV_DRILL_FORM,
  },
  kouatsu: {
    courseId: "kouatsu",
    subject: KOUATSU_JITSUGI.name,
    scope: KOUATSU_JITSUGI.scope,
    legalMin: KOUATSU_JITSUGI.legalMin,
    steps: KOUATSU_DRILL_STEPS,
    totalMin: KOUATSU_DRILL_TOTAL_MIN,
    teacher: KOUATSU_DRILL_TEACHER,
    prep: KOUATSU_DRILL_PREP,
    keepYears: 3,
    form: KOUATSU_DRILL_FORM,
  },
  batsuboku: {
    courseId: "batsuboku",
    subject: BATSUBOKU_JITSUGI.name,
    scope: BATSUBOKU_JITSUGI.scope,
    legalMin: BATSUBOKU_JITSUGI.legalMin,
    steps: BATSUBOKU_DRILL_STEPS,
    totalMin: BATSUBOKU_DRILL_TOTAL_MIN,
    teacher: BATSUBOKU_DRILL_TEACHER,
    prep: BATSUBOKU_DRILL_PREP,
    keepYears: 3,
    form: BATSUBOKU_DRILL_FORM,
  },
  youka: {
    courseId: "youka",
    subject: YOUKA_JITSUGI.name,
    scope: YOUKA_JITSUGI.scope,
    legalMin: YOUKA_JITSUGI.legalMin,
    steps: YOUKA_DRILL_STEPS,
    totalMin: YOUKA_DRILL_TOTAL_MIN,
    teacher: YOUKA_DRILL_TEACHER,
    prep: YOUKA_DRILL_PREP,
    keepYears: 3,
    form: YOUKA_DRILL_FORM,
  },
  press: {
    courseId: "press",
    subject: PRESS_JITSUGI.name,
    scope: PRESS_JITSUGI.scope,
    legalMin: PRESS_JITSUGI.legalMin,
    steps: PRESS_DRILL_STEPS,
    totalMin: PRESS_DRILL_TOTAL_MIN,
    teacher: PRESS_DRILL_TEACHER,
    prep: PRESS_DRILL_PREP,
    keepYears: 3,
    form: PRESS_DRILL_FORM,
  },
  fuseichi: {
    courseId: "fuseichi",
    subject: FUSEICHI_JITSUGI.name,
    scope: FUSEICHI_JITSUGI.scope,
    legalMin: FUSEICHI_JITSUGI.legalMin,
    steps: FUSEICHI_DRILL_STEPS,
    totalMin: FUSEICHI_DRILL_TOTAL_MIN,
    teacher: FUSEICHI_DRILL_TEACHER,
    prep: FUSEICHI_DRILL_PREP,
    keepYears: 3,
    form: FUSEICHI_DRILL_FORM,
  },
  shovel: {
    courseId: "shovel",
    subject: SHOVEL_JITSUGI.name,
    scope: SHOVEL_JITSUGI.scope,
    legalMin: SHOVEL_JITSUGI.legalMin,
    steps: SHOVEL_DRILL_STEPS,
    totalMin: SHOVEL_DRILL_TOTAL_MIN,
    teacher: SHOVEL_DRILL_TEACHER,
    prep: SHOVEL_DRILL_PREP,
    keepYears: 3,
    form: SHOVEL_DRILL_FORM,
  },
  kikaitoishi: {
    courseId: "kikaitoishi",
    subject: KIKAITOISHI_JITSUGI.name,
    scope: KIKAITOISHI_JITSUGI.scope,
    legalMin: KIKAITOISHI_JITSUGI.legalMin,
    steps: KIKAITOISHI_DRILL_STEPS,
    totalMin: KIKAITOISHI_DRILL_TOTAL_MIN,
    teacher: KIKAITOISHI_DRILL_TEACHER,
    prep: KIKAITOISHI_DRILL_PREP,
    keepYears: 3,
    form: KIKAITOISHI_DRILL_FORM,
  },
  arc: {
    courseId: "arc",
    subject: ARC_JITSUGI.name,
    scope: ARC_JITSUGI.scope,
    legalMin: ARC_JITSUGI.legalMin,
    steps: ARC_DRILL_STEPS,
    totalMin: ARC_DRILL_TOTAL_MIN,
    teacher: ARC_DRILL_TEACHER,
    prep: ARC_DRILL_PREP,
    keepYears: 3,
    form: ARC_DRILL_FORM,
  },
  chainsaw: {
    courseId: "chainsaw",
    subject: CHAINSAW_JITSUGI.name,
    scope: CHAINSAW_JITSUGI.scope,
    legalMin: CHAINSAW_JITSUGI.legalMin,
    steps: CHAINSAW_DRILL_STEPS,
    totalMin: CHAINSAW_DRILL_TOTAL_MIN,
    teacher: CHAINSAW_DRILL_TEACHER,
    prep: CHAINSAW_DRILL_PREP,
    keepYears: 3,
    form: CHAINSAW_DRILL_FORM,
  },
  roller: {
    courseId: "roller",
    subject: ROLLER_JITSUGI.name,
    scope: ROLLER_JITSUGI.scope,
    legalMin: ROLLER_JITSUGI.legalMin,
    steps: ROLLER_DRILL_STEPS,
    totalMin: ROLLER_DRILL_TOTAL_MIN,
    teacher: ROLLER_DRILL_TEACHER,
    prep: ROLLER_DRILL_PREP,
    keepYears: 3,
    form: ROLLER_DRILL_FORM,
  },
  winch: {
    courseId: "winch",
    subject: WINCH_JITSUGI.name,
    scope: WINCH_JITSUGI.scope,
    legalMin: WINCH_JITSUGI.legalMin,
    steps: WINCH_DRILL_STEPS,
    totalMin: WINCH_DRILL_TOTAL_MIN,
    teacher: WINCH_DRILL_TEACHER,
    prep: WINCH_DRILL_PREP,
    keepYears: 3,
    form: WINCH_DRILL_FORM,
  },
  teiatsu: {
    courseId: "teiatsu",
    subject: TEIATSU_JITSUGI.name,
    scope: TEIATSU_JITSUGI.scope,
    legalMin: TEIATSU_JITSUGI.legalMin,
    steps: TEIATSU_DRILL_STEPS,
    totalMin: TEIATSU_DRILL_TOTAL_MIN,
    teacher: TEIATSU_DRILL_TEACHER,
    prep: TEIATSU_DRILL_PREP,
    keepYears: 3,
    form: TEIATSU_DRILL_FORM,
  },
  toishi: {
    courseId: "toishi",
    subject: TOISHI_JITSUGI.name,
    scope: TOISHI_JITSUGI.scope,
    legalMin: TOISHI_JITSUGI.legalMin,
    steps: TOISHI_DRILL_STEPS,
    totalMin: TOISHI_DRILL_TOTAL_MIN,
    teacher: TOISHI_DRILL_TEACHER,
    prep: TOISHI_DRILL_PREP,
    keepYears: 3,
    form: TOISHI_DRILL_FORM,
  },
  tailgate: {
    courseId: "tailgate",
    subject: TAILGATE_JITSUGI.name,
    scope: TAILGATE_JITSUGI.scope,
    legalMin: TAILGATE_JITSUGI.legalMin,
    steps: TAILGATE_DRILL_STEPS,
    totalMin: TAILGATE_DRILL_TOTAL_MIN,
    teacher: TAILGATE_DRILL_TEACHER,
    prep: TAILGATE_DRILL_PREP,
    keepYears: 3,
    form: TAILGATE_DRILL_FORM,
  },
  kousho: {
    courseId: "kousho",
    subject: KOUSHO_JITSUGI.name,
    scope: KOUSHO_JITSUGI.scope,
    legalMin: KOUSHO_JITSUGI.legalMin,
    steps: KOUSHO_DRILL_STEPS,
    totalMin: KOUSHO_DRILL_TOTAL_MIN,
    teacher: KOUSHO_DRILL_TEACHER,
    prep: KOUSHO_DRILL_PREP,
    keepYears: 3,
    form: KOUSHO_DRILL_FORM,
  },
};

/** その講座の実技の手引き。実技の無い講座は null */
export const drillGuideOf = (courseId: string): DrillGuide | null => GUIDES[courseId] ?? null;

/** 手引きのある講座の id */
export const DRILL_GUIDE_IDS = Object.keys(GUIDES);
