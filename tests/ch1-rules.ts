/* 第1章の判定のテスト。
   HANDOFF.md 3章「現場のルール」の1〜8を、そのまま検査項目にしてある。
   実行: npx tsx tests/ch1-rules.ts */

import {
  JACK_TARGET,
  POSTS,
  SPAN600,
  SPANS,
  post600,
  postsFor,
  span600,
  type PostId,
  type SpanId,
} from "../src/training/ch1/layout";
import { buildFace } from "../src/training/ch1/queue";
import {
  danDone,
  inStageA,
  initialState,
  isComplete,
  progress,
  type Ch1State,
} from "../src/training/ch1/state";
import { hint, judge, type Action, type Verdict } from "../src/training/ch1/rules";

let ng = 0;
let ok = 0;
const check = (cond: boolean, label: string, extra?: string) => {
  if (cond) {
    ok++;
  } else {
    ng++;
    console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`);
  }
};

/** 手を打って、良手なら状態を進める。良手でなければ落とす */
function step(s: Ch1State, a: Action, label: string): Ch1State {
  const v = judge(s, a);
  if (v.kind !== "good") {
    ng++;
    console.error(`NG  ${label} が通らない → ${v.kind}: ${v.message}`);
    return s;
  }
  ok++;
  /* 場面は連鎖する（内柱は cA → 手摺 → cB → 水平の4段）。
     続く限り順に閉じる */
  let cur = v;
  for (let i = 0; i < 8 && cur.kind === "good" && cur.scene; i++) {
    const done: Verdict = judge(cur.state, {
      type: "sceneDone",
      scene: cur.scene,
      value: cur.scene.type === "jackAdjust" ? JACK_TARGET : undefined,
    });
    if (done.kind !== "good") {
      ng++;
      console.error(`NG  ${label} の場面が閉じない → ${done.kind}: ${done.message}`);
      return cur.state;
    }
    cur = done;
  }
  return cur.kind === "good" ? cur.state : v.state;
}

/** ファールであることを確かめる */
function expectFoul(s: Ch1State, a: Action, tag: string, label: string) {
  const v = judge(s, a);
  if (v.kind !== "foul") {
    ng++;
    console.error(`NG  ${label} はファールのはず → ${v.kind}: ${v.message}`);
    return;
  }
  if (v.tag !== tag) {
    ng++;
    console.error(`NG  ${label} の分類が ${v.tag}（${tag} のはず）`);
    return;
  }
  if (!v.why) {
    ng++;
    console.error(`NG  ${label} に「なぜ駄目か」が無い`);
    return;
  }
  ok++;
}

console.log("── 段取り ──");

let s = initialState();

/* ルール1：根がらみ手摺が1本も無い状態でジャッキ・内柱手摺を置くとファール */
expectFoul(s, { type: "tapPost", tool: "jack", id: "C" }, "段取りの順序", "手摺ゼロでジャッキ");
expectFoul(s, { type: "tapInner", tool: "rail6", id: "S3" }, "段取りの順序", "手摺ゼロで内柱手摺");

/* 根がらみ手摺を5本並べる */
for (const sp of SPANS) s = step(s, { type: "tapSpan", tool: "ledger", id: sp.id }, `手摺 ${sp.id}`);

/* ルール2：内柱。端部は必ず、中間は2スパンに1本 */
expectFoul(s, { type: "tapInner", tool: "rail6", id: "C" }, "内柱の位置決め", "出隅を内柱に");
s = step(s, { type: "tapInner", tool: "rail6", id: "S3" }, "端部の内柱 S3");
s = step(s, { type: "tapInner", tool: "rail6", id: "E2" }, "端部の内柱 E2");
s = step(s, { type: "tapInner", tool: "rail6", id: "S1" }, "中間の内柱 S1");
{
  const v = judge(s, { type: "tapInner", tool: "rail6", id: "S2" });
  check(v.kind === "foul" && v.tag === "内柱の本数", "中間の内柱を2本目はファール");
}

/* ジャッキを配る（柱6本＋内柱3本） */
for (const id of Object.keys(POSTS) as PostId[]) {
  s = step(s, { type: "tapPost", tool: "jack", id }, `ジャッキ ${id}`);
}
check(!danDone(s), "内柱のジャッキが残っていれば段取りは終わっていない");
for (const id of s.inner) {
  s = step(s, { type: "tapInner", tool: "jack", id }, `内柱ジャッキ ${id}`);
}
check(danDone(s), "段取りが済んだ");

s = step(s, { type: "toTate" }, "建方へ");
check(s.phase === "tate", "建方に入った");

console.log("── 建方：共通ステージ ──");

/* ルール4：基準は出隅 → 2方向に根がらみ手摺 → 両隣の柱 */
expectFoul(s, { type: "tapPost", tool: "post", id: "S1" }, "建てる順序", "出隅より先に南①");

/* ルール3：支柱を挿す手前でジャッキ合わせの場面が出る（2回だけ） */
{
  const v = judge(s, { type: "tapPost", tool: "post", id: "C" });
  check(
    v.kind === "good" && v.scene?.type === "jackAdjust",
    "1本目の前にジャッキ合わせが出る",
  );
  if (v.kind === "good" && v.scene) {
    const bad = judge(v.state, { type: "sceneDone", scene: v.scene, value: JACK_TARGET + 40 });
    check(bad.kind === "note", "高さが合っていなければ立たない");
  }
}
s = step(s, { type: "tapPost", tool: "post", id: "C" }, "出隅を立てる");

/* 柱が立つ前のコマには手摺は入らない */
expectFoul(s, { type: "tapSpan", tool: "ledger", id: "S1-S2" }, "根がらみの順序", "立っていない柱のコマ");

s = step(s, { type: "tapSpan", tool: "ledger", id: "C-S1" }, "出隅の南側コマ");
s = step(s, { type: "tapSpan", tool: "ledger", id: "C-E1" }, "出隅の東側コマ");
s = step(s, { type: "tapPost", tool: "post", id: "S1" }, "南①を立てる");
s = step(s, { type: "tapPost", tool: "post", id: "E1" }, "東①を立てる");

/* ルール3：ジャッキ合わせは2回だけ */
check(s.jackSeen === 2, "ジャッキ合わせの場面は2回で打ち止め");
check(s.jackSeen === 2, "ジャッキ合わせは2回で打ち止め（ルール3）");

/* ルール5：柱ごとの順序は 離れ → 水平 → ブラケット で固定
   （内柱でない東①で確かめる。内柱の箇所は「ブラケットは要らん」が先に出る） */
s = { ...s, at: "E1" };
expectFoul(s, { type: "tapPost", tool: "brk", id: "E1" }, "手順の飛ばし", "離れの前にブラケット");
expectFoul(s, { type: "useLevel" }, "手順の飛ばし", "離れの前に水平");
s = step(s, { type: "useHanare" }, "東①の離れ");
expectFoul(s, { type: "tapPost", tool: "brk", id: "E1" }, "手順の飛ばし", "水平の前にブラケット");

/* ルール6：水平器の置き場所。
   プロトタイプでは場面の中で選ばせ、外しても技能点は引かず、
   その場で理由を言って選び直させる。判定側は場面を出すところまでを持つ。 */
{
  const v = judge(s, { type: "useLevel" });
  check(v.kind === "good" && v.scene?.type === "level", "水平の場面が出る");
  if (v.kind === "good" && v.scene?.type === "level") {
    check(v.scene.b === "E1", "対象は東①");
  }
}

s = step(s, { type: "useLevel" }, "東①の水平");
s = step(s, { type: "tapPost", tool: "brk", id: "E1" }, "東①のブラケット");

/* ルール7：S1 は内柱の箇所（中間の内柱に選んだ）→ ブラケットではなく内柱 */
check(s.inner.includes("S1"), "南①は内柱の箇所");
s = { ...s, at: "S1" };
expectFoul(s, { type: "tapPost", tool: "brk", id: "S1" }, "取付位置の誤り", "内柱の箇所にブラケット");
expectFoul(s, { type: "tapPost", tool: "inner", id: "S1" }, "手順の飛ばし", "離れの前に内柱");
s = step(s, { type: "useHanare" }, "南①の離れ");
s = step(s, { type: "useLevel" }, "南①の水平");
s = step(s, { type: "tapPost", tool: "inner", id: "S1" }, "南①の内柱");
check(s.stageA >= 4, "共通ステージを抜けた");

console.log("── 建方：面ごと ──");

/* ルール8：ブラケットの上に踏板。受け材が無いところに踏板は敷けない */
expectFoul(s, { type: "tapSpan", tool: "deck", id: "S1-S2" }, "手順の飛ばし", "受け材の前に踏板");

s = step(s, { type: "tapPost", tool: "brk", id: "C" }, "出隅（南面）のブラケット");
s = step(s, { type: "tapSpan", tool: "deck", id: "C-S1" }, "C-S1 に踏板");

/* 南面：S2 → S3 */
s = step(s, { type: "tapSpan", tool: "ledger", id: "S1-S2" }, "S1-S2 の手摺");
s = step(s, { type: "tapPost", tool: "post", id: "S2" }, "南②を立てる");
s = { ...s, at: "S2" };
s = step(s, { type: "useHanare" }, "南②の離れ");
s = step(s, { type: "useLevel" }, "南②の水平");
s = step(s, { type: "tapPost", tool: "brk", id: "S2" }, "南②のブラケット");
s = step(s, { type: "tapSpan", tool: "deck", id: "S1-S2" }, "S1-S2 に踏板");

s = step(s, { type: "tapSpan", tool: "ledger", id: "S2-S3" }, "S2-S3 の手摺");
s = step(s, { type: "tapPost", tool: "post", id: "S3" }, "南端を立てる");
s = { ...s, at: "S3" };
s = step(s, { type: "useHanare" }, "南端の離れ");
s = step(s, { type: "useLevel" }, "南端の水平");
/* ルール7：端部は内柱の箇所 */
s = step(s, { type: "tapPost", tool: "inner", id: "S3" }, "南端の内柱");
s = step(s, { type: "tapSpan", tool: "deck", id: "S2-S3" }, "S2-S3 に踏板");

/* 東面：出隅のブラケット → 踏板 → E2 */
s = step(s, { type: "tapPost", tool: "brk", id: "C" }, "出隅（東面）のブラケット");
s = step(s, { type: "tapSpan", tool: "deck", id: "C-E1" }, "C-E1 に踏板");
s = step(s, { type: "tapSpan", tool: "ledger", id: "E1-E2" }, "E1-E2 の手摺");
s = step(s, { type: "tapPost", tool: "post", id: "E2" }, "東端を立てる");
s = { ...s, at: "E2" };
s = step(s, { type: "useHanare" }, "東端の離れ");
s = step(s, { type: "useLevel" }, "東端の水平");
s = step(s, { type: "tapPost", tool: "inner", id: "E2" }, "東端の内柱");
s = step(s, { type: "tapSpan", tool: "deck", id: "E1-E2" }, "E1-E2 に踏板");

const pg = progress(s);
check(isComplete(s), "全工程を通せた", `進捗 ${pg.done}/${pg.total} / ヒント：${hint(s)}`);
check(pg.done === pg.total, `工程の数が合う（${pg.done}/${pg.total}）`);

/* ══════════════════════════════════════════
   手摺先行工法（先行手摺を使う段取り）
   出隅の片側を600スパンにして、床を張る前に手摺を上げる
   ══════════════════════════════════════════ */
console.log("── 手摺先行工法 ──");

{
  let k = initialState(true);
  check(k.sk && k.side === null, "先行手摺で始めると、まだ600の側が決まっていない");
  check(hint(k).includes("600スパン"), "まず600にする側を決めろと言う");

  /* 出隅のどちら側を600にするか */
  {
    const v = judge(k, { type: "pickSide", side: "S" });
    check(v.kind === "good" && v.state.side === "S", "南面側を600に決められる");
    k = v.kind === "good" ? v.state : k;
  }
  check(judge(k, { type: "pickSide", side: "E" }).kind === "note", "決めたあとは変えない");
  check(postsFor("S").S1.x === 3 - SPAN600, "南①が600スパンぶんだけ出隅寄りになる");
  check(postsFor("S").S2.x === 3 - SPAN600 - 1, "その先は1スパンずつ離れる");
  check(postsFor(null).S1.x === 2, "先行手摺を使わなければ位置は元のまま");
  check(post600("S") === "S1" && span600("S") === "C-S1", "600スパンとその先の柱");
  check(post600("E") === "E1" && span600("E") === "C-E1", "東面側を選んだときも同じ形");

  /* 出隅にブラケットは掛けない。代わりに先行手摺の工程が入る */
  const q = buildFace("S", ["S2", "S3"], true, "S");
  check(!q.some((x) => x.k === "brk" && x.t === "C"), "先行手摺のときは出隅にブラケットを掛けない");
  check(q[0].k === "sgake" && q[0].t === "C-S1", "踏板の前に先行手摺を上げる工程が入る");
  check(q[1].k === "deck", "先行手摺のあとで踏板");
  const q0 = buildFace("S", ["S2", "S3"], false, null);
  check(q0[0].k === "brk" && q0[0].t === "C", "使わなければ出隅にブラケットを掛ける");
  check(!q0.some((x) => x.k === "sgake"), "使わなければ先行手摺の工程は無い");

  /* 段取りは同じ */
  for (const sp of SPANS) k = step(k, { type: "tapSpan", tool: "ledger", id: sp.id }, `手摺 ${sp.id}`);
  /* 中間の内柱は南②。南①は600スパンの先なので、ここではブラケットの箇所にする */
  for (const id of ["S3", "E2", "S2"] as PostId[]) {
    k = step(k, { type: "tapInner", tool: "rail6", id }, `内柱 ${id}`);
  }
  for (const id of Object.keys(POSTS) as PostId[]) {
    k = step(k, { type: "tapPost", tool: "jack", id }, `ジャッキ ${id}`);
  }
  for (const id of k.inner) k = step(k, { type: "tapInner", tool: "jack", id }, `内柱ジャッキ ${id}`);
  k = step(k, { type: "toTate" }, "建方へ");

  /* 共通ステージ：出隅 → 2方向の根がらみ → 両隣の柱 */
  k = step(k, { type: "tapPost", tool: "post", id: "C" }, "出隅を立てる");
  k = step(k, { type: "tapSpan", tool: "ledger", id: "C-S1" }, "C-S1 の手摺");
  k = step(k, { type: "tapSpan", tool: "ledger", id: "C-E1" }, "C-E1 の手摺");
  k = step(k, { type: "tapPost", tool: "post", id: "S1" }, "南①を立てる");
  k = step(k, { type: "tapPost", tool: "post", id: "E1" }, "東①を立てる");

  /* 600スパンの側（南①）：離れ → 600手摺 → 水平 → ブラケット */
  k = { ...k, at: "S1" };
  expectFoul(k, { type: "tapSpan", tool: "rail6", id: "C-S1" }, "手順の飛ばし", "離れの前に600手摺");
  k = step(k, { type: "useHanare" }, "南①の離れ");
  expectFoul(k, { type: "useLevel" }, "手順の飛ばし", "600手摺の前に水平");
  expectFoul(k, { type: "tapSpan", tool: "rail6", id: "S1-S2" }, "取付位置の誤り", "600手摺を別のスパンへ");
  {
    const v = judge(k, { type: "tapSpan", tool: "rail6", id: "C-S1" });
    check(v.kind === "good" && v.scene?.type === "rail600", "600手摺で場面が開く");
  }
  k = step(k, { type: "tapSpan", tool: "rail6", id: "C-S1" }, "600スパンをつなぐ");
  check(k.placed.includes("R6S:C-S1"), "600手摺が入った");
  check(judge(k, { type: "tapSpan", tool: "rail6", id: "C-S1" }).kind === "note", "二度は入らない");
  {
    const v = judge(k, { type: "useLevel" });
    check(v.kind === "good" && v.scene?.type === "level600", "600スパンの柱は縦で水平を見る");
  }
  k = step(k, { type: "useLevel" }, "南①の水平");
  k = step(k, { type: "tapPost", tool: "brk", id: "S1" }, "南①のブラケット");

  /* 反対側（東①）は600ではないので、いつもどおり */
  k = { ...k, at: "E1" };
  k = step(k, { type: "useHanare" }, "東①の離れ");
  {
    const v = judge(k, { type: "useLevel" });
    check(v.kind === "good" && v.scene?.type === "level", "600でない側はいつもの水平");
  }
  k = step(k, { type: "useLevel" }, "東①の水平");
  k = step(k, { type: "tapPost", tool: "brk", id: "E1" }, "東①のブラケット");
  check(!inStageA(k), "共通ステージを抜けた");

  /* 面ごと：出隅のブラケットは無く、先行手摺 → 踏板 */
  expectFoul(k, { type: "tapPost", tool: "brk", id: "C" }, "手順の飛ばし", "先行手摺のときに出隅へブラケット");
  expectFoul(k, { type: "tapSpan", tool: "deck", id: "C-S1" }, "手順の飛ばし", "先行手摺より先に踏板");
  {
    const v = judge(k, { type: "tapSpan", tool: "sgake", id: "C-S1" });
    check(v.kind === "good" && v.scene?.type === "sgake", "先行手摺で場面が開く");
  }
  k = step(k, { type: "tapSpan", tool: "sgake", id: "C-S1" }, "南面の先行手摺");
  check(k.placed.includes("SG:C-S1"), "先行手摺が上がった");
  k = step(k, { type: "tapSpan", tool: "deck", id: "C-S1" }, "C-S1 に踏板");

  /* 残りの南面 */
  k = step(k, { type: "tapSpan", tool: "ledger", id: "S1-S2" }, "S1-S2 の手摺");
  k = step(k, { type: "tapPost", tool: "post", id: "S2" }, "南②を立てる");
  k = { ...k, at: "S2" };
  k = step(k, { type: "useHanare" }, "南②の離れ");
  k = step(k, { type: "useLevel" }, "南②の水平");
  k = step(k, { type: "tapPost", tool: "inner", id: "S2" }, "南②の内柱");
  k = step(k, { type: "tapSpan", tool: "deck", id: "S1-S2" }, "S1-S2 に踏板");
  k = step(k, { type: "tapSpan", tool: "ledger", id: "S2-S3" }, "S2-S3 の手摺");
  k = step(k, { type: "tapPost", tool: "post", id: "S3" }, "南端を立てる");
  k = { ...k, at: "S3" };
  k = step(k, { type: "useHanare" }, "南端の離れ");
  k = step(k, { type: "useLevel" }, "南端の水平");
  k = step(k, { type: "tapPost", tool: "inner", id: "S3" }, "南端の内柱");
  k = step(k, { type: "tapSpan", tool: "deck", id: "S2-S3" }, "S2-S3 に踏板");

  /* 東面。こちらも出隅のブラケットは無く、先行手摺から */
  k = step(k, { type: "tapSpan", tool: "sgake", id: "C-E1" }, "東面の先行手摺");
  k = step(k, { type: "tapSpan", tool: "deck", id: "C-E1" }, "C-E1 に踏板");
  k = step(k, { type: "tapSpan", tool: "ledger", id: "E1-E2" }, "E1-E2 の手摺");
  k = step(k, { type: "tapPost", tool: "post", id: "E2" }, "東端を立てる");
  k = { ...k, at: "E2" };
  k = step(k, { type: "useHanare" }, "東端の離れ");
  k = step(k, { type: "useLevel" }, "東端の水平");
  k = step(k, { type: "tapPost", tool: "inner", id: "E2" }, "東端の内柱");
  k = step(k, { type: "tapSpan", tool: "deck", id: "E1-E2" }, "E1-E2 に踏板");

  const kp = progress(k);
  check(isComplete(k), "先行手摺でも最後まで通せた", `進捗 ${kp.done}/${kp.total} / ヒント：${hint(k)}`);
  check(kp.done === kp.total, `工程の数が合う（${kp.done}/${kp.total}）`);
  check(!k.placed.some((x) => x.startsWith("BRK:C:")), "出隅にはブラケットが1枚も付いていない");
  check(k.placed.filter((x) => x.startsWith("SG:")).length === 2, "先行手摺は南面・東面で2枚");
}

/* 先行手摺を使わない現場では、先行手摺の道具は空振りする */
{
  const n = initialState(false);
  check(judge(n, { type: "pickSide", side: "S" }).kind === "note", "使わない現場では600の側を決めない");
}

console.log("── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
