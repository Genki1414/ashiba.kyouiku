/* 小型車両系建設機械（整地・運搬・積込み用及び掘削用）の運転の業務の特別教育。

   **まだ作りかけ。公開していない**（courses.ts に無い。目録の行は building）。

   合計は確かめた：学科7時間＋実技6時間（規程第11条）。
   **科目ごとの時間は、まだ確かめられていない。**
   下の割り振り（走行装置3／作業装置2／一般的事項1／関係法令1、実技 走行4／作業装置2）は
   記憶と、車両系建設機械の技能講習の作りから置いたもの。
   高所作業車のとき「装置1時間・原動機3時間」と逆に思い込んでいたのと同じ危険がある。
   **規程第11条の表を見るまで、単元を書かない。** docs/29。

   ここは何にも依存しない。単体で持ち出せるようにしてある。 */

export type KogataSubject = {
  id: number;
  name: string;
  scope: string[];
  legalMin: number;
};

/** ★未確認。規程第11条の表で突き合わせるまで使わない */
export const KOGATA_SUBJECTS_DRAFT: KogataSubject[] = [
  { id: 1, name: "走行に関する装置の構造及び取扱いの方法に関する知識",
    scope: ["走行に関する装置の構造及び取扱いの方法"], legalMin: 180 },
  { id: 2, name: "作業に関する装置の構造、取扱い及び作業方法に関する知識",
    scope: ["作業に関する装置の構造、取扱い及び作業方法"], legalMin: 120 },
  { id: 3, name: "運転に必要な一般的事項に関する知識",
    scope: ["運転に必要な一般的事項"], legalMin: 60 },
  { id: 4, name: "関係法令", scope: ["法、令及び安衛則中の関係条項"], legalMin: 60 },
];

/** ★未確認 */
export const KOGATA_JITSUGI_DRAFT = {
  scope: ["走行の操作", "作業のための装置の操作"],
  scopeMin: [240, 120] as const,
  legalMin: 360,
};

/** 合計は確かめた（学科7時間） */
export const KOGATA_TOTAL_MIN = 420;
export const KOGATA_NAME = "小型車両系建設機械（整地・運搬・積込み用及び掘削用）の運転の業務に係る特別教育";
export const KOGATA_BASIS =
  "労働安全衛生法第59条第3項／労働安全衛生規則第36条第9号／安全衛生特別教育規程第11条";
