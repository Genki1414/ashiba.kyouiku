"use client";

/* 第2章の描画部品。プロトタイプ（handoff/prototypes/ashiba-ch2-v6.tsx）から
   描画を変えずに移植したもの。色や書体の定数もプロトタイプのまま置いてある。

   立面で見る。コマは450mmピッチで支柱の全長に描く。
   内柱は奥行きを表すため少し左へずらす。建物は描かず、屋根だけ出す。 */

import React, { useEffect, useRef, useState } from "react";
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

/* ── 立面の座標（プロトタイプのまま）── */
export const X0 = 56;
export const SW = 72;
export const GY = 428;
export const LH = 88;   // 1段 = 1,800mm
export const KP = 0.25; // コマのピッチ（450mm）
export const IN_DX = -22; // 内柱の見かけのずれ（奥行き表現）
export const px = (i: number) => X0 + i * SW;
export const py = (lv: number) => GY - lv * LH;

/* ── 屋根（足場の奥。南面が水下）── */
export const RF_L = () => px(0) + IN_DX + 4;
export const RF_R = () => px(3) + IN_DX - 4;
export const RF_EAVE = () => py(3);
export const RF_RIDGE = () => py(2) - 1.95 * LH;
export const roofYAt = () => RF_EAVE();

export function Kenta({ mood = "normal", walking }: { mood?: string; walking?: boolean }) {
  return (
    <g className={walking ? "walk" : "idle"}>
      <ellipse cx="0" cy="1" rx="10" ry="3.5" fill="#000" opacity=".35" />
      <path d="M-6 -18 L-7 -3 L-3 -3 L-2 -18 Z" fill={C.navy} />
      <path d="M6 -18 L7 -3 L3 -3 L2 -18 Z" fill={C.navy} />
      <path d="M-8 -36 L8 -36 L9 -17 L-9 -17 Z" fill="#5C7FA3" />
      <rect x="-9.5" y="-22" width="19" height="4" rx="1" fill="#2B3138" />
      <rect x="-10" y="-22" width="4.5" height="7" rx="1.5" fill="#6B5636" />
      <path d="M-8 -34 L-13 -20 L-9 -19 L-5 -31 Z" fill="#5C7FA3" />
      <path d="M8 -34 L13 -20 L9 -19 L5 -31 Z" fill="#5C7FA3" />
      <circle cx="-11" cy="-18" r="2.4" fill={C.skin} /><circle cx="11" cy="-18" r="2.4" fill={C.skin} />
      <circle cx="0" cy="-42" r="7.5" fill={C.skin} />
      <circle cx="-2.8" cy="-42" r="1.3" fill="#2A1D14" /><circle cx="2.8" cy="-42" r="1.3" fill="#2A1D14" />
      {mood === "good" ? <path d="M-3 -38 Q0 -35 3 -38" stroke="#2A1D14" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        : mood === "bad" ? <ellipse cx="0" cy="-37.5" rx="2.2" ry="1.6" fill="#2A1D14" />
          : <line x1="-2.4" y1="-37.6" x2="2.4" y2="-37.6" stroke="#2A1D14" strokeWidth="1.2" strokeLinecap="round" />}
      <path d="M-9 -46 A9 9 0 0 1 9 -46 Z" fill={C.yel} />
      <rect x="-11" y="-47" width="22" height="3.2" rx="1.6" fill="#E0C200" />
    </g>
  );
}

/** 指でもマウスでも受ける */
type PointerLike = React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>;

/* ── ズーム共通の縮尺（プロトタイプのまま）──
   コマ450mm = 40px。作業員は身長1,600mm相当 */
const ZP = 40;
const ZD = 268;                     // 踏板の高さ
const ZX1 = 74, ZX2 = 266;          // 支柱2本
const zk = (n: number) => ZD - n * ZP;   // n番目のコマ（1=450mm）

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

export function Post({ i, top, inner, joint }: { i: number; top: number; inner?: boolean; joint?: boolean }) {
  const x = px(i) + (inner ? IN_DX : 0), yB = GY, yT = py(top);
  const komas = [];
  for (let v = KP; v <= top + 0.001; v += KP) komas.push(py(v));
  return (
    <g className="el">
      <line x1={x} y1={yB} x2={x} y2={yT} stroke={inner ? "#7E8A96" : C.steel} strokeWidth={inner ? 6.5 : 8} />
      <line x1={x} y1={yT} x2={x} y2={yT - 12} stroke={C.steelDk} strokeWidth={inner ? 3.5 : 4.5} />
      {komas.map((y, j) => (
        <polygon key={j} points={`${x - 6.5},${y} ${x},${y - 3.2} ${x + 6.5},${y} ${x},${y + 3.2}`} fill={C.steelLt} />
      ))}
      {joint && <rect x={x - 5} y={py(1) - 6} width="10" height="12" rx="2" fill="#6E7A87" stroke={C.steelDk} />}
    </g>
  );
}

