import type { VerifyReason } from "./face";

/* 何回外れたら受講を止めるか、という判断だけを取り出したもの。

   ここを間違えると、外れているのに いつまでも止まらない。
   実際そうなっていた（顔があるかを2回に1回しか見ていなかったので、
   「外れた回」と「見ていない回」が交互になり、2回続けて外れることが
   無くなっていた）。画面もカメラも要らない形にして、試験できるようにする。

   決まり
   ・2回続けて外れたら止める（SPEC 5章）
   ・ただし「登録した人と違う」は、その1回で止める。
     本人照合は30秒に1回なので、2回続けるのを待つと
     1分ものあいだ別人が受講できてしまう
   ・通れば数え直す */

/** 何秒ごとに見るか */
export const CHECK_INTERVAL_MS = 3000;

/** 何回に1回、本人かどうかまで見るか（3秒×10＝30秒ごと） */
export const ID_EVERY = 10;

/* 何回に1回、通っていることの控えをサーバへ残すか（3秒×100＝5分ごと）。

   OK_EVERY は ID_EVERY の倍数にしておくこと。
   そうしておくと、控えを残す回は必ず本人照合をした回になり、
   記録に「本人を確認」と書ける。倍数でなくなると、
   顔があっただけの回を「本人を確認」と書くことになる。 */
export const OK_EVERY = 100;

/** 2回続けて外れたら止める */
export const FAIL_LIMIT = 2;

/** その1回で止める理由（続けて外れるのを待たない） */
const AT_ONCE: VerifyReason[] = ["not_me"];

export type Tick = { ok: true } | { ok: false; reason: VerifyReason };
export type Gate = { miss: number; stop: VerifyReason | null };

export const START: Gate = { miss: 0, stop: null };

export function step(g: Gate, t: Tick, limit = FAIL_LIMIT): Gate {
  if (t.ok) return { miss: 0, stop: null };
  if (AT_ONCE.includes(t.reason)) return { miss: 0, stop: t.reason };
  const miss = g.miss + 1;
  return miss >= limit ? { miss: 0, stop: t.reason } : { miss, stop: null };
}
