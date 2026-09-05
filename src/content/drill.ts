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
  KIKAISHUZAI_DRILL_FORM,
  KIKAISHUZAI_DRILL_PREP,
  KIKAISHUZAI_DRILL_STEPS,
  KIKAISHUZAI_DRILL_TEACHER,
  KIKAISHUZAI_DRILL_TOTAL_MIN,
  KIKAISHUZAI_JITSUGI,
} from "./kikaishuzai";
import {
  KANIKASEN_DRILL_FORM,
  KANIKASEN_DRILL_PREP,
  KANIKASEN_DRILL_STEPS,
  KANIKASEN_DRILL_TEACHER,
  KANIKASEN_DRILL_TOTAL_MIN,
  KANIKASEN_JITSUGI,
} from "./kanikasen";
import {
  KISOKOUJI_DRILL_FORM,
  KISOKOUJI_DRILL_PREP,
  KISOKOUJI_DRILL_STEPS,
  KISOKOUJI_DRILL_TEACHER,
  KISOKOUJI_DRILL_TOTAL_MIN,
  KISOKOUJI_JITSUGI,
} from "./kisokouji";
import {
  KAITAI_DRILL_FORM,
  KAITAI_DRILL_PREP,
  KAITAI_DRILL_STEPS,
  KAITAI_DRILL_TEACHER,
  KAITAI_DRILL_TOTAL_MIN,
  KAITAI_JITSUGI,
} from "./kaitai";
import {
  KISOKENKI_DRILL_FORM,
  KISOKENKI_DRILL_PREP,
  KISOKENKI_DRILL_STEPS,
  KISOKENKI_DRILL_TEACHER,
  KISOKENKI_DRILL_TOTAL_MIN,
  KISOKENKI_JITSUGI,
} from "./kisokenki";
import {
  KISOSOUSA_DRILL_FORM,
  KISOSOUSA_DRILL_PREP,
  KISOSOUSA_DRILL_STEPS,
  KISOSOUSA_DRILL_TEACHER,
  KISOSOUSA_DRILL_TOTAL_MIN,
  KISOSOUSA_JITSUGI,
} from "./kisosousa";
import {
  CONCRETE_DRILL_FORM,
  CONCRETE_DRILL_PREP,
  CONCRETE_DRILL_STEPS,
  CONCRETE_DRILL_TEACHER,
  CONCRETE_DRILL_TOTAL_MIN,
  CONCRETE_JITSUGI,
} from "./concrete";
import {
  BORING_DRILL_FORM,
  BORING_DRILL_PREP,
  BORING_DRILL_STEPS,
  BORING_DRILL_TEACHER,
  BORING_DRILL_TOTAL_MIN,
  BORING_JITSUGI,
} from "./boring";
import {
  JACK_DRILL_FORM,
  JACK_DRILL_PREP,
  JACK_DRILL_STEPS,
  JACK_DRILL_TEACHER,
  JACK_DRILL_TOTAL_MIN,
  JACK_JITSUGI,
} from "./jack";
import {
  KIDOU_DRILL_FORM,
  KIDOU_DRILL_PREP,
  KIDOU_DRILL_STEPS,
  KIDOU_DRILL_TEACHER,
  KIDOU_DRILL_TOTAL_MIN,
  KIDOU_JITSUGI,
} from "./kidou";
import {
  ROBOTKYOJI_DRILL_FORM,
  ROBOTKYOJI_DRILL_PREP,
  ROBOTKYOJI_DRILL_STEPS,
  ROBOTKYOJI_DRILL_TEACHER,
  ROBOTKYOJI_DRILL_TOTAL_MIN,
  ROBOTKYOJI_JITSUGI,
} from "./robotkyoji";
import {
  ROBOTKENSA_DRILL_FORM,
  ROBOTKENSA_DRILL_PREP,
  ROBOTKENSA_DRILL_STEPS,
  ROBOTKENSA_DRILL_TEACHER,
  ROBOTKENSA_DRILL_TOTAL_MIN,
  ROBOTKENSA_JITSUGI,
} from "./robotkensa";
import {
  TIRE_DRILL_FORM,
  TIRE_DRILL_PREP,
  TIRE_DRILL_STEPS,
  TIRE_DRILL_TEACHER,
  TIRE_DRILL_TOTAL_MIN,
  TIRE_JITSUGI,
} from "./tire";
import {
  TOKUSHU_DRILL_FORM,
  TOKUSHU_DRILL_PREP,
  TOKUSHU_DRILL_STEPS,
  TOKUSHU_DRILL_TEACHER,
  TOKUSHU_DRILL_TOTAL_MIN,
  TOKUSHU_JITSUGI,
} from "./tokushu";
import {
  TAMAKAKE_DRILL_FORM,
  TAMAKAKE_DRILL_PREP,
  TAMAKAKE_DRILL_STEPS,
  TAMAKAKE_DRILL_TEACHER,
  TAMAKAKE_DRILL_TOTAL_MIN,
  TAMAKAKE_JITSUGI,
} from "./tamakake";
import {
  DERRICK_DRILL_FORM,
  DERRICK_DRILL_PREP,
  DERRICK_DRILL_STEPS,
  DERRICK_DRILL_TEACHER,
  DERRICK_DRILL_TOTAL_MIN,
  DERRICK_JITSUGI,
} from "./derrick";
import {
  LIFT_DRILL_FORM,
  LIFT_DRILL_PREP,
  LIFT_DRILL_STEPS,
  LIFT_DRILL_TEACHER,
  LIFT_DRILL_TOTAL_MIN,
  LIFT_JITSUGI,
} from "./kensetsulift";
import {
  MOBILECRANE_DRILL_FORM,
  MOBILECRANE_DRILL_PREP,
  MOBILECRANE_DRILL_STEPS,
  MOBILECRANE_DRILL_TEACHER,
  MOBILECRANE_DRILL_TOTAL_MIN,
  MOBILECRANE_JITSUGI,
} from "./mobilecrane";
import {
  CRANE_DRILL_FORM,
  CRANE_DRILL_PREP,
  CRANE_DRILL_STEPS,
  CRANE_DRILL_TEACHER,
  CRANE_DRILL_TOTAL_MIN,
  CRANE_JITSUGI,
} from "./crane";
import {
  SOUKOU_DRILL_FORM,
  SOUKOU_DRILL_PREP,
  SOUKOU_DRILL_STEPS,
  SOUKOU_DRILL_TEACHER,
  SOUKOU_DRILL_TOTAL_MIN,
  SOUKOU_JITSUGI,
} from "./soukou";
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
  /** 実施記録の「参加者」の列。書かなければ 氏名・生年月日・署名。
      **その講座でしか要らない列があるときだけ書く。**
      たとえばチェーンソーは、一人あたりの伐倒本数を残す */
  personCols?: string[];
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
  derrick: {
    courseId: "derrick",
    subject: DERRICK_JITSUGI.name,
    scope: DERRICK_JITSUGI.scope,
    legalMin: DERRICK_JITSUGI.legalMin,
    steps: DERRICK_DRILL_STEPS,
    totalMin: DERRICK_DRILL_TOTAL_MIN,
    teacher: DERRICK_DRILL_TEACHER,
    prep: DERRICK_DRILL_PREP,
    keepYears: 3,
    form: DERRICK_DRILL_FORM,
  },
  kensetsulift: {
    courseId: "kensetsulift",
    subject: LIFT_JITSUGI.name,
    scope: LIFT_JITSUGI.scope,
    legalMin: LIFT_JITSUGI.legalMin,
    steps: LIFT_DRILL_STEPS,
    totalMin: LIFT_DRILL_TOTAL_MIN,
    teacher: LIFT_DRILL_TEACHER,
    prep: LIFT_DRILL_PREP,
    keepYears: 3,
    form: LIFT_DRILL_FORM,
  },
  mobilecrane: {
    courseId: "mobilecrane",
    subject: MOBILECRANE_JITSUGI.name,
    scope: MOBILECRANE_JITSUGI.scope,
    legalMin: MOBILECRANE_JITSUGI.legalMin,
    steps: MOBILECRANE_DRILL_STEPS,
    totalMin: MOBILECRANE_DRILL_TOTAL_MIN,
    teacher: MOBILECRANE_DRILL_TEACHER,
    prep: MOBILECRANE_DRILL_PREP,
    keepYears: 3,
    form: MOBILECRANE_DRILL_FORM,
  },
  crane: {
    courseId: "crane",
    subject: CRANE_JITSUGI.name,
    scope: CRANE_JITSUGI.scope,
    legalMin: CRANE_JITSUGI.legalMin,
    steps: CRANE_DRILL_STEPS,
    totalMin: CRANE_DRILL_TOTAL_MIN,
    teacher: CRANE_DRILL_TEACHER,
    prep: CRANE_DRILL_PREP,
    keepYears: 3,
    form: CRANE_DRILL_FORM,
  },
  tamakake: {
    courseId: "tamakake",
    subject: TAMAKAKE_JITSUGI.name,
    scope: TAMAKAKE_JITSUGI.scope,
    legalMin: TAMAKAKE_JITSUGI.legalMin,
    steps: TAMAKAKE_DRILL_STEPS,
    totalMin: TAMAKAKE_DRILL_TOTAL_MIN,
    teacher: TAMAKAKE_DRILL_TEACHER,
    prep: TAMAKAKE_DRILL_PREP,
    keepYears: 3,
    form: TAMAKAKE_DRILL_FORM,
  },
  tokushu: {
    courseId: "tokushu",
    subject: TOKUSHU_JITSUGI.name,
    scope: TOKUSHU_JITSUGI.scope,
    legalMin: TOKUSHU_JITSUGI.legalMin,
    steps: TOKUSHU_DRILL_STEPS,
    totalMin: TOKUSHU_DRILL_TOTAL_MIN,
    teacher: TOKUSHU_DRILL_TEACHER,
    prep: TOKUSHU_DRILL_PREP,
    keepYears: 3,
    form: TOKUSHU_DRILL_FORM,
  },
  tire: {
    courseId: "tire",
    subject: TIRE_JITSUGI.name,
    scope: TIRE_JITSUGI.scope,
    legalMin: TIRE_JITSUGI.legalMin,
    steps: TIRE_DRILL_STEPS,
    totalMin: TIRE_DRILL_TOTAL_MIN,
    teacher: TIRE_DRILL_TEACHER,
    prep: TIRE_DRILL_PREP,
    keepYears: 3,
    form: TIRE_DRILL_FORM,
  },
  robotkensa: {
    courseId: "robotkensa",
    subject: ROBOTKENSA_JITSUGI.name,
    scope: ROBOTKENSA_JITSUGI.scope,
    legalMin: ROBOTKENSA_JITSUGI.legalMin,
    steps: ROBOTKENSA_DRILL_STEPS,
    totalMin: ROBOTKENSA_DRILL_TOTAL_MIN,
    teacher: ROBOTKENSA_DRILL_TEACHER,
    prep: ROBOTKENSA_DRILL_PREP,
    keepYears: 3,
    form: ROBOTKENSA_DRILL_FORM,
  },
  robotkyoji: {
    courseId: "robotkyoji",
    subject: ROBOTKYOJI_JITSUGI.name,
    scope: ROBOTKYOJI_JITSUGI.scope,
    legalMin: ROBOTKYOJI_JITSUGI.legalMin,
    steps: ROBOTKYOJI_DRILL_STEPS,
    totalMin: ROBOTKYOJI_DRILL_TOTAL_MIN,
    teacher: ROBOTKYOJI_DRILL_TEACHER,
    prep: ROBOTKYOJI_DRILL_PREP,
    keepYears: 3,
    form: ROBOTKYOJI_DRILL_FORM,
  },
  kidou: {
    courseId: "kidou",
    subject: KIDOU_JITSUGI.name,
    scope: KIDOU_JITSUGI.scope,
    legalMin: KIDOU_JITSUGI.legalMin,
    steps: KIDOU_DRILL_STEPS,
    totalMin: KIDOU_DRILL_TOTAL_MIN,
    teacher: KIDOU_DRILL_TEACHER,
    prep: KIDOU_DRILL_PREP,
    keepYears: 3,
    form: KIDOU_DRILL_FORM,
  },
  jack: {
    courseId: "jack",
    subject: JACK_JITSUGI.name,
    scope: JACK_JITSUGI.scope,
    legalMin: JACK_JITSUGI.legalMin,
    steps: JACK_DRILL_STEPS,
    totalMin: JACK_DRILL_TOTAL_MIN,
    teacher: JACK_DRILL_TEACHER,
    prep: JACK_DRILL_PREP,
    keepYears: 3,
    form: JACK_DRILL_FORM,
  },
  boring: {
    courseId: "boring",
    subject: BORING_JITSUGI.name,
    scope: BORING_JITSUGI.scope,
    legalMin: BORING_JITSUGI.legalMin,
    steps: BORING_DRILL_STEPS,
    totalMin: BORING_DRILL_TOTAL_MIN,
    teacher: BORING_DRILL_TEACHER,
    prep: BORING_DRILL_PREP,
    keepYears: 3,
    form: BORING_DRILL_FORM,
  },
  concrete: {
    courseId: "concrete",
    subject: CONCRETE_JITSUGI.name,
    scope: CONCRETE_JITSUGI.scope,
    legalMin: CONCRETE_JITSUGI.legalMin,
    steps: CONCRETE_DRILL_STEPS,
    totalMin: CONCRETE_DRILL_TOTAL_MIN,
    teacher: CONCRETE_DRILL_TEACHER,
    prep: CONCRETE_DRILL_PREP,
    keepYears: 3,
    form: CONCRETE_DRILL_FORM,
  },
  kisosousa: {
    courseId: "kisosousa",
    subject: KISOSOUSA_JITSUGI.name,
    scope: KISOSOUSA_JITSUGI.scope,
    legalMin: KISOSOUSA_JITSUGI.legalMin,
    steps: KISOSOUSA_DRILL_STEPS,
    totalMin: KISOSOUSA_DRILL_TOTAL_MIN,
    teacher: KISOSOUSA_DRILL_TEACHER,
    prep: KISOSOUSA_DRILL_PREP,
    keepYears: 3,
    form: KISOSOUSA_DRILL_FORM,
  },
  kisokenki: {
    courseId: "kisokenki",
    subject: KISOKENKI_JITSUGI.name,
    scope: KISOKENKI_JITSUGI.scope,
    legalMin: KISOKENKI_JITSUGI.legalMin,
    steps: KISOKENKI_DRILL_STEPS,
    totalMin: KISOKENKI_DRILL_TOTAL_MIN,
    teacher: KISOKENKI_DRILL_TEACHER,
    prep: KISOKENKI_DRILL_PREP,
    keepYears: 3,
    form: KISOKENKI_DRILL_FORM,
  },
  kaitai: {
    courseId: "kaitai",
    subject: KAITAI_JITSUGI.name,
    scope: KAITAI_JITSUGI.scope,
    legalMin: KAITAI_JITSUGI.legalMin,
    steps: KAITAI_DRILL_STEPS,
    totalMin: KAITAI_DRILL_TOTAL_MIN,
    teacher: KAITAI_DRILL_TEACHER,
    prep: KAITAI_DRILL_PREP,
    keepYears: 3,
    form: KAITAI_DRILL_FORM,
  },
  kisokouji: {
    courseId: "kisokouji",
    subject: KISOKOUJI_JITSUGI.name,
    scope: KISOKOUJI_JITSUGI.scope,
    legalMin: KISOKOUJI_JITSUGI.legalMin,
    steps: KISOKOUJI_DRILL_STEPS,
    totalMin: KISOKOUJI_DRILL_TOTAL_MIN,
    teacher: KISOKOUJI_DRILL_TEACHER,
    prep: KISOKOUJI_DRILL_PREP,
    keepYears: 3,
    form: KISOKOUJI_DRILL_FORM,
  },
  kanikasen: {
    courseId: "kanikasen",
    subject: KANIKASEN_JITSUGI.name,
    scope: KANIKASEN_JITSUGI.scope,
    legalMin: KANIKASEN_JITSUGI.legalMin,
    steps: KANIKASEN_DRILL_STEPS,
    totalMin: KANIKASEN_DRILL_TOTAL_MIN,
    teacher: KANIKASEN_DRILL_TEACHER,
    prep: KANIKASEN_DRILL_PREP,
    keepYears: 3,
    form: KANIKASEN_DRILL_FORM,
  },
  kikaishuzai: {
    courseId: "kikaishuzai",
    subject: KIKAISHUZAI_JITSUGI.name,
    scope: KIKAISHUZAI_JITSUGI.scope,
    legalMin: KIKAISHUZAI_JITSUGI.legalMin,
    steps: KIKAISHUZAI_DRILL_STEPS,
    totalMin: KIKAISHUZAI_DRILL_TOTAL_MIN,
    teacher: KIKAISHUZAI_DRILL_TEACHER,
    prep: KIKAISHUZAI_DRILL_PREP,
    keepYears: 3,
    form: KIKAISHUZAI_DRILL_FORM,
  },
  soukou: {
    courseId: "soukou",
    subject: SOUKOU_JITSUGI.name,
    scope: SOUKOU_JITSUGI.scope,
    legalMin: SOUKOU_JITSUGI.legalMin,
    steps: SOUKOU_DRILL_STEPS,
    totalMin: SOUKOU_DRILL_TOTAL_MIN,
    teacher: SOUKOU_DRILL_TEACHER,
    prep: SOUKOU_DRILL_PREP,
    keepYears: 3,
    form: SOUKOU_DRILL_FORM,
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
    /* **一人あたり何本伐ったかを、参加者の行に残す。**
       この講座だけ、受講者の欄に伐倒本数が入っていた */
    personCols: ["氏名", "生年月日", "伐倒本数", "署名"],
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
