"use client";

/* 視聴記録のクライアント側。
   サーバ（Supabase）が使えるときはサーバの値を正とし、
   未設定のあいだは端末内（localStorage）に「開発用」として置く。
   どちらのモードかは /api/progress の応答で決まる。 */

export type ProgressMode = "supabase" | "local";

export type ProgressState = {
  mode: ProgressMode;
  watchedSec: number;
  quizPassedAt: string | null;
};

/* 端末内の控え。講座ごとに分ける（別の講座の 1-1 と混ざらないように） */
const KEY = (courseId: string, lessonId: string) => `ashiba.progress.${courseId}.${lessonId}`;

function readLocal(courseId: string, lessonId: string): { watchedSec: number; quizPassedAt: string | null } {
  try {
    const raw = localStorage.getItem(KEY(courseId, lessonId));
    if (!raw) return { watchedSec: 0, quizPassedAt: null };
    const v = JSON.parse(raw);
    return {
      watchedSec: Number.isFinite(v.watchedSec) ? v.watchedSec : 0,
      quizPassedAt: typeof v.quizPassedAt === "string" ? v.quizPassedAt : null,
    };
  } catch {
    return { watchedSec: 0, quizPassedAt: null };
  }
}

function writeLocal(courseId: string, lessonId: string, v: { watchedSec: number; quizPassedAt: string | null }) {
  try {
    localStorage.setItem(KEY(courseId, lessonId), JSON.stringify(v));
  } catch {
    /* プライベートモード等。表示中の値は保てるので黙って続ける */
  }
}

export async function loadProgress(courseId: string, lessonId: string): Promise<ProgressState> {
  try {
    const res = await fetch(`/api/progress?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`);
    const j = await res.json();
    if (res.ok && j.mode === "supabase") {
      return { mode: "supabase", watchedSec: j.watchedSec, quizPassedAt: j.quizPassedAt };
    }
  } catch {
    /* 通信不可はローカル扱い */
  }
  return { mode: "local", ...readLocal(courseId, lessonId) };
}

/** 前回同期からの再生秒数を送る。戻り値はサーバ確定の累計（local は端末内の累計） */
export async function syncDelta(
  courseId: string,
  lessonId: string,
  deltaSec: number,
  localTotal: number,
): Promise<{ mode: ProgressMode; watchedSec: number }> {
  if (deltaSec > 0) {
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId, deltaSec }),
      });
      const j = await res.json();
      if (res.ok && j.mode === "supabase") {
        return { mode: "supabase", watchedSec: j.watchedSec };
      }
    } catch {
      /* 落ちたら local へ */
    }
  }
  const cur = readLocal(courseId, lessonId);
  const next = { ...cur, watchedSec: Math.max(cur.watchedSec, localTotal) };
  writeLocal(courseId, lessonId, next);
  return { mode: "local", watchedSec: next.watchedSec };
}

export async function markQuizPassed(
  courseId: string,
  lessonId: string,
  needSec: number,
  localWatchedSec: number,
): Promise<{ ok: boolean; quizPassedAt: string | null; error?: string }> {
  try {
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, lessonId }),
    });
    const j = await res.json();
    if (res.ok && j.mode === "supabase") return { ok: true, quizPassedAt: j.quizPassedAt };
    if (res.status === 409) return { ok: false, quizPassedAt: null, error: j.error };
  } catch {
    /* 通信不可はローカル判定 */
  }
  // ローカルモード：規定時間の判定を端末内の値で行う（開発用）
  if (localWatchedSec < needSec) {
    return { ok: false, quizPassedAt: null, error: "規定時間に達していません" };
  }
  const at = new Date().toISOString();
  const cur = readLocal(courseId, lessonId);
  writeLocal(courseId, lessonId, { ...cur, quizPassedAt: cur.quizPassedAt ?? at });
  return { ok: true, quizPassedAt: cur.quizPassedAt ?? at };
}

/** 一覧画面用：全単元のローカル記録をまとめて読む */
export function readAllLocal(
  courseId: string,
  lessonIds: string[],
): Record<string, { watchedSec: number; quizPassedAt: string | null }> {
  const out: Record<string, { watchedSec: number; quizPassedAt: string | null }> = {};
  for (const id of lessonIds) out[id] = readLocal(courseId, id);
  return out;
}
