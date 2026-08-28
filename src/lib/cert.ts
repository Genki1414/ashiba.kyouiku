/* 修了証の決まり。画面から切り離してあるので、ここだけで試験できる。 */

/** 修了証を出せるか。学科の全単元に合格し、修了試験にも受かっていること */
export type Requirement = {
  /** 単元の総数 */
  lessons: number;
  /** 確認問題に合格した単元の数 */
  lessonsPassed: number;
  /** 修了試験に合格しているか */
  examPassed: boolean;
};

export type Eligibility =
  | { ok: true }
  | { ok: false; reason: string };

export function eligible(r: Requirement): Eligibility {
  if (r.lessons <= 0) return { ok: false, reason: "教材が読み込めていません。" };
  const left = r.lessons - r.lessonsPassed;
  if (left > 0) {
    return { ok: false, reason: `確認問題が残り${left}単元あります。全部に合格してください。` };
  }
  if (!r.examPassed) {
    return { ok: false, reason: "修了試験にまだ合格していません。" };
  }
  return { ok: true };
}

/* ── 証明番号 ──────────────────────────────
   AT-西暦月-通し番号。番号はデータベースで採る（0008 の next_cert_no）。

   もとは受講IDから4桁を作っていたが、この仕組みは外販するので
   受講の数がひと月で1万を超えると必ずぶつかる。ぶつかると
   cert_no の一意制約に当たって、修了証が発行できなくなる。
   採番をデータベースに任せて、ぶつからないようにした。

   古い4桁の番号も照会できるように、桁は幅を持たせてある。 */

/** 証明番号の形が合っているか（照会の入り口で見る） */
export const CERT_NO_RE = /^AT-\d{6}-\d{4,8}$/;
export const isCertNo = (s: string): boolean => CERT_NO_RE.test(s.trim().toUpperCase());

/** 修了証に載る中身 */
export type CertData = {
  /** どの教育か。表題に出る。講座は増えていくので、決め打ちにしない */
  courseName: string;
  /* 表題・根拠・結びの文は、講座から出す。
     決め打ちにしていたので、職長教育（安衛法60条）を足したときに
     「59条3項に基づく特別教育を修了した」という嘘の紙が出るところだった。
     号の違う特別教育を足したときも同じことが起きる */
  /** 表題（例「特 別 教 育 修 了 証」） */
  certTitle: string;
  /** 結びの文（例「特別教育を修了したことを証する。」） */
  certLine: string;
  /** 法令の根拠（courses.ts の basis） */
  courseBasis: string;
  name: string;
  birth: string;
  /** 修了日（画面に出す形） */
  date: string;
  certNo: string;
  examScore: number;
  examTotal: number;
  /** 事業者名。決まっていなければ空にして、紙の上で書き入れてもらう */
  company: string;
  /** 教育実施責任者。同上 */
  responsible: string;
  /** 科目と時間 */
  subjects: { id: number; name: string; min: number }[];
};

/** 学科の合計時間（分）を「6時間（学科）」の形にする */
export function totalLabel(subjects: { min: number }[]): string {
  const min = subjects.reduce((s, x) => s + x.min, 0);
  const h = min / 60;
  const t = Number.isInteger(h) ? `${h}時間` : `${Math.floor(h)}時間${min % 60}分`;
  return `${t}（学科）`;
}
