/* 第1章の判定のテスト。
   HANDOFF.md 3章「現場のルール」の1〜8を、そのまま検査項目にしてある。
   実行: npx tsx tests/ch1-rules.ts */

import {
  JACK_TARGET,
  POSTS,
  SPANS,
  type PostId,
  type SpanId,
} from "../src/training/ch1/layout";
import {
  danDone,
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

console.log("── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
