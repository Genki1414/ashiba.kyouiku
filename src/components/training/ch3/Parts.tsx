"use client";

/* 第3章の描画部品。プロトタイプ（handoff/prototypes/ashiba-ch3-v13.tsx）から
   描画を変えずに移植したもの。色や書体の定数もプロトタイプのまま置いてある。

   4面が組み上がった状態を平面図で見る。
   火打は出隅4箇所。二等辺三角形になるように支柱に付ける。 */

import React, { useState } from "react";
import type { Corner } from "@/training/ch3/layout";
import { checkHiuchi, type Action, type HiuchiNg, type HiuchiPoint } from "@/training/ch3/rules";
import {
  BANDS,
  KOMA_PER_LEVEL,
  NEXT_TO_CORNER,
  POSTS as SHEET_POSTS,
  tieOrder,
  type Pitch,
  type PostKey,
} from "@/training/ch3/layout";
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

function Btn({
  children, onClick, tone, dis, style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "y";
  dis?: boolean;
  style?: React.CSSProperties;
}) {
  const y = tone === "y";
  return (
    <button onClick={onClick} disabled={dis} style={{
      background: dis ? C.panel2 : y ? C.yel : "none",
      color: dis ? C.dim2 : y ? "#14171B" : C.txt,
      border: `1px solid ${dis ? C.line : y ? C.yel : C.line}`,
      borderRadius: 9, padding: 13, fontWeight: 800, fontSize: 13.5,
      fontFamily: F, cursor: dis ? "default" : "pointer", width: "100%", ...style,
    }}>{children}</button>
  );
}

/* ── 平面図の寸法（プロトタイプのまま）──
   南面・北面＝3スパン、東面・西面＝2スパン。1スパン＝84px */
export const SP = 84;
export const PX0 = 44;
export const PX1 = PX0 + SP * 3;
export const PY1 = 250;
export const PY0 = PY1 - SP * 2;
export const BW = 26; // 足場の幅（600mm相当）

/** 出隅の平面上の位置 */
export const CORNER_XY: Record<string, { x: number; y: number }> = {
  SE: { x: PX1, y: PY1 },
  SW: { x: PX0, y: PY1 },
  NW: { x: PX0, y: PY0 },
  NE: { x: PX1, y: PY0 },
};

const CORNERS = [
  { id: "SE", nm: "南東の出隅", fa: "南面", fb: "東面", dx: -1, dy: -1, x: PX1, y: PY1 },
  { id: "SW", nm: "南西の出隅", fa: "南面", fb: "西面", dx: 1, dy: -1, x: PX0, y: PY1 },
  { id: "NW", nm: "北西の出隅", fa: "北面", fb: "西面", dx: 1, dy: 1, x: PX0, y: PY0 },
  { id: "NE", nm: "北東の出隅", fa: "北面", fb: "東面", dx: -1, dy: 1, x: PX1, y: PY0 },
];

const XS = [PX0, PX0 + SP, PX0 + SP * 2, PX1];
const YS = [PY0, PY0 + SP, PY1];

