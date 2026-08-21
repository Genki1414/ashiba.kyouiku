"use client";

/* 第1章の盤面。段取り中は地面だけ、建方に入ると柱が立つ。
   タップできるのは 柱 / 内柱 / スパン の3種。 */

import { useMemo, useRef } from "react";
import { POSTS as BASE_POSTS, SPANS, postsFor, type PostId, type SpanId } from "@/training/ch1/layout";
import { has, type Ch1State } from "@/training/ch1/state";
import type { Tool } from "@/training/ch1/rules";
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
  tool,
  mood,
  at,
  ghost,
  onTapPost,
  onTapInner,
  onTapSpan,
}: {
  s: Ch1State;
  /** いま持っている道具。押せる場所は道具で変わる */
  tool: Tool;
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
  /* 手摺先行工法では出隅の片側が600スパンになり、柱の位置がずれる */
  const POSTS = useMemo(() => postsFor(s.side), [s.side]);
  const ids = Object.keys(BASE_POSTS) as PostId[];
  const svgRef = useRef<SVGSVGElement>(null);
  const vb = (dan ? VB_DAN : VB_TATE).split(" ").map(Number);

  /* 押せる節点。柱・内柱・スパンの中点 */
  const nodes: Node[] = useMemo(() => {
    const out: Node[] = [];
    for (const id of ids) {
      const [sx, sy] = P(POSTS[id].x, POSTS[id].y, 0);
      out.push({ key: `post:${id}`, kind: "post", id, sx, sy });
      const ip = innerPos(id, POSTS);
      const [ix, iy] = P(ip.x, ip.y, 0);
      out.push({ key: `inner:${id}`, kind: "inner", id, sx: ix, sy: iy });
    }
    for (const sp of SPANS) {
      const m = spanMid(sp.a, sp.b, POSTS);
      const [sx, sy] = P(m.x, m.y, 0);
      out.push({ key: `span:${sp.id}`, kind: "span", id: sp.id, sx, sy });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dan, POSTS]);

  /* いまの道具で押せる場所。プロトタイプと同じ振り分け。
     押せない種類を候補から外しておかないと、
     隣の点に吸い寄せられて「押していない所」が反応してしまう。 */
  const valid = useMemo(() => {
    if (tool === "move") return { post: true, inner: true, span: true };
    if (dan) {
      return {
        post: tool === "jack",
        inner: tool === "rail6" || tool === "jack",
        span: tool === "ledger",
      };
    }
    return {
      post: tool === "post" || tool === "inner" || tool === "brk",
      inner: false,
      span: tool === "ledger" || tool === "deck" || tool === "sgake" || tool === "rail6",
    };
  }, [tool, dan]);

  /* 段取りでジャッキを配るときだけ、柱と内柱の両方が押せる。
     内柱は柱から600mmしか離れていないので、画面では指1本ぶんも離れていない。
     縮尺は変えられないので、「まだ置いていない方」を先に取る。 */
  const stillNeeded = (n: Node) => {
    if (!dan || tool !== "jack") return true;
    if (n.kind === "post") return !has(s, `J:${n.id}`);
    if (n.kind === "inner") return s.inner.includes(n.id as PostId) && !has(s, `J:in:${n.id}`);
    return true;
  };

  /* 印の濃さ。押せない種類は薄く、押せてももう済んだ場所は控えめに */
  const markOpacity = (n: Node) => {
    if (!valid[n.kind]) return 0.12;
    return stillNeeded(n) ? ghost : ghost * 0.35;
  };

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
    const pick = (list: Node[]) => {
      let b: Node | null = null;
      let bd = Infinity;
      for (const n of list) {
        /* 縦は投影で潰れているので、その分だけ縦の差を重く見る */
        const dx = loc.x - n.sx;
        const dy = (loc.y - n.sy) * 1.9;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          b = n;
        }
      }
      return { node: b, d: bd };
    };
    const usable = nodes.filter((n) => valid[n.kind]);
    /* まだ手を付けていない場所を先に見る。無ければ全部から選ぶ */
    const first = pick(usable.filter(stillNeeded));
    const r = first.node && first.d <= 60 * 60 ? first : pick(usable);
    const best = r.node;
    const bestD = r.d;
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
        const ip = innerPos(id, POSTS);
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
        const ip = innerPos(id, POSTS);
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
        const ip = innerPos(id, POSTS);
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
        <Ledger key={`tie-${id}`} p1={POSTS[id]} p2={innerPos(id, POSTS)} z={1} color="var(--color-cyan)" w={3.5} />
      ))}

      {/* 出隅の600スパンをつなぐ踏板高さの手摺（手摺先行工法） */}
      {SPANS.map((sp) =>
        has(s, `R6S:${sp.id}`) ? (
          <g key={`r6s-${sp.id}`} className="drop">
            <Ledger p1={POSTS[sp.a]} p2={POSTS[sp.b]} z={1} color="var(--color-cyan)" w={5} />
          </g>
        ) : null,
      )}

      {/* 先行手摺（クロスタイプ）。踏板の高さから上さんまで、たすきに掛かる */}
      {SPANS.map((sp) => {
        if (!has(s, `SG:${sp.id}`)) return null;
        const a = POSTS[sp.a];
        const b = POSTS[sp.b];
        const A1 = P(a.x, a.y, 1);
        const A2 = P(a.x, a.y, 1.5);
        const B1 = P(b.x, b.y, 1);
        const B2 = P(b.x, b.y, 1.5);
        return (
          <g key={`sg-${sp.id}`} className="drop">
            <line x1={A1[0]} y1={A1[1]} x2={B2[0]} y2={B2[1]} stroke="var(--color-yel)" strokeWidth="2.6" opacity=".9" />
            <line x1={A2[0]} y1={A2[1]} x2={B1[0]} y2={B1[1]} stroke="var(--color-yel)" strokeWidth="2.6" opacity=".9" />
            <Ledger p1={a} p2={b} z={1.5} />
          </g>
        );
      })}

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
            opacity={markOpacity(n) * (n.kind === "span" ? 0.1 : 0.13)}
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
