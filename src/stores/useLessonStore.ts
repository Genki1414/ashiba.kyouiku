"use client";
import { create } from "zustand";
import type { ProgressMode } from "@/lib/progressClient";

/* 受講中の状態。段（stage）、行、視聴秒、同期待ちの秒数。
   1単元ぶんの状態なので、単元を開くたびに reset する。 */

export type Stage = "narr" | "fig" | "case" | "quiz";

type LessonState = {
  lessonId: string | null;
  stage: Stage;
  line: number;        // ナレーションの現在行
  playing: boolean;    // ナレーション再生中か
  fi: number;          // 図解の何枚目か
  ci: number;          // 事例の何件目か
  mode: ProgressMode;  // supabase（サーバ記録）/ local（端末内・開発用）
  watchedSec: number;  // 表示用の累計（サーバ確定値＋未同期ぶん）
  pendingSec: number;  // まだサーバへ送っていない再生秒数
  quizPassedAt: string | null;
  reset: (lessonId: string) => void;
  set: (p: Partial<LessonState>) => void;
  tick: () => void;
  flushed: (serverTotal: number, sent: number, mode: ProgressMode) => void;
};

export const useLessonStore = create<LessonState>((set) => ({
  lessonId: null,
  stage: "narr",
  line: 0,
  playing: false,
  fi: 0,
  ci: 0,
  mode: "local",
  watchedSec: 0,
  pendingSec: 0,
  quizPassedAt: null,
  reset: (lessonId) =>
    set({
      lessonId,
      stage: "narr",
      line: 0,
      playing: false,
      fi: 0,
      ci: 0,
      watchedSec: 0,
      pendingSec: 0,
      quizPassedAt: null,
    }),
  set: (p) => set(p),
  tick: () => set((s) => ({ watchedSec: s.watchedSec + 1, pendingSec: s.pendingSec + 1 })),
  flushed: (serverTotal, sent, mode) =>
    set((s) => {
      const pending = Math.max(0, s.pendingSec - sent);
      return { mode, pendingSec: pending, watchedSec: serverTotal + pending };
    }),
}));
