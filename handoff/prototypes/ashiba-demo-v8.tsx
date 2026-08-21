import React, { useState } from "react";

/* ═══════════════════════════════════════════
   実務トレーニングの前に見せる「通し見学」
   資材カタログ → 資材配置 → 組立完了 まで、
   タップで1手ずつ進む。操作はしない、見るだけ。
   ═══════════════════════════════════════════ */

const C = {
  bg: "#14171B", panel: "#1E232A", panel2: "#252C34", line: "#2E3640",
  steel: "#93A0AD", steelLt: "#CBD6DF", steelDk: "#5F6B78",
  yel: "#F5D400", red: "#E23B2E", grn: "#25B36B", cyan: "#4FC3D9", org: "#D98B2B",
  navy: "#2F4A6B", skin: "#E2B48C", txt: "#E9EEF3", dim: "#8D98A4", dim2: "#5F6B78",
};
const F = `"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif`;
const MO = `ui-monospace,"SFMono-Regular",Menlo,monospace`;

/* ── 平面の割り付け（出隅／南面3スパン・東面2スパン） ── */
const SP = 66;
const CO = { x: 250, y: 214 };                       // 出隅
const POSTS = [
  { k: "S3", nm: "南端", x: CO.x - SP * 3, y: CO.y, f: "S" },
  { k: "S2", nm: "南②", x: CO.x - SP * 2, y: CO.y, f: "S" },
  { k: "S1", nm: "南①", x: CO.x - SP, y: CO.y, f: "S" },
  { k: "CO", nm: "出隅", x: CO.x, y: CO.y, f: "C" },
  { k: "E1", nm: "東①", x: CO.x, y: CO.y - SP, f: "E" },
  { k: "E2", nm: "東端", x: CO.x, y: CO.y - SP * 2, f: "E" },
];
const P = (k) => POSTS.find((p) => p.k === k);
const SPANS = [["S3", "S2"], ["S2", "S1"], ["S1", "CO"], ["CO", "E1"], ["E1", "E2"]];
const INNER = ["S3", "S1", "E2"];                    // 端部＋中間の内柱
/* 内柱は建物側へ600 */
const inPos = (k) => {
  const p = P(k);
  return p.f === "E" ? { x: p.x - 30, y: p.y } : { x: p.x, y: p.y - 30 };
};

/* ── 親方（説明のとき） ── */
function Boss({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
      <rect x="38" y="70" width="24" height="14" fill={C.skin} />
      <path d="M18 100 L24 82 Q50 74 76 82 L82 100 Z" fill="#3B4753" />
      <circle cx="50" cy="52" r="26" fill={C.skin} />
      <path d="M32 44 L45 44" stroke="#2A1D14" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M68 44 L55 44" stroke="#2A1D14" strokeWidth="4.2" strokeLinecap="round" />
      <circle cx="39" cy="55" r="3.4" fill="#2A1D14" />
      <circle cx="61" cy="55" r="3.4" fill="#2A1D14" />
      <path d="M42 68 Q50 72 58 68" stroke="#2A1D14" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M22 40 A28 28 0 0 1 78 40 Z" fill={C.yel} />
      <rect x="16" y="38" width="68" height="7" rx="3.5" fill="#E0C200" />
    </svg>
  );
}

/* ── 台本 ───────────────────────────────
   show: この手で見えるようになるもの
   ─────────────────────────────────────── */