export function Rail({ a, b, lv, color = C.yel }: { a: number; b: number; lv: number; color?: string }) {
  const x1 = px(a), x2 = px(b);
  const yU = py(lv) - 0.5 * LH;   // 踏板から約900mm
  const yM = py(lv) - 0.25 * LH;  // 中さん
  const wedge = (x: number, d: number, y: number) => `${x},${y - 6} ${x + d * 7},${y - 1} ${x},${y + 5}`;
  return (
    <g className="el">
      <line x1={x1} y1={yU} x2={x2} y2={yU} stroke={color} strokeWidth="5.5" />
      <polygon points={wedge(x1, 1, yU)} fill={color} /><polygon points={wedge(x2, -1, yU)} fill={color} />
      <line x1={x1} y1={yM} x2={x2} y2={yM} stroke={color} strokeWidth="4" opacity=".85" />
      <polygon points={wedge(x1, 1, yM)} fill={color} opacity=".85" /><polygon points={wedge(x2, -1, yM)} fill={color} opacity=".85" />
    </g>
  );
}

export function Deck({ a, b, lv, inner }: { a: number; b: number; lv: number; inner?: boolean }) {
  const x1 = px(a) + (inner ? IN_DX : 0), x2 = px(b) + (inner ? IN_DX : 0), y = py(lv);
  return (
    <g className="el">
      <rect x={x1} y={y - 9} width={x2 - x1} height="10" fill="#7B8895" stroke="#4A545E" strokeWidth="1.4" />
      {[...Array(Math.max(2, Math.floor((x2 - x1) / 14)))].map((_, i) => (
        <line key={i} x1={x1 + 7 + i * 14} y1={y - 8} x2={x1 + 7 + i * 14} y2={y} stroke="#6B7884" strokeWidth="1" />
      ))}
    </g>
  );
}

export function Brk({ i, lv }: { i: number; lv: number }) {
  const x = px(i), y = py(lv);
  return (
    <g className="el">
      <polygon points={`${x},${y} ${x + IN_DX - 4},${y} ${x},${y - 26}`} fill={C.steelDk} stroke={C.steel} strokeWidth="1.2" />
      <line x1={x} y1={y} x2={x + IN_DX - 4} y2={y} stroke={C.steel} strokeWidth="4" />
    </g>
  );
}

export function Rail6({ i, lv }: { i: number; lv: number }) {
  const x = px(i), y = py(lv), xi = x + IN_DX;
  return (
    <g className="el">
      <line x1={x} y1={y} x2={xi} y2={y} stroke={C.cyan} strokeWidth="5" />
      <polygon points={`${x},${y - 5.5} ${x - 6},${y - 1} ${x},${y + 4.5}`} fill={C.cyan} />
      <polygon points={`${xi},${y - 5.5} ${xi + 6},${y - 1} ${xi},${y + 4.5}`} fill={C.cyan} />
    </g>
  );
}

export function Stair({ i, lv }: { i: number; lv: number }) {
  const x1 = px(i), x2 = px(i + 1), yB = py(lv - 1), yT = py(lv);
  const st = [];
  for (let k = 0; k < 7; k++) {
    const t = k / 7, u = (k + 1) / 7;
    st.push(<line key={k} x1={x1 + (x2 - x1) * t} y1={yB - (yB - yT) * t} x2={x1 + (x2 - x1) * u} y2={yB - (yB - yT) * t} stroke="#8A96A2" strokeWidth="3.5" />);
  }
  return (
    <g>
      <line x1={x1} y1={yB} x2={x2} y2={yT} stroke="#5F6B78" strokeWidth="5" />
      <line x1={x1} y1={yB - 12} x2={x2} y2={yT - 12} stroke="#5F6B78" strokeWidth="5" />
      {st}
      <line x1={x1} y1={yB - 52} x2={x2} y2={yT - 52} stroke={C.yel} strokeWidth="3" opacity=".8" />
      <line x1={x1} y1={yB} x2={x1} y2={yB - 52} stroke={C.yel} strokeWidth="3" opacity=".8" />
      <line x1={x2} y1={yT} x2={x2} y2={yT - 52} stroke={C.yel} strokeWidth="3" opacity=".8" />
    </g>
  );
}

export function Roof() {
  const L = RF_L(), R = RF_R(), yE = RF_EAVE(), yR = RF_RIDGE();
  return (
    <g>
      {/* 外壁 */}
      <rect x={L} y={yE} width={R - L} height={GY - yE} fill="#242B33" />
      {/* 窓（1階・2階） */}
      {[0.3, 0.7].map((t, i) => (
        <g key={i}>
          <rect x={L + (R - L) * t - 14} y={yE + 30} width="28" height="34" rx="2" fill="#1C232A" stroke="#333C46" />
          <rect x={L + (R - L) * t - 14} y={yE + 118} width="28" height="34" rx="2" fill="#1C232A" stroke="#333C46" />
        </g>
      ))}
      {/* 奥へ上がる屋根面（南から見ると平行四辺形） */}
      <polygon points={`${L - 12},${yE + 4} ${R + 12},${yE + 4} ${R + 12 - 26},${yR} ${L - 12 - 26},${yR}`} fill="#3E4750" />
      {/* 軒先（水下・全スパン同じ高さ） */}
      <rect x={L - 12} y={yE - 4} width={R - L + 24} height="10" rx="2" fill="#5A6672" />
      <line x1={L - 12} y1={yE - 4} x2={R + 12} y2={yE - 4} stroke="#6E7A87" strokeWidth="1.5" />
      <text x={(L + R) / 2} y={yE + 92} fill="#4A545E" fontSize="11.5" fontFamily={F} textAnchor="middle">建物</text>
      <text x={R + 4} y={yE + 22} fill="#5E6A76" fontSize="10" fontFamily={F} textAnchor="end">軒（水下）</text>
    </g>
  );
}

