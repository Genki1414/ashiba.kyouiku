import React, { useState } from "react";

/* ═══════════════════════════════════════════
   足場 実務トレーニング ／ 資材と用語
   ・第1章の前の導入パート（順に見て「第1章へ」）
   ・章の中からいつでも開けるリファレンス
   ═══════════════════════════════════════════ */

const C = {
  bg: "#14171B", panel: "#1E232A", panel2: "#252C34", line: "#2E3640",
  steel: "#93A0AD", steelLt: "#CBD6DF", steelDk: "#5F6B78",
  yel: "#F5D400", red: "#E23B2E", grn: "#25B36B", cyan: "#4FC3D9", org: "#D98B2B",
  navy: "#2F4A6B", skin: "#E2B48C", txt: "#E9EEF3", dim: "#8D98A4", dim2: "#5F6B78",
};
const F = `"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif`;

const CATS = [
  { k: "base", nm: "土台" },
  { k: "post", nm: "柱" },
  { k: "rail", nm: "手摺" },
  { k: "floor", nm: "床" },
  { k: "brace", nm: "補強" },
  { k: "cover", nm: "養生" },
];

/* ── 資材 ───────────────────────────────── */
const ITEMS = [
  {
    id: "jack", cat: "base", nm: "ジャッキ", yomi: "ジャッキベース",
    use: "支柱の足元に敷き、高さを調整して水平を出す",
    where: "支柱の一番下。敷板の上に置く",
    note: "全長は変わらず、ネジ棒に沿ってハンドルだけが上下する。ハンドルの高さに支柱の後端が乗る。足場の高さを計算してジャッキの高さを出し、支柱を挿す手前でその高さ付近へハンドルを合わせる。合わせずに立てると、あとの水平調整が延々と続く。高さの計算は積算アプリで出せる",
  },
  {
    id: "koma", cat: "post", nm: "コマ", yomi: "くさび受け（ポケット）",
    use: "手摺や筋交のくさびを差し込む受け口",
    where: "支柱に450mmごとに付いている",
    note: "コマの数を数えれば高さが分かる。1コマ＝450mm、4コマ＝1,800mm＝1段",
  },
  {
    id: "pole", cat: "post", nm: "支柱", yomi: "したばしら／建地",
    use: "足場の縦の骨。荷重を地面へ伝える",
    where: "割り付けに沿って1,800mm間隔で立てる",
    note: "上へ継ぎ足して段を重ねる。継ぐときは差し込みが効いているか確かめる",
  },
  {
    id: "inner", cat: "post", nm: "内柱", yomi: "うちばしら",
    use: "建物側に立てる柱。踏板を受け、足場を建物側で支える",
    where: "割り付けで決めた箇所。端部には必ず入れる",
    note: "踏板高さで止める。水平は踏板用手摺を付けてから支柱に水平器を当てて見る",
  },
  {
    id: "negarami", cat: "rail", nm: "根がらみ手摺", yomi: "ねがらみ",
    use: "足元で柱どうしをつなぎ、足場が動かないようにする",
    where: "支柱の一番下のコマ",
    note: "次の柱を立てる前に、立っている柱のコマへ先に入れる。柱→手摺→次の柱の順",
    same: true,
  },
  {
    id: "fumiita_rail", cat: "rail", nm: "踏板用手摺", yomi: "ふみいたようてすり",
    use: "内柱と外柱をつなぎ、踏板を受ける高さに渡す",
    where: "踏板の高さ（1段＝1,800mm）",
    note: "内柱の水平を見るときは、これを付けてから支柱に水平器を当てる",
  },
  {
    id: "tesuri", cat: "rail", nm: "手摺", yomi: "うわさん・なかさん",
    use: "作業床からの墜落を防ぐ",
    where: "上さんは踏板から900mm前後、中さんはその間",
    note: "設置は荷揚げする人がいる側から。中さん→上さんの順で入れる",
    same: true,
  },
  {
    id: "senko", cat: "rail", nm: "先行手摺", yomi: "せんこうてすり",
    use: "上の段に登る前に、下から手摺を先に架けておく部材",
    where: "水平調整が終わった支柱間",
    note: "戸建では標準にしない。使う場合、出隅はどちらか片側に600スパンが必要",
  },
  {
    id: "bracket", cat: "floor", nm: "ブラケット", yomi: "ブラケット（腕木）",
    use: "支柱から張り出して踏板を受ける",
    where: "外柱側。内柱が無い箇所で使う",
    note: "取り付けは水平を調整した後。出隅は2面ぶん必要になる",
  },
  {
    id: "fumiita", cat: "floor", nm: "踏板", yomi: "ふみいた／作業床",
    use: "人が乗って作業する床",
    where: "ブラケットや踏板用手摺の上",
    note: "幅40cm以上、すき間3cm以下が基準。奥から手前へ入れていくと効率が良い",
  },
  {
    id: "kaidan", cat: "floor", nm: "昇降階段", yomi: "しょうこうかいだん",
    use: "段を上り下りするための階段",
    where: "荷揚げの邪魔にならないスパン",
    note: "登り口は手摺で塞がないこと",
  },
  {
    id: "sujikai", cat: "brace", nm: "筋交", yomi: "すじかい",
    use: "面のねじれを止める斜材",
    where: "各段に1本。下端が南端側、上端が出隅側",
    note: "上のコマに先端を入れてから、後端を下のコマへ落とす。逆はできない",
  },
  {
    id: "wall_jack", cat: "brace", nm: "壁当てジャッキ", yomi: "かべあてジャッキ",
    use: "内柱から建物へ突っ張り、足場を建物に頼らせる",
    where: "内柱の、踏板手摺のすぐ下のコマ",
    note: "低い位置に付けると踏板を歩く人の足に当たる。効いていないと乗ったときに足場が動く",
  },
  {
    id: "hiuchi", cat: "brace", nm: "火打", yomi: "ひうち",
    use: "平面がひし形に崩れるのを止める",
    where: "最上段の出隅。直交する2面の支柱へ斜めに掛ける",
    note: "足場と二等辺三角形になるように。支柱に付ける。圧縮材と併用して効く",
  },
  {
    id: "sheet", cat: "cover", nm: "メッシュシート", yomi: "シート",
    use: "塗料や粉じん、落下物の飛散を防ぐ",
    where: "足場の外面。縦張りで1スパンに1枚",
    note: "最上段から下へ垂らし、支柱へ結ぶ。緊結ピッチは450か900（戸建は900でよい）",
  },
  {
    id: "habaki", cat: "cover", nm: "巾木", yomi: "はばき",
    use: "踏板の上の物が下へ落ちるのを止める",
    where: "踏板の外側の縁",
    note: "高さ10cm以上が基準",
  },
];