export function Plan({ done, cur, onTap, skew = 0 }: { done: string[]; cur?: { id: string; x: number; y: number } | null; onTap?: () => void; skew?: number }) {
  const posts: number[][] = [];
  XS.forEach((x) => { posts.push([x, PY0]); posts.push([x, PY1]); });
  YS.slice(1, -1).forEach((y) => { posts.push([PX0, y]); posts.push([PX1, y]); });

  /* ひし形変形のデモ：上辺だけ横へずらす */
  const sk = (x: number, y: number) => [x + skew * ((PY1 - y) / (PY1 - PY0)), y];

  const L = (x1: number, y1: number, x2: number, y2: number, st: string, w = 3.5) => {
    const a = sk(x1, y1), b = sk(x2, y2);
    return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={st} strokeWidth={w} strokeLinecap="round" />;
  };

  return (
    <svg viewBox="0 0 340 300" preserveAspectRatio="xMidYMid meet"
      data-testid="plan" data-skew={Math.round(skew)}
      style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="340" height="300" fill="#0C1015" />

      {/* 建物 */}
      <rect x={PX0 + BW} y={PY0 + BW} width={PX1 - PX0 - BW * 2} height={PY1 - PY0 - BW * 2}
        fill="#242B33" stroke="#2E3640" />
      <text x={(PX0 + PX1) / 2} y={(PY0 + PY1) / 2 + 4} textAnchor="middle" fontSize="12" fill="#4A545E" fontFamily={F}>建物</text>

      {/* 足場の外周（布材・手摺） */}
      <g opacity={skew ? .9 : 1}>
        {L(PX0, PY0, PX1, PY0, C.steel)}
        {L(PX0, PY1, PX1, PY1, C.steel)}
        {L(PX0, PY0, PX0, PY1, C.steel)}
        {L(PX1, PY0, PX1, PY1, C.steel)}
      </g>

      {/* 支柱 */}
      {posts.map(([x, y], i) => {
        const p = sk(x, y);
        return <circle key={i} cx={p[0]} cy={p[1]} r="4.5" fill={C.steelLt} />;
      })}

      {/* 入れた火打。崩れるところを見せている間は外して描く
          （火打があれば崩れないので、付けたまま傾けると話が逆になる） */}
      {skew === 0 && CORNERS.filter((c) => done.includes(c.id)).map((c) => {
        const a = sk(c.x + c.dx * SP, c.y), b = sk(c.x, c.y + c.dy * SP);
        return (
          <g key={c.id}>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={C.org} strokeWidth="4" strokeLinecap="round" />
            <circle cx={a[0]} cy={a[1]} r="3.4" fill={C.org} /><circle cx={b[0]} cy={b[1]} r="3.4" fill={C.org} />
          </g>
        );
      })}

      {/* いま入れる出隅 */}
      {cur && (
        <g onClick={onTap} style={{ cursor: "pointer" }} className="tgt">
          <circle cx={cur.x} cy={cur.y} r="19" fill={C.yel} opacity=".12" />
          <circle cx={cur.x} cy={cur.y} r="19" fill="none" stroke={C.yel} strokeWidth="2" strokeDasharray="5 4" />
        </g>
      )}

      {/* 方位 */}
      <text x={(PX0 + PX1) / 2} y={PY0 - 14} textAnchor="middle" fontSize="11" fill={C.dim} fontFamily={F}>北面</text>
      <text x={(PX0 + PX1) / 2} y={PY1 + 24} textAnchor="middle" fontSize="11" fill={C.dim} fontFamily={F}>南面</text>
      <text x={PX0 - 12} y={(PY0 + PY1) / 2} textAnchor="middle" fontSize="11" fill={C.dim} fontFamily={F}>西</text>
      <text x={PX1 + 12} y={(PY0 + PY1) / 2} textAnchor="middle" fontSize="11" fill={C.dim} fontFamily={F}>東</text>
      <text x="14" y="22" fontSize="10.5" fill={C.dim2} fontFamily={F}>平面図（最上段を上から見たところ）</text>
    </svg>
  );
}

