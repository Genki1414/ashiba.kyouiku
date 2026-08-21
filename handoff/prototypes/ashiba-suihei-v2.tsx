import React, { useState } from "react";

/* ═══════════════════════════════════════════
   第1章に追加する場面：水平器をどこに当てるか
   正解＝支柱。手摺の端（凹み）に当てると誤差が出て、
   4面が回ってきたときに根がらみの高さが合わなくなる。
   ═══════════════════════════════════════════ */

const C = {
  bg: "#14171B", panel: "#1E232A", panel2: "#252C34", line: "#2E3640",
  steel: "#93A0AD", steelLt: "#CBD6DF", steelDk: "#5F6B78",
  yel: "#F5D400", red: "#E23B2E", grn: "#25B36B", cyan: "#4FC3D9", org: "#D98B2B",
  navy: "#2F4A6B", skin: "#E2B48C", txt: "#E9EEF3", dim: "#8D98A4", dim2: "#5F6B78",
};
const F = `"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif`;

function Btn({ children, onClick, tone, style }) {
  const y = tone === "y";
  return (
    <button onClick={onClick} style={{
      background: y ? C.yel : "none", color: y ? "#14171B" : C.txt,
      border: `1px solid ${y ? C.yel : C.line}`, borderRadius: 9, padding: 12,
      fontWeight: 800, fontSize: 13, fontFamily: F, cursor: "pointer", width: "100%", ...style,
    }}>{children}</button>
  );
}

/* 親方（顔＋セリフ） */
function Oyakata({ text }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
      <div style={{
        background: "#2A1512", border: `2px solid ${C.red}`, borderRadius: 14, padding: 4,
        animation: "shk .28s ease-in-out 3", flex: "0 0 auto",
      }}>
        <svg width="72" height="72" viewBox="0 0 100 100">
          <ellipse cx="50" cy="94" rx="30" ry="7" fill="#000" opacity=".3" />
          <rect x="38" y="70" width="24" height="14" fill={C.skin} />
          <path d="M18 100 L24 82 Q50 74 76 82 L82 100 Z" fill="#3B4753" />
          <circle cx="50" cy="52" r="26" fill={C.skin} />
          <path d="M30 42 L44 48" stroke="#2A1D14" strokeWidth="4.6" strokeLinecap="round" />
          <path d="M70 42 L56 48" stroke="#2A1D14" strokeWidth="4.6" strokeLinecap="round" />
          <circle cx="39" cy="55" r="3.4" fill="#2A1D14" />
          <circle cx="61" cy="55" r="3.4" fill="#2A1D14" />
          <ellipse cx="50" cy="68" rx="11" ry="8" fill="#5A2A26" />
          <path d="M41 66 Q50 62 59 66" stroke="#F0F0F0" strokeWidth="2.6" fill="none" />
          <path d="M22 40 A28 28 0 0 1 78 40 Z" fill={C.yel} />
          <rect x="16" y="38" width="68" height="7" rx="3.5" fill="#E0C200" />
          <g stroke={C.red} strokeWidth="3" strokeLinecap="round">
            <path d="M76 14 L92 14" /><path d="M78 22 L94 22" />
            <path d="M82 10 L78 26" /><path d="M90 10 L86 26" />
          </g>
        </svg>
      </div>
      <div style={{
        flex: 1, background: "#2A1512", border: `1.5px solid ${C.red}`, borderRadius: 12,
        padding: "10px 12px", fontSize: 12.5, lineHeight: 1.8, color: "#F4B5AE", fontFamily: F,
      }}>{text}</div>
    </div>
  );
}

