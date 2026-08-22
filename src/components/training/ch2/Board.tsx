"use client";

/* 第2章の盤面（立面）。プロトタイプ ashiba-ch2-v6.tsx の board を
   描画を変えずに移植したもの。

   コマは450mmピッチで支柱の全長に描く。内柱は奥行きを表すため少し左へずらす。
   建物は描かず、屋根だけ出す。
   壁当てジャッキは、真横の一直線だと他の部材と見分けが付かないので
   奥行き方向へ斜めに描く（HANDOFF.md 3章 第2章）。 */

import React from "react";
import {
  FALL_MID as FALL_M,
  FALL_TOP as FALL_U,
  POSTS,
  POST_NAME as PN,
  SPANS,
  SPAN_IDS as SPID,
  isInner,
  type PostId,
  type SpanId,
} from "@/training/ch2/layout";
import { has, type Ch2State } from "@/training/ch2/state";
import type { Step } from "@/training/ch2/queue";
import {
  Brk,
  Deck,
  GY,
  Hoister,
  IN_DX,
  Kenta,
  LH,
  Post,
  Rail,
  Rail6,
  Roof,
  SW,
  Stair,
  px,
  py,
  roofYAt,
} from "./Parts";

const C = {
  yel: "#F5D400", org: "#D98B2B", dim: "#8D98A4", steelDk: "#5F6B78", grn: "#25B36B",
};
const F = `"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif`;

const HOIST = 0; // 荷揚げは出隅側