export function Hoister({ x, y, active }: { x: number; y: number; active?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="0" cy="1" rx="9" ry="3" fill="#000" opacity=".3" />
      <path d="M-5 -16 L-6 -3 L-2 -3 L-1 -16 Z" fill="#3A4A5C" />
      <path d="M5 -16 L6 -3 L2 -3 L1 -16 Z" fill="#3A4A5C" />
      <path d="M-7 -31 L7 -31 L8 -15 L-8 -15 Z" fill="#6B7F55" />
      <path d="M-7 -29 L-13 -38 L-10 -40 L-4 -32 Z" fill="#6B7F55" />
      <path d="M7 -29 L13 -38 L10 -40 L4 -32 Z" fill="#6B7F55" />
      <circle cx="0" cy="-37" r="6.5" fill={C.skin} />
      <path d="M-8 -40 A8 8 0 0 1 8 -40 Z" fill="#D98B2B" />
      <rect x="-9.5" y="-41" width="19" height="2.8" rx="1.4" fill="#B8761F" />
      {active && (
        <g className="tgt">
          <line x1="0" y1="-42" x2="0" y2="-64" stroke={C.org} strokeWidth="2" strokeDasharray="3 3" />
          <polygon points="-5,-64 5,-64 0,-72" fill={C.org} />
        </g>
      )}
      <text x="0" y="16" textAnchor="middle" fontSize="9.5" fill={C.dim} fontFamily={F}>荷揚げ</text>
    </g>
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

export function ZScaffold({ komaOn = [], rails = [], worker = true, mood }: { komaOn?: number[]; rails?: number[]; worker?: boolean; mood?: string }) {
  return (
    <>
      <rect y={ZD} width="340" height="42" fill="#1A2027" />
      {[ZX1, ZX2].map((cx) => (
        <g key={cx}>
          <line x1={cx} y1={ZD} x2={cx} y2="34" stroke={C.steel} strokeWidth="11" />
          {[1, 2, 3, 4, 5].map((n) => (
            <polygon key={n} points={`${cx - 8},${zk(n)} ${cx},${zk(n) - 4} ${cx + 8},${zk(n)} ${cx},${zk(n) + 4}`}
              fill={komaOn.includes(n) ? C.yel : C.steelLt} />
          ))}
        </g>
      ))}
      <rect x={ZX1} y={ZD - 12} width={ZX2 - ZX1} height="13" fill="#7B8895" stroke="#4A545E" />
      {rails.map((n, i) => (
        <g key={i}>
          <line x1={ZX1} y1={zk(n)} x2={ZX2} y2={zk(n)} stroke={C.yel} strokeWidth={n === 2 ? 6 : 4.5} />
          <polygon points={`${ZX1},${zk(n) - 6} ${ZX1 + 7},${zk(n) - 1} ${ZX1},${zk(n) + 5}`} fill={C.yel} />
          <polygon points={`${ZX2},${zk(n) - 6} ${ZX2 - 7},${zk(n) - 1} ${ZX2},${zk(n) + 5}`} fill={C.yel} />
        </g>
      ))}
      {worker && (
        <g transform={`translate(170,${ZD}) scale(3)`}>
          <Kenta mood={mood} />
        </g>
      )}
    </>
  );
}

export function RailZoom({ onClear, onFoul }: { onClear: () => void; onFoul: (fb: string) => void }) {
  const [step, setStep] = useState(0);      // 0=中さん 1=上さん
  const [pick, setPick] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const target = step === 0 ? 1 : 2;        // コマ番号（1=450 中さん / 2=900 上さん）
  const fin = step >= 2;
  const MM = { 1: "450", 2: "900", 3: "1,350", 4: "1,800", 5: "2,250" };

  const tap = (n: number) => {
    setPick(n);
    if (n === target) {
      setDone((d) => [...d, n]);
      setTimeout(() => { if (step === 0) { setStep(1); setPick(null); } else setStep(2); }, 700);
    } else {
      onFoul(n > 2
        ? "そこは高すぎる。手摺はその高さに入れる部材じゃない。"
        : step === 0 ? "そっちは上さんの位置だ。低い方から入れる。" : "そこはもう中さんが入っている。");
    }
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0C1015", zIndex: 20, overflowY: "auto" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.yel }}>手摺を入れる</span>
        <span style={{ fontSize: 11, color: C.dim }}>{step === 0 ? "1本目：中さん" : "2本目：上さん"}</span>
      </div>

      <svg data-scene="rail" viewBox="0 0 340 320" style={{ width: "100%", display: "block" }}>
        <ZScaffold komaOn={done} rails={done} />
        {/* 寸法線 */}
        <line x1={ZX2 + 24} y1={ZD - 12} x2={ZX2 + 24} y2={zk(target)} stroke={C.cyan} strokeWidth="1.4" />
        <line x1={ZX2 + 18} y1={ZD - 12} x2={ZX2 + 30} y2={ZD - 12} stroke={C.cyan} strokeWidth="1.4" />
        <line x1={ZX2 + 18} y1={zk(target)} x2={ZX2 + 30} y2={zk(target)} stroke={C.cyan} strokeWidth="1.4" />
        <text x={ZX2 + 36} y={(ZD - 12 + zk(target)) / 2 + 4} fontSize="12.5" fill={C.cyan} fontFamily={MO}>{MM[target]}</text>
        <text x={ZX1 - 12} y={ZD + 6} textAnchor="end" fontSize="11" fill={C.dim} fontFamily={F}>踏板</text>
        {/* タップ対象 */}
        {!fin && [1, 2, 3, 4].map((n) => !done.includes(n) && (
          <g key={n} onClick={() => tap(n)} style={{ cursor: "pointer" }} className="tgt">
            <rect x={ZX1 - 8} y={zk(n) - 15} width={ZX2 - ZX1 + 16} height="30" rx="8"
              fill={pick === n ? (n === target ? "#1B4030" : "#3A1C17") : C.yel} opacity={pick === n ? .8 : .07} />
            <rect x={ZX1 - 8} y={zk(n) - 15} width={ZX2 - ZX1 + 16} height="30" rx="8" fill="none"
              stroke={pick === n ? (n === target ? C.grn : C.red) : C.yel} strokeWidth="1.4" strokeDasharray="4 4" />
          </g>
        ))}
      </svg>

      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.6, marginBottom: 8 }}>
          {step === 0 ? "中さんを入れるコマはどこ？" : step === 1 ? "上さんを入れるコマはどこ？" : "中さん・上さんが入った"}
        </div>
        <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.85, marginBottom: 12 }}>
          手摺は<b style={{ color: C.txt }}>低い方から</b>入れます。踏板から450mmが中さん、900mmが上さん。
          コマは450mmピッチなので、踏板の1つ上が中さん、2つ上が上さんです。
        </div>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "11px 13px", fontSize: 12, color: C.dim, lineHeight: 1.9 }}>
          上さんだけ先に入れると、その下が空いたままになります。<br />
          体は隙間から抜けます。低い方から順に塞ぐこと。
        </div>
        {step >= 2 && <Btn tone="y" onClick={onClear} style={{ marginTop: 14 }}>次へ</Btn>}
      </div>
    </div>
  );
}