/* 水平器 */
function Level({ x, y, ang = 0, off = 0, w = 76 }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${ang})`}>
      <rect x={-w / 2} y="-9" width={w} height="18" rx="4" fill="#1A2027" stroke={C.steelLt} strokeWidth="1.6" />
      <rect x="-17" y="-6" width="34" height="12" rx="6" fill="#0E1419" stroke={C.steelDk} />
      <line x1="-6" y1="-6" x2="-6" y2="6" stroke={C.dim2} strokeWidth="1.2" />
      <line x1="6" y1="-6" x2="6" y2="6" stroke={C.dim2} strokeWidth="1.2" />
      <circle cx={off} cy="0" r="4.6" fill={Math.abs(off) < 1.5 ? C.grn : C.yel} />
    </g>
  );
}

const SPOTS = [
  { k: "end", nm: "手摺の端", x: 116, y: 214 },
  { k: "in", nm: "端から少し中", x: 152, y: 214, ok: true },
  { k: "mid", nm: "手摺の中ほど", x: 200, y: 214 },
];

export default function App() {
  const [st, setSt] = useState("q");      // q=選ぶ / bad=誤り / demo=結果 / ok=正解
  const [pick, setPick] = useState(null);

  const tap = (k) => {
    setPick(k);
    setSt(k === "in" ? "ok" : "bad");
  };
  const reset = () => { setPick(null); setSt("q"); };

  const scold = pick === "end"
    ? "そこは手摺の端だ。差し込みの都合で凹んでいる。面が出ていないから、気泡が真ん中に来ても水平は出ていないぞ。"
    : "遠すぎる。ジャッキを回しながら気泡が見えないだろう。回しては見に行き、を繰り返す気か。";

  return (
    <div style={{
      background: C.bg, color: C.txt, fontFamily: F, height: "100dvh",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ height: 4, background: `repeating-linear-gradient(45deg,${C.yel} 0 10px,#14171B 10px 20px)` }} />
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.yel }}>水平を見る</span>
        <span style={{ fontSize: 11, color: C.dim }}>
          {st === "q" ? "水平器をどこに当てる？" : st === "ok" ? "正解" : st === "bad" ? "そこじゃない" : "このまま進むとどうなるか"}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {st === "demo" ? (
          /* ── 4面が回ってきたときの結果 ── */
          <svg viewBox="0 0 340 300" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
            <rect width="340" height="300" fill="#0C1015" />
            <text x="16" y="26" fontSize="11" fill={C.dim} fontFamily={F}>4面を一周して戻ってきたところ（展開図）</text>

            {/* 一周分の根がらみ。少しずつ上がっていく */}
            {[0, 1, 2, 3].map((i) => {
              const x = 26 + i * 74, y = 210 - i * 9;
              return (
                <g key={i}>
                  <line x1={x} y1={y} x2={x + 74} y2={y - 9} stroke={C.yel} strokeWidth="5" strokeLinecap="round" />
                  <line x1={x} y1={y} x2={x} y2={y - 66} stroke={C.steel} strokeWidth="7" />
                  <text x={x} y="248" textAnchor="middle" fontSize="10" fill={C.dim2} fontFamily={F}>
                    {["南面", "東面", "北面", "西面"][i]}
                  </text>
                </g>
              );
            })}
            <line x1="322" y1="174" x2="322" y2="108" stroke={C.steel} strokeWidth="7" />

            {/* 戻ってきた高さと、最初の高さの差 */}
            <line x1="16" y1="210" x2="322" y2="210" stroke={C.dim2} strokeWidth="1" strokeDasharray="4 4" />
            <line x1="300" y1="174" x2="330" y2="174" stroke={C.red} strokeWidth="2" />
            <line x1="300" y1="210" x2="330" y2="210" stroke={C.red} strokeWidth="2" />
            <line x1="315" y1="174" x2="315" y2="210" stroke={C.red} strokeWidth="2.4" />
            <text x="308" y="164" textAnchor="middle" fontSize="11" fill={C.red} fontFamily={F} fontWeight="800">合わない</text>

            <text x="16" y="278" fontSize="11.5" fill={C.dim} fontFamily={F}>
              1本あたりの狂いは小さくても、一周ぶん積み上がる。
            </text>
          </svg>
        ) : (
          /* ── 支柱と根がらみ手摺 ── */
          <svg viewBox="0 0 340 300" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
            <rect width="340" height="300" fill="#0C1015" />
            <rect y="262" width="340" height="38" fill="#1A2027" />

            {/* 実際はわずかに傾いている（誤りを選んだときだけ見せる） */}
            <g transform={st === "bad" || st === "demo" ? "rotate(-1.6 96 262)" : ""}>
              <line x1="96" y1="262" x2="96" y2="96" stroke={C.steel} strokeWidth="11" />
              {[214, 178, 142].map((y) => (
                <polygon key={y} points={`88,${y} 96,${y - 5} 104,${y} 96,${y + 5}`} fill={C.steelLt} />
              ))}
              <rect x="80" y="256" width="32" height="10" rx="2" fill={C.steelDk} />
            </g>
            <line x1="250" y1="262" x2="250" y2="96" stroke={C.steel} strokeWidth="11" />
            {[214, 178, 142].map((y) => (
              <polygon key={y} points={`242,${y} 250,${y - 5} 258,${y} 250,${y + 5}`} fill={C.steelLt} />
            ))}
            <rect x="234" y="256" width="32" height="10" rx="2" fill={C.steelDk} />

            {/* 根がらみ手摺（端は差し込みで凹んでいる） */}
            <line x1="104" y1="214" x2="242" y2="214" stroke={C.yel} strokeWidth="8" strokeLinecap="butt" />
            <rect x="104" y="210" width="26" height="4" fill="#B49A00" />
            <rect x="216" y="210" width="26" height="4" fill="#B49A00" />
            <polygon points="104,206 114,214 104,222" fill={C.yel} />
            <polygon points="242,206 232,214 242,222" fill={C.yel} />

            {/* 置いた水平器 */}
            {pick && <Level x={SPOTS.find((sp) => sp.k === pick).x} y="203" off={0} w={pick === "end" ? 56 : 76} />}

            {/* 傾きの実際 */}
            {st === "bad" && pick === "end" && (
              <g>
                <line x1="60" y1="96" x2="60" y2="262" stroke={C.red} strokeWidth="1.4" strokeDasharray="5 5" />
                <line x1="60" y1="96" x2="91" y2="96" stroke={C.red} strokeWidth="1.4" strokeDasharray="4 4" />
                <text x="48" y="90" textAnchor="middle" fontSize="10.5" fill={C.red} fontFamily={F}>実際は傾いている</text>
                <text x="116" y="240" textAnchor="middle" fontSize="10" fill={C.red} fontFamily={F}>凹んでいて面が出ない</text>
              </g>
            )}
            {st === "bad" && pick === "mid" && (
              <g>
                <line x1="100" y1="248" x2="196" y2="248" stroke={C.red} strokeWidth="2" strokeDasharray="6 4" />
                <polygon points="100,248 108,244 108,252" fill={C.red} />
                <polygon points="196,248 188,244 188,252" fill={C.red} />
                <text x="148" y="264" textAnchor="middle" fontSize="10.5" fill={C.red} fontFamily={F}>ジャッキから遠い</text>
              </g>
            )}

            {st === "ok" && (
              <g>
                <circle cx="96" cy="252" r="9" fill={C.skin} />
                <path d="M96 252 q 16 -10 30 -34" stroke={C.skin} strokeWidth="7" fill="none" strokeLinecap="round" />
                <text x="150" y="272" textAnchor="middle" fontSize="10.5" fill={C.grn} fontFamily={F}>見ながら回せる</text>
              </g>
            )}

            {/* 候補 */}
            {st === "q" && SPOTS.map((sp) => (
              <g key={sp.k} onClick={() => tap(sp.k)} style={{ cursor: "pointer" }} className="tgt">
                <circle cx={sp.x} cy={sp.y} r="22" fill={C.yel} opacity=".1" />
                <circle cx={sp.x} cy={sp.y} r="22" fill="none" stroke={C.yel} strokeWidth="1.5" strokeDasharray="5 5" />
                <text x={sp.x} y={sp.y + 40} textAnchor="middle" fontSize="10.5" fill={C.dim} fontFamily={F}>{sp.nm}</text>
              </g>
            ))}
          </svg>
        )}
      </div>

      <div style={{ padding: "10px 16px 18px", flex: "0 0 auto", maxHeight: "48vh", overflowY: "auto" }}>
        {st === "q" && (
          <>
            <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 8 }}>水平器をどこに当てる？</div>
            <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.85 }}>
              ここで取った水平が、この先の全部の基準になる。ジャッキを回しながら見られる場所に置け。
            </div>
          </>
        )}

        {st === "bad" && (
          <>
            <Oyakata text={scold} />
            <Btn onClick={() => setSt("demo")} style={{ marginBottom: 8 }}>このまま進むとどうなる？</Btn>
            <Btn tone="y" onClick={reset}>やり直す</Btn>
          </>
        )}

        {st === "demo" && (
          <>
            <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 8 }}>4面が繋がらない</div>
            <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.85, marginBottom: 12 }}>
              柱1本の狂いは、目では分からないほど小さい。それでも一周すれば積み上がって、最後の根がらみが入らなくなる。
              水平器は、手摺の端から少し中に置く。
            </div>
            <Btn tone="y" onClick={reset}>やり直す</Btn>
          </>
        )}

        {st === "ok" && (
          <>
            <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 8, color: C.grn }}>それでいい</div>
            <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.85, marginBottom: 12 }}>
              端から少し中に入ったところ。ここなら面が出ているし、ジャッキに手が届く。
              回しながら気泡を見ていられるから、行ったり来たりせずに水平が決まる。
            </div>
            <Btn tone="y" onClick={reset}>もう一度</Btn>
          </>
        )}
      </div>

      <style>{`
        html, body, #root { background: ${C.bg}; margin: 0; }
        .tgt { animation: pulse 1.9s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .5 } }
        @keyframes shk { 0%,100% { transform: translateX(0) rotate(0) } 25% { transform: translateX(-3px) rotate(-2deg) } 75% { transform: translateX(3px) rotate(2deg) } }
      `}</style>
    </div>
  );
}
