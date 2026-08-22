"use client";

import { POSTS, type Post, type PostId } from "@/training/ch1/layout";
import { LEVEL_SPOT_WHY, type Scene } from "@/training/ch1/rules";
import { JackScene } from "@/components/training/scenes/JackScene";
import { HanareScene } from "@/components/training/scenes/HanareScene";
import {
  Choice,
  InnerArt,
  LevelZoom,
  RailAnim,
  SgakeAnim,
  type ChoiceOpt,
} from "@/components/training/scenes/Prototype";
import { flipOf, innerPos } from "@/components/training/geometry";

/* 第1章の場面（プロトタイプの overlay）。
   遊ぶときと通し見学で同じものを出すため、ここにまとめてある。
   良し悪しの判定は持たず、起きたことを親（Ch1Client / DemoClient）へ渡すだけ。 */

/** 置き場所を外したまま進めるとどうなるか（記録に残す一言） */
export const LEVEL_SPOT_RESULT: Record<"end" | "in" | "mid", string> = {
  end: "1本の狂いは小さくても、4面が一周すると積み上がって最後の根がらみが入らなくなる。",
  in: "",
  mid: "回しては見に行き、を繰り返すことになる。ジャッキに手が届く場所で見る。",
};

export function Ch1Scene({
  scene,
  posts = POSTS,
  onDone,
  onFoul,
  onPenalty,
}: {
  scene: Scene | null;
  /** 柱の位置。600スパンにすると変わる */
  posts?: Record<PostId, Post>;
  /** 場面を終えた。ジャッキのように値を返す場面もある */
  onDone: (value?: number) => void;
  /** 場面の中で起きたファール */
  onFoul: (tag: string, message: string, why: string) => void;
  /** 場面が自分で叱りを出しきっているとき。点と記録だけ */
  onPenalty: (tag: string, message: string, why: string) => void;
}) {
  return (
    <>
    {scene?.type === "jackAdjust" && (
      <JackScene post={scene.post} onDone={(value) => onDone(value)} />
    )}

    {scene?.type === "hanare" && (
      <HanareScene label={scene.label} onDone={() => onDone()} />
    )}

    {/* 外柱の水平：置き場所を選んでから気泡を合わせる */}
    {scene?.type === "level" && (
      <LevelZoom
        baseN={POSTS[scene.a].n}
        tgtN={POSTS[scene.b].n}
        aId={scene.a}
        bId={scene.b}
        flip={flipOf(posts[scene.a], posts[scene.b])}
        onClear={() => onDone()}
        onFoul={() =>
          onFoul(
            "基準柱のジャッキを操作",
            "そこは基準の柱じゃ！　基準を動かしたら全部狂うぞ！",
            "基準の柱を動かすと、そこまでに出した水平が全部やり直しになる。",
          )
        }
        onSpotFoul={(spot) =>
          onPenalty("水平器の置き場所", LEVEL_SPOT_WHY[spot], LEVEL_SPOT_RESULT[spot])
        }
      />
    )}

    {/* 内柱：立てた直後 → 600手摺 → 水平器をどこに当てるか → 内柱の水平 */}
    {scene?.type === "innerChoiceA" && (
      <Choice
        title="内柱を立てた"
        q="次にどうする？"
        art={<InnerArt flip={flipOf(posts[scene.post], innerPos(scene.post, posts))} ghost />}
        opts={[
          { t: "内柱に水平器を当てて水平を見る", ok: false },
          { t: "踏板高さの手摺を付ける", ok: true },
        ]}
        onPick={(o: ChoiceOpt) => {
          if (!o.ok) {
            return onFoul(
              "内柱の水平を先に見た",
              "順番が逆じゃ！　手摺で外柱とつないでから見んかい！",
              "つないでいない内柱は動く。動くものに水平器を当てても意味がない。",
            );
          }
          onDone();
        }}
      />
    )}

    {scene?.type === "railAnim" && (
      <RailAnim
        flip={flipOf(posts[scene.post], innerPos(scene.post, posts))}
        onDone={() => onDone()}
      />
    )}

    {scene?.type === "innerChoiceB" && (
      <Choice
        title="水平を見る"
        q="水平器はどこに当てる？"
        art={<InnerArt flip={flipOf(posts[scene.post], innerPos(scene.post, posts))} rail />}
        opts={[
          { t: "支柱（内柱）に当てる", ok: true },
          { t: "取り付けた手摺に当てる", ok: false },
        ]}
        onPick={(o: ChoiceOpt) => {
          if (!o.ok) {
            return onFoul(
              "水平器を当てる箇所の誤り",
              "手摺で見るな！　柱で見るんじゃ！",
              "手摺は差し込みに遊びがある。柱に当てんと本当の垂直は分からん。",
            );
          }
          onDone();
        }}
      />
    )}

    {scene?.type === "levelInner" && (
      <LevelZoom
        vertical
        baseN="外柱"
        tgtN="内柱"
        aId={scene.post}
        flip={flipOf(posts[scene.post], innerPos(scene.post, posts))}
        onClear={() => onDone()}
        onFoul={() =>
          onFoul(
            "外柱のジャッキを操作",
            "外柱を動かすな！　もう水平は出とるじゃろが！",
            "外柱はもう決まっとる。動かせば、そこまでの離れも水平もやり直しだ。",
          )
        }
      />
    )}

    {/* ── 手摺先行工法のときだけ出る場面 ── */}

    {/* 600スパンを踏板高さの手摺でつなぐ */}
    {scene?.type === "rail600" && (
      <RailAnim corner flip={flipOf(posts.C, posts[scene.post])} onDone={() => onDone()} />
    )}

    {/* 600スパンの柱の水平。出隅を基準に縦で見る */}
    {scene?.type === "level600" && (
      <LevelZoom
        vertical
        miniInner={false}
        what="600スパンを見る"
        baseN="出隅"
        tgtN={POSTS[scene.post].n}
        aId="C"
        bId={scene.post}
        flip={flipOf(posts.C, posts[scene.post])}
        onClear={() => onDone()}
        onFoul={() =>
          onFoul(
            "基準柱のジャッキを操作",
            "出隅を動かすな！　そこが基準じゃ！",
            "出隅は2方向の基準だ。動かせば南面も東面も割り付けからやり直しになる。",
          )
        }
      />
    )}

    {/* 先行手摺を下から上げる */}
    {scene?.type === "sgake" && <SgakeAnim onDone={() => onDone()} />}
    </>
  );
}