/* ── 絵 ───────────────────────────────── */
function Pic({ id, big }) {
  const s = big ? 1.55 : 1;
  const P = (props) => <g transform={`scale(${s})`} {...props} />;
  const V = (kids) => (
    <svg viewBox={`0 0 ${86 * s} ${86 * s}`} width={big ? 132 : 68} height={big ? 132 : 68} style={{ display: "block" }}>
      <P>{kids}</P>
    </svg>
  );
  const post = (x) => <line x1={x} y1="8" x2={x} y2="78" stroke={C.steel} strokeWidth="7" />;
  const koma = (x, y) => <polygon points={`${x - 6},${y} ${x},${y - 4} ${x + 6},${y} ${x},${y + 4}`} fill={C.steelLt} />;

  switch (id) {
    case "jack":
      return V(<>
        <rect x="38" y="26" width="10" height="52" fill={C.steel} />
        {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1="36" y1={70 - i * 7} x2="50" y2={70 - i * 7} stroke={C.steelDk} strokeWidth="2" />)}
        <rect x="34" y="8" width="18" height="42" fill={C.steel} stroke={C.steelDk} />
        <rect x="28" y="46" width="30" height="9" rx="3" fill="#7E8A96" />
        <text x="62" y="54" fontSize="8" fill={C.dim} fontFamily={F}>ハンドル</text>
        <rect x="22" y="78" width="42" height="6" rx="1" fill={C.steelLt} />
      </>);
    case "koma":
      return V(<>
        {post(43)}
        {[22, 40, 58].map((y) => <g key={y}>{koma(43, y)}</g>)}
        <line x1="60" y1="22" x2="60" y2="40" stroke={C.yel} strokeWidth="1.4" />
        <text x="66" y="35" fontSize="9" fill={C.yel} fontFamily={F}>450</text>
      </>);
    case "pole":
      return V(<>
        {post(43)}
        {[18, 30, 42, 54, 66].map((y) => <g key={y}>{koma(43, y)}</g>)}
        <rect x="37" y="44" width="12" height="5" fill={C.steelDk} />
      </>);
    case "inner":
      return V(<>
        <rect x="4" y="8" width="16" height="70" fill="#242B33" />
        {post(30)}{post(62)}
        <line x1="30" y1="34" x2="62" y2="34" stroke={C.cyan} strokeWidth="5" />
        {koma(30, 20)}{koma(62, 20)}
        <text x="30" y="86" textAnchor="middle" fontSize="8.5" fill={C.dim} fontFamily={F}>内</text>
        <text x="62" y="86" textAnchor="middle" fontSize="8.5" fill={C.dim} fontFamily={F}>外</text>
      </>);
    case "negarami":
      return V(<>
        {post(20)}{post(66)}
        <line x1="20" y1="66" x2="66" y2="66" stroke={C.yel} strokeWidth="6" strokeLinecap="round" />
        <polygon points="20,60 28,66 20,72" fill={C.yel} /><polygon points="66,60 58,66 66,72" fill={C.yel} />
        <rect x="8" y="78" width="70" height="5" fill="#3A434E" />
      </>);
    case "fumiita_rail":
      return V(<>
        {post(20)}{post(66)}
        <line x1="20" y1="40" x2="66" y2="40" stroke={C.cyan} strokeWidth="6" strokeLinecap="round" />
        <polygon points="20,34 28,40 20,46" fill={C.cyan} /><polygon points="66,34 58,40 66,46" fill={C.cyan} />
      </>);
    case "tesuri":
      return V(<>
        {post(20)}{post(66)}
        <line x1="20" y1="26" x2="66" y2="26" stroke={C.yel} strokeWidth="6" strokeLinecap="round" />
        <line x1="20" y1="48" x2="66" y2="48" stroke={C.yel} strokeWidth="6" strokeLinecap="round" />
        <text x="74" y="29" fontSize="8" fill={C.dim} fontFamily={F}>上</text>
        <text x="74" y="51" fontSize="8" fill={C.dim} fontFamily={F}>中</text>
      </>);
    case "senko":
      return V(<>
        {post(20)}{post(66)}
        <line x1="20" y1="22" x2="66" y2="22" stroke={C.yel} strokeWidth="6" strokeLinecap="round" />
        <line x1="20" y1="22" x2="66" y2="60" stroke={C.yel} strokeWidth="3.4" />
        <line x1="66" y1="22" x2="20" y2="60" stroke={C.yel} strokeWidth="3.4" />
      </>);
    case "bracket":
      return V(<>
        {post(24)}
        <line x1="24" y1="40" x2="66" y2="40" stroke={C.steelLt} strokeWidth="6" strokeLinecap="round" />
        <line x1="24" y1="62" x2="64" y2="42" stroke={C.steelLt} strokeWidth="4" />
        <rect x="18" y="34" width="10" height="14" rx="2" fill={C.steelDk} />
      </>);
    case "fumiita":
      return V(<>
        <rect x="10" y="36" width="66" height="12" rx="2" fill="#7B8895" stroke={C.steelDk} />
        {[20, 32, 44, 56, 68].map((x) => <line key={x} x1={x} y1="36" x2={x} y2="48" stroke={C.steelDk} strokeWidth="1" />)}
        {post(14)}{post(72)}
      </>);
    case "kaidan":
      return V(<>
        {post(16)}{post(70)}
        <line x1="18" y1="74" x2="68" y2="22" stroke={C.steelLt} strokeWidth="6" strokeLinecap="round" />
        {[0, 1, 2, 3].map((i) => <line key={i} x1={26 + i * 11} y1={68 - i * 11} x2={34 + i * 11} y2={68 - i * 11} stroke={C.steelDk} strokeWidth="2.6" />)}
      </>);
    case "sujikai":
      return V(<>
        {post(18)}{post(68)}
        {koma(18, 20)}{koma(68, 66)}
        <line x1="68" y1="66" x2="18" y2="20" stroke="#B9C4CE" strokeWidth="5" strokeLinecap="round" />
        <circle cx="18" cy="20" r="4" fill="#8A96A2" /><circle cx="68" cy="66" r="4" fill="#8A96A2" />
      </>);
    case "wall_jack":
      return V(<>
        <rect x="4" y="6" width="18" height="74" fill="#242B33" />
        {post(58)}
        <line x1="58" y1="44" x2="24" y2="26" stroke={C.org} strokeWidth="5" strokeLinecap="round" />
        <line x1="20" y1="20" x2="28" y2="32" stroke="#8A96A2" strokeWidth="5" strokeLinecap="round" />
        <circle cx="58" cy="44" r="4.5" fill={C.org} />
      </>);
    case "hiuchi":
      return V(<>
        <line x1="12" y1="62" x2="74" y2="62" stroke={C.steel} strokeWidth="5" strokeLinecap="round" />
        <line x1="12" y1="62" x2="12" y2="10" stroke={C.steel} strokeWidth="5" strokeLinecap="round" />
        <line x1="42" y1="62" x2="12" y2="32" stroke={C.org} strokeWidth="4.6" strokeLinecap="round" />
        <circle cx="12" cy="62" r="4.5" fill={C.steelLt} />
        <circle cx="42" cy="62" r="4" fill={C.org} /><circle cx="12" cy="32" r="4" fill={C.org} />
      </>);
    case "sheet":
      return V(<>
        {post(16)}{post(70)}
        <rect x="20" y="12" width="46" height="64" fill="#2C6B4A" opacity=".65" />
        <path d="M20 12 L66 58 M66 12 L20 58 M20 34 L44 76 M44 12 L66 34" stroke="#5FBF8C" strokeWidth="1" opacity=".7" />
        {[22, 40, 58].map((y) => <circle key={y} cx="16" cy={y} r="3.4" fill={C.yel} />)}
      </>);
    case "habaki":
      return V(<>
        <rect x="10" y="42" width="66" height="10" rx="2" fill="#7B8895" stroke={C.steelDk} />
        <rect x="10" y="30" width="8" height="14" fill={C.org} />
        <circle cx="40" cy="26" r="5" fill={C.steelLt} />
      </>);
    default:
      return V(<circle cx="43" cy="43" r="20" fill={C.panel2} />);
  }
}

