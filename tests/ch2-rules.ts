/* 第2章の判定のテスト。
   HANDOFF.md 3章「現場のルール　第2章 高所作業」を検査項目にしてある。
   実行: npm run test:ch2 */

import { BRACE_AT, SPAN_IDS, type PostId, type SpanId } from "../src/training/ch2/layout";
import {
  current,
  has,
  initialState,
  isComplete,
  progress,
  STEPS,
  type Ch2State,
} from "../src/training/ch2/state";
import { judge, type Action, type Verdict } from "../src/training/ch2/rules";

let ng = 0;
let ok = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else {
    ng++;
    console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`);
  }
};

/** 良手なら状態を進める。場面が出たら続く限り閉じる */
function step(s: Ch2State, a: Action, label: string): Ch2State {
  const v = judge(s, a);
  if (v.kind !== "good") {
    ng++;
    console.error(`NG  ${label} が通らない → ${v.kind}: ${v.message}`);
    return s;
  }
  ok++;
  let cur: Verdict = v;
  for (let i = 0; i < 5 && cur.kind === "good" && cur.scene; i++) {
    const done = judge(cur.state, { type: "sceneDone", scene: cur.scene });
    if (done.kind !== "good") {
      ng++;
      console.error(`NG  ${label} の場面が閉じない → ${done.kind}: ${done.message}`);
      return cur.state;
    }
    cur = done;
  }
  return cur.kind === "good" ? cur.state : v.state;
}

function expectFoul(s: Ch2State, a: Action, tag: string, label: string) {
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

let s = initialState();
console.log("── 地上 ──");

check(STEPS.length === 33, `工程は33手（いま ${STEPS.length}）`);

/* 筋交：1本目は地上から。上がってからでは駄目 */
expectFoul(
  s,
  { type: "tapSpan", tool: "brace", span: BRACE_AT[2] },
  "取付位置の誤り",
  "1本目を別のスパンに入れる",
);
/* 足場の上の作業は地上ではできない */
{
  const v = judge(s, { type: "tapSpan", tool: "rail", span: "P0-P1" });
  check(v.kind === "note", "地上で手摺を入れようとすると一言");
}
s = step(s, { type: "tapSpan", tool: "brace", span: BRACE_AT[1] }, "地上から筋交");
check(has(s, `BR:1:${BRACE_AT[1]}`), "1本目の筋交が入った");
check(s.braceTaught, "筋交の入れ方を一度教えた");

console.log("── 1段目 ──");
s = step(s, { type: "climb" }, "昇降階段で1段目へ");
check(s.lv === 1, "1段目にいる");
check(s.belt === "post", "安全帯を支柱に取った（HANDOFF：コマではなく支柱）");

/* 手摺は荷揚げ側（出隅）から */
expectFoul(s, { type: "tapSpan", tool: "rail", span: "P2-P3" }, "取付順序", "荷揚げ側から入れない");
s = step(s, { type: "tapSpan", tool: "rail", span: "P0-P1" }, "1段目の手摺 出隅〜南①");
check(s.belt === "rail", "1本目が入ったら安全帯を手摺へ掛け替える");
s = step(s, { type: "tapSpan", tool: "rail", span: "P1-P2" }, "1段目の手摺 南①〜南②");
s = step(s, { type: "tapSpan", tool: "rail", span: "P2-P3" }, "1段目の手摺 南②〜南端");

/* 支柱は奥（南端）から手前へ */
expectFoul(s, { type: "tapPost", tool: "post", post: "P0" }, "建てる順序", "手前から継ぐ");
for (const p of ["P3", "P2"] as PostId[]) {
  s = step(s, { type: "tapPost", tool: "post", post: p }, `${p} の支柱を継ぐ`);
  s = step(s, { type: "tapPost", tool: "post", post: p }, `${p} の内柱を継ぐ`);
}
s = step(s, { type: "tapPost", tool: "post", post: "P1" }, "南①の支柱を継ぐ");
s = step(s, { type: "tapPost", tool: "post", post: "P0" }, "出隅の支柱を継ぐ");

/* 受け材：内柱の箇所は踏板手摺、それ以外はブラケット */
expectFoul(s, { type: "tapPost", tool: "brk", post: "P3" }, "取付位置の誤り", "内柱の箇所にブラケット");
s = step(s, { type: "tapPost", tool: "rail6", post: "P3" }, "南端の踏板手摺");
s = step(s, { type: "tapPost", tool: "rail6", post: "P2" }, "南②の踏板手摺");
expectFoul(s, { type: "tapPost", tool: "rail6", post: "P1" }, "取付位置の誤り", "内柱でない柱に踏板手摺");
s = step(s, { type: "tapPost", tool: "brk", post: "P1" }, "南①のブラケット");
s = step(s, { type: "tapPost", tool: "brk", post: "P0" }, "出隅のブラケット");

/* 壁当てジャッキ：付く相手は踏板手摺。内柱の箇所だけ */
expectFoul(s, { type: "tapPost", tool: "wjack", post: "P1" }, "取付位置の誤り", "内柱でない柱に壁当てジャッキ");
s = step(s, { type: "tapPost", tool: "wjack", post: "P3" }, "南端の壁当てジャッキ");
s = step(s, { type: "tapPost", tool: "wjack", post: "P2" }, "南②の壁当てジャッキ");
check(has(s, "WJ:P3") && has(s, "WJ:P2"), "壁当てジャッキが2本とも付いた");

/* 踏板は奥から。踏板が全部入るまで2段目へは上がれない */
expectFoul(s, { type: "tapSpan", tool: "deck", span: "P0-P1" }, "取付位置の誤り", "手前から踏板を敷く");
s = step(s, { type: "tapSpan", tool: "deck", span: "P2-P3" }, "踏板 南②〜南端");
{
  /* 工程キューが踏板より先へ進ませないので、通常は起きない。
     念のための守り（囲いの無い床に上がらない）が効くかを直接確かめる */
  const atClimb2 = STEPS.findIndex((x) => x.k === "climb2");
  expectFoul(
    { ...s, qi: atClimb2 },
    { type: "climb" },
    "手順の飛ばし",
    "踏板が揃わないまま2段目へ上がる",
  );
}
s = step(s, { type: "tapSpan", tool: "deck", span: "P1-P2" }, "踏板 南①〜南②");
s = step(s, { type: "tapSpan", tool: "deck", span: "P0-P1" }, "踏板 出隅〜南①");

/* 2本目の筋交は1段目から */
s = step(s, { type: "tapSpan", tool: "brace", span: BRACE_AT[2] }, "1段目から筋交");

console.log("── 2段目 ──");
s = step(s, { type: "climb" }, "昇降階段で2段目へ");
check(s.lv === 2, "2段目にいる");

{
  const atRoof = STEPS.findIndex((x) => x.k === "roof");
  expectFoul(
    { ...s, qi: atRoof },
    { type: "climb" },
    "手摺の無い床に上がる",
    "2段目の手摺が無いまま屋根へ",
  );
}
for (const id of SPAN_IDS) {
  s = step(s, { type: "tapSpan", tool: "rail", span: id }, `2段目の手摺 ${id}`);
}

/* 3本目の筋交は2段目から。ここで3本が一直線に揃う */
expectFoul(
  { ...s, lv: 1 },
  { type: "tapSpan", tool: "brace", span: BRACE_AT[3] },
  "作業位置の誤り",
  "3本目を1段目から入れる",
);
s = step(s, { type: "tapSpan", tool: "brace", span: BRACE_AT[3] }, "2段目から筋交");
check(
  has(s, `BR:1:${BRACE_AT[1]}`) && has(s, `BR:2:${BRACE_AT[2]}`) && has(s, `BR:3:${BRACE_AT[3]}`),
  "筋交が3本、1段に1本ずつ入った",
);

console.log("── 屋根 ──");
s = step(s, { type: "climb" }, "屋根へ上がる");
check(s.lv === 3, "屋根にいる");

/* 転落防止手摺は中さん2,250 → 上さん2,700 */
for (const id of SPAN_IDS) {
  const bad = judge(s, { type: "tapSpan", tool: "fall", span: id });
  if (current(s)?.k === "fall" && (current(s) as { t: string }).t.startsWith("U:")) {
    check(bad.kind === "foul", "上さんを先に入れるとファール");
  }
  s = step(s, { type: "tapSpan", tool: "fall", span: id }, `中さん ${id}`);
  s = step(s, { type: "tapSpan", tool: "fall", span: id }, `上さん ${id}`);
}

const pg = progress(s);
check(isComplete(s), "第2章を最後まで通せた", `進捗 ${pg.done}/${pg.total}`);
check(pg.done === pg.total, `工程の数が合う（${pg.done}/${pg.total}）`);

console.log("── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
