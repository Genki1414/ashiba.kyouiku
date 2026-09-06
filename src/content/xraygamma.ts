/* エックス線装置又はガンマ線照射装置を取り扱う業務の特別教育（目録47）。**装置の区分ごとに3本。**

   科目・範囲・時間は
   **エックス線装置及びガンマ線照射装置取扱業務特別教育規程**（昭和50年労働省告示。
   令和8年4月1日施行の改正後の題名と科目名）のまま。
   **告示の全文（画面写し）で、科目名・中欄・時間を一字ずつ確かめてある**（2026年9月6日・docs/83）。
   **学科だけ。実技は無い。**
   根拠は**電離放射線障害防止規則（昭和47年労働省令第41号）第52条の5第1項**。裏取りは docs/86。

   **科目2「構造及び取扱いの方法」が、装置で行が分かれている。**
   ・エックス線装置を取り扱う業務を行う者 …… 1時間30分
   ・ガンマ線照射装置を取り扱う業務を行う者 …… 1時間30分
   片方だけなら **270分**。両方を扱う人は両方の行を受けるので **360分**。

   | 区分 | 講座ID | 科目2 | 学科 |
   |---|---|---|---|
   | エックス線装置 | xrayki | エックス線装置の行 | 270 |
   | ガンマ線照射装置 | gammaki | ガンマ線照射装置の行 | 270 |
   | 両方 | xraygammaki | 両方の行 | 360 |

   **二つの装置で、いちばん違うところ。**
   ・**エックス線装置は、電源を切れば出ない。**
   ・**ガンマ線照射装置は、線源が入っている限り、出続ける。**切れない。
   この違いが、被ばく防止と事故時の措置の芯。

   **軸は三つ。**
   ・**出ている間に、近づかない。**照射中の立入り。線源が戻っていないことに気づかない
   ・**距離と遮へいと時間。**外部被ばくだけの仕事（ガンマ線の線源が漏れない限り）
   ・**事故時は、まず止める（切る・戻す）。戻らないなら、離れて、囲って、知らせる**

   ここは何にも依存しない。単体で持ち出せるようにしてある。 */

export type XgKubunId = "x" | "g" | "xg";

export type XgKubun = {
  id: XgKubunId;
  courseId: string;
  /** 区分の名前（目録の variants と同じ字） */
  kubun: string;
  short: string;
  hasX: boolean;
  hasG: boolean;
};

export const XG_KUBUN: Record<XgKubunId, XgKubun> = {
  x: { id: "x", courseId: "xrayki", kubun: "エックス線装置", short: "エックス線装置の取扱い", hasX: true, hasG: false },
  g: { id: "g", courseId: "gammaki", kubun: "ガンマ線照射装置", short: "ガンマ線照射装置の取扱い", hasX: false, hasG: true },
  xg: {
    id: "xg",
    courseId: "xraygammaki",
    kubun: "エックス線装置とガンマ線照射装置の両方",
    short: "エックス線装置とガンマ線照射装置の取扱い",
    hasX: true,
    hasG: true,
  },
};

export const XG_KUBUN_IDS: XgKubunId[] = ["x", "g", "xg"];

export const xgKubunOfCourse = (courseId: string): XgKubun | null =>
  XG_KUBUN_IDS.map((k) => XG_KUBUN[k]).find((v) => v.courseId === courseId) ?? null;

export type XgSubject = { id: number; name: string; scope: string[]; legalMin: number };

const S1 = ["作業の手順", "電離放射線の測定", "被ばく防止の方法", "事故時の措置"];
const S2X = [
  "エックス線装置の原理",
  "エックス線装置のエックス線管、高電圧発生器及び制御器の構造及び機能",
  "エックス線装置の操作及び点検",
];
const S2G = [
  "ガンマ線照射装置の種類及び型式",
  "線源容器の構造及び機能",
  "放射線源送出し装置又は放射線源の位置を調整する遠隔操作装置の構造及び機能",
  "放射線源の構造及び放射性物質の性質",
  "ガンマ線照射装置の操作及び点検",
];
const S3 = ["電離放射線の種類及び性質", "電離放射線が生体の細胞、組織、器官及び全身に与える影響"];
const S4 = "労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及び電離放射線障害防止規則中の関係条項";

