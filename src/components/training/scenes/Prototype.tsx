"use client";

/* プロトタイプ（handoff/ashiba-app-v16h.tsx）の場面部品を、描画を変えずに移植したもの。
   色や書体の定数もプロトタイプのまま置いてある（見た目を一致させるため）。

   - InnerArt   内柱と外柱の立面。ghost=これから入る材／rail=600手摺が付いた状態
   - RailAnim   600手摺を取り付けるところ
   - MiniPlan   いまどこで何を向いているか（俯瞰と同じ向き）
   - LevelZoom  水平器。置き場所を選ばせてから気泡を合わせる
   - Choice     選択の場面
   - Scold      ファールのとき、親方が怒る

   音は src/lib/sfx.ts。プロトタイプと同じ波形をその場で作って鳴らす。 */

import React, { useEffect, useState } from "react";
import { POSTS, type PostId } from "@/training/ch1/layout";
import { P, pts, innerPos as inPos, VB_TATE as VB } from "../geometry";
import { Boss, WorkerSide } from "../Characters";
import { SFX } from "@/lib/sfx";

/* ── プロトタイプの定数（そのまま） ── */
const C = {
  bg: "#14171B", panel: "#1E232A", panel2: "#252C34", line: "#2E3640",
  steel: "#93A0AD", steelLt: "#CBD6DF", steelDk: "#5F6B78",
  yel: "#F5D400", red: "#E23B2E", grn: "#25B36B", cyan: "#4FC3D9", org: "#D98B2B",
  navy: "#2F4A6B", skin: "#E2B48C", txt: "#E9EEF3", dim: "#8D98A4", dim2: "#5F6B78",
};
const F = `"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif`;
const MO = `ui-monospace,"SFMono-Regular",Menlo,monospace`;

/* プロトタイプの Btn（big 付き） */
function Btn({
  children, onClick, tone, big, style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "y";
  big?: boolean;
  style?: React.CSSProperties;
}) {
  const y = tone === "y";
  return (
    <button onClick={onClick} style={{
      background: y ? C.yel : C.panel2, color: y ? "#14171B" : C.txt,
      border: `1px solid ${y ? C.yel : C.line}`,
      borderRadius: 9, padding: big ? "15px 16px" : "13px 8px",
      fontSize: big ? 14 : 13.5, fontWeight: 800,
      fontFamily: F, cursor: "pointer", width: "100%",
      textAlign: big ? "left" : "center", lineHeight: 1.5, ...style,
    }}>{children}</button>
  );
}

export type SpotKey = "end" | "in" | "mid";

export type ChoiceOpt = { t: string; ok?: boolean; v?: string };

type LevelZoomProps = {
  baseN: string;
  tgtN: string;
  aId: PostId;
  bId?: PostId;
  flip?: boolean;
  vertical?: boolean;
  miniInner?: boolean;
  onClear: () => void;
  /** 基準側のジャッキを触ったとき */
  onFoul: () => void;
  /** 水平器の置き場所を外したとき。叱るのは場面の中で行うので、
      呼び出し側は技能点を引くだけにする */
  onSpotFoul?: (spot: "end" | "mid") => void;
};