export function BraceZoom({ onClear, onFoul }: { onClear: () => void; onFoul: (fb: string) => void }) {
  const [phase, setPhase] = useState(0);      // 0=先端を上へ 1=後端を下へ 2=完了
  const [pos, setPos] = useState({ x: 190, y: 200 });       // 中心（phase0）
  const [ang, setAng] = useState(0);          // phase1：上部コマ→後端 の向き
  const [drag, setDrag] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const swung = useRef(false);                // 実際に振り下ろしたか
  const svgRef = useRef<SVGSVGElement>(null);

  /* 向きは盤面と同じ。上端＝出隅側（左）／下端＝南端側（右） */
  const TOP = { x: ZX1, y: zk(5) };           // 上部コマ（左柱＝出隅側）
  const BOT = { x: ZX2, y: zk(1) };           // 下部コマ（右柱＝南端側）※4コマ分
  const LEN = Math.hypot(TOP.x - BOT.x, TOP.y - BOT.y);
  const AF = Math.atan2(BOT.y - TOP.y, BOT.x - TOP.x);   // 完成時：上部コマ→後端
  const AH = AF - 0.42;                                  // 担いだ状態（後端を上げて持つ）

  /* いまの筋交の両端。a=後端（下）／b=先端（上） */
  const ends = () => {
    if (phase === 0) {
      const hx = Math.cos(AH) * LEN / 2, hy = Math.sin(AH) * LEN / 2;
      return { a: { x: pos.x + hx, y: pos.y + hy }, b: { x: pos.x - hx, y: pos.y - hy } };
    }
    return { a: { x: TOP.x + Math.cos(ang) * LEN, y: TOP.y + Math.sin(ang) * LEN }, b: TOP };
  };
  const { a, b } = ends();

  /* 指でもマウスでも同じように座標を取る */
  const toSvg = (e: PointerLike) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const t = "touches" in e && e.touches.length ? e.touches[0] : (e as React.MouseEvent);
    return { x: ((t.clientX - r.left) / r.width) * 340, y: ((t.clientY - r.top) / r.height) * 340 };
  };

  const move = (e: PointerLike) => {
    if (!drag || phase === 2) return;
    e.preventDefault();
    const p = toSvg(e);
    if (phase === 0) {
      setPos(p);
      const hx = Math.cos(AH) * LEN / 2, hy = Math.sin(AH) * LEN / 2;
      const tip = { x: p.x - hx, y: p.y - hy };
      /* 先端が上部コマに入る。この時点で後端はまだ下部コマから離れている */
      if (Math.hypot(tip.x - TOP.x, tip.y - TOP.y) < 20) {
        SFX.ham(); setPhase(1); setAng(AH); swung.current = false;
      }
    } else {
      const th = Math.atan2(p.y - TOP.y, p.x - TOP.x);
      setAng(th);
      /* 一定角度振らないと「入った」ことにしない */
      if (Math.abs(th - AH) > 0.18) swung.current = true;
      const tail = { x: TOP.x + Math.cos(th) * LEN, y: TOP.y + Math.sin(th) * LEN };
      /* 後端が下部コマに十分近づいたときだけ入る */
      if (swung.current && Math.hypot(tail.x - BOT.x, tail.y - BOT.y) < 18) {
        SFX.ham(); setAng(AF); setPhase(2); setDrag(false);
      }
    }
  };

  /* 下端を先に入れようとした場合 */
  const tapBottomFirst = () => {
    if (phase !== 0) return;
    setWarn("下からは入らん。筋交は上のコマに先端を差してから、振り下ろして後端を落とす。");
    onFoul("筋交は上部のコマに先端を入れないと、下部のコマに入らない。");
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0C1015", zIndex: 20, overflowY: "auto" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.yel }}>筋交を入れる</span>
        <span style={{ fontSize: 11, color: C.dim }}>
          {phase === 0 ? "① 先端を上部のコマへ" : phase === 1 ? "② 後端を下部のコマへ" : "入った"}
        </span>
      </div>

      <svg data-scene="brace" ref={svgRef} viewBox="0 0 340 340" style={{ width: "100%", display: "block", touchAction: "none" }}
        onMouseMove={move} onTouchMove={move}
        onMouseUp={() => setDrag(false)} onTouchEnd={() => setDrag(false)}>
        <ZScaffold worker={false} />
        {/* 取付先の表示 */}
        {phase === 0 && (
          <g className="tgt">
            <circle cx={TOP.x} cy={TOP.y} r="15" fill={C.grn} opacity=".18" />
            <circle cx={TOP.x} cy={TOP.y} r="15" fill="none" stroke={C.grn} strokeWidth="2" strokeDasharray="4 4" />
            <text x={TOP.x - 22} y={TOP.y - 20} textAnchor="end" fontSize="11" fill={C.grn} fontFamily={F}>ここへ先端</text>
          </g>
        )}
        {phase === 1 && (
          <g className="tgt">
            <circle cx={BOT.x} cy={BOT.y} r="15" fill={C.grn} opacity=".18" />
            <circle cx={BOT.x} cy={BOT.y} r="15" fill="none" stroke={C.grn} strokeWidth="2" strokeDasharray="4 4" />
            <text x={BOT.x + 22} y={BOT.y + 22} fontSize="11" fill={C.grn} fontFamily={F}>ここへ後端</text>
            <circle cx={TOP.x} cy={TOP.y} r="8" fill={C.grn} />
          </g>
        )}
        {phase === 0 && (
          <g onClick={tapBottomFirst} style={{ cursor: "pointer" }}>
            <circle cx={BOT.x} cy={BOT.y} r="14" fill={C.dim2} opacity=".12" />
          </g>
        )}

        {/* 筋交本体 */}
        <g>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={phase === 2 ? C.grn : "#B9C4CE"} strokeWidth="7" strokeLinecap="round" />
          <circle cx={a.x} cy={a.y} r="6" fill="#8A96A2" />
          <circle cx={b.x} cy={b.y} r="6" fill={phase >= 1 ? C.grn : "#8A96A2"} />
          {/* つかむ場所（中心） */}
          {phase < 2 && (
            <g onMouseDown={() => setDrag(true)} onTouchStart={() => setDrag(true)} style={{ cursor: "grab" }}>
              <circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r="20" fill={C.yel} opacity={drag ? ".5" : ".22"} />
              <circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r="20" fill="none" stroke={C.yel} strokeWidth="2" />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 4} textAnchor="middle" fontSize="10" fill={C.yel} fontFamily={F} fontWeight="700">持つ</text>
            </g>
          )}
        </g>
      </svg>

      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.6, marginBottom: 8 }}>
          {phase === 0 ? "筋交の中心を持って、先端を上のコマへ入れる"
            : phase === 1 ? "上端を軸に振って、後端を下のコマへ落とす"
              : "入った。これで面が動かなくなる"}
        </div>
        <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.85, marginBottom: 12 }}>
          筋交は4コマ分（約1,800mm）をまたぐ長さです。向きは<b style={{ color: C.txt }}>南端側が下、出隅側が上</b>の一方向。
          <b style={{ color: C.txt }}>上部のコマに先端を入れないと、下部のコマに入りません</b>。
          先に上へ差し込み、そこを軸に振り下ろして後端を落とす。材の長さと差し込み代が、その順でしか収まらないためです。
        </div>
        {warn && <div style={{ fontSize: 12.5, color: "#F4B5AE", lineHeight: 1.8, marginBottom: 10 }}>{warn}</div>}
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "11px 13px", fontSize: 12, color: C.dim, lineHeight: 1.9 }}>
          筋交は、足場が平行四辺形につぶれるのを防ぐ材です。<br />
          これが無いと、風や人の動きで面ごと揺れます。
        </div>
        {phase === 2 && <Btn tone="y" onClick={onClear} style={{ marginTop: 14 }}>次へ</Btn>}
      </div>
    </div>
  );
}