export const xgSubjects = (v: XgKubun): XgSubject[] => [
  { id: 1, name: "エックス線装置又はガンマ線照射装置を取り扱う業務に係る作業の方法に関する知識", scope: S1, legalMin: 90 },
  {
    id: 2,
    name: "エックス線装置又はガンマ線照射装置の構造及び取扱いの方法に関する知識",
    scope: [...(v.hasX ? S2X : []), ...(v.hasG ? S2G : [])],
    legalMin: (v.hasX ? 90 : 0) + (v.hasG ? 90 : 0),
  },
  { id: 3, name: "電離放射線の生体に与える影響", scope: S3, legalMin: 30 },
  { id: 4, name: "関係法令", scope: [S4], legalMin: 60 },
];

export const xgTotalMin = (v: XgKubun): number => xgSubjects(v).reduce((n, s) => n + s.legalMin, 0);

export const xgName = (v: XgKubun): string =>
  `エックス線装置又はガンマ線照射装置を取り扱う業務（${v.kubun}）に係る特別教育`;

export const XG_BASIS =
  "労働安全衛生法第59条第3項／電離放射線障害防止規則第52条の5第1項／エックス線装置及びガンマ線照射装置取扱業務特別教育規程";

export type XgLesson = { id: string; title: string; scope: string; min: number };

/* 単元の割り付け。中欄の項目に1つずつ当てる。
   科目1が四、科目2が装置ごとに三と五、科目3が二、科目4が一。 */
export const xgLessons = (v: XgKubun): Record<number, XgLesson[]> => {
  const l2: XgLesson[] = [];
  let n = 0;
  if (v.hasX) {
    l2.push(
      { id: `2-${++n}`, title: "エックス線装置の原理", scope: S2X[0], min: 25 },
      { id: `2-${++n}`, title: "エックス線管、高電圧発生器及び制御器の構造及び機能", scope: S2X[1], min: 35 },
      { id: `2-${++n}`, title: "エックス線装置の操作及び点検", scope: S2X[2], min: 30 },
    );
  }
  if (v.hasG) {
    l2.push(
      { id: `2-${++n}`, title: "ガンマ線照射装置の種類及び型式", scope: S2G[0], min: 15 },
      { id: `2-${++n}`, title: "線源容器の構造及び機能", scope: S2G[1], min: 20 },
      { id: `2-${++n}`, title: "放射線源送出し装置又は遠隔操作装置の構造及び機能", scope: S2G[2], min: 20 },
      { id: `2-${++n}`, title: "放射線源の構造及び放射性物質の性質", scope: S2G[3], min: 15 },
      { id: `2-${++n}`, title: "ガンマ線照射装置の操作及び点検", scope: S2G[4], min: 20 },
    );
  }
  return {
    1: [
      { id: "1-1", title: "作業の手順", scope: S1[0], min: 30 },
      { id: "1-2", title: "電離放射線の測定", scope: S1[1], min: 20 },
      { id: "1-3", title: "被ばく防止の方法", scope: S1[2], min: 25 },
      { id: "1-4", title: "事故時の措置", scope: S1[3], min: 15 },
    ],
    2: l2,
    3: [
      { id: "3-1", title: "電離放射線の種類及び性質", scope: S3[0], min: 15 },
      { id: "3-2", title: "電離放射線が生体の細胞、組織、器官及び全身に与える影響", scope: S3[1], min: 15 },
    ],
    4: [{ id: "4-1", title: "関係法令", scope: S4, min: 60 }],
  };
};

/* 例をどこから出すか（docs/19 ⑤）。
   非破壊検査（溶接部の透過写真：橋、タンク、配管、船、プラント）、
   工場の検査装置、荷物の検査、厚さ計・水分計、研究と分析、医療機器の据付と保守。
   **足場屋の例は入れない。** */
export const XG_EXAMPLES =
  "溶接部の非破壊検査（橋・タンク・配管・船・プラント）／工場の検査装置／荷物の検査装置／厚さ計・水分計／研究と分析／医療機器の据付と保守／装置の輸送と保管";
