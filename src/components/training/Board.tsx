"use client";

/* 第1章の盤面。段取り中は地面だけ、建方に入ると柱が立つ。
   タップできるのは 柱 / 内柱 / スパン の3種。 */

import { useMemo, useRef } from "react";
import { POSTS, SPANS, type PostId, type SpanId } from "@/training/ch1/layout";
import { has, type Ch1State } from "@/training/ch1/state";
import {
  P,
  VB_DAN,
  VB_TATE,
  brkOffset,
  innerPos,
  laidOffset,
  spanMid,
} from "./geometry";
import { Bracket, Deck, Jack, Laid, Ledger, Post } from "./Parts";
import { Worker, type Mood } from "./Characters";

const POST_TOP = 2; // 立ち上げる段数

type Node = { key: string; kind: "post" | "inner" | "span"; id: string; sx: number; sy: number };

export function Board({
  s,
  mood,
  at,
  ghost,
  onTapPost,
  onTapInner,
  onTapSpan,
}: {
  s: Ch1State;
  mood: Mood;
  /** 作業員の位置 */
  at: { x: number; y: number };
  /** 設置箇所のゴースト（チュートリアルでは濃く、本番では薄く） */
  ghost: number;
  onTapPost: (id: PostId) => void;
  onTapInner: (id: PostId) => void;
  onTapSpan: (id: SpanId) => void;
}) {
  const dan = s.phase === "dan";
  const ids = Object.keys(POSTS) as PostId[];
  const svgRef = useRef<SVGSVGElement>(null);
  const vb = (dan ? VB_DAN : VB_TATE).split(" ").map(Number);

  /* 押せる節点。柱・内柱・スパンの中点 */
  const nodes: Node[] = useMemo(() => {
    const out: Node[] = [];
    for (const id of ids) {
      const [sx, sy] = P(POSTS[id].x, POSTS[id].y, 0);
      out.push({ key: `post:${id}`, kind: "post", id, sx, sy });
      const ip = innerPos(id);
      const [ix, iy] = P(ip.x, ip.y, 0);
      out.push({ key: `inner:${id}`, kind: "inner", id, sx: ix, sy: iy });
    }
    for (const sp of SPANS) {
      const m = spanMid(sp.a, sp.b);
      const [sx, sy] = P(m.x, m.y, 0);
      out.push({ key: `span:${sp.id}`, kind: "span", id: sp.id, sx, sy });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dan]);

  /* 押した点にいちばん近い節点へ振り分ける */
  const onBoardClick = (e: React.MouseEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const loc = pt.matrixTransform(ctm.inverse());
    let best: Node | null = null;
    let bestD = Infinity;
    for (const n of nodes) {
      /* 縦は投影で潰れているので、その分だけ縦の差を重く見る */
      const dx = loc.x - n.sx;
      const dy = (loc.y - n.sy) * 1.9;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    if (!best || bestD > 60 * 60) return;
    if (best.kind === "post") onTapPost(best.id as PostId);
    else if (best.kind === "inner") onTapInner(best.id as PostId);
    else onTapSpan(best.id as SpanId);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={dan ? VB_DAN : VB_TATE}
      preserveAspectRatio="xMidYMid meet"
      className="block w-full select-none"
    >
      {/* 地面 */}
      <polygon
        points={[
          P(-1.1, -1.1),
          P(4.1, -1.1),
          P(4.1, 3.1),
          P(-1.1, 3.1),
        ]
          .map((p) => p.join(","))
          .join(" ")}
        fill="#171C22"
      />

      {/* 建物の外面（出隅から2方向）。離れ900mmの内側 */}
      <polyline
        points={[P(-1.1, -0.5), P(3.5, -0.5), P(3.5, 3.1)].map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth="2"
        strokeDasharray="6 6"
      />

      {/* 段取り：寝かせた根がらみ手摺 */}
      {SPANS.map((sp) => {
        if (!has(s, `L:${sp.id}`)) return null;
        const o = laidOffset(sp.a, sp.b);
        return (
          <Laid
            key={`laid-${sp.id}`}
            p1={{ x: POSTS[sp.a].x + o.x, y: POSTS[sp.a].y + o.y }}
            p2={{ x: POSTS[sp.b].x + o.x, y: POSTS[sp.b].y + o.y }}
          />
        );
      })}

      {/* 段取り：内柱の箇所に置いた600手摺 */}
      {s.inner.map((id) => {
        if (!has(s, `R6:${id}`)) return null;
        const ip = innerPos(id);
        return (
          <Laid
            key={`r6-${id}`}
            p1={{ x: POSTS[id].x, y: POSTS[id].y }}
            p2={ip}
            color="var(--color-cyan)"
          />
        );
      })}

      {/* ジャッキ */}
      {ids.map((id) =>
        has(s, `J:${id}`) ? (
          <Jack key={`j-${id}`} x={POSTS[id].x} y={POSTS[id].y} lifted={!!s.jack[id]} />
        ) : null,
      )}
      {s.inner.map((id) => {
        if (!has(s, `J:in:${id}`)) return null;
        const ip = innerPos(id);
        return <Jack key={`ji-${id}`} x={ip.x} y={ip.y} />;
      })}

      {/* 建方：支柱 */}
      {ids.map((id) =>
        has(s, `P:${id}`) ? (
          <Post key={`p-${id}`} x={POSTS[id].x} y={POSTS[id].y} top={POST_TOP} />
        ) : null,
      )}
      {/* 建方：内柱 */}
      {s.inner.map((id) => {
        if (!has(s, `PI:${id}`)) return null;
        const ip = innerPos(id);
        return <Post key={`pi-${id}`} x={ip.x} y={ip.y} top={1} thin />;
      })}

      {/* 建方：コマへ入れた根がらみ手摺（1コマ目＝450mm） */}
      {SPANS.map((sp) =>
        has(s, `LU:${sp.id}`) ? (
          <Ledger
            key={`lu-${sp.id}`}
            p1={POSTS[sp.a]}
            p2={POSTS[sp.b]}
            z={0.25}
          />
        ) : null,
      )}

      {/* 内柱をつなぐ踏板高さの600手摺 */}
      {s.innerTied.map((id) => (
        <Ledger key={`tie-${id}`} p1={POSTS[id]} p2={innerPos(id)} z={1} color="var(--color-cyan)" w={3.5} />
      ))}

      {/* ブラケット */}
      {ids.flatMap((id) =>
        (["S", "E"] as const)
          .filter((f) => has(s, `BRK:${id}:${f}`))
          .map((f) => (
            <Bracket key={`brk-${id}-${f}`} x={POSTS[id].x} y={POSTS[id].y} off={brkOffset(f)} />
          )),
      )}

      {/* 踏板 */}
      {SPANS.map((sp) => {
        if (!has(s, `DK:${sp.id}`)) return null;
        const f = (POSTS[sp.a].face ?? POSTS[sp.b].face) === "E" ? "E" : "S";
        const o = brkOffset(f);
        return <Deck key={`dk-${sp.id}`} a={POSTS[sp.a]} b={POSTS[sp.b]} off={o} />;
      })}

      {/* 作業員 */}
      <g transform={`translate(${P(at.x, at.y)[0]},${P(at.x, at.y)[1]})`}>
        <Worker mood={mood} />
      </g>

      {/* ── タップできる場所 ──
          内柱は外柱から600mmしか離れていない（縮尺どおり）ので、
          当たり判定を重ねると取り合いになる。
          板1枚で受けて、押した点にいちばん近い節点へ振り分ける。 */}
      {nodes.map((n) => (
        <g key={`ghost-${n.key}`} className="pointer-events-none">
          <ellipse
            cx={n.sx}
            cy={n.sy}
            rx={n.kind === "span" ? 20 : n.kind === "post" ? 14 : 10}
            ry={n.kind === "span" ? 10 : n.kind === "post" ? 7 : 5}
            fill={
              n.kind === "span"
                ? "var(--color-yel)"
                : n.kind === "post"
                  ? "var(--color-cyan)"
                  : "var(--color-org)"
            }
            opacity={ghost * (n.kind === "span" ? 0.1 : 0.13)}
          />
          {n.kind === "post" && (
            <text x={n.sx} y={n.sy + 20} textAnchor="middle" fontSize="11" fill="var(--color-dim)">
              {POSTS[n.id as PostId].n}
            </text>
          )}
          {/* テストと目視のための印。押せない */}
          <circle data-node={n.key} cx={n.sx} cy={n.sy} r="1.5" fill="transparent" />
        </g>
      ))}
      <rect
        x={vb[0]}
        y={vb[1]}
        width={vb[2]}
        height={vb[3]}
        fill="transparent"
        onClick={onBoardClick}
        className="cursor-pointer"
      />
    </svg>
  );
}
