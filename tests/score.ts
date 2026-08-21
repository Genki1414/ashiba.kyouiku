/* 得点の決まりのテスト。プロトタイプの計算と一致するかを見る。
   実行: npm run test:score */

import {
  PASS,
  gainOf,
  isComboBeat,
  isPass,
  mmss,
  multOf,
  rankOf,
  summarize,
  type Err,
} from "../src/training/score";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else {
    ng++;
    console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`);
  }
};

/* ── 倍率 ── */
check(multOf(0) === 1, "コンボ0で×1");
check(multOf(2) === 1, "コンボ2まではまだ×1");
check(multOf(3) === 2, "コンボ3で×2");
check(multOf(6) === 3, "コンボ6で×3");
check(multOf(12) === 5, "コンボ12で×5");
check(multOf(30) === 5, "倍率は×5で頭打ち");

/* ── 1手の点 ── */
check(gainOf(0) === 100, "1手目は100点");
check(gainOf(3) === 200, "4手目（コンボ3）は200点");
check(gainOf(15) === 500, "頭打ちは500点");

/* ── コンボの節目 ── */
check(!isComboBeat(2), "コンボ2は節目ではない");
check(isComboBeat(3), "コンボ3は節目");
check(!isComboBeat(4), "コンボ4は節目ではない");
check(isComboBeat(6), "コンボ6は節目");

/* ── 無傷で通したときの合計。プロトタイプと同じ積み上げ ── */
let score = 0;
for (let c = 0; c < 10; c++) score += gainOf(c);
/* 1..3手目 ×1、4..6手目 ×2、7..9手目 ×3、10手目 ×4 */
check(score === 100 * 3 + 200 * 3 + 300 * 3 + 400, `10手無傷で ${score} 点`, `= ${score}`);

/* ── 段位 ── */
check(rankOf(100, "まだ現場に出せん").r === "S", "100点はS");
check(rankOf(92, "まだ現場に出せん").r === "A", "92点はA");
check(rankOf(75, "まだ現場に出せん").r === "B", "75点はB");
check(rankOf(74, "まだ現場に出せん").r === "C", "74点はC");
check(rankOf(0, "まだ上に上げられん").t === "まだ上に上げられん", "章ごとにCの呼び方が変わる");
check(rankOf(90, "x").t === "半人前の上", "Aは半人前の上");

/* ── 合格ライン ── */
check(PASS === 80, "合格ラインは80点");
check(isPass(80), "80点は合格");
check(!isPass(79), "79点は不合格");
/* Bランク（75〜89）のうち、80未満は不合格になる */
check(rankOf(78, "x").r === "B" && !isPass(78), "Bでも80未満なら再受講");

/* ── 指摘のまとめ ── */
const errs: Err[] = [
  { tag: "離れを見ていない", message: "離れを見んか！", why: "壁との寸法が狂う。" },
  { tag: "水平を見ていない", message: "水平を出せ！", why: "上まで狂いが積み上がる。" },
  { tag: "離れを見ていない", message: "離れを見んか！", why: "壁との寸法が狂う。" },
];
const u = summarize(errs);
check(u.length === 2, "同じ指摘は1件にまとまる");
check(u[0].n === 2, "まとめた件数が付く");
check(u[1].n === 1, "1回だけの指摘は1件のまま");
check(u[0].why !== "", "なぜ駄目かが残っている");
check(summarize([]).length === 0, "指摘が無ければ空");

/* ── 時間の表示 ── */
check(mmss(0) === "00:00", "0秒");
check(mmss(59) === "00:59", "59秒");
check(mmss(60) === "01:00", "1分");
check(mmss(605) === "10:05", "10分5秒");

console.log("── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
