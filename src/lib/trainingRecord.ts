"use client";

/* 実務トレーニングの記録を端末に置く。
   いまはログインが無く、誰がやっているか分からないので端末内だけ。
   ログインを入れたら、ここから Supabase へ送るようにする。 */

import {
  addAttempt,
  toAttempt,
  type Attempt,
  type Record_,
} from "@/training/record";
import type { ChapterId } from "@/training/chapters";
import type { Score } from "@/training/score";

const KEY = "ashiba.training";

export function readRecord(): Record_ {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const v = JSON.parse(raw) as Record_;
    return v && typeof v === "object" ? v : {};
  } catch {
    /* 壊れていたら無かったことにする。記録より先に進めることを優先する */
    return {};
  }
}

function write(rec: Record_) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* 入らない端末でも、その回の表示は続ける */
  }
}

/** 章を通し終えたときに1件残す。同じ結果を二度書かないよう、呼び出し側で一度だけ呼ぶ */
export function saveAttempt(
  ch: ChapterId,
  r: Score,
  opt: { tutorial: boolean; sk?: boolean; at?: string },
): Attempt {
  const a = toAttempt(r, { at: opt.at ?? new Date().toISOString(), tutorial: opt.tutorial, sk: opt.sk });
  write(addAttempt(readRecord(), ch, a));
  return a;
}

/** 記録を消す */
export function clearRecord() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* 消せなくても画面は進む */
  }
}
