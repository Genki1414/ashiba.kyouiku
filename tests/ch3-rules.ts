/* 第3章の判定のテスト。
   HANDOFF.md 3章「現場のルール　第3章 火打とシート」を検査項目にしてある。
   実行: npm run test:ch3 */

import {
  CORNERS,
  NEXT_TO_CORNER,
  POSTS,
  SHEET_SPANS,
  tieOrder,
  type CornerId,
  type PostKey,
} from "../src/training/ch3/layout";
import { initialState, isComplete, type Ch3State } from "../src/training/ch3/state";
import { judge, progress, type Action, type HiuchiPoint } from "../src/training/ch3/rules";

let ng = 0;
let ok = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else {
    ng++;
    console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`);
  }
};

function step(s: Ch3State, a: Action, label: string): Ch3State {
  const v = judge(s, a);
  if (v.kind !== "good") {
    ng++;
    console.error(`NG  ${label} が通らない → ${v.kind}: ${v.message}`);
    return s;
  }
  ok++;
  return v.state;
}

function expectFoul(s: Ch3State, a: Action, tag: string, label: string) {
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

const P = (f: "a" | "b", k: "post" | "rail", n: number): HiuchiPoint => ({ f, k, n });

let s = initialState();
console.log("── 火打 ──");

const c0 = CORNERS[0].id;
/* 手摺には付けない */
expectFoul(
  s,
  { type: "hiuchiPick", corner: c0, a: P("a", "post", 1), b: P("b", "rail", 1) },
  "火打の取付先",
  "手摺に付ける",
);
/* 同じ面の支柱どうしでは三角形にならない */
expectFoul(
  s,
  { type: "hiuchiPick", corner: c0, a: P("a", "post", 1), b: P("a", "post", 2) },
  "火打の掛け方",
  "同じ面の支柱どうし",
);
/* 出隅から同じ距離でないと二等辺にならない */
expectFoul(
  s,
  { type: "hiuchiPick", corner: c0, a: P("a", "post", 1), b: P("b", "post", 2) },
  "火打の掛け方",
  "二等辺になっていない",
);

/* 4隅に掛ける */
for (const c of CORNERS) {
  const v = judge(s, { type: "tapCorner", corner: c.id });
  check(v.kind === "good" && v.scene?.type === "hiuchi", `${c.nm}で火打の場面が開く`);
  s = step(s, { type: "hiuchiPick", corner: c.id, a: P("a", "post", 1), b: P("b", "post", 1) }, `${c.nm}の火打`);
}
check(s.hiuchi.length === 4, "火打が4箇所とも入った");
check(s.phase === "hiuchiDone", "火打が入ったことを確かめる場面へ");

/* 火打を見ている間はシートの手は受け付けない */
{
  const v = judge(s, { type: "tapSpan", span: 0 });
  check(v.kind === "note", "火打の場面ではシートを垂らせない");
}
s = step(s, { type: "toSheet" }, "シートへ進む");
check(s.phase === "hang", "シートの作業に移った");
{
  const v = judge(s, { type: "toSheet" });
  check(v.kind === "note", "シートに入ってからは戻れない");
}

console.log("── シートを垂らす ──");

/* 広げるときに足で挟まないと落とす */
{
  const v = judge(s, { type: "tapSpan", span: 0 });
  check(v.kind === "good" && v.scene?.type === "spread", "広げ方を聞く場面が出る");
}
expectFoul(s, { type: "spreadPick", span: 0, foot: false }, "シートを落とす", "足で挟まずに広げる");

s = step(s, { type: "spreadPick", span: 0, foot: true }, "足で挟んで広げる");
check(s.footOK, "足で挟むことを覚えた");
{
  /* 覚えたあとは聞かれない */
  const v = judge(s, { type: "tapSpan", span: 1 });
  check(v.kind === "good" && !v.scene, "2枚目からは聞かれない");
}
s = step(s, { type: "tapSpan", span: 1 }, "2枚目を垂らす");
check(s.phase === "hang", "まだ垂らし終えていない");
s = step(s, { type: "tapSpan", span: 2 }, "3枚目を垂らす");
check(s.hung.length === SHEET_SPANS.length, "全スパン垂れた");
check(s.phase === "pitch", "ピッチを決める場面へ");

console.log("── 緊結ピッチ ──");
expectFoul(s, { type: "pickPitch", pitch: 1800 }, "緊結ピッチ", "1800mmは粗すぎる");
s = step(s, { type: "pickPitch", pitch: 900 }, "900mmで結ぶ");
check(s.phase === "tie", "結ぶ場面へ");
check(tieOrder(900).join(",") === "4,2", "900なら4コマ目と2コマ目（上から）");
check(tieOrder(450).join(",") === "4,3,2,1", "450なら全コマ（上から）");

console.log("── 結ぶ ──");

/* 出隅は最後。隣の2本を結んでから */
expectFoul(s, { type: "tapPost", post: "corner" }, "出隅を先に結んだ", "出隅を先に結ぶ");

const tieOne = (st: Ch3State, k: PostKey): Ch3State => {
  let t = step(st, { type: "tapPost", post: k }, `${k} を選ぶ`);
  for (const koma of tieOrder(900)) {
    t = step(t, { type: "tapKoma", koma }, `${k} の${koma}コマ目`);
  }
  return step(t, { type: "nextPost" }, `${k} を結び終える`);
};

/* 結ぶ位置の決まり */
s = step(s, { type: "tapPost", post: "s1" }, "南①を選ぶ");
expectFoul(s, { type: "tapKoma", koma: 0 }, "結ぶ位置", "立っている踏板の高さを結ぶ");
expectFoul(s, { type: "tapKoma", koma: 3 }, "結ぶ順序", "900なのに3コマ目");
expectFoul(s, { type: "tapKoma", koma: 2 }, "結ぶ順序", "上から順でない（先に2コマ目）");
s = step(s, { type: "tapKoma", koma: 4 }, "4コマ目");
expectFoul(s, { type: "nextPost" }, "結び残し", "結び終える前に次の支柱へ");
s = step(s, { type: "tapKoma", koma: 2 }, "2コマ目");
s = step(s, { type: "nextPost" }, "南①を結び終える");

/* 残りを結ぶ。出隅は最後 */
for (const k of ["s2", "s3", "w1", "w2"] as PostKey[]) s = tieOne(s, k);
check(NEXT_TO_CORNER.every((n) => s.tied.includes(n)), "出隅の両隣が結べた");
s = tieOne(s, "corner");

check(isComplete(s), "第3章を最後まで通せた");
const pg = progress(s);
check(pg.done === pg.total, `工程の数が合う（${pg.done}/${pg.total}）`);

console.log("── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
