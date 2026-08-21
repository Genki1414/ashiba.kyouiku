/* 途中で閉じたときの続き。
   現場では電話が入る。1章まるごとやり直しでは使えない。

   残すのは「盤面の状態」と「そこまでの成績」だけ。
   画面の見せ方（作業員の動き・演出）は作り直します。

   第3章のシートだけは、部品が自分の中に持っている状態が多く、
   途中から作り直せません。シートに入ったら、シートの手前まで戻します。 */

import type { Score } from "./score";
import type { ChapterId } from "./chapters";

/** 続きに要るもの。JSON にそのまま落とせる形にしておく */
export type Saved<S> = {
  /** どの版の作りで保存したか。作りが変わったら捨てる */
  fmt: number;
  ch: ChapterId;
  at: string;
  tutorial: boolean;
  sk: boolean;
  /** 盤面の状態 */
  s: S;
  /** そこまでの成績 */
  score: Score;
  /** いま持っている道具 */
  tool?: string;
  /** 親方が最後に言ったこと */
  msg?: string;
  /** 開いていた場面。閉じずに落ちても、そこから続けられる */
  scene?: unknown;
};

/** 盤面の作りを変えたら上げる。上げると古い続きは捨てられる */
export const FMT = 1;

/** 続きとして使えるか。作りが変わっていたり、別のやり方なら使わない */
export function usable<S>(
  v: Saved<S> | null,
  want: { ch: ChapterId; tutorial: boolean; sk: boolean },
): boolean {
  if (!v) return false;
  if (v.fmt !== FMT) return false;
  if (v.ch !== want.ch) return false;
  /* チュートリアルと本番、先行手摺とふつうは別の現場として扱う */
  return v.tutorial === want.tutorial && v.sk === want.sk;
}

/** 「8月22日 0:14 まで」 */
export function savedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