export function HiuchiZoom({ corner, onClear, onFoul }: { corner: Corner & { x: number; y: number }; onClear: (a: HiuchiPoint, b: HiuchiPoint) => void; onFoul: (a: HiuchiPoint, b: HiuchiPoint) => void }) {
  const [sel, setSel] = useState<(HiuchiPoint & { x: number; y: number })[]>([]);
  const [ng, setNg] = useState<HiuchiNg>(null);
  const D = 100;                            // ズーム上の1スパン
  const cx = corner.dx > 0 ? 92 : 248;
  const cy = corner.dy > 0 ? 78 : 222;

  /* 取付点。f=面（a=南北面 b=東西面）、n=出隅から何本目、k=post/rail */
  const pt = (f: "a" | "b", k: "post" | "rail", n: number) => f === "a"
    ? { x: cx + corner.dx * (k === "rail" ? D * (n - .5) : D * n), y: cy }
    : { x: cx, y: cy + corner.dy * (k === "rail" ? D * (n - .5) : D * n) };
  const TGT: (HiuchiPoint & { x: number; y: number })[] = (
    [
      { f: "a", k: "post", n: 1 }, { f: "a", k: "post", n: 2 }, { f: "a", k: "rail", n: 1 },
      { f: "b", k: "post", n: 1 }, { f: "b", k: "post", n: 2 }, { f: "b", k: "rail", n: 1 },
    ] as HiuchiPoint[]
  ).map((t) => ({ ...t, ...pt(t.f, t.k, t.n) }));

  /* 2箇所選んだら親へ渡す。良し悪しの判定は rules.ts の checkHiuchi が持つ */
  const tap = (t: HiuchiPoint & { x: number; y: number }) => {
    if (sel.length >= 2) return;
    const s2 = [...sel, t];
    setSel(s2);
    SFX.step();
    if (s2.length < 2) return;
    const [a, b] = s2;
    setTimeout(() => {
      const bad = checkHiuchi(a, b);
      setNg(bad);
      if (bad) onFoul(a, b);
      else { SFX.ham(); SFX.ok(); }
    }, 260);
  };

  const okNow = sel.length === 2 && !ng && sel[0].k === "post" && sel[1].k === "post"
    && sel[0].f !== sel[1].f && sel[0].n === sel[1].n;

  const reset = () => { setSel([]); setNg(null); };

  /* 建物側（内側）の向き */
  const inX = cx + corner.dx * 60, inY = cy + corner.dy * 60;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0C1015", zIndex: 20, overflowY: "auto" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.yel }}>{corner.nm}</span>
        <span style={{ fontSize: 11, color: C.dim }}>{okNow ? "入った" : `${sel.length} / 2 箇所`}</span>
      </div>

      <svg viewBox="0 0 340 300" style={{ width: "100%", display: "block" }}>
        <rect width="340" height="300" fill="#0C1015" />

        {/* 建物（内側の面） */}
        <rect x={corner.dx > 0 ? cx + 26 : 0} y={corner.dy > 0 ? cy + 26 : 0}
          width={corner.dx > 0 ? 340 - cx - 26 : cx - 26} height={corner.dy > 0 ? 300 - cy - 26 : cy - 26}
          fill="#1B2129" />

        {/* 布材・手摺（2面） */}
        <line x1={cx} y1={cy} x2={cx + corner.dx * 230} y2={cy} stroke={C.steel} strokeWidth="6" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={cx} y2={cy + corner.dy * 230} stroke={C.steel} strokeWidth="6" strokeLinecap="round" />
        <text x={cx + corner.dx * 200} y={cy + (corner.dy > 0 ? -14 : 22)} textAnchor="middle" fontSize="11" fill={C.dim} fontFamily={F}>{corner.fa}</text>
        <text x={cx + (corner.dx > 0 ? -22 : 26)} y={cy + corner.dy * 200} textAnchor="middle" fontSize="11" fill={C.dim} fontFamily={F}>{corner.fb}</text>

        {/* 出隅の支柱 */}
        <circle cx={cx} cy={cy} r="9" fill={C.steelLt} />
        <text x={cx + corner.dx * -14} y={cy + corner.dy * -14} textAnchor="middle" fontSize="10" fill={C.dim} fontFamily={F}>出隅</text>

        {/* 選んだ2点を結ぶ火打 */}
        {sel.length === 2 && (
          <g>
            <line x1={sel[0].x} y1={sel[0].y} x2={sel[1].x} y2={sel[1].y}
              stroke={ng ? C.red : C.org} strokeWidth="5" strokeLinecap="round" />
            {okNow && (
              <>
                {/* 等辺の印 */}
                {[sel[0], sel[1]].map((p, i) => (
                  <g key={i}>
                    <line x1={(p.x + cx) / 2 - 5} y1={(p.y + cy) / 2 - 5} x2={(p.x + cx) / 2 + 5} y2={(p.y + cy) / 2 + 5}
                      stroke={C.grn} strokeWidth="2" />
                  </g>
                ))}
                <polygon points={`${cx},${cy} ${sel[0].x},${sel[0].y} ${sel[1].x},${sel[1].y}`} fill={C.grn} opacity=".13" />
              </>
            )}
          </g>
        )}

        {/* 取付点 */}
        {TGT.map((t, i) => {
          const on = sel.some((s) => s.x === t.x && s.y === t.y);
          const isPost = t.k === "post";
          return (
            <g key={i} data-hiuchi={`${t.f}-${t.k}-${t.n}`} onClick={() => tap(t)} style={{ cursor: "pointer" }} className="tgt">
              {isPost
                ? <circle cx={t.x} cy={t.y} r="7" fill={on ? (ng ? C.red : C.org) : C.steelLt} />
                : <rect x={t.x - 9} y={t.y - 5} width="18" height="10" rx="3" fill={on ? C.red : "#6E7A87"} />}
              <circle cx={t.x} cy={t.y} r="16" fill={C.yel} opacity={on ? 0 : .09} />
              <circle cx={t.x} cy={t.y} r="16" fill="none" stroke={on ? "none" : C.yel} strokeWidth="1.3" strokeDasharray="4 4" />
              <text x={t.x} y={t.y + (t.f === "a" ? 32 : 0)} dx={t.f === "b" ? 30 : 0} textAnchor="middle"
                fontSize="9.5" fill={C.dim2} fontFamily={F}>{isPost ? `支柱${t.n}本目` : "手摺"}</text>
            </g>
          );
        })}
      </svg>

      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.6, marginBottom: 8 }}>
          {okNow ? "二等辺三角形になった" : "火打を掛ける2箇所を選べ"}
        </div>
        <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.85, marginBottom: 12 }}>
          {okNow
            ? "出隅から同じ距離の支柱どうしを結んだので、平面に三角形ができた。これで足場がひし形に崩れない。"
            : "足場が平面内でひし形に変形するのを防ぐ補強だ。出隅をまたいで、火打と足場が二等辺三角形になるように掛ける。"}
        </div>

        {ng && <Btn onClick={reset} style={{ marginBottom: 10 }}>やり直す</Btn>}
        {okNow && <Btn tone="y" onClick={() => onClear(sel[0], sel[1])}>次へ</Btn>}

        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "11px 13px", fontSize: 12, color: C.dim, lineHeight: 1.9, marginTop: 12 }}>
          火打は圧縮材と併用することで引張効果が生じる。<br />
          圧縮材は火打の近傍に設けること。
        </div>
      </div>
    </div>
  );
}