export function InnerArt({ flip, ghost, rail }: { flip?: boolean; ghost?: boolean; rail?: boolean }) {
  const ox = flip ? 250 : 92, ix = flip ? 92 : 250;   // 外柱 / 内柱
  const GY = 176, TOP = 46, RY = 104;                  // 地面 / 柱頭 / 踏板高さ
  const koma: number[] = [];
  for (let y = GY - 18; y > TOP; y -= 26) koma.push(y);
  return (
    <svg viewBox="0 0 340 200" style={{ width: "100%", display: "block" }}>
      <rect y={GY} width="340" height="24" fill="#1A2027" />
      {[ox, ix].map((x, i) => (
        <g key={i}>
          <line x1={x} y1={GY} x2={x} y2={i ? RY - 6 : TOP} stroke={C.steel} strokeWidth={i ? 7 : 9} />
          <ellipse cx={x} cy={GY - 2} rx="15" ry="5" fill={C.steelDk} />
          {koma.filter((y) => (i ? y > RY - 8 : true)).map((y) => (
            <polygon key={y} points={`${x - 7},${y} ${x},${y - 3.5} ${x + 7},${y} ${x},${y + 3.5}`} fill={C.steelLt} />
          ))}
        </g>
      ))}
      <text x={ox} y={TOP - 12} textAnchor="middle" fontSize="11" fill={C.dim} fontFamily={F}>外柱</text>
      <text x={ix} y={RY - 22} textAnchor="middle" fontSize="11" fill={C.yel} fontFamily={F} fontWeight="700">内柱</text>
      {/* 1コマ目の根がらみ手摺 */}
      <g>
        <line x1={ox} y1={GY - 18} x2={ix} y2={GY - 18} stroke={C.yel} strokeWidth="6" />
        <text x={(ox + ix) / 2} y={GY - 26} textAnchor="middle" fontSize="10" fill={C.yel} fontFamily={F} opacity=".8">根がらみ手摺</text>
      </g>
      {rail && (
        <g>
          <line x1={ox} y1={RY} x2={ix} y2={RY} stroke={C.cyan} strokeWidth="6" />
          <text x={(ox + ix) / 2} y={RY - 10} textAnchor="middle" fontSize="10" fill={C.cyan} fontFamily={F}>踏板用手摺（600）</text>
        </g>
      )}
      <line x1="20" y1={RY} x2="320" y2={RY} stroke={C.dim} strokeWidth="1" strokeDasharray="4 5" opacity=".5" />
      <text x={flip ? 300 : 24} y={RY - 8} textAnchor={flip ? "end" : "start"} fontSize="10" fill={C.dim} fontFamily={F}>この高さに踏板が載る</text>
      {ghost && (
        <g opacity=".35">
          <line x1={ox} y1={RY} x2={ix} y2={RY} stroke={C.cyan} strokeWidth="6" strokeDasharray="7 6" />
          <text x={(ox + ix) / 2} y={RY - 12} textAnchor="middle" fontSize="10.5" fill={C.cyan} fontFamily={F}>ここに入る材は？</text>
        </g>
      )}
    </svg>
  );
}

export function MiniPlan({ aId, bId, inner }: { aId: PostId; bId?: PostId; inner?: boolean }) {
  const ap = POSTS[aId];
  const bp = inner || !bId ? inPos(aId) : POSTS[bId];
  const A = P(ap.x, ap.y), B = P(bp.x, bp.y);
  const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1;
  const hx = B[0] - (dx / len) * 16, hy = B[1] - (dy / len) * 16;
  const nx = -(dy / len) * 6, ny = (dx / len) * 6;
  return (
    <svg viewBox={VB} width="112" height="80" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <polygon points={pts(P(-0.6, 0.95), P(2.55, 0.95), P(2.55, 2.9), P(-0.6, 2.9))} fill="#2A323A" />
      {Object.values(POSTS).map((p, i) => { const q = P(p.x, p.y); return <circle key={i} cx={q[0]} cy={q[1]} r="7" fill="#49535D" />; })}
      <line x1={A[0]} y1={A[1]} x2={hx} y2={hy} stroke={C.cyan} strokeWidth="7" />
      <polygon points={`${B[0]},${B[1]} ${hx + nx},${hy + ny} ${hx - nx},${hy - ny}`} fill={C.cyan} />
      <circle cx={A[0]} cy={A[1]} r="9" fill={C.steelLt} />
      <circle cx={B[0]} cy={B[1]} r="9" fill={C.yel} />
    </svg>
  );
}

