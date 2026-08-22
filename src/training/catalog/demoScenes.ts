/* 通し見学（第1章）で、実際に操作してもらう場面。

   場面そのものは遊ぶときと同じ部品（Ch1Scene）を出す。
   ここにあるのは「どの手で、どの場面を出すか」だけ。
   ひとつの手に2つ続くところ（内柱の水平）は、順に出す。

   手摺先行工法のときだけ出る場面（600手摺・600の水平・先行手摺）は
   ここには入っていない。通し見学は普通の工法の15手を見せるものなので。 */

import { POSTS, faceOf, type PostId } from "@/training/ch1/layout";
import type { Scene } from "@/training/ch1/rules";

/** 離れの見出し。判定（rules.ts）が作るものと同じにする */
const hanareLabel = (id: PostId) => `${faceOf(id)} ${POSTS[id].n}`;

/** 手の番号（STEPS の n）→ その手で出す場面。

    場面は「何をするか」を書いた手に付ける。
    1手前に付けると、まだ教えていないことを聞くことになって、
    初めての人には何が正解か分からない。 */
export const DEMO_SCENES: Record<number, Scene[]> = {
  /* 04 基準のジャッキの高さを合わせる */
  4: [{ type: "jackAdjust", post: "C" }],
  /* 08 離れを測る */
  8: [{ type: "hanare", post: "S1", label: hanareLabel("S1") }],
  /* 09 水平を見る（置き場所を選んでから気泡を合わせる） */
  9: [{ type: "level", a: "C", b: "S1" }],
  /* 12 踏板高さの手摺でつなぐ。
     「内柱を立てた。次にどうする？」は、踏板高さの手摺の話をしてから聞く。
     11（内柱を立てる）で聞くと、まだ手摺の話をしていないので答えようがない */
  12: [
    { type: "innerChoiceA", post: "S1" },
    { type: "railAnim", post: "S1" },
  ],
  /* 13 内柱の水平を見る（どこに当てるか → 合わせる） */
  13: [
    { type: "innerChoiceB", post: "S1" },
    { type: "levelInner", post: "S1" },
  ],
};

/** その手で操作してもらう場面。無ければ空 */
export const scenesOf = (n: number): Scene[] => DEMO_SCENES[n] ?? [];

/** 操作してもらう場面の数 */
export const SCENE_COUNT = Object.values(DEMO_SCENES).reduce((a, v) => a + v.length, 0);
