/* 高圧室内業務の特別教育（目録42）。

   科目・範囲・時間は
   **高気圧業務特別教育規程（昭和47年労働省告示第129号）第6条**のまま。
   **告示の全文で、科目名・中欄・時間を一字ずつ確かめてある**（2026年9月5日・docs/71）。
   **学科7時間だけ。実技は無い。**
   根拠は**高気圧作業安全衛生規則（昭和47年労働省令第40号）第11条第1項第6号**。裏取りは docs/81。

   **高圧則第11条第1項の六つの業務のうち、この第6号だけ、
   バルブを回す側ではなく「中で働く人」の教育。**
   ほかの五つは、送る側・操作する側の持ち場（`compressor`／`soukiroom`／
   `kikoushitsu`／`soukisensui`／`saiatsushitsu`）。
   **この人は、圧のかかった作業室の中にいる。**

   **だから実技が無い。**回すバルブが無いから。
   そのかわり、**科目3「急激な圧力低下、火災等の防止に関すること。」に180分**——
   学科7時間のうち3時間が、ここに置かれている。

   **軸は三つ。**
   ・**急激な圧力低下＝異常出水。**圧が水を押さえている。抜ければ水が来る
   ・**火災。**気圧が高いと、ものはよく燃える。**逃げ場は気こう室しかない**
   ・**自分の体は自分で守れない。**加圧も減圧も、外の人が回している

   **関係法令の中欄が「労働基準法」から始まる。**
   高圧室内業務は**労働時間そのものが法で縛られている**から（docs/71）。

   ここは何にも依存しない。単体で持ち出せるようにしてある。 */

export type KouatsushitsuSubject = {
  id: number;
  name: string;
  /** 規程第6条の範囲（中欄） */
  scope: string[];
  legalMin: number;
};

export const KOUATSUSHITSU_SUBJECTS: KouatsushitsuSubject[] = [
  {
    id: 1,
    name: "圧気工法の知識に関すること。",
    scope: ["圧気工法の概要", "圧気工法による業務の危険性"],
    legalMin: 60,
  },
  {
    id: 2,
    name: "圧気工法に係る設備に関すること。",
    scope: ["送気設備の種類及び機能", "気閘室の機能", "通話装置の取扱い方法"],
    legalMin: 60,
  },
  {
    id: 3,
    name: "急激な圧力低下、火災等の防止に関すること。",
    scope: [
      "急激な圧力低下による異常出水等の防止方法",
      "火災等の防止方法",
      "事故発生時の措置",
      "保護具の使用方法",
    ],
    legalMin: 180,
  },
  {
    id: 4,
    name: "高気圧障害の知識に関すること。",
    scope: ["高気圧障害の病理、症状及び予防方法"],
    legalMin: 60,
  },
  {
    id: 5,
    name: "関係法令",
    scope: ["労働基準法、安衛法、施行令、安衛則及び高圧則中の関係条項"],
    legalMin: 60,
  },
];

/** 学科の合計（分）。7時間。**実技は無い** */
export const KOUATSUSHITSU_TOTAL_MIN = KOUATSUSHITSU_SUBJECTS.reduce((n, s) => n + s.legalMin, 0);

export const KOUATSUSHITSU_NAME = "高圧室内業務に係る特別教育";

export const KOUATSUSHITSU_BASIS =
  "労働安全衛生法第59条第3項／高気圧作業安全衛生規則第11条第1項第6号／高気圧業務特別教育規程第6条";

export type KouatsushitsuLesson = { id: string; title: string; scope: string; min: number };

const S1 = KOUATSUSHITSU_SUBJECTS[0].scope;
const S2 = KOUATSUSHITSU_SUBJECTS[1].scope;
const S3 = KOUATSUSHITSU_SUBJECTS[2].scope;
const S4 = KOUATSUSHITSU_SUBJECTS[3].scope;
const S5 = KOUATSUSHITSU_SUBJECTS[4].scope;

/* 単元の割り付け。中欄の項目に1つずつ当てる。
   科目1が2つ、2が3つ、3が4つ、4が1つ、5が1つ。**合わせて11単元。**

   **告示が科目3に180分を置いている。**学科7時間のうち3時間。
   中で働く人にとって、そこがいちばん死ぬところだということ。 */
export const KOUATSUSHITSU_LESSONS: Record<number, KouatsushitsuLesson[]> = {
  1: [
    { id: "1-1", title: "圧気工法の概要", scope: S1[0], min: 30 },
    { id: "1-2", title: "圧気工法による業務の危険性", scope: S1[1], min: 30 },
  ],
  2: [
    { id: "2-1", title: "送気設備の種類及び機能", scope: S2[0], min: 25 },
    { id: "2-2", title: "気閘室の機能", scope: S2[1], min: 20 },
    { id: "2-3", title: "通話装置の取扱い方法", scope: S2[2], min: 15 },
  ],
  3: [
    { id: "3-1", title: "急激な圧力低下による異常出水等の防止方法", scope: S3[0], min: 60 },
    { id: "3-2", title: "火災等の防止方法", scope: S3[1], min: 50 },
    { id: "3-3", title: "事故発生時の措置", scope: S3[2], min: 40 },
    { id: "3-4", title: "保護具の使用方法", scope: S3[3], min: 30 },
  ],
  4: [{ id: "4-1", title: "高気圧障害の病理、症状及び予防方法", scope: S4[0], min: 60 }],
  5: [{ id: "5-1", title: "関係法令", scope: S5[0], min: 60 }],
};

/* 例をどこから出すか（docs/19 ⑤）。**足場屋の例は入れない。** */
export const KOUATSUSHITSU_EXAMPLES =
  "シールドトンネル／ニューマチックケーソン（橋脚の基礎）／立坑／地下鉄／上下水道の管／共同溝／河川と港湾の構造物／地下の駐車場／電力の洞道／ガスの洞道";
