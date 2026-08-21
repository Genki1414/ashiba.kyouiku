/* 章の記録と間違いノートのテスト。
   実行: npm run test:record */

import {
  KEEP,
  addAttempt,
  bestOf,
  countOf,
  fixedItems,
  lastOf,
  noteCountOf,
  noteItems,
  passedCount,
  rankLabel,
  toAttempt,
  type Attempt,
  type Record_,
} from "../src/training/record";
import type { Err, Score } from "../src/training/score";
import { CHAPTERS, chapterLabel, chapterOf } from "../src/training/chapters";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else {
    ng++;
    console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`);
  }
};

const E = (tag: string, message = `${tag}のこと`, why = `${tag}だから危ない`): Err => ({
  tag,
  message,
  why,
});
const S = (skill: number, errs: Err[] = []): Score => ({
  skill, score: skill * 100, best: 3, sec: 120, hints: 0, asks: 1, errs,
});
const A = (at: string, skill: number, errs: Err[] = []): Attempt =>
  toAttempt(S(skill, errs), { at, tutorial: true });

console.log("── 記録 ──");

/* ── 1件ぶんに変える ── */
{
  const a = toAttempt(S(92, [E("離れ")]), { at: "2026-08-21T10:00:00Z", tutorial: false, sk: true });
  check(a.skill === 92 && a.score === 9200, "点がそのまま入る");
  check(a.tutorial === false && a.sk === true, "本番か・先行手摺かが残る");
  check(a.errs.length === 1 && a.errs[0].why !== "", "なぜ駄目かも残る");
  check(a.at === "2026-08-21T10:00:00Z", "日時が入る");
}

/* ── 足す ── */
let rec: Record_ = {};
check(lastOf(rec, "ch1") === null, "まだ通していなければ空");
check(countOf(rec, "ch1") === 0, "回数も0");
rec = addAttempt(rec, "ch1", A("2026-08-20T09:00:00Z", 70, [E("離れ"), E("水平")]));
rec = addAttempt(rec, "ch1", A("2026-08-21T09:00:00Z", 92, [E("離れ")]));
check(countOf(rec, "ch1") === 2, "2回ぶん残る");
check(lastOf(rec, "ch1")!.skill === 92, "新しいものが先頭");
check(bestOf(rec, "ch1")!.skill === 92, "いちばん良いものが取れる");
rec = addAttempt(rec, "ch1", A("2026-08-22T09:00:00Z", 60));
check(lastOf(rec, "ch1")!.skill === 60, "下手になっても最後は最後");
check(bestOf(rec, "ch1")!.skill === 92, "最高は下がらない");
check(countOf(rec, "ch2") === 0, "別の章は混ざらない");

/* ── 上限 ── */
{
  let r: Record_ = {};
  for (let i = 0; i < KEEP + 6; i++) {
    r = addAttempt(r, "ch2", A(`2026-08-${String(i + 1).padStart(2, "0")}T09:00:00Z`, 80));
  }
  check(countOf(r, "ch2") === KEEP, `残すのは${KEEP}回まで`);
  check(lastOf(r, "ch2")!.at.startsWith("2026-08-26"), "古いものから捨てる");
}

/* ── 合格した章の数 ── */
{
  let r: Record_ = {};
  r = addAttempt(r, "ch1", A("2026-08-21T09:00:00Z", 92));  // 合格
  r = addAttempt(r, "ch2", A("2026-08-21T09:00:00Z", 60));  // 不合格
  r = addAttempt(r, "ch3", A("2026-08-21T09:00:00Z", 80));  // ちょうど合格
  check(passedCount(r) === 2, "80点以上の章だけ数える");
  /* 一度でも合格していれば数える（最高で見る） */
  r = addAttempt(r, "ch2", A("2026-08-22T09:00:00Z", 85));
  r = addAttempt(r, "ch2", A("2026-08-23T09:00:00Z", 40));
  check(passedCount(r) === 3, "最後が悪くても、一度合格していれば数える");
}

/* ── 段位の呼び方は章で違う ── */
check(rankLabel("ch1", 0).t === "まだ現場に出せん", "第1章のCの呼び方");
check(rankLabel("ch2", 0).t === "まだ上に上げられん", "第2章のCの呼び方");
check(rankLabel("ch3", 0).t === "まだ任せられん", "第3章のCの呼び方");
check(rankLabel("ch1", 100).r === "S", "段位そのものは共通");

console.log("── 章の一覧 ──");
check(CHAPTERS.length === 6, "章は6つ");
check(CHAPTERS.filter((c) => c.ready).length === 3, "いま遊べるのは3つ");
check(
  CHAPTERS.filter((c) => c.ready).every((c) => !!c.lowText),
  "遊べる章にはCの呼び方がある",
);
check(chapterLabel("ch2") === "第2章 高所作業", "章の呼び名");
check(chapterLabel("zz") === "zz", "知らない章はそのまま返す");
check(chapterOf("ch4")?.ready === false, "準備中の章は遊べない");
check(
  new Set(CHAPTERS.map((c) => c.n)).size === CHAPTERS.length,
  "章の番号が重なっていない",
);

console.log("── 間違いノート ──");

/* ── まとめ方 ── */
{
  let r: Record_ = {};
  r = addAttempt(r, "ch1", A("2026-08-20T09:00:00Z", 70, [E("離れ"), E("水平"), E("離れ")]));
  r = addAttempt(r, "ch1", A("2026-08-21T09:00:00Z", 80, [E("離れ")]));
  r = addAttempt(r, "ch2", A("2026-08-21T10:00:00Z", 90, [E("離れ")]));

  const items = noteItems(r);
  check(items.length === 3, "章 × 中身 でまとまる", `いま ${items.length}件`);
  check(items[0].tag === "離れ" && items[0].ch === "ch1" && items[0].n === 3, "多い順に並ぶ");
  check(
    items.some((i) => i.ch === "ch2" && i.tag === "離れ"),
    "同じ分類でも章が違えば別に出す",
  );
  check(items[0].last === "2026-08-21T09:00:00Z", "最後に言われた日を持つ");
  check(items.every((i) => i.why !== ""), "なぜ駄目かが残っている");
  check(noteCountOf(r, "ch1") === 4, "章ごとの合計回数");
  check(noteCountOf(r, "ch3") === 0, "通していない章は0");
}

/* ── 同じ分類でも中身が違えば別 ── */
{
  let r: Record_ = {};
  r = addAttempt(r, "ch1", A("2026-08-21T09:00:00Z", 70, [
    E("手順の飛ばし", "先に離れを見ろ。"),
    E("手順の飛ばし", "水平が先だ。"),
  ]));
  check(noteItems(r).length === 2, "同じ分類でも言われた中身が違えば別に出す");
}

/* ── 直せたもの ── */
{
  let r: Record_ = {};
  r = addAttempt(r, "ch1", A("2026-08-20T09:00:00Z", 70, [E("離れ"), E("水平")]));
  r = addAttempt(r, "ch1", A("2026-08-21T09:00:00Z", 92, [E("水平")]));
  const f = fixedItems(r);
  check(f.length === 1 && f[0].tag === "離れ", "最後の1回で言われなければ直せたとみなす");
  const items = noteItems(r);
  check(items.length === 2, "直せたものもノートには残る");

  /* まだ言われているものは直せたに入らない */
  check(!f.some((x) => x.tag === "水平"), "最後にも言われたものは直せていない");
}

/* ── 何も無いとき ── */
check(noteItems({}).length === 0, "記録が無ければノートも空");
check(fixedItems({}).length === 0, "直せたものも空");
check(passedCount({}) === 0, "合格0");

console.log("── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
