/* 参加コードの試験。外販なので、事業者ごとに合言葉を配る。
   実行: npx tsx tests/tenant.ts */

import { codeKind, isJoinCode, isSeatCode, newJoinCode, normalizeJoinCode, showSeatCode } from "@/training/joinCode";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

console.log("── 参加コードの形 ──");
{
  const c = newJoinCode();
  check(c.length === 8, `8文字（いま ${c.length}）`);
  check(isJoinCode(c), `作ったものは通る（${c}）`);
  /* 紙に書いて渡すので、読み違えやすい字は使わない */
  check(!/[01OIL]/.test(c), `0・1・O・I・L を使っていない（${c}）`);
}
{
  /* 総当たりされにくいか。31文字×8桁＝約8500億通り */
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) seen.add(newJoinCode());
  check(seen.size === 2000, `2000回作って全部違う（いま ${seen.size}通り）`);
}

console.log("── 入れてもらった字を揃える ──");
check(normalizeJoinCode(" abcd2345 ") === "ABCD2345", "小文字と前後の空白を直す");
check(normalizeJoinCode("ABCD-2345") === "ABCD2345", "区切りの線を外す");
check(normalizeJoinCode("AB CD 23 45") === "ABCD2345", "間の空白も外す");
check(isJoinCode("abcd2345"), "小文字でも通る");

console.log("── 通さないもの ──");
check(!isJoinCode(""), "空は通さない");
check(!isJoinCode("ABCD234"), "7文字は通さない");
check(!isJoinCode("ABCD23456"), "9文字は通さない");
check(!isJoinCode("ABCD2340"), "0 は使っていないので通さない");
check(!isJoinCode("ABCD234I"), "I は使っていないので通さない");
check(!isJoinCode("ABCD234L"), "L は使っていないので通さない");
check(!isJoinCode("ABCD234O"), "O は使っていないので通さない");
check(!isJoinCode("ABCD234."), "記号は通さない");

console.log("── 参加コードと受講コードを見分ける ──");
/* 入り口は1つ。桁で見分ける（現場の人に2種類を説明したくない） */
check(codeKind("ABCD2345") === "join", "8文字は参加コード");
check(codeKind("ABCD23456789") === "seat", "12文字は受講コード");
check(codeKind("ABCD-2345-6789") === "seat", "区切り線が入っていても受講コード");
check(codeKind("abcd-2345-6789") === "seat", "小文字でも受講コード");
check(codeKind("ABCD234567") === null, "10文字はどちらでもない");
check(codeKind("") === null, "空はどちらでもない");
check(codeKind("ABCD23456780") === null, "使っていない字（0）が入れば通さない");
check(isSeatCode("ABCD23456789"), "受講コードの形");
check(!isSeatCode("ABCD2345"), "参加コードは受講コードではない");
check(!isJoinCode("ABCD23456789"), "受講コードは参加コードではない");
check(showSeatCode("ABCD23456789") === "ABCD-2345-6789", "4文字ごとに区切って見せる");

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
