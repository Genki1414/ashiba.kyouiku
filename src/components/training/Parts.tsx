"use client";

/* 盤面の描画部品。プロトタイプの Koma / Post / Jack / Ledger / Laid を移植。
   色は globals.css のトークンに合わせている。 */

import { P, pts, type Pt } from "./geometry";

const STEEL = "var(--color-steel)";
const STEEL_LT = "var(--color-steel-lt)";
const STEEL_DK = "var(--color-steel-dk)";
const YEL = "var(--color-yel)";

/** 緊結部（コマ）。450mmピッチ＝z 0.25 刻み */
export const Koma = ({ x, y, z }: { x: number; y: number; z: number }) => {
  const [a, b] = P(x, y, z);
  return (
    <polygon
      points={`${a - 6},${b} ${a},${b - 3} ${a + 6},${b} ${a},${b + 3}`}
      fill={STEEL_LT}
    />
  );
};

/** 支柱。top は段数（1＝1,800mm） */
export const Post = ({
  x,
  y,
  top = 2,
  thin,
}: {
  x: number;
  y: number;
  top?: number;
  thin?: boolean;
}) => {
  const a = P(x, y, 0.06);
  const c = P(x, y, top);
  const pin = P(x, y, top + 0.1);
  const koma = [];
  for (let i = 0.25; i <= top + 0.001; i += 0.25) koma.push(+i.toFixed(2));
  return (
    <g className="drop">
      <line x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} stroke={STEEL} strokeWidth={thin ? 4.5 : 5.5} />
      <line x1={c[0]} y1={c[1]} x2={pin[0]} y2={pin[1]} stroke={STEEL_DK} strokeWidth="2.5" />
      {koma.map((z) => (
        <Koma key={z} x={x} y={y} z={z} />
      ))}
    </g>
  );
};

/** ジャッキ。敷板の上に据える */
export const Jack = ({ x, y, lifted }: { x: number; y: number; lifted?: boolean }) => {
  const b = P(x, y, 0);
  const s = P(x, y, 0.06);
  return (
    <g className="drop">
      {/* 敷板 */}
      <polygon
        points={`${b[0] - 12},${b[1]} ${b[0]},${b[1] - 6} ${b[0] + 12},${b[1]} ${b[0]},${b[1] + 6}`}
        fill={STEEL_DK}
      />
      <line x1={b[0]} y1={b[1]} x2={s[0]} y2={s[1]} stroke={STEEL_LT} strokeWidth="3.5" />
      {/* ハンドル */}
      <ellipse cx={b[0]} cy={b[1] - (lifted ? 13 : 9)} rx="7.5" ry="3" fill={STEEL} />
    </g>
  );
};

/** コマへ入れた手摺（根がらみ手摺・落下防止手摺は同じ資材） */
export const Ledger = ({
  p1,
  p2,
  z,
  color = YEL,
  w = 4.5,
}: {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  z: number;
  color?: string;
  w?: number;
}) => {
  const a = P(p1.x, p1.y, z);
  const c = P(p2.x, p2.y, z);
  const d = a[0] < c[0] ? 1 : -1;
  const wedge = (p: Pt, o: number) =>
    `${p[0]},${p[1] - 5} ${p[0] + o * 5},${p[1] - 1} ${p[0]},${p[1] + 4}`;
  return (
    <g className="drop">
      <line x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} stroke={color} strokeWidth={w} />
      <polygon points={wedge(a, d)} fill={color} />
      <polygon points={wedge(c, -d)} fill={color} />
    </g>
  );
};

/** 段取りで寝かせてある手摺 */
export const Laid = ({
  p1,
  p2,
  color = YEL,
}: {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  color?: string;
}) => {
  const a = P(p1.x, p1.y, 0.02);
  const c = P(p2.x, p2.y, 0.02);
  return (
    <line
      className="drop"
      x1={a[0]}
      y1={a[1]}
      x2={c[0]}
      y2={c[1]}
      stroke={color}
      strokeWidth="5"
      opacity=".5"
      strokeLinecap="round"
    />
  );
};

/** ブラケット。外柱から建物側へ張り出す（HANDOFF.md ルール8） */
export const Bracket = ({
  x,
  y,
  off,
}: {
  x: number;
  y: number;
  off: { x: number; y: number };
}) => (
  <polygon
    className="drop"
    points={pts(P(x, y, 1), P(x + off.x, y + off.y, 1), P(x, y, 0.78))}
    fill={STEEL}
    stroke={STEEL_LT}
    strokeWidth="1"
  />
);

/** 踏板。ブラケットの上に載る */
export const Deck = ({
  a,
  b,
  off,
}: {
  a: { x: number; y: number };
  b: { x: number; y: number };
  off: { x: number; y: number };
}) => (
  <polygon
    className="drop"
    points={pts(
      P(a.x, a.y, 1),
      P(b.x, b.y, 1),
      P(b.x + off.x, b.y + off.y, 1),
      P(a.x + off.x, a.y + off.y, 1),
    )}
    fill="#6E7C8A"
    stroke={STEEL_LT}
    strokeWidth="1"
    opacity=".95"
  />
);