export function WJackZoom({ onClear, onFoul }: { onClear: () => void; onFoul: (fb: string) => void }) {
  const [phase, setPhase] = useState(0);     // 0=高さ選択 1=垂直調整 2=完了
  const [pick, setPick] = useState<number | null>(null);
  const [turn, setTurn] = useState(-64);     // -100〜100（0が垂直）。16刻み

  /* 内柱・外柱・踏板手摺。1段目の踏板に立った目線 */
  const XO = 243, XI = 190;                   // 内柱〜外柱＝600mm
  const YD = ZD - 172;                        // 踏板手摺＝1段目の踏板の上面から1,800mm
  const KO = [1, 2, 3];                       // 踏板手摺より下のコマ（1が直下）
  const ky = (n: number) => YD + n * ZP;              // 450mmごと下へ
  const STEP = 16;

  const tap = (n: number) => {
    setPick(n);
    if (n === 1) { SFX.ham(); setTimeout(() => setPhase(1), 550); }
    else onFoul(n === 3
      ? "低すぎる。そこに突き出ていたら、踏板の上を歩く者の足に当たる。"
      : "そこじゃない。踏板手摺のすぐ下のコマに付ける。低いと作業者に接触する。");
  };

  /* 回す＝根がらみのジャッキと同じ。左右のボタンで少しずつ */
  const roll = (d: number) => {
    if (phase !== 1) return;
    const v = Math.max(-96, Math.min(96, turn + d * STEP));
    setTurn(v);
    if (v === 0) { SFX.ok(); setPhase(2); }
  };

  const lean = phase === 0 ? 0 : turn / 100 * 14;   // 柱の傾き（px）
  const ok = phase === 2;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0C1015", zIndex: 20, overflowY: "auto" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.yel }}>壁当てジャッキ</span>
        <span style={{ fontSize: 11, color: C.dim }}>
          {phase === 0 ? "① 付ける高さを選ぶ" : phase === 1 ? "② 回して垂直を出す" : "垂直が出た"}
        </span>
      </div>

      <svg data-scene="wjack" viewBox="0 0 340 320" style={{ width: "100%", display: "block", touchAction: "none" }}>
        <rect y={ZD} width="340" height="42" fill="#1A2027" />
        {/* 建物の壁 */}
        <rect x="0" y="20" width="146" height={ZD - 20} fill="#242B33" />
        <text x="73" y={ZD - 16} textAnchor="middle" fontSize="11" fill="#4A545E" fontFamily={F}>建物</text>

        {/* 作業員（1段目の踏板に立っている。柱より奥に描く） */}
        <g transform={`translate(222,${ZD - 12})`}>
          <WorkerSide />
        </g>

        {/* 支柱（内柱・外柱）。傾きを反映 */}
        {([[XI, "内柱"], [XO, "外柱"]] as [number, string][]).map(([x, nm]) => (
          <g key={nm}>
            <line x1={x} y1={ZD} x2={x + lean} y2="30" stroke={C.steel} strokeWidth="10" />
            {[0, 1, 2, 3, 4].map((n) => {
              const y = ky(n);
              const cx = x + lean * ((ZD - y) / (ZD - 30));
              return <polygon key={n} points={`${cx - 8},${y} ${cx},${y - 4} ${cx + 8},${y} ${cx},${y + 4}`}
                fill={pick === n && n === 1 ? C.yel : C.steelLt} />;
            })}
            <text x={x + 4} y={ZD + 22} textAnchor="middle" fontSize="10.5" fill={C.dim} fontFamily={F}>{nm}</text>
          </g>
        ))}

        {/* 1段目の踏板（いま立っている床） */}
        <rect x={XI - 10} y={ZD - 12} width={XO - XI + 20} height="13" fill="#7B8895" stroke="#4A545E" />

        {/* 踏板手摺（内柱と外柱をつなぐ。踏板はまだ入っていない） */}
        {(() => {
          const cxI = XI + lean * ((ZD - YD) / (ZD - 30));
          const cxO = XO + lean * ((ZD - YD) / (ZD - 30));
          return (
            <g>
              <line x1={cxI} y1={YD} x2={cxO} y2={YD} stroke={C.cyan} strokeWidth="5.5" />
              <polygon points={`${cxI},${YD - 6} ${cxI + 7},${YD - 1} ${cxI},${YD + 5}`} fill={C.cyan} />
              <polygon points={`${cxO},${YD - 6} ${cxO - 7},${YD - 1} ${cxO},${YD + 5}`} fill={C.cyan} />
              <text x={XO + 16} y={YD - 8} fontSize="10.5" fill={C.cyan} fontFamily={F}>踏板手摺</text>
            </g>
          );
        })()}

        {/* 壁当てジャッキ */}
        {phase >= 1 && (() => {
          const y = ky(1), cx = XI + lean * ((ZD - y) / (ZD - 30));
          return (
            <g>
              <line x1={cx} y1={y} x2="150" y2={y} stroke={ok ? C.grn : C.org} strokeWidth="6" />
              <rect x="140" y={y - 9} width="11" height="19" rx="2" fill={ok ? C.grn : C.org} />
              <circle cx={cx} cy={y} r="5" fill={ok ? C.grn : C.org} />
              {/* ねじ部 */}
              {[0, 1, 2].map((i) => <line key={i} x1={156 + i * 9} y1={y - 6} x2={156 + i * 9} y2={y + 6} stroke="#0C1015" strokeWidth="1.6" opacity=".5" />)}
            </g>
          );
        })()}

        {/* 高さの選択 */}
        {phase === 0 && KO.map((n) => (
          <g key={n} onClick={() => tap(n)} style={{ cursor: "pointer" }} className="tgt">
            <rect x={XI - 26} y={ky(n) - 15} width="52" height="30" rx="8"
              fill={pick === n ? (n === 1 ? "#1B4030" : "#3A1C17") : C.yel} opacity={pick === n ? .85 : .1} />
            <rect x={XI - 26} y={ky(n) - 15} width="52" height="30" rx="8" fill="none"
              stroke={pick === n ? (n === 1 ? C.grn : C.red) : C.yel} strokeWidth="1.4" strokeDasharray="4 4" />
          </g>
        ))}

        {/* 垂直の判定 */}
        {phase >= 1 && (
          <g>
            <rect x="164" y="34" width="104" height="26" rx="7" fill="#101720" stroke={ok ? C.grn : C.line} strokeWidth="1.5" />
            <line x1="204" y1="38" x2="204" y2="56" stroke={C.dim2} strokeWidth="1.2" />
            <line x1="228" y1="38" x2="228" y2="56" stroke={C.dim2} strokeWidth="1.2" />
            <circle cx={216 + turn * 0.3} cy="47" r="8" fill={ok ? C.grn : Math.abs(turn) < 20 ? C.yel : C.red} opacity=".9" />
            <text x="216" y="26" textAnchor="middle" fontSize="10" fill={C.dim} fontFamily={F}>垂直</text>
          </g>
        )}
      </svg>

      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.6, marginBottom: 8 }}>
          {phase === 0 ? "壁当てジャッキを付けるコマはどこ？"
            : phase === 1 ? "ジャッキを回して、内柱の垂直を出す"
              : "垂直が出た。これで内柱が建物へ突っ張った"}
        </div>
        <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.85, marginBottom: 12 }}>
          {phase === 0
            ? "壁当てジャッキは踏板手摺のすぐ下に付けます。低い位置に付けると、踏板の上を歩く者の足に当たって危険です。"
            : "締めると柱の頭が建物から離れ、緩めると建物側へ寄ります。泡が真ん中で止まったところが垂直です。"}
        </div>

        {/* 回す操作：根がらみのジャッキと同じ。柱の頭が動く側のボタンを押す */}
        {phase === 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <Btn onClick={() => roll(-1)}>◀　緩める</Btn>
            <Btn onClick={() => roll(1)}>締める　▶</Btn>
          </div>
        )}

        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "11px 13px", fontSize: 12, color: C.dim, lineHeight: 1.9 }}>
          一側足場は建物に頼って立っています。<br />
          壁当てジャッキが効いていないと、踏板に乗ったときに足場ごと動きます。
        </div>
        {phase === 2 && <Btn tone="y" onClick={onClear} style={{ marginTop: 14 }}>次へ</Btn>}
      </div>
    </div>
  );
}