const STEPS = [
  { t: "割り付けどおりに根がらみ手摺を並べる", d: "手摺が無いと、どこにジャッキを置くのか決まらない。だから最初はこれ。", show: { ledger: 5 }, spot: { spans: SPANS.map(([a, b]) => `${a}-${b}`) } , why: "図面で割り付けた通りに手摺を並べる。" },
  { t: "内柱の箇所に手摺を置く", d: "端部は必ず内柱。中間は2スパンに1本。内側へ手摺を出して、内柱の位置を決めておく。", show: { inner6: 3 }, spot: { inner: INNER } , why: "端部を必ず内柱にするのは、端部に内柱が無いと足場が安定しないから。" },
  { t: "ジャッキを配る（内柱の分も）", d: "並べた手摺が位置の目印になる。外柱だけでなく、内柱が立つところにも配る。", show: { jack: 6, jackIn: 3 }, spot: { posts: POSTS.map((p) => p.k), inner: INNER } , why: "配ってから立てれば、柱を担いだまま探し回らずに済む。内柱のジャッキを忘れると、内柱だけ後から地面に直置きになるぞ。" },
  { t: "基準のジャッキの高さを合わせる", d: "出隅が基準。足場の高さを計算して出した高さへ、ハンドルを合わせる。", spot: { posts: ["CO"] }, art: "jack" , why: "1本目が現場全体の基準になる。ここが狂えば全部が狂う。計算した高さに合わせておけば、あとの水平調整が最小で済む。" },
  { t: "基準の支柱を挿す", d: "高さを合わせたジャッキへ挿す。この1本が現場全部の基準になる。", show: { post: ["CO"] }, spot: { posts: ["CO"] } , why: "出隅は2つの面が交わる場所だ。ここを基準にすれば、南面と東面の割り付けが同時に決まる。" },
  { t: "根がらみ手摺を付ける", d: "立っている柱のコマへ先に入れる。柱 → 手摺 → 次の柱、の順。", show: { ledgerFix: ["S1-CO", "CO-E1"] }, spot: { spans: ["S1-CO", "CO-E1"] } , why: "柱を2本立ててからでは効率が悪い。実際の現場では基準支柱は持ってて貰おう。名前は根がらみ手摺と呼んでるが、使う資材は手摺資材だ。" },
  { t: "次の支柱を挿す", d: "手摺を入れてから隣を立てる。ここもジャッキの高さを合わせてから挿す。", show: { post: ["S1", "E1"] }, spot: { posts: ["S1", "E1"] } , why: "手摺で繋いでから隣を立てれば、柱が倒れず、間隔もスパンどおりに決まる。" },
  { t: "離れを測る", d: "建物からの離れ。ここがずれると、上まで全部ずれる。", show: { hanare: ["S1"] }, spot: { posts: ["S1"] }, art: "hanare" , why: "離れが狂うと、壁つなぎもブラケットも合わなくなる。1段目の10mmが、上では手が付けられん狂いになる。" },
  { t: "水平を見る", d: "水平器は根がらみ手摺の端から少し中。ジャッキを回しながら気泡が見える位置に置く。", show: { level: ["S1-CO"] }, spot: { spans: ["S1-CO"] }, art: "level" , why: "ここで取った水平が、上まで全部の基準になる。端の凹みでは面が出ないし、遠すぎるとジャッキを回しながら気泡が見えない。" },
  { t: "ブラケットを掛ける", d: "外柱側。踏板を受ける腕木になる。", show: { brk: ["S1"] }, spot: { posts: ["S1"] }, art: "brk" , why: "ここに踏板を付ける。" },
  { t: "内柱を立てる", d: "内柱の箇所は、外柱の離れと水平を決めてから立てる。", show: { postIn: ["S1"] }, spot: { inner: ["S1"] } , why: "外柱の離れと水平が決まってから立てる。基準が動いているうちに立てても、結局やり直しだ。" },
  { t: "踏板高さの手摺でつなぐ", d: "内柱と外柱を、踏板が載る高さで結ぶ。", show: { rail6: ["S1"] }, spot: { inner: ["S1"] }, art: "inner" , why: "踏板を受けるためだけじゃない。この手摺を付けてはじめて、内柱の垂直を支柱で見られるようになる。" },
  { t: "内柱の水平を見る", d: "こちらは支柱に水平器を当てて、垂直と高さを合わせる。", show: { levelIn: ["S1"] }, spot: { inner: ["S1"] }, art: "levelIn" , why: "支柱に当てないと本当の垂直は分からない。" },
  { t: "同じことを面ごとに繰り返す", d: "離れ → 水平 → ブラケット → 内柱。1スパンずつ進めていく。", show: { all: true }, spot: { posts: ["S2", "S3", "E2"] } , why: "1スパンずつ確定させて進む。まとめて立ててから直そうとすると、狂いが全部に回って手が付けられなくなる。" },
  { t: "踏板を敷いて一周", d: "根がらみが一周して繋がる。ここまでが第1章。", show: { deck: true }, spot: { spans: SPANS.map(([a, b]) => `${a}-${b}`) }, art: "deck" , why: "根がらみが一周して繋がると、面がひとつの箱になって動かなくなる。ここまでが土台だ。" },
];

