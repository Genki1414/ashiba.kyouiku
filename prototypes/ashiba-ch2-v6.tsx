import React, { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════
   足場 実務トレーニング ／ 第2章 高所作業
   昇降階段で上がる → 1段目の手摺 → 支柱 → ブラケット（内柱は踏板手摺）
   → 踏板 → 2段目の手摺 → 屋根へ → 転落防止手摺2本
   ═══════════════════════════════════════════ */

const C = {
  bg: "#14171B", panel: "#1E232A", panel2: "#252C34", line: "#2E3640",
  steel: "#93A0AD", steelLt: "#CBD6DF", steelDk: "#5F6B78",
  yel: "#F5D400", red: "#E23B2E", grn: "#25B36B", cyan: "#4FC3D9", org: "#D98B2B",
  navy: "#2F4A6B", skin: "#E2B48C", txt: "#E9EEF3", dim: "#8D98A4", dim2: "#5F6B78",
};
const F = `"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif`;
const MO = `ui-monospace,"SFMono-Regular",Menlo,monospace`;

/* ── 現場：南面3スパン・4柱。内柱は南②と南端 ── */
const POSTS = ["P0", "P1", "P2", "P3"];
const PN = { P0: "出隅", P1: "南①", P2: "南②", P3: "南端" };
const SPANS = [["P0", "P1"], ["P1", "P2"], ["P2", "P3"]];
const SPID = SPANS.map(([a, b]) => `${a}-${b}`);
const SPID_ALL = SPID;
const INNER = { P2: 1, P3: 1 };
const STAIR_SPAN = "P0-P1";      // 昇降階段のあるスパン
/* ── 工程 ─────────────────────────────── */
/* 荷揚げは出隅側。手摺は荷揚げ側から、支柱・受け材・踏板は奥側から。 */
const FAR = [...POSTS].reverse();                 // 奥（南端）から手前へ
const FARSP = [...SPANS].reverse();
/* 転落防止手摺の高さ（2段目踏板から） */
const FALL_M = 2250 / 1800;                        // 中さん
const FALL_U = 2700 / 1800;                        // 上さん
/* 筋交は1段につき1本。南端から出隅へ、段を上がるごとに1スパン寄せて一直線にする */
const BR_AT = { 1: SPID_ALL[2], 2: SPID_ALL[1], 3: SPID_ALL[0] };   // 地上／1段目／2段目
const spName = (id) => id.split("-").map((p) => PN[p]).join("〜");
function buildSteps() {
  const q = [];
  /* 1段目は踏板が入っている前提。地上から筋交を入れる */
  q.push({ k: "brace", t: `1:${BR_AT[1]}`, d: `地上から筋交を入れる（${spName(BR_AT[1])}）　南端から出隅へ一直線に上げていく` });
  q.push({ k: "climb1", d: "昇降階段で1段目に上がる" });
  SPANS.forEach(([a, b]) => q.push({ k: "rail1", t: `${a}-${b}`, d: `1段目の手摺を入れる（${PN[a]}〜${PN[b]}）　荷揚げ側から` }));
  FAR.forEach((p) => {
    q.push({ k: "post2", t: p, d: `${PN[p]}の支柱を継ぐ　奥から手前へ` });
    if (INNER[p]) q.push({ k: "postI", t: p, d: `${PN[p]}の内柱も継ぐ` });
  });
  FAR.forEach((p) => {
    if (INNER[p]) q.push({ k: "rail6", t: p, d: `${PN[p]}は内柱の箇所。踏板高さの手摺で内柱とつなぐ` });
    else q.push({ k: "brk", t: p, d: `${PN[p]}にブラケットを掛ける` });
  });
  /* 踏板手摺が入ってから壁当てジャッキで建物へ突っ張る */
  FAR.filter((p) => INNER[p]).forEach((p) => q.push({ k: "wjack", t: p, d: `${PN[p]}の内柱に壁当てジャッキを取り付ける（踏板手摺の下）` }));

  FARSP.forEach(([a, b]) => q.push({ k: "deck2", t: `${a}-${b}`, d: `2段目の踏板を敷く（${PN[a]}〜${PN[b]}）　奥から` }));
  /* 踏板が入ったスパンから筋交 */
  q.push({ k: "brace", t: `2:${BR_AT[2]}`, d: `踏板が入ったので1段目から筋交を入れる（${spName(BR_AT[2])}）　1本目の続き` });
  q.push({ k: "climb2", d: "昇降階段で2段目に上がる" });
  SPANS.forEach(([a, b]) => q.push({ k: "rail2", t: `${a}-${b}`, d: `2段目の手摺を入れる（${PN[a]}〜${PN[b]}）　荷揚げ側から` }));
  q.push({ k: "brace", t: `3:${BR_AT[3]}`, d: `2段目から最後の筋交を入れる（${spName(BR_AT[3])}）　これで一直線になる` });
  q.push({ k: "roof", d: "屋根に上がる" });
  SPANS.forEach(([a, b]) => {
    q.push({ k: "fall", t: `M:${a}-${b}`, d: `転落防止手摺の中さん2,250を入れる（${PN[a]}〜${PN[b]}）` });
    q.push({ k: "fall", t: `U:${a}-${b}`, d: `続けて上さん2,700を入れる（${PN[a]}〜${PN[b]}）` });
  });
  return q;
}

/* ── 効果音 ───────────────────────────── */
const SFX = (() => {
  const RATE = 22050; let on = true;
  const wav = (f) => {
    const n = f.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
    const W = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    W(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); W(8, "WAVEfmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    W(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, f[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); }
    const u = new Uint8Array(b); let str = "";
    for (let i = 0; i < u.length; i += 0x2000) str += String.fromCharCode.apply(null, u.subarray(i, i + 0x2000));
    return "data:audio/wav;base64," + btoa(str);
  };
  const gen = (k) => {
    const dur = { ham: .3, buzz: .2, shout: .7, ok: .35, step: .12 }[k] || .3;
    const n = Math.floor(RATE * dur), o = new Float32Array(n), R = () => Math.random() * 2 - 1;
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      if (k === "ham") o[i] = R() * Math.exp(-55 * t) * .55 + Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-16 * t) * .2 + Math.sin(2 * Math.PI * 180 * t) * Math.exp(-42 * t) * .3;
      else if (k === "buzz") o[i] = (Math.sin(2 * Math.PI * (190 - 180 * t) * t) >= 0 ? 1 : -1) * Math.exp(-13 * t) * .14;
      else if (k === "shout") { const f = 150 - 55 * t + 32 * Math.sin(2 * Math.PI * 24 * t); let v = ((t * f) % 1) * 2 - 1; v = v * .8 + R() * .22; const e = t < .03 ? t / .03 : t < .16 ? 1 - (t - .03) * 4.2 : t < .22 ? .45 + (t - .16) * 9 : Math.max(0, 1 - (t - .22) / .44); o[i] = v * e * .5; }
      else if (k === "ok") { [880, 1320].forEach((fq, j) => { const st = j * .07; if (t > st) o[i] += Math.sin(2 * Math.PI * fq * (t - st)) * Math.exp(-7 * (t - st)) * .12; }); }
      else o[i] = R() * Math.exp(-90 * t) * .3;
    }
    return o;
  };
  const cache = {};
  const play = (k) => { if (!on) return; try { const u = cache[k] || (cache[k] = wav(gen(k))); const a = new Audio(u); a.volume = .55; a.play().catch(() => { }); } catch (e) { } };
  return { ham: () => play("ham"), buzz: () => play("buzz"), shout: () => play("shout"), ok: () => play("ok"), step: () => play("step"), setOn: (v) => { on = v; }, warm: () => { ["ham", "buzz", "ok", "step"].forEach((k) => { try { cache[k] = cache[k] || wav(gen(k)); } catch (e) { } }); } };
})();
/* ═══════════════════════════════════════════
   第2章 高所作業（戸建・一側足場）v2
   ・安全帯は支柱に取り付ける（コマはファール）
   ・1本目の手摺を入れたら手摺へ付け替え
   ・コマは450mmピッチで支柱全長に描く
   ・内柱を描写／建物は描かない
   ・2段目の踏板が終わったら昇降階段で2段目へ
   ═══════════════════════════════════════════ */

