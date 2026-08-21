"use client";

import { KOMA_PER_LEVEL, POSTS, postName, tieOrder, type Pitch, type PostKey } from "@/training/ch3/layout";
import type { Ch3State } from "@/training/ch3/state";

/* 通し見学の第3章、シートのところで出す立面。
   遊ぶ画面の SheetPart は自分の中に状態を持っていて外から動かせないので、
   見学のために、盤面の状態だけを見て描く小さな絵を用意した。

   南面3スパン・支柱4本。垂れたシートと、結んだコマを出す。 */

const W = 340, H = 300;
const X0 = 62, X1 = 300;          // 左右の支柱
const TOP = 40, GY = 246;          // 最上段と足元
/* この立面は南面。西面の2本は向こう側なので、ここには描かない */
const SOUTH = POSTS.slice(0, 4);
const N = SOUTH.length;
const px = (i: number) => X0 + ((X1 - X0) / (N - 1)) * i;

/** シートのスパン i は、支柱 i と i+1 のあいだ */
const spanX = (i: number) => [px(i) + 3, px(i + 1) - 3] as const;

export function DemoSheet({ s }: { s: Ch3State }) {
  /* 南面の4本。左から 出隅 → 南端 */
  const south = SOUTH.map((p) => p.k);
  const komas = s.pitch ? tieOrder(s.pitch as Pitch) : [];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="block h-full w-full">
      <defs>
        <pattern id="demo-mesh" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0 L6 6 M6 0 L0 6" stroke="#5FBF8C" strokeWidth=".6" opacity=".7" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#0C1015" />

      {/* 段（最上段と足元） */}
      <line x1={X0 - 14} y1={TOP} x2={X1 + 14} y2={TOP} stroke="#93A0AD" strokeWidth="4" strokeLinecap="round" />
      <line x1={X0 - 14} y1={GY} x2={X1 + 14} y2={GY} stroke="#93A0AD" strokeWidth="4" strokeLinecap="round" />
      <text x={X0 - 18} y={TOP + 4} textAnchor="end" fontSize="10" fill="#8D98A4">最上段</text>
      <text x={X0 - 18} y={GY + 4} textAnchor="end" fontSize="10" fill="#8D98A4">2段目</text>

      {/* 垂れたシート */}
      {s.hung.map((i) => {
        const [a, b] = spanX(i);
        return (
          <g key={`sheet-${i}`} className="drop">
            <rect x={a} y={TOP} width={b - a} height={GY - TOP} fill="#2C6B4A" opacity=".5" />
            <rect x={a} y={TOP} width={b - a} height={GY - TOP} fill="url(#demo-mesh)" opacity=".45" />
            <rect x={a} y={TOP} width={b - a} height={GY - TOP} fill="none" stroke="#3E8F63" strokeWidth="1.4" />
          </g>
        );
      })}

      {/* 支柱 */}
      {south.map((k, i) => (
        <line key={k} x1={px(i)} y1={TOP - 6} x2={px(i)} y2={GY + 6} stroke="#CBD6DF" strokeWidth="6" />
      ))}

      {/* 結んだコマ。結び終えた支柱は全部、いま結んでいる支柱は打った分だけ */}
      {south.map((k, i) => {
        const done = s.tied.includes(k as PostKey);
        const now = s.tying === k;
        if (!done && !now) return null;
        const list = done ? komas : komas.filter((c) => s.dots.includes(c));
        return (
          <g key={`tie-${k}`}>
            {list.map((c) => {
              const y = GY - ((GY - TOP) / KOMA_PER_LEVEL) * c;
              return <circle key={c} cx={px(i)} cy={y} r="5" fill="#F5D400" stroke="#14171B" strokeWidth="1.5" />;
            })}
          </g>
        );
      })}

      {/* 支柱の名前 */}
      {SOUTH.map((p, i) => (
        <text key={p.k} x={px(i)} y={GY + 30} textAnchor="middle" fontSize="10" fill="#5F6B78">
          {p.nm}
        </text>
      ))}

      {/* いま結んでいるのが西面のときは、そう断っておく
          （南面の絵に印が出ないので、止まって見えてしまう） */}
      {s.tying && !south.includes(s.tying) && (
        <text x={W / 2} y={GY + 56} textAnchor="middle" fontSize="11" fill="#F5D400">
          いまは西面（{postName(s.tying)}）。南面と同じことを繰り返す
        </text>
      )}
    </svg>
  );
}