/* ── 平面だけでは分かりにくい作業の拡大図（立面） ── */
function Art({ kind }) {
  const G = 168;                                     // 地面
  const pole = (x, top = 40) => <rect x={x - 6} y={top} width="12" height={G - top} fill={C.steel} />;
  const wall = <><rect x="0" y="24" width="58" height={G - 24} fill="#242B33" /><text x="29" y="100" textAnchor="middle" fontSize="11" fill="#4A545E" fontFamily={F}>建物</text></>;
  const ground = <><rect y={G} width="340" height="34" fill="#1A2027" /><line x1="0" y1={G} x2="340" y2={G} stroke="#39434D" strokeWidth="2" /></>;

  if (kind === "jack") return (
    <>
      {ground}
      <rect x="128" y={G - 4} width="72" height="11" rx="2" fill="#CBD6DF" />
      <rect x="157" y={G - 130} width="14" height="130" fill="#93A0AD" />
      {Array.from({ length: 14 }, (_, i) => <line key={i} x1="155" y1={G - 10 - i * 8.6} x2="173" y2={G - 10 - i * 8.6} stroke="#5F6B78" strokeWidth="2" />)}
      <line x1="70" y1={G - 78} x2="290" y2={G - 78} stroke={C.yel} strokeWidth="1.6" strokeDasharray="6 5" />
      <text x="290" y={G - 84} textAnchor="end" fontSize="10.5" fill={C.yel} fontFamily={F}>計算で出した高さ</text>
      <rect x="140" y={G - 84} width="48" height="13" rx="3" fill={C.grn} />
      <text x="196" y={G - 74} fontSize="10.5" fill={C.grn} fontFamily={F}>ハンドルを合わせる</text>
    </>
  );
  if (kind === "hanare") return (
    <>
      {ground}{wall}
      {pole(190)}
      <line x1="58" y1={G - 40} x2="184" y2={G - 40} stroke={C.org} strokeWidth="2" />
      <line x1="58" y1={G - 46} x2="58" y2={G - 34} stroke={C.org} strokeWidth="2" />
      <line x1="184" y1={G - 46} x2="184" y2={G - 34} stroke={C.org} strokeWidth="2" />
      <text x="121" y={G - 48} textAnchor="middle" fontSize="11" fill={C.org} fontFamily={MO}>離れ</text>
      <text x="190" y={G + 22} textAnchor="middle" fontSize="10" fill={C.dim} fontFamily={F}>外柱</text>
    </>
  );
  if (kind === "brk") return (
    <>
      {ground}{wall}
      {pole(210)}
      <line x1="210" y1={G - 92} x2="140" y2={G - 92} stroke={C.steelLt} strokeWidth="6" strokeLinecap="round" />
      <line x1="210" y1={G - 44} x2="146" y2={G - 88} stroke={C.steelLt} strokeWidth="4" />
      <text x="150" y={G - 100} fontSize="10.5" fill={C.txt} fontFamily={F}>ブラケット</text>
      <text x="150" y={G - 112} fontSize="9.5" fill={C.dim2} fontFamily={F}>ここに踏板が載る</text>
      <text x="210" y={G + 22} textAnchor="middle" fontSize="10" fill={C.dim} fontFamily={F}>外柱</text>
    </>
  );
  if (kind === "level") return (
    <>
      {ground}
      {pole(96)}{pole(258)}
      <line x1="96" y1={G - 34} x2="258" y2={G - 34} stroke={C.yel} strokeWidth="7" strokeLinecap="round" />
      <rect x="112" y={G - 50} width="70" height="15" rx="4" fill="#3A444E" stroke={C.steelLt} />
      <circle cx="147" cy={G - 42} r="4.6" fill={C.grn} />
      <text x="147" y={G - 58} textAnchor="middle" fontSize="10.5" fill={C.txt} fontFamily={F}>端から少し中に置く</text>
      <text x="96" y={G + 22} textAnchor="middle" fontSize="10" fill={C.dim2} fontFamily={F}>ここが端</text>
    </>
  );
  if (kind === "inner") return (
    <>
      {ground}{wall}
      {pole(240)}{pole(120, 96)}
      <line x1="120" y1={G - 72} x2="240" y2={G - 72} stroke={C.cyan} strokeWidth="6" strokeLinecap="round" />
      <text x="180" y={G - 80} textAnchor="middle" fontSize="10.5" fill={C.cyan} fontFamily={F}>踏板高さの600手摺</text>
      <text x="120" y={G + 22} textAnchor="middle" fontSize="10" fill={C.dim} fontFamily={F}>内柱</text>
      <text x="240" y={G + 22} textAnchor="middle" fontSize="10" fill={C.dim} fontFamily={F}>外柱</text>
    </>
  );
  if (kind === "levelIn") return (
    <>
      {ground}{wall}
      {pole(240)}{pole(120, 96)}
      <line x1="120" y1={G - 72} x2="240" y2={G - 72} stroke={C.cyan} strokeWidth="6" strokeLinecap="round" />
      <rect x="104" y={G - 130} width="15" height="60" rx="4" fill="#3A444E" stroke={C.steelLt} />
      <circle cx="111" cy={G - 100} r="4.6" fill={C.grn} />
      <text x="90" y={G - 136} fontSize="10.5" fill={C.txt} fontFamily={F}>内柱は支柱に当てる</text>
    </>
  );
  if (kind === "deck") return (
    <>
      {ground}{wall}
      {pole(240)}{pole(120, 96)}
      <rect x="112" y={G - 84} width="136" height="12" rx="2" fill="#7B8895" stroke={C.steelDk} />
      <text x="180" y={G - 92} textAnchor="middle" fontSize="10.5" fill={C.txt} fontFamily={F}>踏板</text>
    </>
  );
  return null;
}