export function WorkerSide() {
  return (
    <g>
      <ellipse cx="0" cy="0" rx="12" ry="3" fill="#000" opacity=".3" />
      {/* 脚 */}
      <path d="M-5 -2 L-6 -66 L2 -66 L2 -2 Z" fill={C.navy} />
      <path d="M3 -2 L2 -66 L9 -66 L8 -2 Z" fill="#2B3A4C" />
      <path d="M-8 -2 L-8 -7 L2 -7 L2 -2 Z" fill="#2B3138" />
      {/* 胴（横向きなので薄い） */}
      <path d="M-6 -64 L-8 -118 L8 -118 L7 -64 Z" fill="#5C7FA3" />
      {/* 安全帯 */}
      <rect x="-8" y="-98" width="16" height="4.5" fill="#2B3138" />
      {/* 腕（内柱側へ伸ばす） */}
      <path d="M-6 -113 L-23 -93 L-19 -88 L-2 -106 Z" fill="#5C7FA3" />
      <circle cx="-22" cy="-89" r="3.6" fill={C.skin} />
      {/* 首・頭（横顔） */}
      <rect x="-3" y="-125" width="7" height="9" fill={C.skin} />
      <circle cx="-1" cy="-134" r="11" fill={C.skin} />
      <path d="M-11.5 -135 L-15 -132 L-11.5 -130 Z" fill={C.skin} />
      <circle cx="-6" cy="-137" r="1.4" fill="#2A1D14" />
      <line x1="-10" y1="-129" x2="-6" y2="-129" stroke="#2A1D14" strokeWidth="1.2" strokeLinecap="round" />
      {/* ヘルメット */}
      <path d="M-13 -140 A12 12 0 0 1 11 -140 Z" fill={C.yel} />
      <rect x="-17" y="-142.5" width="30" height="3.4" rx="1.7" fill="#E0C200" />
    </g>
  );
}

