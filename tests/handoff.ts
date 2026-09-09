/* ログインの引き継ぎコードの決まり。実行: npx tsx tests/handoff.ts

   げんきさん（2026-09-09）
     「ホーム画面に追加したのに、ホーム画面に追加した所から
       ログインするとネット版になる」

   ここで見るのは字の形だけ。1回きり・5分の決まりは SQL 側で、
   supabase/tests/handoff.sql が本物のデータベースに当てて確かめる。 */

import { readFileSync } from "node:fs";
import {
  HANDOFF_ALPHABET, HANDOFF_LEN, HANDOFF_MIN,
  isHandoff, normalizeHandoff, showHandoff,
} from "../src/lib/handoff";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

console.log("── 字の形 ──");
{
  check(HANDOFF_LEN === 8, "8文字");
  check(HANDOFF_MIN === 5, "5分で切れる");
  /* 打ち間違えやすい字を使わない。紙に書き写して打つため */
  for (const c of "01OIL") check(!HANDOFF_ALPHABET.includes(c), `${c} は使わない`);
  check(HANDOFF_ALPHABET.length === 31, "使う字は31種");

  check(isHandoff("23456789"), "使ってよい字ならば通る");
  check(!isHandoff("2345678"), "7文字は通さない");
  /* 貼り付けで余計な字が付いても、はじめの8文字で通す。
     形が違うだけで断ると、打ち直しの理由が分からない */
  check(isHandoff("234567890"), "余分に付いていても、はじめの8文字で通る");
  check(!isHandoff(""), "空は通さない");
}

console.log("\n── 打ち方の揺れ ──");
{
  check(normalizeHandoff("abcdefgh") === "ABCDEFGH", "小文字は大文字に");
  check(normalizeHandoff(" 2345 6789 ") === "23456789", "空白は取る");
  check(normalizeHandoff("2345-6789") === "23456789", "ハイフンは取る");
  check(normalizeHandoff("2345ー6789") === "23456789", "長音で打ってしまっても取る");
  /* 見た目が近い字は、使っている字に寄せる。
     紙の「O」を打った人を、形が違うだけで断らない */
  check(normalizeHandoff("O234567I") === "02345671", "O と I は 0 と 1 に寄せる");
  check(normalizeHandoff("あ23456789") === "23456789", "かなは落とす");
  check(normalizeHandoff("234567891234") === "23456789", "長すぎる分は切る");
  check(showHandoff("23456789") === "2345 6789", "画面では4文字ずつ");
}

console.log("\n── 危ない所 ──");
{
  const lib = read("src/lib/handoff.ts");
  check(!/process\.env/.test(lib), "鍵を持たない（字の形だけ）");

  const make = read("src/app/api/handoff/route.ts");
  check(/currentUser\(/.test(make), "コードを作れるのは、入っている本人だけ");
  check(/make_handoff/.test(make), "作るのは SQL 側（決まりを2か所に書かない）");

  const use = read("src/app/api/handoff/use/route.ts");
  check(/use_handoff/.test(use), "使うのも SQL 側（1回きりを2か所に書かない）");
  check(/generateLink/.test(use) && /verifyOtp/.test(use), "合図はサーバで作る（メールは送らない）");
  check(!/console\.log\(.*code/.test(use), "コードを記録に残さない");

  const sql = read("supabase/migrations/0036_handoff.sql");
  check(/delete from public\.handoffs where user_id = p_user/.test(sql), "作り直したら、前のは消す");
  check(/interval '5 minutes'/.test(sql), "5分で切れる");
  check(/delete from public\.handoffs where code = v_row\.code/.test(sql), "使ったら消す（1回きり）");
  check(/enable row level security/.test(sql), "誰にも開けない");
  check(/revoke all on function public\.use_handoff/.test(sql), "サーバ以外は呼べない");
}

console.log(`\n${ok} 件通過 / ${ng} 件失敗`);
process.exit(ng ? 1 : 0);
