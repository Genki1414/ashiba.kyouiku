"use client";

/* 実務トレーニングの記録。

   端末に置くのが本体（間違いノートと章の一覧はこちらを見る。圏外でも動く）。
   あわせてサーバへも1行送る。教育担当者が誰の分か見られるようにするため。
   サーバが未設定・圏外のときは黙って端末だけで続ける。 */

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
  void sendAttempt(ch, a);
  return a;
}

/** サーバにも1行残す。失敗しても画面は止めない（記録より先へ進むことを優先する） */
async function sendAttempt(ch: ChapterId, a: Attempt) {
  try {
    await fetch("/api/training", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chapter: ch,
        tutorial: a.tutorial,
        sk: a.sk,
        skill: a.skill,
        score: a.score,
        sec: a.sec,
        hints: a.hints,
        asks: a.asks,
        errs: a.errs,
      }),
    });
  } catch {
    /* 圏外・未設定。端末の記録は残っている */
  }
}

/* ── 通し見学 ──
   見たことをサーバに残す。点は付かないが、担当者は
   「手順を最後まで見たか」を知りたい。
   開いたときに done=false、最後まで見たときに done=true。
   失敗しても画面は止めない（見学より先へ進むことを優先する）。 */
export function seeDemo(ch: ChapterId, done: boolean) {
  void (async () => {
    try {
      await fetch("/api/training/view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chapter: ch, done }),
      });
    } catch {
      /* 圏外・未設定。見学そのものは続けられる */
    }
  })();
}

/** 記録を消す */
export function clearRecord() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* 消せなくても画面は進む */
  }
}