export function Choice({ title, q, opts, art, onPick }: { title: string; q: string; opts: ChoiceOpt[]; art?: React.ReactNode; onPick: (o: ChoiceOpt) => void }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#0C1015ee", zIndex: 20, display: "flex", alignItems: "center", padding: 20 }}>
      <div style={{ width: "100%" }}>
        <div style={{ fontSize: 11, color: C.yel, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>{title}</div>
        {art && <div style={{ background: "#10151B", border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>{art}</div>}
        <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 16, lineHeight: 1.5 }}>{q}</div>
        <div style={{ display: "grid", gap: 8 }}>{opts.map((o, i) => <Btn key={i} big onClick={() => onPick(o)}>{o.t}</Btn>)}</div>
      </div>
    </div>
  );
}

export function Scold({ line, onClose }: { line: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#000b", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, padding: 20 }}>
      <div className="shake" style={{ background: C.panel, border: `2px solid ${C.red}`, borderRadius: 14, padding: 18, maxWidth: 350, width: "100%" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Boss size={72} angry />
          <div>
            <div style={{ fontSize: 11, color: C.red, fontWeight: 800, letterSpacing: 1, marginBottom: 5 }}>ファール　技能 −10 ／ コンボ切れ</div>
            <div style={{ fontSize: 15.5, fontWeight: 800, lineHeight: 1.6 }}>{line}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ marginTop: 14, width: "100%", background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: 12, fontWeight: 800, fontFamily: F, fontSize: 14, cursor: "pointer" }}>すいません！</button>
      </div>
    </div>
  );
}

export function RailAnim({ flip, corner, onDone }: { flip?: boolean; corner?: boolean; onDone: () => void }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setT(1), 850);
    const b = setTimeout(() => { setT(2); SFX.hammer(); }, 1650);
    const c = setTimeout(() => setT(3), 2250);
    return () => { [a, b, c].forEach(clearTimeout); };
  }, []);
  const ox = flip ? 250 : 92, ix = flip ? 92 : 250;
  const GY = 176, TOP = 46, RY = 104;
  const mid = (ox + ix) / 2;
  const wedgeX = ix;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0C1015", zIndex: 32, display: "flex", flexDirection: "column", justifyContent: "center", padding: 16 }}>
      <div style={{ fontSize: 11, color: C.cyan, fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>踏板用手摺（600手摺）</div>
      <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.5, marginBottom: 10 }}>
        {corner ? <>踏板が載る高さのコマに入れて、<br />出隅と次の柱をつなぐ。</> : <>踏板が載る高さのコマに入れて、<br />外柱と内柱をつなぐ。</>}
      </div>

      <div style={{ background: "#10151B", border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
        <svg viewBox="0 0 340 200" style={{ width: "100%", display: "block" }}>
          <rect y={GY} width="340" height="24" fill="#1A2027" />
          {[[ox, 9, TOP], [ix, 7, RY - 6]].map(([x, w, top], i) => (
            <g key={i}>
              <line x1={x} y1={GY} x2={x} y2={top} stroke={C.steel} strokeWidth={w} />
              <ellipse cx={x} cy={GY - 2} rx="15" ry="5" fill={C.steelDk} />
              <polygon points={`${x - 7},${RY} ${x},${RY - 3.5} ${x + 7},${RY} ${x},${RY + 3.5}`} fill={C.steelLt} />
            </g>
          ))}
          <line x1={ox} y1={GY - 18} x2={ix} y2={GY - 18} stroke={C.yel} strokeWidth="6" />
          <text x={(ox + ix) / 2} y={GY - 26} textAnchor="middle" fontSize="10" fill={C.yel} fontFamily={F} opacity=".8">根がらみ手摺</text>
          <text x={ox} y={TOP - 12} textAnchor="middle" fontSize="11" fill={C.dim} fontFamily={F}>{corner ? "出隅" : "外柱"}</text>
          <text x={ix} y={RY - 24} textAnchor="middle" fontSize="11" fill={C.yel} fontFamily={F} fontWeight="700">{corner ? "次の柱" : "内柱"}</text>

          {/* 600手摺 */}
          <g style={{
            transform: t >= 1 ? "translate(0px,0px)" : `translate(${flip ? -26 : 26}px,-54px)`,
            opacity: t >= 1 ? 1 : .8, transition: "transform .65s cubic-bezier(.3,.8,.4,1.2), opacity .4s",
          }}>
            <line x1={ox} y1={RY} x2={ix} y2={RY} stroke={C.cyan} strokeWidth="6.5" strokeLinecap="butt" />
            <polygon points={`${ox},${RY - 6} ${ox + (flip ? -6 : 6)},${RY - 1} ${ox},${RY + 5}`} fill={C.cyan} />
            <polygon points={`${ix},${RY - 6} ${ix + (flip ? 6 : -6)},${RY - 1} ${ix},${RY + 5}`} fill={C.cyan} />
          </g>

          {/* ハンマー */}
          {t >= 1 && t < 3 && (
            <g style={{ transform: t >= 2 ? "rotate(8deg)" : "rotate(-42deg)", transformOrigin: `${wedgeX}px ${RY - 4}px`, transition: "transform .16s ease-in" }}>
              <line x1={wedgeX} y1={RY - 10} x2={wedgeX + (flip ? 54 : -54)} y2={RY - 44} stroke="#8A6A45" strokeWidth="6" strokeLinecap="round" />
              <rect x={wedgeX + (flip ? 44 : -68)} y={RY - 58} width="24" height="16" rx="3" fill={C.steelDk} stroke={C.steelLt} />
            </g>
          )}
          {t === 2 && <circle cx={wedgeX} cy={RY - 2} r="16" fill={C.yel} opacity=".55" className="flash" />}

          {t >= 3 && (
            <g className="drop">
              <line x1={mid - 46} y1={RY - 30} x2={mid + 46} y2={RY - 30} stroke={C.grn} strokeWidth="2" strokeDasharray="5 4" />
              <text x={mid} y={RY - 36} textAnchor="middle" fontSize="10.5" fill={C.grn} fontFamily={F}>これで内柱が固定される</text>
            </g>
          )}
        </svg>
      </div>

      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.7, marginTop: 10 }}>
        {corner
          ? "足元は根がらみ手摺で留まっているが、上はまだ自由に動く。踏板高さでもつないで、初めて柱の位置が決まる。つないでから支柱に水平器を当てる。"
          : "足元は根がらみ手摺で留まっているが、上はまだ自由に動く。踏板高さでもつないで、初めて内柱の位置が決まる。"}
      </div>
      <button onClick={onDone} disabled={t < 3} style={{
        marginTop: 12, width: "100%", background: t >= 3 ? C.yel : C.panel2, color: t >= 3 ? "#14171B" : C.dim,
        border: `1px solid ${t >= 3 ? C.yel : C.line}`, borderRadius: 9, padding: 13,
        fontWeight: 800, fontSize: 14, fontFamily: F, cursor: t >= 3 ? "pointer" : "default",
      }}>{t >= 3 ? "次へ" : "取り付け中…"}</button>
    </div>
  );
}

