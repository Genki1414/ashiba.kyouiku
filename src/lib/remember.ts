"use client";

/* 前に見たものを端末に覚えておく。

   押した先で読み終わるまで待たせるのではなく、
   前に見たものをすぐ出して、そのうしろで読み直す。
   担当者は名簿を毎日開くので、そこが効く。

   ・古いものを出しているあいだは、画面にそう書く（黙って古いものを見せない）
   ・端末の持ち主が変わると、この覚えも消える
     （wipeDevice が ashiba.* をまとめて消すため。src/lib/device.ts）
     名簿には他の人の氏名も入るので、渡した時点で消えないと困る
   ・古すぎるものは出さない。出すと、辞めた人が居るように見える */

const PREFIX = "ashiba.seen.";
/** これより古い覚えは出さない */
const OLD_MS = 24 * 60 * 60 * 1000;

type Box<T> = { at: number; v: T };

/** 前に見たもの。無い・古すぎる・読めないなら null */
export function recall<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const box = JSON.parse(raw) as Box<T>;
    if (!box || typeof box.at !== "number") return null;
    if (Date.now() - box.at > OLD_MS) return null;
    return box.v;
  } catch {
    return null;
  }
}

/** 見たものを覚える */
export function keep<T>(key: string, v: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), v } satisfies Box<T>));
  } catch {
    /* しまえない端末（プライベートモード・容量いっぱい）。毎回読み直すだけ */
  }
}
