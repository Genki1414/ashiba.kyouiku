import React, { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════
   足場 実務トレーニング ／ 第3章 火打とシート
   前半：火打（4面組立済みの状態を平面図で展開）
   出隅4箇所に、支柱と支柱を結ぶ二等辺三角形の火打を入れる
   ═══════════════════════════════════════════ */

const C = {
  bg: "#14171B", panel: "#1E232A", panel2: "#252C34", line: "#2E3640",
  steel: "#93A0AD", steelLt: "#CBD6DF", steelDk: "#5F6B78",
  yel: "#F5D400", red: "#E23B2E", grn: "#25B36B", cyan: "#4FC3D9", org: "#D98B2B",
  navy: "#2F4A6B", skin: "#E2B48C", txt: "#E9EEF3", dim: "#8D98A4", dim2: "#5F6B78",
};
const F = `"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif`;
const MO = `ui-monospace,"SFMono-Regular",Menlo,monospace`;

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


/* ── 平面図の寸法 ───────────────────────────
   南面・北面＝3スパン、東面・西面＝2スパン。1スパン＝84px
   ─────────────────────────────────────── */
const SP = 84;
const PX0 = 44, PX1 = PX0 + SP * 3;      // 44 → 296
const PY1 = 250, PY0 = PY1 - SP * 2;     // 250 → 82（上が北）
const BW = 26;                            // 足場の幅（600mm相当）

/* 出隅4箇所。dx/dy＝その出隅から各面が伸びる向き */
const CORNERS = [
  { id: "SE", nm: "南東の出隅", fa: "南面", fb: "東面", dx: -1, dy: -1, x: PX1, y: PY1 },
  { id: "SW", nm: "南西の出隅", fa: "南面", fb: "西面", dx: 1, dy: -1, x: PX0, y: PY1 },
  { id: "NW", nm: "北西の出隅", fa: "北面", fb: "西面", dx: 1, dy: 1, x: PX0, y: PY0 },
  { id: "NE", nm: "北東の出隅", fa: "北面", fb: "東面", dx: -1, dy: 1, x: PX1, y: PY0 },
];

const XS = [PX0, PX0 + SP, PX0 + SP * 2, PX1];
const YS = [PY0, PY0 + SP, PY1];

/* ══════════════ 平面図（盤面） ══════════════ */
function Plan({ done, cur, onTap, skew = 0 }) {
  const posts = [];
  XS.forEach((x) => { posts.push([x, PY0]); posts.push([x, PY1]); });
  YS.slice(1, -1).forEach((y) => { posts.push([PX0, y]); posts.push([PX1, y]); });

  /* ひし形変形のデモ：上辺だけ横へずらす */
  const sk = (x, y) => [x + skew * ((PY1 - y) / (PY1 - PY0)), y];

  const L = (x1, y1, x2, y2, st, w = 3.5) => {
    const a = sk(x1, y1), b = sk(x2, y2);
    return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={st} strokeWidth={w} strokeLinecap="round" />;
  };

  return (
    <svg viewBox="0 0 340 300" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
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

      {/* 入れた火打 */}
      {CORNERS.filter((c) => done.includes(c.id)).map((c) => {
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

/* ══════════════ 出隅のズーム ══════════════ */
function HiuchiZoom({ corner, onClear, onFoul }) {
  const [sel, setSel] = useState([]);       // 選んだ取付点
  const [ng, setNg] = useState(null);
  const D = 100;                            // ズーム上の1スパン
  const cx = corner.dx > 0 ? 92 : 248;
  const cy = corner.dy > 0 ? 78 : 222;

  /* 取付点。f=面（a=南北面 b=東西面）、n=出隅から何本目、k=post/rail */
  const pt = (f, k, n) => f === "a"
    ? { x: cx + corner.dx * (k === "rail" ? D * (n - .5) : D * n), y: cy }
    : { x: cx, y: cy + corner.dy * (k === "rail" ? D * (n - .5) : D * n) };
  const TGT = [
    { f: "a", k: "post", n: 1 }, { f: "a", k: "post", n: 2 }, { f: "a", k: "rail", n: 1 },
    { f: "b", k: "post", n: 1 }, { f: "b", k: "post", n: 2 }, { f: "b", k: "rail", n: 1 },
  ].map((t) => ({ ...t, ...pt(t.f, t.k, t.n) }));

  const tap = (t) => {
    if (sel.length >= 2) return;
    const s = [...sel, t];
    setSel(s);
    SFX.step();
    if (s.length < 2) return;
    const [a, b] = s;
    setTimeout(() => {
      if (a.k === "rail" || b.k === "rail") {
        setNg("rail");
        onFoul("火打は支柱に付ける。どうしても手摺に付けるときは、その手摺に抜け止め措置をすること。");
      } else if (a.f === b.f) {
        setNg("face");
        onFoul("同じ面の支柱どうしでは三角形にならない。出隅をまたいで、両方の面に振り分ける。");
      } else if (a.n !== b.n) {
        setNg("iso");
        onFoul("二等辺になっていない。出隅から同じ距離の支柱に掛ける。");
      } else {
        SFX.ham(); SFX.ok();
        setNg(null);
      }
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
            <g key={i} onClick={() => tap(t)} style={{ cursor: "pointer" }} className="tgt">
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
        {okNow && <Btn tone="y" onClick={onClear}>次へ</Btn>}

        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "11px 13px", fontSize: 12, color: C.dim, lineHeight: 1.9, marginTop: 12 }}>
          火打は圧縮材と併用することで引張効果が生じる。<br />
          圧縮材は火打の近傍に設けること。
        </div>
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

/* ══════════════ 親方 ══════════════ */
function Oyakata({ show, text }) {
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

/* ══════════════ シート ══════════════
   ① 全スパンを最上段から下へ垂らす（足で挟んで落とさない）
   ② 緊結ピッチ（450または900。戸建は900でよい）
   ③ 支柱に結ぶ。2段目を全部結んでから1段目、地上へ下りる
      出隅は南①・西①の両方を結んでから
   ═══════════════════════════════════ */
const FX = [44, 128, 212, 296];
const FN = ["出隅", "南①", "南②", "南端"];
const TOPY = 62, GY = 284;
const SPANS3 = [0, 1, 2];

const CX = 100, CY = 190, PS = 62;
const PPOST = [
  { k: "corner", x: CX, y: CY, nm: "出隅" },
  { k: "s1", x: CX + PS, y: CY, nm: "南①" },
  { k: "s2", x: CX + PS * 2, y: CY, nm: "南②" },
  { k: "s3", x: CX + PS * 3, y: CY, nm: "南端" },
  { k: "w1", x: CX, y: CY - PS, nm: "西①" },
  { k: "w2", x: CX, y: CY - PS * 2, nm: "西②" },
];
const NEXT_TO_CORNER = ["s1", "w1"];
const BANDS = [
  { nm: "2段目", top: "最上段" },
  { nm: "1段目", top: "2段目" },
  { nm: "地上", top: "1段目" },
];

function SheetPart({ onDone, onFoul, say }) {
  const [ph, setPh] = useState("hang");          // hang / pitch / tie / done
  const [hung, setHung] = useState([]);
  const [roll, setRoll] = useState({});
  const [footOK, setFootOK] = useState(false);
  const [ask, setAsk] = useState(null);
  const [fall, setFall] = useState(null);
  const [pitch, setPitch] = useState(null);
  const [bi, setBi] = useState(0);               // いま結んでいる段
  const [tied, setTied] = useState([]);          // その段で結び終えた支柱
  const [sel, setSel] = useState(null);
  const [dots, setDots] = useState([]);
  const [gap, setGap] = useState(false);
  const [angry, setAngry] = useState(false);
  const [angryMsg, setAngryMsg] = useState("");

  const scold = (t) => {
    SFX.shout(); setAngry(true); setAngryMsg(t); onFoul(t);
    setTimeout(() => setAngry(false), 4200);
  };

  /* ── ① 垂らす ── */
  const hang = (i) => { if (!footOK) { setAsk(i); return; } drop(i); };
  const drop = (i) => {
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
  const spread = (foot) => {
    const i = ask;
    if (foot) { setFootOK(true); setAsk(null); drop(i); say("そのまま足で押さえておけ。"); }
    else {
      setAsk(null); setFall({ i, y: 0, done: false });
      scold("オイ！　シートを落としたぞ。下に人が居たらどうする。広げるときは足で挟んで押さえながらだ。");
      let t = 0;
      const id = setInterval(() => {
        t += 1; setFall({ i, y: t * 22, done: t >= 10 });
        if (t >= 10) { clearInterval(id); setTimeout(() => setFall(null), 2600); }
      }, 45);
    }
  };

  /* ── ② ピッチ ── */
  const pickPitch = (v) => {
    setPitch(v);
    if (v === 1800) { scold("粗すぎる。緊結ピッチは450か900だ。戸建なら900でよい。"); }
    else { SFX.ham(); setPh("tie"); say("2段目から結んでいく。どの支柱からでもいいが、出隅は最後だ。"); }
  };

  /* ── ③ 支柱を選ぶ ── */
  const tap = (k) => {
    if (tied.includes(k) || sel) return;
    if (k === "corner" && !NEXT_TO_CORNER.every((n) => tied.includes(n))) {
      setGap(true);
      const nokori = NEXT_TO_CORNER.filter((n) => !tied.includes(n)).map((n) => PPOST.find((p) => p.k === n).nm).join("と");
      scold(`まだ${nokori}が結べていない。出隅を先に結ぶとシートが出隅側へ寄って、隣の支柱の側に隙間が空く。`);
      setTimeout(() => setGap(false), 1800);
      return;
    }
    SFX.ham(); setSel(k); setDots([]);
  };

  /* ── ④ 結ぶ位置。立っている踏板から上へ、下から順に ── */
  const DOTN = 4;                                 // 1段＝1,800mm ÷ 450mm＝4コマ
  /* 上（4コマ目）から下へ。900なら4コマ目・2コマ目 */
  const OKDOT = [4, 3, 2, 1].filter((i) => pitch === 450 ? true : i % 2 === 0);
  const hitDot = (i) => {
    if (dots.includes(i)) return;
    if (i === 0) {
      scold("そこは自分が立っている踏板の高さだ。踏板高さは下の段に立って結んだ方が効率が良い。ここからは上を結べ。");
      return;
    }
    const need = OKDOT[dots.length];
    if (i !== need) {
      scold(OKDOT.includes(i) ? "上から順に結んでいけ。" : `${pitch}mmで結ぶと決めただろう。その位置は間だ。`);
      setDots([]);
      return;
    }
    SFX.ham();
    setDots([...dots, i]);
  };

  /* 次の支柱へ（結び終わっていなければファール） */
  const goNext = () => {
    if (dots.length < OKDOT.length) {
      scold("まだ結び終わっていない。この支柱を終わらせてから次だ。");
      return;
    }
    SFX.ok();
    const nt = [...tied, sel];
    setSel(null); setDots([]);
    if (nt.length === PPOST.length) {
      /* 1段目・地上は同じ繰り返しなので省略 */
      setTied(nt); setPh("done");
      say("2段目が全部結べた。あとは1段目、地上と同じことを繰り返すだけだ。");
    } else { setTied(nt); say("結べた。次の支柱へ。"); }
  };

  const Strip = ({ i, h, drop: dy = 0, op = 1 }) => (
    <g opacity={op}>
      <rect x={FX[i] + 2} y={TOPY + dy} width={FX[i + 1] - FX[i] - 4} height={(GY - TOPY) * h} fill="#2C6B4A" opacity=".55" />
      <rect x={FX[i] + 2} y={TOPY + dy} width={FX[i + 1] - FX[i] - 4} height={(GY - TOPY) * h} fill="url(#mesh)" opacity=".5" />
      <rect x={FX[i] + 2} y={TOPY + dy} width={FX[i + 1] - FX[i] - 4} height={(GY - TOPY) * h} fill="none" stroke="#3E8F63" strokeWidth="1.5" />
    </g>
  );

  /* ══ 全画面：結ぶ位置を選ぶ ══ */
  const TieFull = () => {
    const p = PPOST.find((q) => q.k === sel), B = BANDS[bi];
    const Y0 = 96, Y1 = 470;                     // Y1＝いま立っている踏板
    const dy = (i) => Y1 - ((Y1 - Y0) / DOTN) * i;
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
              <g key={i} onClick={() => hitDot(i)} style={{ cursor: "pointer" }} className={on ? "" : "tgt"}>
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
        <Oyakata show={angry} text={angryMsg} />
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
              <g key={p.k} onClick={() => tap(p.k)} style={{ cursor: "pointer" }} className={on ? "" : "tgt"}>
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
          <rect y={GY} width="340" height="16" fill="#1A2027" />
          {[TOPY, 142, 222, GY].map((y, i) => (
            <line key={i} x1="44" y1={y} x2="296" y2={y} stroke={C.steel} strokeWidth="4" strokeLinecap="round" />
          ))}
          {FX.map((x, i) => (
            <g key={i}>
              <line x1={x} y1="52" x2={x} y2={GY} stroke={C.steel} strokeWidth="7" />
              <text x={x} y="298" textAnchor="middle" fontSize="9.5" fill={i === 0 ? C.yel : C.dim2} fontFamily={F}>{FN[i]}</text>
            </g>
          ))}
          {SPANS3.map((i) => (roll[i] ? <Strip key={i} i={i} h={Math.min(1, roll[i])} /> : null))}
          {fall && !fall.done && <Strip i={fall.i} h={.5} drop={fall.y} op={.6} />}
          {fall && fall.done && (
            <g>
              <ellipse cx={(FX[fall.i] + FX[fall.i + 1]) / 2} cy={GY + 6} rx="42" ry="11" fill="#2C6B4A" opacity=".85" />
              <ellipse cx={(FX[fall.i] + FX[fall.i + 1]) / 2} cy={GY + 2} rx="34" ry="9" fill="#3E8F63" opacity=".8" />
              <text x={(FX[fall.i] + FX[fall.i + 1]) / 2} y={GY - 14} textAnchor="middle" fontSize="11" fill={C.red} fontFamily={F} fontWeight="800">落とした</text>
            </g>
          )}
          {ph === "hang" && SPANS3.filter((i) => !hung.includes(i) && !roll[i]).map((i) => (
            <g key={i} onClick={() => hang(i)} style={{ cursor: "pointer" }} className="tgt">
              <rect x={FX[i] + 4} y={TOPY} width={FX[i + 1] - FX[i] - 8} height={GY - TOPY} fill={C.yel} opacity=".07" />
              <rect x={FX[i] + 4} y={TOPY} width={FX[i + 1] - FX[i] - 8} height={GY - TOPY} fill="none" stroke={C.yel} strokeWidth="1.4" strokeDasharray="5 4" />
              <text x={(FX[i] + FX[i + 1]) / 2} y={TOPY + 26} textAnchor="middle" fontSize="11" fill={C.yel} fontFamily={F}>垂らす</text>
            </g>
          ))}
        </svg>
      )}

      <Oyakata show={angry && !sel} text={angryMsg} />

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

/* ══════════════ 本体 ══════════════ */
export default function App() {
  const [view, setView] = useState("home");   // home / play / done
  const [done, setDone] = useState([]);
  const [zoom, setZoom] = useState(null);
  const [msg, setMsg] = useState("4面とも組み上がった。最上段の出隅に火打を入れる。");
  const [fouls, setFouls] = useState([]);
  const [sound, setSound] = useState(true);
  const [skew, setSkew] = useState(0);

  useEffect(() => { SFX.setOn(sound); }, [sound]);

  const cur = CORNERS.find((c) => !done.includes(c.id));
  const say = (t) => setMsg(t);

  const clear = () => {
    const c = cur;
    setZoom(null);
    const nd = [...done, c.id];
    setDone(nd);
    if (nd.length === CORNERS.length) { setMsg("4箇所とも入った。これで平面が固まった。次はシートだ。"); setView("hiuchiDone"); }
    else setMsg(`${c.nm}に入った。次は${CORNERS.find((x) => !nd.includes(x.id)).nm}だ。`);
  };
  const foul = (t) => { SFX.shout(); setMsg(t); setFouls((f) => [...f, t]); };

  /* ひし形変形のデモ */
  const demo = () => {
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      setSkew(Math.sin(t / 6) * 26);
      if (t > 38) { clearInterval(id); setSkew(0); }
    }, 45);
  };

  if (view === "home") {
    return (
      <div style={{ background: C.bg, color: C.txt, fontFamily: F, minHeight: "100vh", padding: "22px 18px 40px", boxSizing: "border-box" }}>
        <div style={{ height: 4, background: `repeating-linear-gradient(45deg,${C.yel} 0 10px,#14171B 10px 20px)`, marginBottom: 20 }} />
        <div style={{ fontSize: 11, color: C.yel, fontWeight: 800, letterSpacing: 2 }}>第3章</div>
        <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>火打とシート</div>
        <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.9, margin: "12px 0 20px" }}>
          第2章の現場の続き。4面とも組み上がった状態から始める。<br />
          この章の前半は火打だ。平面図で、最上段の出隅4箇所に入れていく。
        </div>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "13px 15px", fontSize: 12, color: C.dim, lineHeight: 1.95, marginBottom: 20 }}>
          火打は、足場が平面内でひし形に変形するのを防ぐための補強だ。<br />
          最上段のコーナーで、直交する布材に単管を斜めに掛けて三角形をつくる。
        </div>
        <Btn tone="y" onClick={() => { SFX.warm(); setView("play"); }}>はじめる</Btn>
        <Btn onClick={() => { SFX.warm(); setView("sheet"); setMsg("シートから始める。上から下へ、1スパンに1枚だ。"); }} style={{ marginTop: 10 }}>
          シートから始める（テスト用）
        </Btn>
        <style>{`html, body, #root { background: ${C.bg}; margin: 0; }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      background: C.bg, color: C.txt, fontFamily: F, height: "100dvh", position: "relative",
      boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ height: 4, background: `repeating-linear-gradient(45deg,${C.yel} 0 10px,#14171B 10px 20px)` }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ fontSize: 13, fontWeight: 900 }}>
          {view === "sheet" ? "シート" : "火打"}
          <span style={{ fontSize: 11, color: C.dim, fontWeight: 400 }}>{view === "sheet" ? "" : `　${done.length} / 4`}</span>
        </div>
        <button onClick={() => setSound(!sound)} style={{
          background: "none", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 7,
          padding: "5px 10px", fontSize: 11, fontFamily: F, cursor: "pointer",
        }}>音 {sound ? "ON" : "OFF"}</button>
      </div>

      <div style={{ padding: "10px 14px", fontSize: 12.5, color: C.txt, lineHeight: 1.75, background: C.panel, borderBottom: `1px solid ${C.line}` }}>
        {msg}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {view === "sheet"
          ? <SheetPart onDone={() => { setView("done"); setMsg("火打もシートも終わった。第3章はここまでだ。"); }} onFoul={foul} say={say} />
          : <div style={{ flex: 1, minHeight: 0 }}>
            <Plan done={done} cur={view === "play" ? cur : null} onTap={() => setZoom(cur)} skew={skew} />
          </div>}
      </div>

      <div style={{ padding: "4px 16px 16px", flex: "0 0 auto", maxHeight: "42vh", overflowY: "auto" }}>
        {view === "done" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 900, marginTop: 10 }}>第3章 完了</div>
            <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.9, margin: "8px 0 14px" }}>
              出隅4箇所の火打と、最上段のシート。<br />
              指摘された回数　<span style={{ color: fouls.length ? C.red : C.grn, fontWeight: 800 }}>{fouls.length}回</span>
            </div>
          </>
        )}
        {view === "play" && cur && (
          <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.85 }}>
            平面図の黄色い丸（{cur.nm}）をタップして寄る。
            <button onClick={() => { setView("sheet"); setMsg("シートへ飛んだ。上から下へ、1スパンに1枚だ。"); }} style={{
              display: "block", marginTop: 12, background: "none", border: `1px solid ${C.line}`,
              color: C.dim2, borderRadius: 7, padding: "6px 11px", fontSize: 11, fontFamily: F, cursor: "pointer",
            }}>火打を飛ばしてシートへ（テスト用）</button>
          </div>
        )}
        {view === "hiuchiDone" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 900, marginTop: 10 }}>火打が入った</div>
            <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.9, margin: "8px 0 14px" }}>
              4つの出隅に三角形ができた。これで平面がねじれない。<br />
              火打が無いと、足場は上から見てひし形に崩れていく。
            </div>
            <Btn onClick={demo} style={{ marginBottom: 10 }}>火打が無いとどうなるか見る</Btn>
            <Btn tone="y" onClick={() => { setView("sheet"); setMsg("次はシートだ。上から下へ張っていく。"); }} style={{ marginBottom: 10 }}>シートへ進む</Btn>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "12px 14px", fontSize: 12, color: C.dim, lineHeight: 1.9 }}>
              この現場で入れた火打　<span style={{ color: C.txt, fontWeight: 800 }}>4箇所</span><br />
              指摘された回数　<span style={{ color: fouls.length ? C.red : C.grn, fontWeight: 800 }}>{fouls.length}回</span>
            </div>

          </>
        )}
      </div>

      {zoom && <HiuchiZoom corner={zoom} onClear={clear} onFoul={foul} />}

      <style>{`
        html, body, #root { background: ${C.bg}; }
        .tgt { animation: pulse 1.9s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
        @keyframes shk { 0%,100% { transform: translateX(0) rotate(0) } 25% { transform: translateX(-3px) rotate(-2deg) } 75% { transform: translateX(3px) rotate(2deg) } }
      `}</style>
    </div>
  );
}
