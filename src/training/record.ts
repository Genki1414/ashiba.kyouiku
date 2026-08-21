/* 章を通したときの記録。
   点数だけでなく「言われたこと」も残す。ここが間違いノートの元になる。

   画面から切り離してあるので、ここだけで試験できる。
   端末への読み書きは src/lib/trainingRecord.ts。 */

import { isPass, rankOf, type Err, type Score } from "./score";
import { chapterOf, type ChapterId } from "./chapters";

/** 1回ぶんの記録 */
export type Attempt = {
  /** 通し終えた日時（ISO） */
  at: string;
  /** チュートリアルか本番か */
  tutorial: boolean;
  /** 手摺先行工法で組んだか（第1章だけ） */
  sk: boolean;
  skill: number;
  score: number;
  best: number;
  sec: number;
  hints: number;
  asks: number;
  errs: Err[];
};

/** 章ごとの記録。新しいものが先頭 */
export type Record_ = Partial<Record<ChapterId, Attempt[]>>;

/** 1つの章で残す回数。端末を埋めないように上限を決めておく */
export const KEEP = 20;

/** 通し終えた成績から、記録する1件を作る */
export function toAttempt(
  r: Score,
  opt: { at: string; tutorial: boolean; sk?: boolean },
): Attempt {
  return {
    at: opt.at,
    tutorial: opt.tutorial,
    sk: !!opt.sk,
    skill: r.skill,
    score: r.score,
    best: r.best,
    sec: r.sec,
    hints: r.hints,
    asks: r.asks,
    errs: r.errs,
  };
}

/** 記録を足す。新しいものが先頭で、上限を超えたら古いものから捨てる */
export function addAttempt(rec: Record_, ch: ChapterId, a: Attempt): Record_ {
  const list = [a, ...(rec[ch] ?? [])].slice(0, KEEP);
  return { ...rec, [ch]: list };
}

/** その章の最後の1回 */
export const lastOf = (rec: Record_, ch: ChapterId): Attempt | null =>
  rec[ch]?.[0] ?? null;

/** その章のいちばん良い技能点 */
export const bestOf = (rec: Record_, ch: ChapterId): Attempt | null => {
  const list = rec[ch];
  if (!list?.length) return null;
  return list.reduce((a, b) => (b.skill > a.skill ? b : a));
};

/** その章を何回通したか */
export const countOf = (rec: Record_, ch: ChapterId): number => rec[ch]?.length ?? 0;

/** 合格した章の数 */
export const passedCount = (rec: Record_): number =>
  (Object.keys(rec) as ChapterId[]).filter((ch) => {
    const b = bestOf(rec, ch);
    return !!b && isPass(b.skill);
  }).length;

/** 段位の表示（章でCの呼び方が違う） */
export function rankLabel(ch: ChapterId, skill: number): { r: string; t: string } {
  const low = chapterOf(ch)?.lowText ?? "まだ任せられん";
  return rankOf(skill, low);
}

/* ══════════════════════════════════════════
   間違いノート
   章をまたいで「言われたこと」をまとめる
   ══════════════════════════════════════════ */

export type NoteItem = Err & {
  ch: ChapterId;
  /** 言われた回数 */
  n: number;
  /** 最後に言われた日時 */
  last: string;
};

/**
 * 言われたことを、章 × 分類 × 中身 でまとめる。
 * 中身まで見るのは、同じ分類でも「なぜ駄目か」が違うことがあるため。
 * 多く言われたものが先に来る。同じ回数なら新しい方が先。
 */
export function noteItems(rec: Record_): NoteItem[] {
  const out: NoteItem[] = [];
  for (const ch of Object.keys(rec) as ChapterId[]) {
    for (const a of rec[ch] ?? []) {
      for (const e of a.errs) {
        const f = out.find(
          (v) => v.ch === ch && v.tag === e.tag && v.message === e.message,
        );
        if (f) {
          f.n++;
          if (a.at > f.last) f.last = a.at;
        } else {
          out.push({ ...e, ch, n: 1, last: a.at });
        }
      }
    }
  }
  return out.sort((x, y) => (y.n === x.n ? (y.last > x.last ? 1 : -1) : y.n - x.n));
}

/** 章ごとの、言われた回数の合計 */
export function noteCountOf(rec: Record_, ch: ChapterId): number {
  return (rec[ch] ?? []).reduce((s, a) => s + a.errs.length, 0);
}

/** 直近の1回で言われなかった＝直せたもの */
export function fixedItems(rec: Record_): NoteItem[] {
  const all = noteItems(rec);
  return all.filter((it) => {
    const last = lastOf(rec, it.ch);
    if (!last) return false;
    /* 最後の1回で同じことを言われていなければ、直せたとみなす */
    return !last.errs.some((e) => e.tag === it.tag && e.message === it.message);
  });
}