export function Board({
  s,
  cur,
  mood,
  walking,
  tuto,
  still,
  fit,
  onTapPost,
  onTapSpan,
}: {
  s: Ch2State;
  cur: Step | null;
  mood?: string;
  walking?: boolean;
  tuto: boolean;
  /** 組み上がりを見せるだけのとき。タップ位置の印を出さない */
  still?: boolean;
  /** 入れ物の高さに合わせて縮める。通し見学のように、
      下に説明欄がある画面で使う（そのままだと縦にはみ出す） */
  fit?: boolean;
  onTapPost: (i: number) => void;
  onTapSpan: (i: number) => void;
}) {
  const { lv, belt, at: atPost } = s;
  const at = POSTS.indexOf(atPost);
  const INNER: Record<string, boolean> = Object.fromEntries(POSTS.map((p) => [p, isInner(p)]));
  const topOf = (p: PostId) => (has(s, `P2:${p}`) ? 2 + FALL_U + 0.2 : 2.0);
  const topIn = (p: PostId) => (has(s, `PI:${p}`) ? 2.06 : 1.06);
  const wx = lv >= 3 ? px(at) + IN_DX : px(at) + (lv >= 1 ? 13 : 0);
  const wy = lv >= 3 ? roofYAt() + 2 : py(Math.min(lv, 2)) - 9;
  const tapPost = onTapPost;
  const tapSpan = onTapSpan;
  const hasK = (k: string) => has(s, k);

  return (
    <svg
      viewBox="0 0 340 476"
      preserveAspectRatio="xMidYMid meet"
      style={fit
        ? { width: "100%", height: "100%", display: "block" }
        : { width: "100%", display: "block" }}
    >
      <Roof />
      <rect y={GY} width="340" height="46" fill="#1A2027" />
      {/* 内柱（1段目まで既設） */}
      {POSTS.map((p, i) => INNER[p] && <Post key={"in" + p} i={i} top={topIn(p)} inner joint={hasK(`PI:${p}`)} />)}
      {/* 1段目：根がらみ・踏板 */}
      <line x1={px(0)} y1={py(0.25)} x2={px(3)} y2={py(0.25)} stroke={C.steelDk} strokeWidth="4.5" />
      {SPANS.map((_, i) => <Deck key={"d1" + i} a={i} b={i + 1} lv={1} />)}
      {POSTS.map((p, i) => INNER[p] && <Rail6 key={"r6a" + p} i={i} lv={1} />)}
      {/* 荷揚げ役 */}
      <Hoister x={px(HOIST) - 30} y={GY} active={!!cur && /^(rail1|rail2|post2|postI|brk|rail6|deck2)$/.test(cur.k)} />
      {/* 昇降階段 */}
      <Stair i={0} lv={1} />
      {lv >= 2 && <Stair i={0} lv={2} />}
      {/* 外柱 */}
      {POSTS.map((p, i) => <Post key={p} i={i} top={topOf(p)} joint={hasK(`P2:${p}`)} />)}
      {/* 1段目の手摺 */}
      {SPID.map((id, i) => hasK(`R1:${id}`) && <Rail key={"r1" + id} a={i} b={i + 1} lv={1} />)}
      {/* 筋交 */}
      {["1", "2", "3"].map((L) => SPID.map((id, i) => hasK(`BR:${L}:${id}`) && (() => {
        /* 向きは一方向のみ。下端＝南端側（右）／上端＝出隅側（左） */
        const xLo = px(i + 1), yLo = py(Number(L) - 1) - 6;   // 下端（南端側）
        const xHi = px(i), yHi = py(Number(L)) - 6;           // 上端（出隅側）
        return (
          <g key={"br" + L + id} className="el">
            <line x1={xLo} y1={yLo} x2={xHi} y2={yHi} stroke="#B9C4CE" strokeWidth="5" strokeLinecap="round" />
            <circle cx={xLo} cy={yLo} r="4.5" fill="#8A96A2" /><circle cx={xHi} cy={yHi} r="4.5" fill="#8A96A2" />
          </g>
        );
      })()))}
      {/* 壁当てジャッキ（内柱→建物） */}
      {POSTS.map((p, i) => hasK(`WJ:${p}`) && (() => {
        const y = py(2) + 0.25 * LH;
        const xp = px(i) + IN_DX;          // 内柱
        /* 建物は奥。真横の一直線だと他の部材と見分けが付かないので、奥行き方向へ斜めに描く */
        const ex = xp - 34, ey = y - 22;     // 外壁に当たる先端
        const ux = (ex - xp) / Math.hypot(ex - xp, ey - y), uy = (ey - y) / Math.hypot(ex - xp, ey - y);
        return (
          <g key={"wj" + p} className="el">
            {/* 支柱側の取付金具 */}
            <rect x={xp - 6} y={y - 7} width="12" height="14" rx="2" fill="#7E8A96" stroke={C.steelDk} />
            {/* ねじ軸（斜め） */}
            <line x1={xp} y1={y} x2={ex} y2={ey} stroke="#9AA6B2" strokeWidth="4.5" strokeLinecap="round" />
            {[1, 2, 3].map((k) => {
              const cx = xp + ux * (k * 7 + 8), cy = y + uy * (k * 7 + 8);
              return <line key={k} x1={cx - uy * 4} y1={cy + ux * 4} x2={cx + uy * 4} y2={cy - ux * 4} stroke="#6E7A87" strokeWidth="1.4" />;
            })}
            {/* 外壁に当たる座金 */}
            <line x1={ex - uy * 7} y1={ey + ux * 7} x2={ex + uy * 7} y2={ey - ux * 7} stroke="#8A96A2" strokeWidth="5" strokeLinecap="round" />
          </g>
        );
      })())}
      {/* 受け材 */}
      {POSTS.map((p, i) => hasK(`BRK:${p}`) && <Brk key={"b" + p} i={i} lv={2} />)}
      {POSTS.map((p, i) => hasK(`R6:${p}`) && <Rail6 key={"r6" + p} i={i} lv={2} />)}
      {/* 2段目 */}
      {SPID.map((id, i) => hasK(`D2:${id}`) && <Deck key={"d2" + id} a={i} b={i + 1} lv={2} />)}
      {SPID.map((id, i) => hasK(`R2:${id}`) && <Rail key={"r2" + id} a={i} b={i + 1} lv={2} />)}
      {/* 転落防止手摺 */}
      {([["M", FALL_M, 4], ["U", FALL_U, 5.5]] as [string, number, number][]).map(([k, h, w]) => SPID.map((id, i) => hasK(`FL:${k}:${id}`) && (() => {
        const y = py(2) - h * LH, x1 = px(i), x2 = px(i + 1);
        const wd = (x: number, d: number) => `${x},${y - 6} ${x + d * 7},${y - 1} ${x},${y + 5}`;
        return (
          <g key={k + id} className="el">
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={C.org} strokeWidth={w} />
            <polygon points={wd(x1, 1)} fill={C.org} /><polygon points={wd(x2, -1)} fill={C.org} />
          </g>
        );
      })()))}

      {/* 取付ガイド：筋交 */}
      {cur && cur.k === "brace" && (() => {
        const [L, sid] = cur.t.split(":");
        const i = SPID.indexOf(sid as SpanId);
        if (i < 0) return null;
        /* 向きは一方向のみ。下端＝南端側（右）／上端＝出隅側（左） */
        const xLo = px(i + 1), yLo = py(Number(L) - 1) - 6;
        const xHi = px(i), yHi = py(Number(L)) - 6;
        return (
          <g className="tgt">
            <line x1={xLo} y1={yLo} x2={xHi} y2={yHi} stroke="#B9C4CE" strokeWidth="7" opacity=".2" strokeLinecap="round" />
            <line x1={xLo} y1={yLo} x2={xHi} y2={yHi} stroke="#B9C4CE" strokeWidth="2" strokeDasharray="6 5" />
            <circle cx={xLo} cy={yLo} r="10" fill="none" stroke="#B9C4CE" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx={xHi} cy={yHi} r="10" fill="none" stroke="#B9C4CE" strokeWidth="2" strokeDasharray="3 3" />
          </g>
        );
      })()}

      {/* 取付ガイド：いま付ける位置を破線で示す */}
      {cur && cur.k === "fall" && (() => {
        const [kind, sid] = cur.t.split(":");
        const i = SPID.indexOf(sid as SpanId);
        if (i < 0) return null;
        const h = kind === "U" ? FALL_U : FALL_M;
        const y = py(2) - h * LH, x1 = px(i), x2 = px(i + 1);
        return (
          <g className="tgt">
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={C.org} strokeWidth="7" opacity=".25" strokeLinecap="round" />
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={C.org} strokeWidth="2" strokeDasharray="6 5" />
            {[x1, x2].map((x) => (
              <circle key={x} cx={x} cy={y} r="11" fill="none" stroke={C.org} strokeWidth="2" strokeDasharray="3 3" />
            ))}
            {tuto && (
              <>
                <rect x={(x1 + x2) / 2 - 42} y={y - 30} width="84" height="19" rx="5" fill="#0F1318" stroke={C.org} strokeWidth="1.2" />
                <text x={(x1 + x2) / 2} y={y - 16.5} textAnchor="middle" fontSize="11" fill={C.org} fontFamily={F} fontWeight="700">
                  {kind === "U" ? "上さん 2,700" : "中さん 2,250"}
                </text>
                <line x1={x2 + 20} y1={py(2)} x2={x2 + 20} y2={y} stroke={C.org} strokeWidth="1.2" opacity=".7" />
                <line x1={x2 + 15} y1={py(2)} x2={x2 + 25} y2={py(2)} stroke={C.org} strokeWidth="1.2" opacity=".7" />
                <line x1={x2 + 15} y1={y} x2={x2 + 25} y2={y} stroke={C.org} strokeWidth="1.2" opacity=".7" />
              </>
            )}
          </g>
        );
      })()}

      {/* タップ位置：柱 */}
      {POSTS.map((p, i) => (
        <g key={"tp" + p} data-node={`post:${p}`} className={still ? undefined : "tgt"}
          style={{ cursor: still ? "default" : "pointer" }} onClick={still ? undefined : () => tapPost(i)}>
          {!still && <>
            <circle cx={px(i)} cy={py(Math.min(lv, 2)) - 34} r="18" fill={C.yel} opacity=".10" />
            <circle cx={px(i)} cy={py(Math.min(lv, 2)) - 34} r="18" fill="none" stroke={C.yel} strokeWidth="1.4" strokeDasharray="4 4" />
          </>}
          {/* 柱の呼び名は組み上がりの図でも要る */}
          <text x={px(i)} y={GY + 24} textAnchor="middle" fontSize="10.5" fill={C.dim} fontFamily={F}>{PN[p]}</text>
        </g>
      ))}
      {/* タップ位置：スパン */}
      {!still && SPID.map((id, i) => {
        const onRoof = lv >= 3;
        const kind = cur && cur.k === "fall" ? cur.t.split(":")[0] : "M";
        const onBrace = cur && cur.k === "brace";
        const bl = onBrace ? Number(cur.t.split(":")[0]) : 1;
        const yc = onRoof ? py(2) - (kind === "U" ? FALL_U : FALL_M) * LH
          : onBrace ? (py(bl - 1) + py(bl)) / 2
            : py(Math.min(lv, 2)) - 49;
        const isTarget = (cur && cur.k === "fall" && cur.t.split(":")[1] === id)
          || (onBrace && cur.t.split(":")[1] === id);
        return (
          <g key={"ts" + id} data-node={`span:${id}`} className="tgt" style={{ cursor: "pointer" }} onClick={() => tapSpan(i)}>
            <rect x={px(i) + 14} y={yc - 15} width={SW - 28} height="30" rx="7"
              fill={isTarget ? C.org : C.yel} opacity={isTarget ? ".14" : ".08"} />
            <rect x={px(i) + 14} y={yc - 15} width={SW - 28} height="30" rx="7" fill="none"
              stroke={isTarget ? C.org : C.yel} strokeWidth="1.4" strokeDasharray="4 4" />
          </g>
        );
      })}

      {/* 作業員 */}
      <g style={{ transform: `translate(${wx}px,${wy}px)`, transition: "transform .3s ease" }}>
        {belt !== "none" && lv >= 1 && lv < 3 && (
          <line x1="-2" y1="-30" x2={belt === "post" ? px(at) - wx : -30} y2={belt === "post" ? -46 : -54} stroke={C.grn} strokeWidth="2.5" />
        )}
        <Kenta mood={mood} walking={walking} />
      </g>
    </svg>
  );
}