export function Oyakata({ show, text }: { show?: boolean; text?: string }) {
  if (!show) return null;
  return (
    <div style={{
      position: "absolute", left: 10, right: 10, top: 10, zIndex: 6,
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <div style={{
        background: "#2A1512", border: `2px solid ${C.red}`, borderRadius: 14, padding: 4,
        animation: "shk .28s ease-in-out 3", flex: "0 0 auto",
      }}>
      <svg width="86" height="86" viewBox="0 0 100 100">
        <ellipse cx="50" cy="94" rx="30" ry="7" fill="#000" opacity=".3" />
        {/* 首・肩 */}
        <rect x="38" y="70" width="24" height="14" fill={C.skin} />
        <path d="M18 100 L24 82 Q50 74 76 82 L82 100 Z" fill="#3B4753" />
        {/* 顔 */}
        <circle cx="50" cy="52" r="26" fill={C.skin} />
        {/* 怒り眉 */}
        <path d="M30 42 L44 48" stroke="#2A1D14" strokeWidth="4.6" strokeLinecap="round" />
        <path d="M70 42 L56 48" stroke="#2A1D14" strokeWidth="4.6" strokeLinecap="round" />
        {/* 目 */}
        <circle cx="39" cy="55" r="3.4" fill="#2A1D14" />
        <circle cx="61" cy="55" r="3.4" fill="#2A1D14" />
        {/* 怒鳴る口 */}
        <ellipse cx="50" cy="68" rx="11" ry="8" fill="#5A2A26" />
        <path d="M41 66 Q50 62 59 66" stroke="#F0F0F0" strokeWidth="2.6" fill="none" />
        {/* ヘルメット */}
        <path d="M22 40 A28 28 0 0 1 78 40 Z" fill={C.yel} />
        <rect x="16" y="38" width="68" height="7" rx="3.5" fill="#E0C200" />
        {/* 怒りマーク */}
        <g stroke={C.red} strokeWidth="3" strokeLinecap="round">
          <path d="M76 14 L92 14" /><path d="M78 22 L94 22" />
          <path d="M82 10 L78 26" /><path d="M90 10 L86 26" />
        </g>
      </svg>
      </div>
      <div style={{
        flex: 1, background: "#2A1512", border: `1.5px solid ${C.red}`, borderRadius: 12,
        padding: "10px 12px", fontSize: 12.5, lineHeight: 1.75, color: "#F4B5AE", fontFamily: F,
      }}>{text}</div>
    </div>
  );
}
/* ── シートの立面の座標（プロトタイプのまま）── */
const FX = [44, 128, 212, 296];
const FN = ["出隅", "南①", "南②", "南端"];
const TOPY = 62, SGY = 284;
const SPANS3 = [0, 1, 2];
const CX = 100, CY = 190, PS = 62;
const PPOST: { k: PostKey; x: number; y: number; nm: string }[] = [
  { k: "corner", x: CX, y: CY, nm: "出隅" },
  { k: "s1", x: CX + PS, y: CY, nm: "南①" },
  { k: "s2", x: CX + PS * 2, y: CY, nm: "南②" },
  { k: "s3", x: CX + PS * 3, y: CY, nm: "南端" },
  { k: "w1", x: CX, y: CY - PS, nm: "西①" },
  { k: "w2", x: CX, y: CY - PS * 2, nm: "西②" },
];

/* ── シート（縦張り・1スパン1枚・上から下へ結ぶ）──
   プロトタイプの SheetPart から描画を移した。
   良し悪しの判定はここには置かず、すべて act()（rules.ts の judge）へ渡す。 */
export function SheetPart({
  act,
  angryMsg,
  onDone,
  say,
}: {
  /** 手を打つ。良手なら true。良し悪しは rules.ts が決める */
  act: (a: Action) => boolean;
  /** 親方のいまのセリフ（ファールのとき出す） */
  angryMsg: string;
  onDone: () => void;
  say: (t: string) => void;
}) {
  const [ph, setPh] = useState<"hang" | "pitch" | "tie" | "done">("hang");          // hang / pitch / tie / done
  const [hung, setHung] = useState<number[]>([]);
  const [roll, setRoll] = useState<Record<number, number>>({});
  const [footOK, setFootOK] = useState(false);
  const [ask, setAsk] = useState<number | null>(null);
  const [fall, setFall] = useState<{ i: number; y: number; done: boolean } | null>(null);
  const [pitch, setPitch] = useState<number | null>(null);
  const [bi, setBi] = useState(0);               // いま結んでいる段
  const [tied, setTied] = useState<PostKey[]>([]);          // その段で結び終えた支柱
  const [sel, setSel] = useState<PostKey | null>(null);
  const [dots, setDots] = useState<number[]>([]);
  const [gap, setGap] = useState(false);
  const [angry, setAngry] = useState(false);

  /* 叱る文言は親（rules.ts）が持つ。ここは画面を揺らして親方を出すだけ */
  const shake = () => {
    SFX.shout(); setAngry(true);
    setTimeout(() => setAngry(false), 4200);
  };

  /* ── ① 垂らす ── */
  const hang = (i: number) => {
    /* 良し悪しは親（rules.ts）が決める。ここは見せ方だけ */
    if (!act({ type: "tapSpan", span: i })) return;
    if (!footOK) { setAsk(i); return; }
    drop(i);
  };
  const drop = (i: number) => {
    SFX.ham();
    let t = 0;
    const id = setInterval(() => {
      t += 1; setRoll((r) => ({ ...r, [i]: t / 12 }));
      if (t >= 12) {
        clearInterval(id);
        const h = [...hung, i]; setHung(h);
        if (h.length === SPANS3.length) { SFX.ok(); setPh("pitch"); say("全部垂れた。ここから支柱に結んでいく。"); }
        else say("次のスパンも垂らす。全部垂らしてから結ぶ。");
      }
    }, 40);
  };
  const spread = (foot: boolean) => {
    const i = ask as number;
    act({ type: "spreadPick", span: i, foot });
    if (foot) { setFootOK(true); setAsk(null); drop(i); say("そのまま足で押さえておけ。"); }
    else {
      setAsk(null); setFall({ i, y: 0, done: false });
      shake();
      let t = 0;
      const id = setInterval(() => {
        t += 1; setFall({ i, y: t * 22, done: t >= 10 });
        if (t >= 10) { clearInterval(id); setTimeout(() => setFall(null), 2600); }
      }, 45);
    }
  };

  /* ── ② ピッチ ── */
  const pickPitch = (v: number) => {
    setPitch(v);
    if (!act({ type: "pickPitch", pitch: v as Pitch })) { shake(); return; }
    SFX.ham(); setPh("tie"); say("2段目から結んでいく。どの支柱からでもいいが、出隅は最後だ。");
  };

  /* ── ③ 支柱を選ぶ ── */
  const tap = (k: PostKey) => {
    if (tied.includes(k) || sel) return;
    if (!act({ type: "tapPost", post: k })) {
      if (k === "corner") { setGap(true); setTimeout(() => setGap(false), 1800); }
      shake();
      return;
    }
    SFX.ham(); setSel(k); setDots([]);
  };

  /* ── ④ 結ぶ位置。立っている踏板から上へ、下から順に ── */
  const DOTN = 4;                                 // 1段＝1,800mm ÷ 450mm＝4コマ
  /* 上（4コマ目）から下へ。900なら4コマ目・2コマ目 */
  const OKDOT = [4, 3, 2, 1].filter((i) => pitch === 450 ? true : i % 2 === 0);
  const hitDot = (i: number) => {
    if (dots.includes(i)) return;
    if (!act({ type: "tapKoma", koma: i })) {
      shake();
      if (i !== 0) setDots([]);
      return;
    }
    SFX.ham();
    setDots([...dots, i]);
  };

  /* 次の支柱へ（結び終わっていなければファール） */
  const goNext = () => {
    if (!act({ type: "nextPost" })) { shake(); return; }
    SFX.ok();
    const nt: PostKey[] = sel ? [...tied, sel] : tied;
    setSel(null); setDots([]);
    if (nt.length === PPOST.length) {
      /* 1段目・地上は同じ繰り返しなので省略 */
      setTied(nt); setPh("done");
      say("2段目が全部結べた。あとは1段目、地上と同じことを繰り返すだけだ。");
    } else { setTied(nt); say("結べた。次の支柱へ。"); }
  };

  const Strip = ({ i, h, drop: dy = 0, op = 1 }: { i: number; h: number; drop?: number; op?: number }) => (
    <g opacity={op}>
      <rect x={FX[i] + 2} y={TOPY + dy} width={FX[i + 1] - FX[i] - 4} height={(SGY - TOPY) * h} fill="#2C6B4A" opacity=".55" />
      <rect x={FX[i] + 2} y={TOPY + dy} width={FX[i + 1] - FX[i] - 4} height={(SGY - TOPY) * h} fill="url(#mesh)" opacity=".5" />
      <rect x={FX[i] + 2} y={TOPY + dy} width={FX[i + 1] - FX[i] - 4} height={(SGY - TOPY) * h} fill="none" stroke="#3E8F63" strokeWidth="1.5" />
    </g>
  );

  /* ══ 全画面：結ぶ位置を選ぶ ══ */
  const TieFull = () => {
    const p = PPOST.find((q) => q.k === sel)!, B = BANDS[bi];
    const Y0 = 96, Y1 = 470;                     // Y1＝いま立っている踏板
    const dy = (i: number) => Y1 - ((Y1 - Y0) / DOTN) * i;
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#0C1015", zIndex: 30,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 8, alignItems: "baseline", flex: "0 0 auto" }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: C.yel }}>{p.nm}の支柱</span>
          <span style={{ fontSize: 11, color: C.dim }}>{B.top}から{B.nm}まで　{dots.length} / {OKDOT.length}</span>
        </div>

        <svg viewBox="0 0 340 520" preserveAspectRatio="xMidYMid meet" style={{ flex: 1, minHeight: 0, width: "100%", display: "block" }}>
          <defs>
            <pattern id="mesh" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M0 0 L6 6 M6 0 L0 6" stroke="#5FBF8C" strokeWidth=".6" opacity=".7" />
            </pattern>
          </defs>
          <rect width="340" height="520" fill="#0C1015" />
          {/* 上下の段 */}
          <line x1="40" y1={Y0} x2="300" y2={Y0} stroke={C.steel} strokeWidth="5" strokeLinecap="round" />
          <line x1="40" y1={Y1} x2="300" y2={Y1} stroke={C.steel} strokeWidth="5" strokeLinecap="round" />
          <text x="300" y={Y0 - 12} textAnchor="end" fontSize="11.5" fill={C.dim} fontFamily={F}>{B.top}（4コマ）</text>
          <text x="300" y={Y1 + 22} textAnchor="end" fontSize="11.5" fill={C.dim} fontFamily={F}>{B.nm}　いま立っている踏板</text>

          {/* 左右のシートの端 */}
          <rect x="86" y={Y0} width="76" height={Y1 - Y0} fill="#2C6B4A" opacity=".5" />
          <rect x="86" y={Y0} width="76" height={Y1 - Y0} fill="url(#mesh)" opacity=".4" />
          <rect x="178" y={Y0} width="76" height={Y1 - Y0} fill="#2C6B4A" opacity=".5" />
          <rect x="178" y={Y0} width="76" height={Y1 - Y0} fill="url(#mesh)" opacity=".4" />
          <text x="124" y={Y0 + 26} textAnchor="middle" fontSize="10.5" fill="#9FD9B8" fontFamily={F}>シート</text>
          <text x="216" y={Y0 + 26} textAnchor="middle" fontSize="10.5" fill="#9FD9B8" fontFamily={F}>シート</text>

          {/* 踏板（上＝4コマ目の高さ、下＝いま立っている段） */}
          <rect x="60" y={Y0 + 4} width="200" height="9" fill="#5F6B78" stroke="#4A545E" />
          <rect x="60" y={Y1 + 4} width="200" height="11" fill="#7B8895" stroke="#4A545E" />

          {/* 支柱とコマ（450mmごと） */}
          <line x1="170" y1={Y0 - 16} x2="170" y2={Y1 + 16} stroke={C.steel} strokeWidth="16" />
          {Array.from({ length: DOTN + 1 }, (_, i) => {
            const y = Y0 + ((Y1 - Y0) / DOTN) * i;
            return <polygon key={i} points={`160,${y} 170,${y - 7} 180,${y} 170,${y + 7}`} fill={C.steelLt} />;
          })}
          <text x="170" y={Y0 - 26} textAnchor="middle" fontSize="10.5" fill={C.dim} fontFamily={F}>{p.nm}</text>

          {/* 作業員（下の段に立っている。身長1,700mm） */}
          <g transform={`translate(276,${Y1}) scale(${(Y1 - Y0) / 1800 * 1700 / 151})`}>
            <WorkerSide />
          </g>
          <text x="276" y={Y1 + 26} textAnchor="middle" fontSize="10" fill={C.dim2} fontFamily={F}>{B.nm}に立つ</text>

          {/* 結ぶ位置の候補。0＝立っている踏板の高さ（ここは下の段から結ぶ） */}
          {Array.from({ length: DOTN + 1 }, (_, i) => {
            const y = dy(i), on = dots.includes(i);
            return (
              <g key={i} data-koma={i} onClick={() => hitDot(i)} style={{ cursor: "pointer" }} className={on ? "" : "tgt"}>
                {on ? (
                  <g>
                    <line x1="120" y1={y} x2="220" y2={y} stroke={C.yel} strokeWidth="5" strokeLinecap="round" />
                    <circle cx="170" cy={y} r="9" fill={C.yel} />
                  </g>
                ) : (
                  <g>
                    <circle cx="170" cy={y} r="24" fill={C.yel} opacity=".08" />
                    <circle cx="170" cy={y} r="24" fill="none" stroke={C.yel} strokeWidth="1.5" strokeDasharray="5 5" />
                  </g>
                )}
                {i > 0 && (
                  <text x="76" y={y + 4} textAnchor="end" fontSize="11" fill={on ? C.yel : C.dim2} fontFamily={F}>
                    {i}コマ
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div style={{ padding: "8px 16px 16px", flex: "0 0 auto" }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 6 }}>どこを結ぶ？</div>
          <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.85, marginBottom: 12 }}>
            立っている踏板から上を、上から順に結んでいく。緊結ピッチ{pitch}mmなら{pitch === 450 ? "1コマごと" : "2コマごと"}だ。<br />
            結び終えたら自分で「次の支柱へ」だ。
          </div>
          <div style={{ fontSize: 11.5, color: C.dim2, fontFamily: MO, marginBottom: 10 }}>
            結んだ　{dots.length} / {OKDOT.length}
          </div>
          <Btn tone={dots.length === OKDOT.length ? "y" : undefined} onClick={goNext}>次の支柱へ</Btn>
        </div>
        <Oyakata show={angry && !!angryMsg} text={angryMsg} />
      </div>
    );
  };

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {ph === "tie" ? (
        <svg viewBox="0 0 340 250" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", minHeight: 0, display: "block" }}>
          <rect width="340" height="250" fill="#0C1015" />
          <text x="14" y="20" fontSize="10.5" fill={C.dim2} fontFamily={F}>平面図（南西の出隅まわり）　{BANDS[bi].nm}を結ぶ</text>
          <rect x={CX + 14} y={CY - PS * 2 - 14} width="196" height={PS * 2} fill="#242B33" />
          <text x={CX + 112} y={CY - PS + 4} textAnchor="middle" fontSize="11" fill="#4A545E" fontFamily={F}>建物</text>

          <line x1={CX} y1={CY} x2={CX + PS * 3} y2={CY} stroke={C.steel} strokeWidth="5" strokeLinecap="round" />
          <line x1={CX} y1={CY} x2={CX} y2={CY - PS * 2} stroke={C.steel} strokeWidth="5" strokeLinecap="round" />
          <text x={CX + PS * 1.6} y={CY + 34} textAnchor="middle" fontSize="11" fill={C.dim} fontFamily={F}>南面</text>
          <text x={CX - 34} y={CY - PS} textAnchor="middle" fontSize="11" fill={C.dim} fontFamily={F}>西面</text>

          <line x1={CX - (gap ? 0 : 9)} y1={CY + 9} x2={CX + PS * 3} y2={CY + 9} stroke="#3E8F63" strokeWidth="6" strokeLinecap="round" />
          <line x1={CX - 9} y1={CY + 9} x2={CX - 9} y2={CY - PS * 2} stroke="#3E8F63" strokeWidth="6" strokeLinecap="round" />

          {gap && (
            <g>
              <line x1={CX + PS - 24} y1={CY + 9} x2={CX + PS + 24} y2={CY + 9} stroke={C.red} strokeWidth="7" strokeLinecap="round" opacity=".85" />
              <text x={CX + PS} y={CY + 34} textAnchor="middle" fontSize="10.5" fill={C.red} fontFamily={F}>ここに隙間</text>
            </g>
          )}

          {PPOST.map((p) => {
            const on = tied.includes(p.k);
            return (
              <g key={p.k} data-post={p.k} onClick={() => tap(p.k)} style={{ cursor: "pointer" }} className={on ? "" : "tgt"}>
                <circle cx={p.x} cy={p.y} r="7" fill={on ? C.yel : C.steelLt} />
                {!on && <>
                  <circle cx={p.x} cy={p.y} r="16" fill={C.yel} opacity=".1" />
                  <circle cx={p.x} cy={p.y} r="16" fill="none" stroke={C.yel} strokeWidth="1.3" strokeDasharray="4 4" />
                </>}
                <text x={p.x + (p.k[0] === "w" ? -26 : 0)} y={p.y + (p.k[0] === "w" ? 4 : -24)} textAnchor="middle"
                  fontSize="10" fill={on ? C.yel : C.dim} fontFamily={F}>{p.nm}</text>
              </g>
            );
          })}
        </svg>
      ) : (
        <svg viewBox="0 0 340 300" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", minHeight: 0, display: "block" }}>
          <defs>
            <pattern id="mesh" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M0 0 L6 6 M6 0 L0 6" stroke="#5FBF8C" strokeWidth=".6" opacity=".7" />
            </pattern>
          </defs>
          <rect width="340" height="300" fill="#0C1015" />
          <rect y={SGY} width="340" height="16" fill="#1A2027" />
          {[TOPY, 142, 222, SGY].map((y, i) => (
            <line key={i} x1="44" y1={y} x2="296" y2={y} stroke={C.steel} strokeWidth="4" strokeLinecap="round" />
          ))}
          {FX.map((x, i) => (
            <g key={i}>
              <line x1={x} y1="52" x2={x} y2={SGY} stroke={C.steel} strokeWidth="7" />
              <text x={x} y="298" textAnchor="middle" fontSize="9.5" fill={i === 0 ? C.yel : C.dim2} fontFamily={F}>{FN[i]}</text>
            </g>
          ))}
          {SPANS3.map((i) => (roll[i] ? <Strip key={i} i={i} h={Math.min(1, roll[i])} /> : null))}
          {fall && !fall.done && <Strip i={fall.i} h={.5} drop={fall.y} op={.6} />}
          {fall && fall.done && (
            <g>
              <ellipse cx={(FX[fall.i] + FX[fall.i + 1]) / 2} cy={SGY + 6} rx="42" ry="11" fill="#2C6B4A" opacity=".85" />
              <ellipse cx={(FX[fall.i] + FX[fall.i + 1]) / 2} cy={SGY + 2} rx="34" ry="9" fill="#3E8F63" opacity=".8" />
              <text x={(FX[fall.i] + FX[fall.i + 1]) / 2} y={SGY - 14} textAnchor="middle" fontSize="11" fill={C.red} fontFamily={F} fontWeight="800">落とした</text>
            </g>
          )}
          {ph === "hang" && SPANS3.filter((i) => !hung.includes(i) && !roll[i]).map((i) => (
            <g key={i} onClick={() => hang(i)} style={{ cursor: "pointer" }} className="tgt">
              <rect x={FX[i] + 4} y={TOPY} width={FX[i + 1] - FX[i] - 8} height={SGY - TOPY} fill={C.yel} opacity=".07" />
              <rect x={FX[i] + 4} y={TOPY} width={FX[i + 1] - FX[i] - 8} height={SGY - TOPY} fill="none" stroke={C.yel} strokeWidth="1.4" strokeDasharray="5 4" />
              <text x={(FX[i] + FX[i + 1]) / 2} y={TOPY + 26} textAnchor="middle" fontSize="11" fill={C.yel} fontFamily={F}>垂らす</text>
            </g>
          ))}
        </svg>
      )}

      <Oyakata show={angry && !sel && !!angryMsg} text={angryMsg} />

      <div style={{ padding: "6px 16px 14px", flex: "0 0 auto" }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.6, marginBottom: 8 }}>
          {ask !== null ? "シートを広げる。落とさないためには？"
            : ph === "hang" ? "まず全スパンを垂らす"
              : ph === "pitch" ? "緊結ピッチはどれで結ぶ？"
                : ph === "tie" ? `${BANDS[bi].nm}を結ぶ　支柱 ${tied.length} / ${PPOST.length}`
                  : "2段目が結べた"}
        </div>
        <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.85, marginBottom: 12 }}>
          {ask !== null ? "張り始めのシートを地上へ落とすのが、この作業で一番多い失敗だ。"
            : ph === "hang" ? "シートは縦に張る。1スパンに1枚。先に全部、最上段から下へ垂らしてしまう。"
              : ph === "pitch" ? "シートを支柱に結ぶ間隔だ。"
                : ph === "tie" ? "この段の支柱を全部結んでから、下の段へ下りる。出隅は南①・西①の両方を結んでからだ。"
                  : "この下は同じことの繰り返しだ。1段目、地上と下りて、他の面も同じ要領で張っていく。"}
        </div>

        {ask !== null && (
          <div style={{ display: "grid", gap: 8 }}>
            <Btn onClick={() => spread(true)}>足で挟んで押さえる</Btn>
            <Btn onClick={() => spread(false)}>手で持つだけで広げる</Btn>
          </div>
        )}
        {ph === "pitch" && (
          <div style={{ display: "grid", gap: 8 }}>
            <Btn onClick={() => pickPitch(450)}>450mm</Btn>
            <Btn onClick={() => pickPitch(900)}>900mm（戸建）</Btn>
            <Btn onClick={() => pickPitch(1800)}>1,800mm</Btn>
          </div>
        )}
        {(ph === "tie" || ph === "done") && pitch && (
          <div style={{ fontSize: 11.5, color: C.dim2, fontFamily: MO, marginBottom: 10 }}>緊結ピッチ {pitch}mm　／　{BANDS[bi].nm}</div>
        )}
        {ph === "done" && <Btn tone="y" onClick={onDone}>次へ</Btn>}
      </div>

      {sel && <TieFull />}
    </div>
  );
}