export function LevelZoom({ baseN, tgtN, aId, bId, flip, vertical, miniInner, onClear, onFoul, onSpotFoul }: LevelZoomProps) {
  const [o, setO] = useState(() => (Math.random() < .5 ? -1 : 1) * (2 + Math.floor(Math.random() * 2)));
  /* 根がらみのときは、まず水平器をどこに置くかを選ばせる */
  const [spot, setSpot] = useState<SpotKey | null>(vertical ? "in" : null);
  const [ng, setNg] = useState<string | null>(null);
  const bx = flip ? 258 : 82, tx = flip ? 82 : 258;
  const by = 116, ty = 116 - o * 7;
  const ang = (Math.atan2(ty - by, tx - bx) * 180) / Math.PI;
  const mx = (bx + tx) / 2, my = (by + ty) / 2;
  const hit = (d: "up" | "down") => { SFX.tick(); const v = o + (d === "up" ? 1 : -1); setO(v); if (v === 0) setTimeout(onClear, 480); };
  /* 手摺の上：端（凹み）／端から少し中（正解）／中ほど */
  /* 手摺の描画は進行方向が左のとき180度回るので、回転後に進行方向側へ来る端を基準にする */
  const vEnd = flip ? bx : tx, vOther = flip ? tx : bx;
  const vDir = vEnd > vOther ? 1 : -1;
  const SPOTX: Record<SpotKey, number> = { end: vEnd - vDir * 16, in: vEnd - vDir * 52, mid: vEnd - vDir * 104 };
  const SPOTNM: Record<SpotKey, string> = { end: "手摺の端", in: "端から少し中", mid: "手摺の中ほど" };
  const putLevel = (k: SpotKey) => {
    if (k === "in") { SFX.tick(); setNg(null); setSpot("in"); return; }
    SFX.buzz(); SFX.shout();
    onSpotFoul?.(k);
    setNg(k === "end"
      ? "そこは手摺の端だ。差し込みの都合で凹んでいる。面が出ていないから、気泡が真ん中に来ても水平は出ていないぞ。"
      : "遠すぎる。ジャッキを回しながら気泡が見えないだろう。回しては見に行き、を繰り返す気か。");
  };
  const B = { n: vertical ? "外柱" : baseN, adj: false }, T = { n: tgtN, adj: true };
  const sides = flip ? [T, B] : [B, T];
  const faceN = (POSTS[(vertical ? aId : bId) ?? aId] || {}).face === "E" ? "東面" : "南面";
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0C1015", zIndex: 30, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 8, flex: "0 0 auto", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.yel }}>水平器</span>
        <span style={{ fontSize: 11, color: C.dim }}>{vertical ? "内柱を見る" : "根がらみを見る"}</span>
        <span style={{ fontSize: 10.5, color: C.cyan, border: `1px solid ${C.line}`, borderRadius: 4, padding: "2px 6px" }}>
          {faceN}／{flip ? "基準右・進行左" : "基準左・進行右"}
        </span>
        <span data-testid="level-now" data-o={o} style={{ marginLeft: "auto", fontSize: 11, fontFamily: MO, color: o === 0 ? C.grn : C.dim }}>
          {o === 0 ? "水平" : `${tgtN} が ${Math.abs(o) * 5}mm ${o > 0 ? "高い" : "低い"}`}
        </span>
      </div>

      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <div style={{ position: "absolute", right: 10, top: 8, background: "#161C22e6", border: `1px solid ${C.line}`, borderRadius: 8, padding: "4px 4px 2px", zIndex: 2 }}>
          <MiniPlan aId={aId} bId={bId} inner={miniInner === undefined ? vertical : miniInner} />
          <div style={{ fontSize: 9, color: C.dim, textAlign: "center", paddingBottom: 2 }}>現在地と向き</div>
        </div>

        <svg viewBox="0 0 340 220" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
          <rect y="192" width="340" height="28" fill="#1A2027" />
          {!vertical && <g>
            <line x1={flip ? 190 : 150} y1="26" x2={flip ? 74 : 266} y2="26" stroke={C.cyan} strokeWidth="2" />
            <polygon points={flip ? "62,26 76,20 76,32" : "278,26 264,20 264,32"} fill={C.cyan} />
            <text x={flip ? 152 : 150} y="17" fontSize="11" fill={C.cyan} fontFamily={F} fontWeight="700">進行方向</text>
          </g>}
          <text x={bx} y="52" textAnchor="middle" fontSize="11" fill={C.dim} fontFamily={F}>{vertical ? "外柱" : `基準 ${baseN}`}</text>
          <text x={tx} y="52" textAnchor="middle" fontSize="11" fill={C.yel} fontFamily={F} fontWeight="700">{tgtN}</text>

          <line x1={bx} y1="190" x2={bx} y2={by - 6} stroke={C.steel} strokeWidth="9" />
          <ellipse cx={bx} cy="187" rx="15" ry="5" fill={C.steelDk} />
          <line x1={tx} y1="190" x2={tx} y2={vertical ? ty - 46 : ty - 6} stroke={C.steel} strokeWidth={vertical ? 7 : 9} />
          <ellipse cx={tx} cy="187" rx="15" ry="5" fill={C.steelDk} />
          <line x1={bx} y1={by} x2={tx} y2={ty} stroke={vertical ? C.cyan : C.yel} strokeWidth="7" strokeLinecap="round" />

          {/* 作業員（身長1,700mm。根がらみは地面から450mm） */}
          <g transform={`translate(${flip ? 34 : 306},190) scale(${flip ? -0.62 : 0.62},0.62)`}>
            <WorkerSide />
          </g>

          {vertical ? (
            <g>
              <rect x={tx + (flip ? -34 : 12)} y={ty - 60} width="22" height="72" rx="4" fill="#3A444E" stroke={C.steelLt} />
              <rect x={tx + (flip ? -30 : 16)} y={ty - 42} width="14" height="36" rx="7" fill="#0F1318" />
              <line x1={tx + (flip ? -30 : 16)} y1={ty - 27} x2={tx + (flip ? -16 : 30)} y2={ty - 27} stroke={C.grn} strokeWidth="1" />
              <line x1={tx + (flip ? -30 : 16)} y1={ty - 17} x2={tx + (flip ? -16 : 30)} y2={ty - 17} stroke={C.grn} strokeWidth="1" />
              <circle cx={tx + (flip ? -23 : 23)} cy={ty - 22 - o * 5} r="5" fill={o === 0 ? C.grn : C.yel} />
            </g>
          ) : (
            <g transform={`rotate(${ang} ${mx} ${my})`}>
              {spot && (() => {
                const px = SPOTX[spot];
                return (
                  <g>
                    <rect x={px - 44} y={my - 32} width="88" height="24" rx="5" fill="#3A444E" stroke={C.steelLt} />
                    <rect x={px - 24} y={my - 26} width="48" height="12" rx="6" fill="#0F1318" />
                    <line x1={px - 7} y1={my - 28} x2={px - 7} y2={my - 12} stroke={C.grn} strokeWidth="1" />
                    <line x1={px + 7} y1={my - 28} x2={px + 7} y2={my - 12} stroke={C.grn} strokeWidth="1" />
                    <circle cx={px + (flip ? -1 : 1) * o * 7} cy={my - 20} r="5" fill={o === 0 ? C.grn : C.yel} />
                  </g>
                );
              })()}
              {!spot && (Object.keys(SPOTX) as SpotKey[]).map((k) => (
                <g key={k} onClick={() => putLevel(k)} style={{ cursor: "pointer" }} className="tgt">
                  <circle cx={SPOTX[k]} cy={my - 16} r="18" fill={C.yel} opacity=".1" />
                  <circle cx={SPOTX[k]} cy={my - 16} r="18" fill="none" stroke={C.yel} strokeWidth="1.4" strokeDasharray="4 4" />
                  <g transform={Math.abs(ang) > 90 ? `rotate(180 ${SPOTX[k]} ${my + (k === "in" ? 40 : 26)})` : ""}>
                    <text x={SPOTX[k]} y={my + (k === "in" ? 40 : 26)} textAnchor="middle" fontSize="9.5" fill={C.dim} fontFamily={F}>{SPOTNM[k]}</text>
                  </g>
                </g>
              ))}
            </g>
          )}
        </svg>
      </div>

      <div style={{ padding: "12px 16px 16px", flex: "0 0 auto", maxHeight: "46vh", overflowY: "auto" }}>
        {!spot && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>水平器をどこに置く？</div>
            <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.8 }}>
              ここで取った水平が、この先の全部の基準になる。ジャッキを回しながら気泡を見られる場所に置け。
            </div>
            {ng && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12 }}>
                <div style={{ flex: "0 0 auto" }}><Boss size={54} angry /></div>
                <div style={{
                  flex: 1, background: "#2A1512", border: `1.5px solid ${C.red}`, borderRadius: 12,
                  padding: "10px 12px", fontSize: 12.5, lineHeight: 1.8, color: "#F4B5AE",
                }}>{ng}</div>
              </div>
            )}
          </div>
        )}
        {spot && <div style={{ fontSize: 12.5, color: o === 0 ? C.grn : C.dim, lineHeight: 1.6, marginBottom: 14 }}>
          {o === 0 ? "水平が出た。" : o > 0 ? `気泡は高い側に寄る。いま ${tgtN} 側が高い。` : `気泡は高い側に寄る。${vertical ? "外柱" : "基準"}側が高い＝${tgtN} が低い。`}
        </div>}
        {spot && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {sides.map((s, i) => (
            <div key={i} data-side={s.adj ? "adj" : "base"}>
              <div style={{ fontSize: 10.5, marginBottom: 6, color: s.adj ? C.yel : C.dim, fontWeight: 700, textAlign: "center" }}>{s.n}{s.adj ? "" : "（基準）"}</div>
              <div style={{ display: "grid", gap: 6 }}>
                <Btn tone={s.adj ? "y" : undefined} onClick={() => (s.adj ? hit("up") : onFoul())}>↑ 上げる</Btn>
                <Btn tone={s.adj ? "y" : undefined} onClick={() => (s.adj ? hit("down") : onFoul())}>↓ 下げる</Btn>
              </div>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}