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
};

const GUIDES: Record<string, DrillGuide> = {
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
  },
};

/** その講座の実技の手引き。実技の無い講座は null */
export const drillGuideOf = (courseId: string): DrillGuide | null => GUIDES[courseId] ?? null;

/** 手引きのある講座の id */
export const DRILL_GUIDE_IDS = Object.keys(GUIDES);
