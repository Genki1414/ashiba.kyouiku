/* 更新のお知らせの出し分けのテスト。
   実行: npm run test:changelog */

import { LATEST, RELEASES, unseen, type Release } from "../src/content/changelog";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else {
    ng++;
    console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`);
  }
};

const R = (v: string, d = v): Release => ({ v, d, title: v, items: [{ k: "直した", t: v }] });
const list = [R("c"), R("b"), R("a")]; // 上が新しい。日付は全部ばらばら

/* ── 出し分け ── */
check(unseen(null, list).length === 1, "初めて開いた人にはいちばん新しい日ぶんだけ");
check(unseen(null, list)[0].v === "c", "その1件はいちばん新しいもの");
check(unseen("c", list).length === 0, "最新まで見ていれば出さない");
check(unseen("b", list).length === 1 && unseen("b", list)[0].v === "c", "1つ飛ばしていれば1件");
check(
  unseen("a", list).map((r) => r.v).join(",") === "c,b",
  "2つ飛ばしていれば2件、新しい順",
);
check(unseen("z", list).length === 1, "知らない目印ならいちばん新しい日ぶんだけ");

/* 同じ日に何度も直した日は、初めての人にはその日ぶんをまとめて出す */
const sameDay = [R("d3", "8/21"), R("d2", "8/21"), R("d1", "8/21"), R("c0", "8/20")];
check(
  unseen(null, sameDay).map((r) => r.v).join(",") === "d3,d2,d1",
  "同じ日の分はまとめて出す",
);
check(unseen("c0", sameDay).length === 3, "前の日まで見ていれば、その日の3件が出る");
check(unseen([] as unknown as string, sameDay).length === 3, "空の目印もいちばん新しい日ぶん");

/* ── 本物の中身 ── */
check(RELEASES.length > 0, "更新が1件以上ある");
check(LATEST === RELEASES[0].v, "いちばん新しい目印は先頭のもの");
check(
  new Set(RELEASES.map((r) => r.v)).size === RELEASES.length,
  "目印が重なっていない",
);
check(
  RELEASES.every((r) => /^\d{4}-\d{2}-\d{2}-\d+$/.test(r.v)),
  "目印は 日付-通し番号 の形",
);
check(
  RELEASES.every((r) => r.items.length > 0),
  "中身の無い更新が無い",
);
check(
  RELEASES.every((r) => r.items.every((c) => c.t.length >= 10)),
  "何をしたか分かる長さで書いてある",
);
check(
  RELEASES.every((r) => r.title.length > 0 && r.d.length > 0),
  "見出しと日付がある",
);

/* 新しい順に並んでいるか（目印の文字列で比べられる形にしてある） */
const vs = RELEASES.map((r) => r.v);
const sorted = [...vs].sort((a, b) => {
  const [ad, an] = [a.slice(0, 10), Number(a.slice(11))];
  const [bd, bn] = [b.slice(0, 10), Number(b.slice(11))];
  return ad === bd ? bn - an : ad < bd ? 1 : -1;
});
check(vs.join(",") === sorted.join(","), "上が新しい順に並んでいる", `いま ${vs.join(",")}`);

console.log("── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
