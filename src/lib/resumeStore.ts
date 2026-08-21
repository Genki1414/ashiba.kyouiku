"use client";

/* 続きを端末に置く。章ごとに1つだけ持つ。 */

import { FMT, usable, type Saved } from "@/training/resume";
import type { ChapterId } from "@/training/chapters";
import type { Score } from "@/training/score";

const key = (ch: ChapterId) => `ashiba.resume.${ch}`;

export function readSaved<S>(ch: ChapterId): Saved<S> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(ch));
    if (!raw) return null;
    return JSON.parse(raw) as Saved<S>;
  } catch {
    /* 壊れていたら無かったことにする */
    return null;
  }
}

export function writeSaved<S>(
  ch: ChapterId,
  v: { s: S; score: Score; tutorial: boolean; sk?: boolean; tool?: string; msg?: string; scene?: unknown },
) {
  try {
    const saved: Saved<S> = {
      fmt: FMT,
      ch,
      at: new Date().toISOString(),
      tutorial: v.tutorial,
      sk: !!v.sk,
      s: v.s,
      score: v.score,
      tool: v.tool,
      msg: v.msg,
      scene: v.scene,
    };
    window.localStorage.setItem(key(ch), JSON.stringify(saved));
  } catch {
    /* 入らない端末でも、その回は続けられる */
  }
}

export function clearSaved(ch: ChapterId) {
  try {
    window.localStorage.removeItem(key(ch));
  } catch {
    /* 消せなくても進む */
  }
}

/** いま開いた章と同じやり方の続きがあれば返す */
export function pickSaved<S>(
  ch: ChapterId,
  want: { tutorial: boolean; sk: boolean },
): Saved<S> | null {
  const v = readSaved<S>(ch);
  return usable(v, { ch, ...want }) ? v : null;
}