export function BeltZoom({ mode, onClear, onFoul }: { mode: "post" | "rail"; onClear: () => void; onFoul: (fb: string) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const opts = mode === "post"
    ? [
      { t: "支柱に付ける", ok: true, fb: "正解。手摺がまだ無いうちは、支柱が一番確かな掛け先だ。" },
      { t: "支柱のコマに掛ける", ok: false, fb: "コマは部材を差す緊結部だ。フックを掛ける場所じゃない。外れる。" },
      { t: "足元の踏板の枠に掛ける", ok: false, fb: "低い位置に掛ければ、落ちたときに地面まで届く。" },
    ]
    : [
      { t: "入れた手摺に掛け替える", ok: true, fb: "正解。手摺が入ったら、そこへ移す。移動しながら作業できる。" },
      { t: "支柱のまま動かない", ok: false, fb: "支柱のままでは移動できん。手摺が入ったら掛け替える。" },
      { t: "コマに掛け替える", ok: false, fb: "コマには掛けない。何度言わせるんじゃ。" },
    ];
  /* 掛け先の座標（支柱の高い位置／コマ／踏板／手摺） */
  const P_POST = { x: ZX1, y: (zk(4) + zk(3)) / 2 };   // コマとコマの間＝支柱の胴
  const P_KOMA = { x: ZX1, y: zk(3) };
  const P_DECK = { x: 170, y: ZD - 8 };
  const P_RAIL = { x: 130, y: zk(2) };
  const tgt = mode === "post" ? [P_POST, P_KOMA, P_DECK] : [P_RAIL, P_POST, P_KOMA];

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0C1015", zIndex: 20, overflowY: "auto" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.yel }}>安全帯</span>
        <span style={{ fontSize: 11, color: C.dim }}>{mode === "post" ? "足場上に上がった" : "1本目の手摺が入った"}</span>
      </div>

      <svg data-scene="belt" viewBox="0 0 340 320" style={{ width: "100%", display: "block" }}>
        <ZScaffold rails={mode === "rail" ? [1, 2] : []} komaOn={mode === "rail" ? [1, 2] : []} />
        {/* ラベル */}
        <text x={ZX1 - 12} y={(zk(4) + zk(3)) / 2 + 4} textAnchor="end" fontSize="11" fill={C.dim} fontFamily={F}>支柱</text>
        <text x={ZX2 + 14} y={zk(3) + 4} fontSize="11" fill={C.dim} fontFamily={F}>コマ</text>
        {mode === "rail" && <text x={ZX2 + 14} y={zk(2) + 4} fontSize="11" fill={C.yel} fontFamily={F}>手摺</text>}
        <text x={ZX2 + 14} y={ZD + 4} fontSize="11" fill={C.dim} fontFamily={F}>踏板</text>
        {/* フックの線 */}
        {pick !== null && (
          <g>
            <line x1="170" y1={ZD - 96} x2={tgt[pick].x} y2={tgt[pick].y}
              stroke={opts[pick].ok ? C.grn : C.red} strokeWidth="3.5" />
            {(mode === "post" ? pick === 0 : pick === 1) ? (
              <ellipse cx={tgt[pick].x} cy={tgt[pick].y} rx="11" ry="7" fill="none"
                stroke={opts[pick].ok ? C.grn : C.red} strokeWidth="3" />
            ) : (
              <circle cx={tgt[pick].x} cy={tgt[pick].y} r="12" fill="none"
                stroke={opts[pick].ok ? C.grn : C.red} strokeWidth="3" />
            )}
          </g>
        )}
      </svg>

      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 10 }}>
          {mode === "post" ? "安全帯をどこに取り付ける？" : "安全帯をどうする？"}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {opts.map((o, i) => (
            <button key={i} onClick={() => { setPick(i); if (!o.ok) onFoul(o.fb); }} style={{
              background: pick === i ? (o.ok ? "#12281D" : "#2C1815") : C.panel2,
              color: pick === i ? (o.ok ? "#9FE3BE" : "#F4B5AE") : C.txt,
              border: `1px solid ${pick === i ? (o.ok ? C.grn : C.red) : C.line}`,
              borderRadius: 9, padding: "13px 14px", fontSize: 13, fontWeight: 700, fontFamily: F, cursor: "pointer", textAlign: "left",
            }}>{o.t}</button>
          ))}
        </div>
        {pick !== null && (
          <div style={{ fontSize: 12.5, lineHeight: 1.8, marginTop: 11, color: opts[pick].ok ? C.grn : "#F4B5AE" }}>{opts[pick].fb}</div>
        )}
        {pick !== null && opts[pick].ok && <Btn tone="y" onClick={onClear} style={{ marginTop: 14 }}>次へ</Btn>}
      </div>
    </div>
  );
}