/* ── 本体 ───────────────────────────────── */
export default function Glossary({ mode = "intro", onDone, onClose }) {
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState(null);
  const [seen, setSeen] = useState([]);

  const list = cat === "all" ? ITEMS : ITEMS.filter((i) => i.cat === cat);
  const item = ITEMS.find((i) => i.id === open);
  const intro = mode === "intro";

  const tap = (i) => {
    setOpen(i.id);
    if (!seen.includes(i.id)) setSeen([...seen, i.id]);
  };

  return (
    <div style={{
      background: C.bg, color: C.txt, fontFamily: F, height: "100dvh",
      display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
    }}>
      <div style={{ height: 4, background: `repeating-linear-gradient(45deg,${C.yel} 0 10px,#14171B 10px 20px)`, flex: "0 0 auto" }} />

      <div style={{ padding: "12px 16px 8px", flex: "0 0 auto", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: C.yel, fontWeight: 800, letterSpacing: 2 }}>資材と用語</div>
            <div style={{ fontSize: 17, fontWeight: 900, marginTop: 4 }}>
              {intro ? "まず、道具の名前を覚える" : "資材図鑑"}
            </div>
          </div>
          {!intro && onClose && (
            <button onClick={onClose} style={{
              background: "none", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 7,
              padding: "6px 12px", fontSize: 12, fontFamily: F, cursor: "pointer",
            }}>閉じる</button>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.7, marginTop: 6 }}>
          {intro
            ? `名前と用途が分かっていれば、親方の指示が通る。${seen.length} / ${ITEMS.length} 見た`
            : "章の途中でも、ここから何度でも確認できる"}
        </div>
      </div>

      {/* 分類 */}
      <div style={{ display: "flex", gap: 6, padding: "8px 12px", overflowX: "auto", flex: "0 0 auto" }}>
        {[{ k: "all", nm: "すべて" }, ...CATS].map((c) => (
          <button key={c.k} onClick={() => setCat(c.k)} style={{
            background: cat === c.k ? C.yel : "none", color: cat === c.k ? "#14171B" : C.dim,
            border: `1px solid ${cat === c.k ? C.yel : C.line}`, borderRadius: 20,
            padding: "6px 13px", fontSize: 12, fontWeight: 800, fontFamily: F, cursor: "pointer", whiteSpace: "nowrap",
          }}>{c.nm}</button>
        ))}
      </div>

      {/* 一覧 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 12px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {list.map((i) => (
            <button key={i.id} onClick={() => tap(i)} style={{
              background: C.panel, border: `1px solid ${seen.includes(i.id) ? C.steelDk : C.line}`,
              borderRadius: 12, padding: "12px 10px", fontFamily: F, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative",
            }}>
              {seen.includes(i.id) && (
                <span style={{ position: "absolute", top: 8, right: 9, fontSize: 10, color: C.grn }}>✓</span>
              )}
              <Pic id={i.id} />
              <span style={{ fontSize: 13.5, fontWeight: 900, color: C.txt }}>{i.nm}</span>
              <span style={{ fontSize: 10.5, color: C.dim2, lineHeight: 1.5, textAlign: "center" }}>{i.yomi}</span>
            </button>
          ))}
        </div>
      </div>

      {intro && (
        <div style={{ padding: "10px 16px 16px", flex: "0 0 auto", borderTop: `1px solid ${C.line}` }}>
          <button onClick={onDone} style={{
            background: seen.length >= 6 ? C.yel : "none", color: seen.length >= 6 ? "#14171B" : C.dim,
            border: `1px solid ${seen.length >= 6 ? C.yel : C.line}`, borderRadius: 9, padding: 13,
            fontWeight: 800, fontSize: 13.5, fontFamily: F, cursor: "pointer", width: "100%",
          }}>第1章へ進む</button>
          <div style={{ fontSize: 11, color: C.dim2, textAlign: "center", marginTop: 8 }}>
            章の中からも、いつでもここに戻れる
          </div>
        </div>
      )}

      {/* 詳細 */}
      {item && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(8,10,13,.92)", zIndex: 20,
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
        }} onClick={() => setOpen(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: C.panel, borderTop: `2px solid ${C.yel}`, borderRadius: "16px 16px 0 0",
            padding: "18px 18px 26px", maxHeight: "82%", overflowY: "auto",
          }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ background: "#0C1015", borderRadius: 12, padding: 8, flex: "0 0 auto" }}>
                <Pic id={item.id} big />
              </div>
              <div>
                <div style={{ fontSize: 19, fontWeight: 900 }}>{item.nm}</div>
                <div style={{ fontSize: 11.5, color: C.dim, marginTop: 4 }}>{item.yomi}</div>
                <div style={{
                  display: "inline-block", marginTop: 8, fontSize: 10.5, fontWeight: 800,
                  color: C.yel, border: `1px solid ${C.line}`, borderRadius: 5, padding: "3px 8px",
                }}>{CATS.find((c) => c.k === item.cat).nm}</div>
              </div>
            </div>

            {item.same && (
              <div style={{
                marginTop: 16, background: "#1A2A22", border: `1px solid ${C.grn}`, borderRadius: 9,
                padding: "10px 12px", fontSize: 12.5, color: "#A8E6C4", lineHeight: 1.8,
              }}>
                根がらみ手摺・落下防止手摺・上さん・中さんは、<b>同じ資材</b>。<br />
                使う場所と高さで呼び名が変わるだけで、物は変わらない。
              </div>
            )}
            {[["何のため", item.use], ["どこに", item.where], ["覚えておくこと", item.note]].map(([t, v]) => (
              <div key={t} style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: C.yel, fontWeight: 800, letterSpacing: 1 }}>{t}</div>
                <div style={{ fontSize: 13, color: C.txt, lineHeight: 1.85, marginTop: 5 }}>{v}</div>
              </div>
            ))}

            <button onClick={() => setOpen(null)} style={{
              background: "none", color: C.txt, border: `1px solid ${C.line}`, borderRadius: 9,
              padding: 12, fontWeight: 800, fontSize: 13, fontFamily: F, cursor: "pointer",
              width: "100%", marginTop: 20,
            }}>閉じる</button>
          </div>
        </div>
      )}

      <style>{`html, body, #root { background: ${C.bg}; margin: 0; }`}</style>
    </div>
  );
}
