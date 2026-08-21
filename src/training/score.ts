/* 得点の決まり。プロトタイプ（handoff/ashiba-app-v16h.tsx / prototypes/ashiba-ch2-v6.tsx）と同じ。
   画面から切り離してあるので、ここだけで試験できる。 */

/** 親方に言われたこと。1件ずつ「何が」「なぜ駄目か」を持つ */
export type Err = { tag: string; message: string; why: string };

/** 章を終えたときの成績 */
export type Score = {
  skill: number;   // 技能点。100から引かれていく
  score: number;   // SCORE。良い手を打つほど増える
  best: number;    // 最大コンボ
  sec: number;     // かかった時間（秒）
  hints: number;   // 手順書を見た回数
  asks: number;    // 親方に聞いた回数
  errs: Err[];
};

/** 連続で正しく打つと倍率が上がる。3手ごとに1段、5倍まで */
export function multOf(combo: number): number {
  return Math.min(1 + Math.floor(combo / 3), 5);
}

/** 良い手ひとつぶんの点 */
export function gainOf(combo: number): number {
  return 100 * multOf(combo);
}

/** コンボの効果音を鳴らす手かどうか（3の倍数ちょうど） */
export function isComboBeat(nextCombo: number): boolean {
  return nextCombo >= 3 && nextCombo % 3 === 0;
}

export type Rank = { min: number; r: string; t: string };

/** 技能点の段位。第1章・第2章で最下位の呼び方だけ違う（プロトタイプどおり） */
export function ranksOf(lowText: string): Rank[] {
  return [
    { min: 100, r: "S", t: "一人前" },
    { min: 90, r: "A", t: "半人前の上" },
    { min: 75, r: "B", t: "見習い" },
    { min: 0, r: "C", t: lowText },
  ];
}

export function rankOf(skill: number, lowText: string): Rank {
  return ranksOf(lowText).find((x) => skill >= x.min)!;
}

/** 合格ライン。80点に届かなければ再受講 */
export const PASS = 80;

export function isPass(skill: number): boolean {
  return skill >= PASS;
}

/** 同じ指摘をまとめて回数を付ける。
    分類が同じでも中身が違えば別に出す。「なぜ駄目か」を潰さないため。 */
export function summarize(errs: Err[]): (Err & { n: number })[] {
  const u: (Err & { n: number })[] = [];
  for (const e of errs) {
    const f = u.find((v) => v.tag === e.tag && v.message === e.message);
    if (f) f.n++;
    else u.push({ ...e, n: 1 });
  }
  return u;
}

/** mm:ss */
export function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