export function Scold({ line, onClose }: { line: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#000b", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, padding: 20 }}>
      <div className="shake" style={{ background: C.panel, border: `2px solid ${C.red}`, borderRadius: 14, padding: 18, maxWidth: 350, width: "100%" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Boss size={68} angry />
          <div>
            <div style={{ fontSize: 11, color: C.red, fontWeight: 800, letterSpacing: 1, marginBottom: 5 }}>ファール　技能 −10</div>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.6 }}>{line}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ marginTop: 14, width: "100%", background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: 12, fontWeight: 800, fontFamily: F, fontSize: 14, cursor: "pointer" }}>すいません！</button>
      </div>
    </div>
  );
}

export function Boss({ size = 38, angry }: { size?: number; angry?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
      {/* 顔（ヘルメットの内側に収まる大きさ） */}
      <circle cx="36" cy="45" r="19" fill="#D9A97E" />
      {/* 耳 */}
      <circle cx="17" cy="45" r="3.4" fill="#C9976C" /><circle cx="55" cy="45" r="3.4" fill="#C9976C" />
      {/* ヘルメット（顔の幅より少し大きく） */}
      <path d="M13 34 A23 21 0 0 1 59 34 Z" fill={angry ? "#E8B400" : C.yel} />
      <rect x="9" y="32" width="54" height="6" rx="3" fill="#E0C200" />
      {angry ? <path d="M25 40 L33 44 M47 40 L39 44" stroke="#2A1D14" strokeWidth="3.2" strokeLinecap="round" />
        : <path d="M26 41 L33 40 M46 41 L39 40" stroke="#2A1D14" strokeWidth="2.8" strokeLinecap="round" />}
      <circle cx="29.5" cy="47" r="2.5" fill="#2A1D14" /><circle cx="42.5" cy="47" r="2.5" fill="#2A1D14" />
      {angry ? <ellipse cx="36" cy="57" rx="7.5" ry="4.5" fill="#5A1E17" />
        : <path d="M31 57 Q36 60 41 57" stroke="#2A1D14" strokeWidth="2" fill="none" strokeLinecap="round" />}
      <rect x="29" y="52" width="14" height="2.8" rx="1.4" fill="#2A1D14" />
    </svg>
  );
}