export default function App() {
  const [view, setView] = useState("intro");   // intro / walk / end
  const [i, setI] = useState(0);

  /* いまの手までに見えているもの */
  const upto = (n) => STEPS.slice(0, n + 1).reduce((a, s) => {
    for (const [k, v] of Object.entries(s.show || {})) {
      if (Array.isArray(v)) a[k] = [...(a[k] || []), ...v];
      else a[k] = v;
    }
    return a;
  }, {});
  const sh = upto(i);
  const st = STEPS[i];
  const done = sh.all || sh.deck;

  const next = () => { if (i < STEPS.length - 1) setI(i + 1); else setView("end"); };

  const Post = ({ p, on }) => (
    <circle cx={p.x} cy={p.y} r={on ? 7 : 4} fill={on ? C.steelLt : "#39434D"} />
  );

  return (
    <div style={{
      background: C.bg, color: C.txt, fontFamily: F, height: "100dvh",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ height: 4, background: `repeating-linear-gradient(45deg,${C.yel} 0 10px,#14171B 10px 20px)`, flex: "0 0 auto" }} />

      {view === "intro" && (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 18px 28px" }}>
          <div style={{ fontSize: 11, color: C.yel, fontWeight: 800, letterSpacing: 2 }}>第1章のまえに</div>
          <div style={{ fontSize: 23, fontWeight: 900, lineHeight: 1.4, marginTop: 8 }}>
            まず、通しで<br />見てもらう。
          </div>
          <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.95, margin: "12px 0 18px" }}>
            資材を置くところから、根がらみが一周するまで。<br />
            操作はしません。タップで1手ずつ進みます。<br />
            全体の順番が頭に入ってから、チュートリアルへ進みます。
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 15px", marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: C.yel, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>この現場で使う資材</div>
            <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 2 }}>
              ジャッキ　／　支柱　／　内柱<br />
              根がらみ手摺　／　踏板高さの600手摺<br />
              ブラケット　／　踏板<br />
              <span style={{ color: C.dim2, fontSize: 11.5 }}>
                根がらみ手摺・落下防止手摺・上さん・中さんは同じ資材。使う場所で呼び名が変わるだけ。
              </span>
            </div>
          </div>

          <button onClick={() => setView("walk")} style={{
            width: "100%", background: C.yel, color: "#14171B", border: "none", borderRadius: 9,
            padding: 14, fontSize: 14, fontWeight: 900, fontFamily: F, cursor: "pointer",
          }}>通しで見る（15手）</button>
          <div style={{ fontSize: 11, color: C.dim2, textAlign: "center", marginTop: 10 }}>
            資材の詳しい説明は、資材カタログでいつでも見られます
          </div>
        </div>
      )}

      {view === "walk" && (
        <>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "baseline", gap: 8, flex: "0 0 auto" }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: C.yel }}>組立の通し</span>
            <span style={{ fontSize: 11, color: C.dim, fontFamily: MO }}>{i + 1} / {STEPS.length}</span>
            <button onClick={() => setView("end")} style={{
              marginLeft: "auto", background: "none", border: `1px solid ${C.line}`, color: C.dim,
              borderRadius: 7, padding: "5px 10px", fontSize: 11, fontFamily: F, cursor: "pointer",
            }}>とばす</button>
          </div>

          <div onClick={next} style={{ flex: 1, minHeight: 0, cursor: "pointer", position: "relative" }}>
            {st.art && (
              <svg viewBox="0 0 340 210" preserveAspectRatio="xMidYMid meet" style={{
                width: "100%", height: "42%", display: "block", borderBottom: `1px solid ${C.line}`,
              }}>
                <rect width="340" height="210" fill="#0C1015" />
                <text x="14" y="18" fontSize="10.5" fill={C.dim2} fontFamily={F}>近くで見ると</text>
                <Art kind={st.art} />
              </svg>
            )}
            <svg viewBox="0 0 340 260" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: st.art ? "58%" : "100%", display: "block" }}>
              <rect width="340" height="260" fill="#0C1015" />
              <text x="14" y="20" fontSize="10.5" fill={C.dim2} fontFamily={F}>平面図（上から見たところ）</text>

              {/* いまの作業箇所 */}
              {(st.spot?.spans || []).map((id) => {
                const [a, b] = id.split("-"), p = P(a), q = P(b);
                return <line key={id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={C.yel} strokeWidth="18"
                  strokeLinecap="round" opacity=".16" className="spot" />;
              })}
              {(st.spot?.posts || []).map((k) => {
                const p = P(k);
                return <circle key={k} cx={p.x} cy={p.y} r="19" fill={C.yel} opacity=".16" className="spot" />;
              })}
              {(st.spot?.inner || []).map((k) => {
                const q = inPos(k), p = P(k);
                return <g key={k} className="spot">
                  <circle cx={q.x} cy={q.y} r="17" fill={C.yel} opacity=".16" />
                  <circle cx={p.x} cy={p.y} r="15" fill={C.yel} opacity=".12" />
                </g>;
              })}

              {/* 建物 */}
              <rect x="60" y="66" width="178" height="134" fill="#242B33" stroke="#2E3640" />
              <text x="149" y="136" textAnchor="middle" fontSize="12" fill="#4A545E" fontFamily={F}>建物</text>

              {/* 踏板 */}
              {sh.deck && SPANS.map(([a, b], n) => {
                const p = P(a), q = P(b);
                const v = p.f === "E" || q.f === "E";
                return <rect key={n} x={Math.min(p.x, q.x) - (v ? 9 : 0)} y={Math.min(p.y, q.y) - (v ? 0 : 9)}
                  width={v ? 18 : Math.abs(q.x - p.x)} height={v ? Math.abs(q.y - p.y) : 18} fill="#4A5A63" opacity=".8" />;
              })}

              {/* 根がらみ手摺 */}
              {SPANS.map(([a, b], n) => {
                const p = P(a), q = P(b);
                const laid = sh.ledger > n || (sh.ledgerFix || []).includes(`${a}-${b}`) || sh.all;
                if (!laid) return null;
                const fixed = (sh.ledgerFix || []).includes(`${a}-${b}`) || sh.all;
                return <line key={n} x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                  stroke={fixed ? C.yel : "#8A7A22"} strokeWidth={fixed ? 5 : 4} strokeLinecap="round"
                  strokeDasharray={fixed ? "" : "8 5"} />;
              })}

              {/* ジャッキ */}
              {sh.jack && POSTS.map((p, n) => (
                <rect key={p.k} x={p.x - 6} y={p.y - 6} width="12" height="12" rx="2" fill="#5F6B78" />
              ))}
              {sh.jackIn && INNER.map((k) => {
                const q = inPos(k);
                return <rect key={k} x={q.x - 5} y={q.y - 5} width="10" height="10" rx="2" fill="#5F6B78" />;
              })}

              {/* 内柱の600手摺 */}
              {sh.inner6 && INNER.map((k) => {
                const p = P(k), q = inPos(k);
                return <line key={k} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={C.cyan} strokeWidth="3.4" strokeLinecap="round" />;
              })}

              {/* 支柱 */}
              {POSTS.map((p) => <Post key={p.k} p={p} on={sh.all || (sh.post || []).includes(p.k)} />)}
              {/* 内柱 */}
              {INNER.map((k) => {
                const q = inPos(k), on = sh.all || (sh.postIn || []).includes(k);
                return <circle key={k} cx={q.x} cy={q.y} r={on ? 5.5 : 3} fill={on ? C.cyan : "#39434D"} />;
              })}

              {/* ブラケット */}
              {(sh.all ? ["S2", "CO", "E1"] : sh.brk || []).map((k) => {
                const p = P(k);
                const d = p.f === "E" ? [-14, 0] : [0, -14];
                return <line key={k} x1={p.x} y1={p.y} x2={p.x + d[0]} y2={p.y + d[1]} stroke={C.steelLt} strokeWidth="4" strokeLinecap="round" />;
              })}

              {/* 踏板高さの600手摺 */}
              {(sh.all ? INNER : sh.rail6 || []).map((k) => {
                const p = P(k), q = inPos(k);
                return <line key={k} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={C.cyan} strokeWidth="5" strokeLinecap="round" />;
              })}

              {/* 離れ */}
              {(sh.hanare || []).map((k) => {
                const p = P(k);
                return (
                  <g key={k}>
                    <line x1={p.x} y1={p.y} x2={p.x} y2={p.y - 14} stroke={C.org} strokeWidth="2" strokeDasharray="3 3" />
                    <text x={p.x + 6} y={p.y - 18} fontSize="10" fill={C.org} fontFamily={MO}>離れ</text>
                  </g>
                );
              })}

              {/* 水平 */}
              {(st.show?.level || []).map((id) => {
                const [a, b] = id.split("-"), p = P(a), q = P(b);
                const mx = (p.x + q.x) / 2 - 12, my = (p.y + q.y) / 2;
                return (
                  <g key={id}>
                    <rect x={mx - 16} y={my - 20} width="40" height="12" rx="3" fill="#3A444E" stroke={C.steelLt} />
                    <circle cx={mx + 4} cy={my - 14} r="3.4" fill={C.grn} />
                  </g>
                );
              })}
              {(st.show?.levelIn || []).map((k) => {
                const q = inPos(k);
                return <circle key={k} cx={q.x} cy={q.y} r="11" fill="none" stroke={C.grn} strokeWidth="1.6" strokeDasharray="3 3" />;
              })}

              {/* 名前 */}
              {POSTS.map((p) => (
                <text key={p.k} x={p.f === "E" ? p.x + 16 : p.x} y={p.f === "E" ? p.y + 4 : p.y + 22}
                  textAnchor={p.f === "E" ? "start" : "middle"} fontSize="10" fill={C.dim2} fontFamily={F}>{p.nm}</text>
              ))}
            </svg>
          </div>

          <div onClick={next} style={{ padding: "12px 16px 18px", flex: "0 0 auto", borderTop: `1px solid ${C.line}`, cursor: "pointer" }}>
            <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.5, marginBottom: 7 }}>{st.t}</div>
            <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.85, marginBottom: 10 }}>{st.d}</div>
            {st.why && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ flex: "0 0 auto", background: "#1D1B0B", border: `1px solid ${C.yel}`, borderRadius: 10, padding: 3 }}>
                  <Boss />
                </div>
                <div style={{
                  flex: 1, background: "#1D1B0B", border: `1px solid #4A430F`, borderRadius: 10,
                  padding: "9px 12px", fontSize: 12, color: "#E8E0B0", lineHeight: 1.85,
                }}>{st.why}</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={(e) => { e.stopPropagation(); setI(Math.max(0, i - 1)); }} style={{
                background: "none", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 8,
                padding: "10px 14px", fontSize: 12, fontFamily: F, cursor: "pointer",
              }}>戻る</button>
              <button onClick={next} style={{
                flex: 1, background: C.yel, color: "#14171B", border: "none", borderRadius: 8,
                padding: 12, fontSize: 13.5, fontWeight: 900, fontFamily: F, cursor: "pointer",
              }}>{i === STEPS.length - 1 ? "見終わった" : "次の手"}</button>
            </div>
          </div>
        </>
      )}

      {view === "end" && (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "22px 18px 28px" }}>
          <div style={{ fontSize: 11, color: C.yel, fontWeight: 800, letterSpacing: 2 }}>見学おわり</div>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.4, marginTop: 8 }}>
            順番は入ったか。<br />次は自分でやってみろ。
          </div>
          <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.95, margin: "12px 0 20px" }}>
            チュートリアルでは、次の作業を親方が教えます。<br />
            資材や用語は、いつでも資材カタログで確認できます。
          </div>
          <button style={{
            width: "100%", background: C.yel, color: "#14171B", border: "none", borderRadius: 9,
            padding: 14, fontSize: 14, fontWeight: 900, fontFamily: F, cursor: "pointer",
          }}>チュートリアルへ進む</button>
          <button onClick={() => { setI(0); setView("walk"); }} style={{
            width: "100%", background: "none", color: C.txt, border: `1px solid ${C.line}`, borderRadius: 9,
            padding: 13, fontSize: 13, fontFamily: F, cursor: "pointer", marginTop: 10,
          }}>もう一度見る</button>
        </div>
      )}

      <style>{`
        html, body, #root { background: ${C.bg}; margin: 0; }
        .spot { animation: sp 1.7s ease-in-out infinite; }
        @keyframes sp { 0%,100% { opacity: .18 } 50% { opacity: .42 } }
      `}</style>
    </div>
  );
}