/* ── 立面の座標 ── */
const X0 = 56, SW = 72, GY = 428, LH = 88;    // 1段=1800mm相当
const HOIST = 0;                               // 荷揚げ位置（出隅側）
const KP = 0.25;                               // コマのピッチ（450mm）
const px = (i) => X0 + i * SW;
const py = (lv) => GY - lv * LH;
const IN_DX = -22;                             // 内柱の見かけのずれ（奥行き表現）

/* ── 支柱（コマを全長に描く） ── */
function Post({ i, top, inner, joint }) {
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

/* ── 手摺（上さん・中さん） ── */
function Rail({ a, b, lv, color = C.yel }) {
  const x1 = px(a), x2 = px(b);
  const yU = py(lv) - 0.5 * LH;   // 踏板から約900mm
  const yM = py(lv) - 0.25 * LH;  // 中さん
  const wedge = (x, d, y) => `${x},${y - 6} ${x + d * 7},${y - 1} ${x},${y + 5}`;
  return (
    <g className="el">
      <line x1={x1} y1={yU} x2={x2} y2={yU} stroke={color} strokeWidth="5.5" />
      <polygon points={wedge(x1, 1, yU)} fill={color} /><polygon points={wedge(x2, -1, yU)} fill={color} />
      <line x1={x1} y1={yM} x2={x2} y2={yM} stroke={color} strokeWidth="4" opacity=".85" />
      <polygon points={wedge(x1, 1, yM)} fill={color} opacity=".85" /><polygon points={wedge(x2, -1, yM)} fill={color} opacity=".85" />
    </g>
  );
}

/* ── 踏板 ── */
function Deck({ a, b, lv, inner }) {
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

/* ── ブラケット（外柱から内側へ張り出す） ── */
function Brk({ i, lv }) {
  const x = px(i), y = py(lv);
  return (
    <g className="el">
      <polygon points={`${x},${y} ${x + IN_DX - 4},${y} ${x},${y - 26}`} fill={C.steelDk} stroke={C.steel} strokeWidth="1.2" />
      <line x1={x} y1={y} x2={x + IN_DX - 4} y2={y} stroke={C.steel} strokeWidth="4" />
    </g>
  );
}

/* ── 踏板高さの手摺（外柱⇔内柱） ── */
function Rail6({ i, lv }) {
  const x = px(i), y = py(lv), xi = x + IN_DX;
  return (
    <g className="el">
      <line x1={x} y1={y} x2={xi} y2={y} stroke={C.cyan} strokeWidth="5" />
      <polygon points={`${x},${y - 5.5} ${x - 6},${y - 1} ${x},${y + 4.5}`} fill={C.cyan} />
      <polygon points={`${xi},${y - 5.5} ${xi + 6},${y - 1} ${xi},${y + 4.5}`} fill={C.cyan} />
    </g>
  );
}

/* ── 昇降階段（段ごと） ── */
function Stair({ i, lv }) {
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

/* ── 屋根（足場の奥。棟が中央） ── */
/* 家：南面が水下。軒の高さは全スパン一定（片流れを南から見た形） */
const RF_L = () => px(0) + IN_DX + 4;                  // 家の左端
const RF_R = () => px(3) + IN_DX - 4;                  // 家の右端
/* 軒＝2段目踏板から1,800mm上。屋根に立つと転落防止手摺が
   足元から450（中さん）・900（上さん）になる */
const RF_EAVE = () => py(3);
const RF_RIDGE = () => py(2) - 1.95 * LH;              // 奥の棟
const ROOF_Y = () => RF_EAVE();
/* 屋根面の高さ：南面から見るとどのスパンでも軒の高さで一定 */
const roofYAt = () => RF_EAVE();
function Roof() {
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

/* 作業員 */
function Kenta({ mood = "normal", walking }) {
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
/* 荷揚げ役（地上） */
function Hoister({ x, y, active }) {
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

/* 親方 */
function Boss({ size = 38, angry }) {
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

const Tape = ({ h = 6 }) => <div style={{ height: h, background: `repeating-linear-gradient(115deg, ${C.yel} 0 12px, #14171B 12px 24px)` }} />;
function Btn({ children, onClick, tone, dis, style }) {
  const y = tone === "y";
  return (
    <button onClick={onClick} disabled={dis} style={{
      background: dis ? C.panel2 : y ? C.yel : "none", color: dis ? C.dim2 : y ? "#14171B" : C.txt,
      border: `1px solid ${dis ? C.line : y ? C.yel : C.line}`, borderRadius: 9, padding: 12,
      fontWeight: 800, fontSize: 13, fontFamily: F, cursor: dis ? "default" : "pointer", width: "100%", ...style,
    }}>{children}</button>
  );
}
function Scold({ line, onClose }) {
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
/* ── ズーム共通の縮尺 ──
   コマ450mm = 40px。作業員は身長1,600mm相当（Kentaを3倍）
   ─────────────────────────────────────── */
const ZP = 40;                      // 450mmあたりのピクセル
const ZD = 268;                     // 踏板の高さ
const ZX1 = 74, ZX2 = 266;          // 支柱2本
const zk = (n) => ZD - n * ZP;      // n番目のコマ（1=450mm）

function ZScaffold({ komaOn = [], rails = [], worker = true, mood }) {
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

/* ── 手摺の取付位置ズーム（1段目の最初の手摺で表示） ── */
function RailZoom({ onClear, onFoul }) {
  const [step, setStep] = useState(0);      // 0=中さん 1=上さん
  const [pick, setPick] = useState(null);
  const [done, setDone] = useState([]);
  const target = step === 0 ? 1 : 2;        // コマ番号（1=450 中さん / 2=900 上さん）
  const fin = step >= 2;
  const MM = { 1: "450", 2: "900", 3: "1,350", 4: "1,800", 5: "2,250" };

  const tap = (n) => {
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

      <svg viewBox="0 0 340 320" style={{ width: "100%", display: "block" }}>
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

/* ── 筋交の取付ズーム（指でスライドして入れる） ──
   ① 中心を持って動かし、先端を上部コマへ
   ② 上端を軸に振って、後端を下部コマへ
   ─────────────────────────────────────── */
function BraceZoom({ onClear, onFoul }) {
  const [phase, setPhase] = useState(0);      // 0=先端を上へ 1=後端を下へ 2=完了
  const [pos, setPos] = useState({ x: 190, y: 200 });       // 中心（phase0）
  const [ang, setAng] = useState(0);          // phase1：上部コマ→後端 の向き
  const [drag, setDrag] = useState(false);
  const [warn, setWarn] = useState(null);
  const swung = useRef(false);                // 実際に振り下ろしたか
  const svgRef = useRef(null);

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

  const toSvg = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) / r.width * 340, y: (t.clientY - r.top) / r.height * 340 };
  };

  const move = (e) => {
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

      <svg ref={svgRef} viewBox="0 0 340 340" style={{ width: "100%", display: "block", touchAction: "none" }}
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

/* ── 側面の作業員（断面図用。縮尺どおり：身長1,700mm＝コマ4つ弱） ── */
function WorkerSide() {
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

/* ── 壁当てジャッキの取付ズーム ──
   ① 踏板の下、どのコマに付けるかを選ぶ
   ② ジャッキを回して垂直を出す
   ─────────────────────────────────────── */
function WJackZoom({ onClear, onFoul }) {
  const [phase, setPhase] = useState(0);     // 0=高さ選択 1=垂直調整 2=完了
  const [pick, setPick] = useState(null);
  const [turn, setTurn] = useState(-64);     // -100〜100（0が垂直）。16刻み

  /* 内柱・外柱・踏板手摺。1段目の踏板に立った目線 */
  const XO = 243, XI = 190;                   // 内柱〜外柱＝600mm
  const YD = ZD - 172;                        // 踏板手摺＝1段目の踏板の上面から1,800mm
  const KO = [1, 2, 3];                       // 踏板手摺より下のコマ（1が直下）
  const ky = (n) => YD + n * ZP;              // 450mmごと下へ
  const STEP = 16;

  const tap = (n) => {
    setPick(n);
    if (n === 1) { SFX.ham(); setTimeout(() => setPhase(1), 550); }
    else onFoul(n === 3
      ? "低すぎる。そこに突き出ていたら、踏板の上を歩く者の足に当たる。"
      : "そこじゃない。踏板手摺のすぐ下のコマに付ける。低いと作業者に接触する。");
  };

  /* 回す＝根がらみのジャッキと同じ。左右のボタンで少しずつ */
  const roll = (d) => {
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

      <svg viewBox="0 0 340 320" style={{ width: "100%", display: "block", touchAction: "none" }}>
        <rect y={ZD} width="340" height="42" fill="#1A2027" />
        {/* 建物の壁 */}
        <rect x="0" y="20" width="146" height={ZD - 20} fill="#242B33" />
        <text x="73" y={ZD - 16} textAnchor="middle" fontSize="11" fill="#4A545E" fontFamily={F}>建物</text>

        {/* 作業員（1段目の踏板に立っている。柱より奥に描く） */}
        <g transform={`translate(222,${ZD - 12})`}>
          <WorkerSide />
        </g>

        {/* 支柱（内柱・外柱）。傾きを反映 */}
        {[[XI, "内柱"], [XO, "外柱"]].map(([x, nm]) => (
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

/* ── 安全帯（フックの掛け先を選ぶ） ── */
function BeltZoom({ mode, onClear, onFoul }) {
  const [pick, setPick] = useState(null);
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

      <svg viewBox="0 0 340 320" style={{ width: "100%", display: "block" }}>
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


/* ── 完成図（結果の前に振り返る） ── */
function Complete({ svg, stats, onResult }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.grn, fontWeight: 800, letterSpacing: 3 }}>第2章 高所作業</div>
        <div style={{ fontSize: 20, fontWeight: 900, marginTop: 5 }}>足場組立完了</div>
      </div>
      <div style={{ background: "#0F1318", border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
        {svg}
      </div>
      <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, marginBottom: 8 }}>この現場で入れたもの</div>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
        {stats.map(([k, v, c], i) => (
          <div key={i} style={{ display: "flex", fontSize: 12.5, padding: "5px 0" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c, marginRight: 9, marginTop: 3, flexShrink: 0 }} />
            <span style={{ flex: 1, color: C.dim }}>{k}</span>
            <span style={{ fontFamily: MO, color: C.txt }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", fontSize: 12, color: C.dim, lineHeight: 1.95, marginBottom: 16 }}>
        床に乗る前に囲いを作る。手摺は低い方から。<br />
        支柱・受け材・踏板は奥から手前へ。手摺は荷揚げ側から。<br />
        この2つの向きが、材料を運ぶ距離を決めます。
      </div>
      <Btn tone="y" onClick={onResult}>結果を見る</Btn>
    </div>
  );
}

/* ── ゲーム本体 ───────────────────────── */
function Game({ tuto, onEnd, onHome }) {
  const [S, setS] = useState(() => new Set());
  const [qi, setQi] = useState(0);
  const [lv, setLv] = useState(0);          // 作業員の高さ 0/1/2(屋根)
  const [at, setAt] = useState(0);          // 立っている柱の番号（0..3）
  const [tool, setTool] = useState("move");
  const [walking, setWalking] = useState(false);
  const [mood, setMood] = useState("normal");
  const [skill, setSkill] = useState(100);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [errs, setErrs] = useState([]);
  const [msg, setMsg] = useState(tuto ? "まず地上から筋交を入れろ。南端から出隅へ向かって入れる。" : "筋交からだ。南端からだ。");
  const [ov, setOv] = useState(null);
  const [scold, setScold] = useState(null);
  const [t0] = useState(() => Date.now());
  const [sec, setSec] = useState(0);
  const [belt, setBelt] = useState("none");   // none / post / rail

  useEffect(() => { const i = setInterval(() => setSec(Math.floor((Date.now() - t0) / 1000)), 1000); return () => clearInterval(i); }, [t0]);

  const steps = buildSteps();
  const cur = steps[qi];
  const has = (k) => S.has(k);
  const put = (k) => setS((p) => new Set(p).add(k));
  const adv = () => setQi((i) => i + 1);
  const mult = Math.min(1 + Math.floor(combo / 3), 5);
  const SCOLD = ["違う。", "何しとる。", "順番を考えろ。", "そこじゃない。"];

  const good = (t, quiet) => {
    if (!quiet) SFX.ham();
    const g = 100 * mult; setScore((v) => v + g);
    setCombo((c) => { const n = c + 1; setBest((b) => Math.max(b, n)); return n; });
    setMood("good"); setTimeout(() => setMood("normal"), 800);
    setMsg(tuto ? t : (t.length > 14 ? t.split("。")[0] + "。" : t));
  };
  const bad = (t, p = 0, tag) => {
    SFX.buzz(); setCombo(0); setMood("bad"); setTimeout(() => setMood("normal"), 800);
    if (p) { setSkill((v) => Math.max(0, v - p)); setErrs((e) => [...e, { h: tag, t }]); }
    setMsg(tuto ? t : SCOLD[Math.floor(Math.random() * SCOLD.length)]);
  };
  const foul = (line, tag) => {
    SFX.shout(); setScold(tuto ? line : "何をしとるんじゃ！");
    setCombo(0); setMood("bad"); setSkill((v) => Math.max(0, v - 10));
    setErrs((e) => [...e, { h: tag || "重大な誤り", t: line }]);
  };
  const walk = (i) => { setWalking(true); setAt(i); SFX.step(); setTimeout(() => setWalking(false), 300); };

  /* 昇降 */
  const climb = () => {
    if (!cur) return;
    if (cur.k === "climb1") {
      setLv(1); walk(0); adv();
      setOv({ type: "belt", mode: "post", next: () => { setBelt("post"); good("支柱に安全帯を取った。ここから2段目を組む。"); } });
      return;
    }
    if (cur.k === "climb2") {
      if (!SPID.every((id) => has(`D2:${id}`))) return bad("踏板が全部敷けていない。", 8, "手順の飛ばし");
      setLv(2); walk(0); adv();
      return good("昇降階段で2段目に上がった。手摺を入れろ。");
    }
    if (cur.k === "roof") {
      if (!SPID.every((id) => has(`R2:${id}`))) return bad("2段目の手摺が全部入っていない。囲いの無い床には上がらない。", 10, "手摺の無い床に上がる");
      setLv(3); adv();
      return good("屋根に上がった。まず転落防止手摺を立てる。");
    }
    return bad("いま上がる場面じゃない。");
  };

  /* 柱をタップ */
  const tapPost = (i) => {
    const p = POSTS[i];
    if (tool === "move") { if (lv === 0) return bad("まず1段目に上がれ。"); walk(i); return setMsg(`${PN[p]}の前に立った。`); }
    if (lv === 0) return bad("足場の上でやる作業だ。まず上がれ。");
    if (tool === "post") {
      if (cur.k !== "post2" && cur.k !== "postI")
        return bad(cur.k === "rail1" ? "先に1段目の手摺だ。囲いの無い床で作業するな。" : "いま支柱を継ぐ場面じゃない。", 8, "手順の飛ばし");
      if (i !== at) return bad(`${PN[p]}の前まで移動しろ。`);
      if (cur.t !== p) return bad("その柱の番じゃない。奥から手前へ順に継げ。", 8, "建てる順序");
      if (cur.k === "postI") {
        if (has(`PI:${p}`)) return bad("その内柱はもう継いである。");
        put(`PI:${p}`); adv(); return good(`${PN[p]}の内柱も継いだ。踏板を受ける柱だ。`);
      }
      if (has(`P2:${p}`)) return bad("その柱はもう継いである。");
      put(`P2:${p}`); adv(); return good(`${PN[p]}の支柱を継いだ。`);
    }
    if (tool === "brk") {
      if (INNER[p]) return bad("そこは内柱の箇所だ。ブラケットではなく踏板高さの手摺でつなぐ。", 8, "取付位置の誤り");
      if (has(`BRK:${p}`)) return bad("もう掛けてある。");
      if (cur.k !== "brk") return bad("いまブラケットを掛ける場面じゃない。", 8, "手順の飛ばし");
      if (cur.t !== p) return bad("その柱じゃない。", 8, "取付位置の誤り");
      put(`BRK:${p}`); adv(); return good("ブラケットを掛けた。2段目の踏板を受ける材だ。");
    }
    if (tool === "wjack") {
      if (!INNER[p]) return bad("壁当てジャッキは内柱の箇所に付ける。", 8, "取付位置の誤り");
      if (has(`WJ:${p}`)) return bad("もう付いている。");
      if (!cur || cur.k !== "wjack") return bad("いまその場面じゃない。", 8, "手順の飛ばし");
      if (cur.t !== p) return bad("その柱じゃない。", 8, "取付位置の誤り");
      if (!has(`R6:${p}`)) return bad("先に踏板手摺で内柱とつなげ。", 8, "手順の飛ばし");
      return setOv({ type: "wjack", next: () => { put(`WJ:${p}`); adv(); good("壁当てジャッキで建物へ突っ張った。垂直も出ている。"); } });
    }
    if (tool === "rail6") {
      if (!INNER[p]) return bad("そこは内柱の箇所じゃない。ブラケットで受ける。", 8, "取付位置の誤り");
      if (has(`R6:${p}`)) return bad("もう入っている。");
      if (cur.k !== "rail6") return bad("いまその場面じゃない。", 8, "手順の飛ばし");
      if (cur.t !== p) return bad("その柱じゃない。", 8, "取付位置の誤り");
      if (!has(`PI:${p}`)) return bad("内柱がまだ継がれていない。", 8, "手順の飛ばし");
      put(`R6:${p}`); adv(); return good("踏板高さの手摺で内柱とつないだ。これが踏板を受ける。");
    }
    return bad("その資材はそこに付かん。");
  };

  /* スパンをタップ */
  const tapSpan = (k) => {
    const id = SPID[k];
    if (tool === "move") {
      if (lv === 0) return bad("地上では筋交を入れるだけだ。");
      walk(k); return setMsg("スパンの間に立った。");
    }
    if (lv === 0 && tool !== "brace") return bad("それは足場の上でやる作業だ。まず筋交を入れて上がれ。");
    if (tool === "rail") {
      const lvl = cur.k === "rail1" ? 1 : cur.k === "rail2" ? 2 : null;
      if (!lvl) return bad("いま手摺を入れる場面じゃない。", 8, "手順の飛ばし");
      const key = lvl === 1 ? `R1:${id}` : `R2:${id}`;
      if (has(key)) return bad("もう入っている。");
      if (cur.t !== id) return bad("そのスパンの番じゃない。", 8, "取付順序");
      if (lvl === 2 && !has(`D2:${id}`)) return bad("先に踏板を敷け。", 8, "手順の飛ばし");
      /* 1本目の手摺は図解で入れ方を教える */
      if (lvl === 1 && !S.has("TAUGHT")) {
        return setOv({
          type: "rail", next: () => {
            put("TAUGHT"); put(key); adv();
            setOv({ type: "belt", mode: "rail", next: () => { setBelt("rail"); good("手摺に掛け替えた。これで動ける。"); } });
          },
        });
      }
      put(key); adv();
      if (lvl === 1 && belt === "post") {
        setOv({ type: "belt", mode: "rail", next: () => { setBelt("rail"); good("手摺に掛け替えた。これで動ける。"); } });
        return;
      }
      return good(lvl === 1 ? "1段目の手摺が入った。ここが自分の囲いになる。" : "2段目の手摺が入った。");
    }
    if (tool === "fall") {
      if (lv !== 3) return bad("屋根に上がってから付ける。");
      if (!cur || cur.k !== "fall") return bad("いまその場面じゃない。", 8, "手順の飛ばし");
      const [kind] = cur.t.split(":");
      const key = `FL:${cur.t}`;
      if (has(key)) return bad("それはもう入っている。");
      if (cur.t !== `${kind}:${id}`) return bad("そのスパンの番じゃない。", 8, "取付順序");
      if (kind === "U" && !has(`FL:M:${id}`)) return bad("中さんが先だ。低い方から入れる。", 8, "取付順序");
      put(key); adv();
      const rest = SPID.filter((x) => !has(`FL:${kind}:${x}`) && x !== id).length;
      return good(kind === "M"
        ? (rest ? "中さんを入れた。次のスパンへ。" : "中さんが全部入った。次は上さんだ。")
        : (rest ? "上さんを入れた。" : "上さんも全部入った。これで屋根側が囲われた。"));
    }
    if (tool === "brace") {
      if (!cur || cur.k !== "brace") return bad("いま筋交を入れる場面じゃない。", 8, "手順の飛ばし");
      const [lvl, sid] = cur.t.split(":");
      if (sid !== id) return bad("そのスパンじゃない。", 8, "取付位置の誤り");
      if (has(`BR:${cur.t}`)) return bad("もう入っている。");
      if (lvl === "1" && lv !== 0) return bad("1本目の筋交は地上から入れる。降りろ。", 8, "作業位置の誤り");
      if (lvl === "2" && lv !== 1) return bad("2本目の筋交は1段目から入れる。", 8, "作業位置の誤り");
      if (lvl === "3" && lv !== 2) return bad("最後の筋交は2段目から入れる。", 8, "作業位置の誤り");
      /* 1本目は図解で入れ方を教える */
      if (!S.has("BR_TAUGHT")) {
        return setOv({ type: "brace", next: () => { put("BR_TAUGHT"); put(`BR:${cur.t}`); adv(); good("筋交が入った。面が動かなくなる。"); } });
      }
      return setOv({ type: "brace", next: () => { put(`BR:${cur.t}`); adv(); good("筋交が入った。"); } });
    }
    if (tool === "deck") {
      if (has(`D2:${id}`)) return bad("もう敷いてある。");
      if (cur.k !== "deck2") return bad("いま踏板を敷く場面じゃない。受け材が先だ。", 8, "手順の飛ばし");
      if (cur.t !== id) return bad("そのスパンじゃない。", 8, "取付位置の誤り");
      put(`D2:${id}`); adv(); return good("2段目の踏板を敷いた。");
    }
    return bad("そこに付く資材じゃない。");
  };

  const finished = qi >= steps.length;



  /* チュートリアルの案内と使える資材 */
  const guide = tuto && cur ? cur.d : null;
  const usable = () => {
    if (!cur) return ["move"];
    const m = { brace: "brace", rail1: "rail", rail2: "rail", post2: "post", postI: "post", wjack: "wjack", brk: "brk", rail6: "rail6", deck2: "deck", fall: "fall" }[cur.k];
    return m ? ["move", m] : ["move"];
  };
  const ALLT = [["move", "移動"], ["brace", "筋交"], ["rail", "手摺"], ["post", "支柱"], ["wjack", "壁当てジャッキ"], ["brk", "ブラケット"], ["rail6", "踏板手摺"], ["deck", "踏板"], ["fall", "転落防止手摺"]];
  const tools = tuto ? ALLT.filter(([id]) => usable().includes(id)) : ALLT;

  /* 描画：柱の高さ */
  const topOf = (p) => (has(`P2:${p}`) ? 2 + FALL_U + 0.2 : 2.0);
  const topIn = (p) => (has(`PI:${p}`) ? 2.06 : 1.06);   // 踏板高さで止まる
  const wx = lv >= 3 ? px(at) + IN_DX : px(at) + (lv >= 1 ? 13 : 0);
  const wy = lv >= 3 ? roofYAt() + 2 : py(Math.min(lv, 2)) - 9;

  const board = (
        <svg viewBox="0 0 340 476" style={{ width: "100%", display: "block" }}>
      <Roof />
      <rect y={GY} width="340" height="46" fill="#1A2027" />
      {/* 内柱（1段目まで既設） */}
      {POSTS.map((p, i) => INNER[p] && <Post key={"in" + p} i={i} top={topIn(p)} inner joint={has(`PI:${p}`)} />)}
      {/* 1段目：根がらみ・踏板 */}
      <line x1={px(0)} y1={py(0.25)} x2={px(3)} y2={py(0.25)} stroke={C.steelDk} strokeWidth="4.5" />
      {SPANS.map((_, i) => <Deck key={"d1" + i} a={i} b={i + 1} lv={1} />)}
      {POSTS.map((p, i) => INNER[p] && <Rail6 key={"r6a" + p} i={i} lv={1} />)}
      {/* 荷揚げ役 */}
      <Hoister x={px(HOIST) - 30} y={GY} active={cur && /^(rail1|rail2|post2|postI|brk|rail6|deck2)$/.test(cur.k)} />
      {/* 昇降階段 */}
      <Stair i={0} lv={1} />
      {lv >= 2 && <Stair i={0} lv={2} />}
      {/* 外柱 */}
      {POSTS.map((p, i) => <Post key={p} i={i} top={topOf(p)} joint={has(`P2:${p}`)} />)}
      {/* 1段目の手摺 */}
      {SPID.map((id, i) => has(`R1:${id}`) && <Rail key={"r1" + id} a={i} b={i + 1} lv={1} />)}
      {/* 筋交 */}
      {["1", "2", "3"].map((L) => SPID.map((id, i) => has(`BR:${L}:${id}`) && (() => {
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
      {POSTS.map((p, i) => has(`WJ:${p}`) && (() => {
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
      {POSTS.map((p, i) => has(`BRK:${p}`) && <Brk key={"b" + p} i={i} lv={2} />)}
      {POSTS.map((p, i) => has(`R6:${p}`) && <Rail6 key={"r6" + p} i={i} lv={2} />)}
      {/* 2段目 */}
      {SPID.map((id, i) => has(`D2:${id}`) && <Deck key={"d2" + id} a={i} b={i + 1} lv={2} />)}
      {SPID.map((id, i) => has(`R2:${id}`) && <Rail key={"r2" + id} a={i} b={i + 1} lv={2} />)}
      {/* 転落防止手摺 */}
      {[["M", FALL_M, 4], ["U", FALL_U, 5.5]].map(([k, h, w]) => SPID.map((id, i) => has(`FL:${k}:${id}`) && (() => {
        const y = py(2) - h * LH, x1 = px(i), x2 = px(i + 1);
        const wd = (x, d) => `${x},${y - 6} ${x + d * 7},${y - 1} ${x},${y + 5}`;
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
        const i = SPID.indexOf(sid);
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
        const i = SPID.indexOf(sid);
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
        <g key={"tp" + p} className="tgt" style={{ cursor: "pointer" }} onClick={() => tapPost(i)}>
          <circle cx={px(i)} cy={py(Math.min(lv, 2)) - 34} r="18" fill={C.yel} opacity=".10" />
          <circle cx={px(i)} cy={py(Math.min(lv, 2)) - 34} r="18" fill="none" stroke={C.yel} strokeWidth="1.4" strokeDasharray="4 4" />
          <text x={px(i)} y={GY + 24} textAnchor="middle" fontSize="10.5" fill={C.dim} fontFamily={F}>{PN[p]}</text>
        </g>
      ))}
      {/* タップ位置：スパン */}
      {SPID.map((id, i) => {
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
          <g key={"ts" + id} className="tgt" style={{ cursor: "pointer" }} onClick={() => tapSpan(i)}>
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

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {/* HUD */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 14px", background: C.panel, borderBottom: `1px solid ${C.line}` }}>
        <div>
          <div style={{ fontSize: 9, color: C.dim, letterSpacing: 1 }}>SCORE</div>
          <div style={{ fontFamily: MO, fontSize: 16, fontWeight: 700, color: C.yel, lineHeight: 1 }}>{score}</div>
        </div>
        {combo >= 2 && <div style={{ background: C.yel, color: "#14171B", borderRadius: 6, padding: "3px 8px", fontWeight: 900, fontSize: 13, fontFamily: MO }}>{combo} COMBO ×{mult}</div>}
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 9, color: C.dim, letterSpacing: 1 }}>技能</div>
          <div style={{ fontFamily: MO, fontSize: 16, fontWeight: 700, lineHeight: 1, color: skill >= 80 ? C.grn : skill >= 60 ? C.yel : C.red }}>{skill}</div>
        </div>
        <div style={{ fontFamily: MO, fontSize: 12, color: C.dim }}>{String(Math.floor(sec / 60)).padStart(2, "0")}:{String(sec % 60).padStart(2, "0")}</div>
      </div>

      {/* 盤面（立面） */}
      {!finished && <div style={{ background: "#0F1318", borderBottom: `1px solid ${C.line}`, position: "relative" }}>
        {guide && (
          <div style={{ position: "absolute", left: 8, right: 8, top: 8, zIndex: 4, background: "#0F1318ee", border: `1px solid ${C.yel}`, borderRadius: 9, padding: "9px 12px", display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 9, color: "#14171B", background: C.yel, borderRadius: 4, padding: "2px 6px", fontWeight: 900 }}>次</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}>{guide}</span>
          </div>
        )}
        {!guide && (
          <div style={{ position: "absolute", left: 8, top: 8, zIndex: 4, background: "#0F1318cc", borderRadius: 7, padding: "5px 9px", fontSize: 10.5, color: C.dim }}>
            {["地上", "1段目", "2段目", "屋根"][lv]}　<b style={{ color: C.cyan }}>{PN[POSTS[at]] || ""}</b>
          </div>
        )}

        {board}
      </div>}

      {finished && (
        <Complete
          svg={board}
          stats={[
            ["1段目の手摺", `${SPID.length}スパン`, C.yel],
            ["継いだ支柱", `${POSTS.length}本`, C.steel],
            ["継いだ内柱", `${POSTS.filter((p) => INNER[p]).length}本`, "#7E8A96"],
            ["ブラケット", `${POSTS.filter((p) => !INNER[p]).length}箇所`, C.steelDk],
            ["踏板高さの手摺", `${POSTS.filter((p) => INNER[p]).length}箇所`, C.cyan],
            ["2段目の踏板", `${SPID.length}枚`, "#7B8895"],
            ["2段目の手摺", `${SPID.length}スパン`, C.yel],
            ["筋交", `3本（南端から出隅へ一直線）`, "#B9C4CE"],
            ["壁当てジャッキ", `${POSTS.filter((p) => INNER[p]).length}箇所`, C.org],
            ["転落防止手摺", `${SPID.length}スパン × 2本`, C.org],
          ]}
          onResult={() => onEnd({ skill, score, best, errs, sec })} />
      )}

      {/* 親方 */}
      {!finished &&
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start", margin: "8px 14px 0", background: C.panel, border: `1px solid ${mood === "bad" ? C.red : C.line}`, borderRadius: 10, padding: "9px 11px" }}>
        <Boss size={38} angry={mood === "bad"} />
        <div style={{ fontSize: 12.5, lineHeight: 1.65, color: mood === "bad" ? "#F4B5AE" : C.txt, paddingTop: 2 }}>{msg}</div>
      </div>}

      {/* 操作 */}
      {!finished && <div style={{ padding: "10px 14px 14px" }}>
        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2 }}>
          {tools.map(([id, n]) => (
            <button key={id} onClick={() => setTool(id)} style={{
              flex: "0 0 auto", background: tool === id ? C.yel : C.panel2, color: tool === id ? "#14171B" : C.txt,
              border: `1px solid ${tool === id ? C.yel : C.line}`, borderRadius: 7, padding: "9px 13px",
              fontSize: 12, fontWeight: 800, fontFamily: F, cursor: "pointer", whiteSpace: "nowrap",
            }}>{n}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 7 }}>
          <Btn tone={cur && /^(climb1|climb2|roof)$/.test(cur.k) ? "y" : undefined} onClick={climb}>
            {!cur ? "—" : cur.k === "climb1" ? "昇降階段で1段目へ" : cur.k === "climb2" ? "昇降階段で2段目へ" : cur.k === "roof" ? "屋根に上がる" : "上がる"}
          </Btn>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            background: belt === "none" ? C.panel2 : C.panel, border: `1px solid ${belt === "none" ? C.red : C.grn}`,
            borderRadius: 9, padding: 12, fontSize: 12.5, fontWeight: 800,
            color: belt === "none" ? "#F4B5AE" : C.grn,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: belt === "none" ? C.red : C.grn }} />
            {belt === "none" ? "安全帯 未" : belt === "post" ? "安全帯 支柱" : "安全帯 手摺"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
          <button onClick={onHome} style={{ flex: 1, background: "none", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 8, padding: 9, fontSize: 11.5, fontFamily: F, cursor: "pointer" }}>中断</button>
        </div>
      </div>}

      {ov && ov.type === "wjack" && (
        <WJackZoom onClear={() => { const n = ov.next; setOv(null); n(); }}
          onFoul={(fb) => foul(fb, "壁当てジャッキの取付位置の誤り")} />
      )}
      {ov && ov.type === "brace" && (
        <BraceZoom onClear={() => { const n = ov.next; setOv(null); SFX.ok(); n(); }}
          onFoul={(fb) => foul(fb, "筋交の入れ方の誤り")} />
      )}
      {ov && ov.type === "rail" && (
        <RailZoom onClear={() => { const n = ov.next; setOv(null); SFX.ok(); n(); }}
          onFoul={(fb) => { setOv(null); foul(fb, "手摺の取付位置の誤り"); }} />
      )}
      {ov && ov.type === "belt" && (
        <BeltZoom mode={ov.mode} onClear={() => { const n = ov.next; setOv(null); SFX.ok(); n(); }}
          onFoul={(fb) => { setOv(null); foul(fb, "安全帯の取り付け位置の誤り"); }} />
      )}
      {scold && <Scold line={scold} onClose={() => { setScold(null); setMood("normal"); }} />}
    </div>
  );
}

/* ── 結果 ─────────────────────────────── */
const RANKS = [{ min: 100, r: "S", t: "一人前" }, { min: 90, r: "A", t: "半人前の上" }, { min: 75, r: "B", t: "見習い" }, { min: 0, r: "C", t: "まだ上に上げられん" }];
function Result({ r, onRetry, onHome }) {
  const rk = RANKS.find((x) => r.skill >= x.min), pass = r.skill >= 80, u = [];
  r.errs.forEach((e) => { const f = u.find((v) => v.h === e.h); if (f) f.n++; else u.push({ ...e, n: 1 }); });
  return (
    <div style={{ padding: 20 }}>
      <div style={{ border: `1px solid ${pass ? C.grn : C.red}`, borderRadius: 12, padding: 20, background: C.panel, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: C.dim, letterSpacing: 3 }}>第2章 高所作業</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, margin: "10px 0" }}>
          <div className="rank" style={{ fontFamily: MO, fontSize: 60, fontWeight: 800, color: pass ? C.yel : C.red, lineHeight: 1 }}>{rk.r}</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 15, fontWeight: 900 }}>{rk.t}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{pass ? "合格" : "不合格 — 再受講"}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
          {[["SCORE", r.score], ["最大コンボ", r.best], ["技能", r.skill]].map(([t, v], i) => (
            <div key={i} style={{ background: C.panel2, borderRadius: 8, padding: "9px 4px" }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 1 }}>{t}</div>
              <div style={{ fontFamily: MO, fontSize: 17, fontWeight: 700, color: C.yel }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 10 }}>タイム {String(Math.floor(r.sec / 60)).padStart(2, "0")}:{String(r.sec % 60).padStart(2, "0")}</div>
      </div>
      {u.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: C.yel, letterSpacing: 2, marginBottom: 8 }}>親方に言われたこと</div>
          {u.map((e, k) => (
            <div key={k} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "11px 13px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 3 }}>{e.h}{e.n > 1 && ` ×${e.n}`}</div>
              <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>{e.t}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center", background: C.panel, border: `1px solid ${C.grn}`, borderRadius: 10, padding: 14 }}>
          <Boss size={44} /><div style={{ fontSize: 13, color: C.grn, lineHeight: 1.6 }}>一度も怒られんかったな。上出来じゃ。</div>
        </div>
      )}
      <div style={{ display: "grid", gap: 8, marginTop: 20 }}>
        <Btn tone="y" onClick={onRetry}>もう一度やる</Btn>
        <Btn onClick={onHome} style={{ color: C.dim, fontWeight: 400 }}>ホームへ</Btn>
      </div>
    </div>
  );
}

/* ── ルート ───────────────────────────── */
export default function App() {
  const [v, setV] = useState("home");
  const [r, setR] = useState(null);
  const [seed, setSeed] = useState(0);
  const [tuto, setTuto] = useState(true);
  const [snd, setSnd] = useState(true);
  const css = `
    @keyframes rise{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
    .el{animation:rise .3s cubic-bezier(.2,.9,.3,1.3) both}
    @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}} .idle{animation:bob 2.4s ease-in-out infinite}
    @keyframes wk{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}} .walk{animation:wk .3s ease-in-out}
    @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}} .tgt{animation:pulse 1.9s ease-in-out infinite}
    @keyframes shk{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
    .shake{animation:shk .4s ease}
    @keyframes rk{0%{opacity:0;transform:scale(2.2)}100%{opacity:1;transform:scale(1)}} .rank{animation:rk .5s cubic-bezier(.2,.9,.3,1.2) both}
    @media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
  `;
  return (
    <div style={{ background: C.bg, color: C.txt, fontFamily: F, minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative", overflow: "hidden" }}>
      <style>{css}</style>
      <Tape />
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.5 }}>足場 実務トレーニング</div>
        <div style={{ fontSize: 10, color: C.dim, border: `1px solid ${C.line}`, padding: "2px 6px", borderRadius: 4 }}>第2章</div>
        <button onClick={() => { const n = !snd; setSnd(n); SFX.setOn(n); if (n) SFX.warm(); }} style={{
          marginLeft: "auto", background: "none", border: `1px solid ${C.line}`, color: snd ? C.yel : C.dim,
          borderRadius: 6, padding: "5px 9px", fontSize: 12, fontFamily: F, cursor: "pointer",
        }}>{snd ? "🔊 音 ON" : "🔇 音 OFF"}</button>
      </div>

      {v === "home" && (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.45, margin: "6px 0" }}>床に乗る前に、<br />囲いを作る。</div>
          <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.85, marginBottom: 18 }}>
            1段目に上がり、2段目を組み上げて、屋根の転落防止手摺まで。<br />
            足場の墜落災害が最も多いのは、この工程です。
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "13px 15px", marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: C.yel, letterSpacing: 2, marginBottom: 8 }}>この章の流れ</div>
            <div style={{ fontSize: 12, color: C.dim, lineHeight: 2 }}>
              地上から筋交（南端〜南②）<br />
              昇降階段で1段目へ　→　安全帯を支柱に<br />
              1段目の手摺（荷揚げ側から）→　安全帯を手摺へ<br />
              支柱・内柱を継ぐ（奥から）<br />
              ブラケット／踏板手摺　→　壁当てジャッキ<br />
              踏板　→　1段目から筋交（南①〜南②）<br />
              昇降階段で2段目へ　→　2段目の手摺（荷揚げ側から）<br />
              2段目から筋交（出隅〜南①）＝一直線に揃う<br />
              屋根へ　→　転落防止手摺（中さん2,250→上さん2,700）
            </div>
          </div>

          <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, marginBottom: 7 }}>モード</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 14 }}>
            {[
              { k: true, t: "チュートリアル", d: "次の作業を表示\n使える資材だけ出る" },
              { k: false, t: "本番", d: "指示は出ない\n間違えれば怒られる" },
            ].map((o) => (
              <button key={String(o.k)} onClick={() => setTuto(o.k)} style={{
                textAlign: "left", background: tuto === o.k ? C.panel : C.panel2,
                border: `1px solid ${tuto === o.k ? C.yel : C.line}`, borderRadius: 10,
                padding: "12px 13px", fontFamily: F, cursor: "pointer", color: C.txt,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 7, flexShrink: 0, border: `1px solid ${tuto === o.k ? C.yel : C.line}`, background: tuto === o.k ? C.yel : "transparent" }} />
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{o.t}</span>
                </div>
                <div style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.75, marginTop: 6, whiteSpace: "pre-line" }}>{o.d}</div>
              </button>
            ))}
          </div>

          <button onClick={() => { SFX.warm(); setSeed((s) => s + 1); setV("game"); }} style={{
            display: "block", width: "100%", textAlign: "left", background: C.yel, color: "#14171B",
            border: "none", borderRadius: 10, padding: 16, fontFamily: F, cursor: "pointer",
          }}>
            <div style={{ fontSize: 11, opacity: .65, marginBottom: 3 }}>第2章</div>
            <div style={{ fontSize: 17, fontWeight: 900 }}>高所作業</div>
            <div style={{ fontSize: 12, opacity: .7, marginTop: 3 }}>戸建・一側足場／南面3スパン　内柱＝南②・南端</div>
          </button>

          <div style={{ fontSize: 11, color: C.dim, marginTop: 14, lineHeight: 1.8 }}>
            荷揚げは出隅側から。手摺は荷揚げ側から入れ、支柱・受け材・踏板は奥から手前へ戻りながら付けると、材料を運ぶ距離が短くて済みます。
          </div>
        </div>
      )}

      {v === "game" && <Game key={seed} tuto={tuto} onEnd={(x) => { setR(x); setV("res"); }} onHome={() => setV("home")} />}
      {v === "res" && <Result r={r} onRetry={() => { setSeed((s) => s + 1); setV("game"); }} onHome={() => setV("home")} />}
      <Tape h={4} />
    </div>
  );
}
