/* 事業者名の突き合わせの試験。
   実行: npx tsx tests/company-name.ts

   同じ会社が2つ登録されると、名簿が割れる。
   片方に申し込んだ人が、もう片方を見ている担当者からは見えない。
   会社名の書き方は人によってばらつくので、揃えてから比べる。 */

import { companyCore, likeCompany, normalizeCompany, sameCompany } from "@/training/companyName";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

console.log("── 同じ会社とみなすもの ──");
const SAME = [
  ["東北三上機材株式会社", "東北三上機材（株）"],
  ["東北三上機材株式会社", "東北三上機材(株)"],
  ["東北三上機材株式会社", "東北三上機材㈱"],
  ["東北三上機材株式会社", "東北三上機材 株式会社"],
  ["東北三上機材株式会社", "東北三上機材　株式会社"],
  ["東北三上機材株式会社", " 東北三上機材株式会社 "],
  ["有限会社山田工業", "㈲山田工業"],
  ["有限会社山田工業", "(有)山田工業"],
  ["ABC建設", "ＡＢＣ建設"],
  ["ABC建設", "abc建設"],
  ["カネコ工業", "ｶﾈｺ工業"],
  ["ダイワ足場", "ﾀﾞｲﾜ足場"],
  ["山田・鈴木建設", "山田鈴木建設"],
  ["山田-鈴木建設", "山田鈴木建設"],
];
for (const [a, b] of SAME) check(sameCompany(a, b), `${a} ＝ ${b}`);

console.log("── 別の会社とするもの ──");
const DIFF: [string, string][] = [
  ["株式会社山田", "山田株式会社"],
  ["東北三上機材株式会社", "東北三上機材工業株式会社"],
  ["山田工業", "山本工業"],
  ["", "山田工業"],
  ["山田工業", ""],
];
for (const [a, b] of DIFF) check(!sameCompany(a, b), `${a || "（空）"} ≠ ${b || "（空）"}`);
check(!sameCompany("", ""), "空どうしは、同じ会社にしない");

console.log("── もしかしてこれ？（候補に出すだけ） ──");
/* 前株と後株は、別の会社のことがある。止めはしないが、候補には出す */
check(likeCompany("株式会社山田工業", "山田工業株式会社"), "前株と後株は候補に出す");
check(likeCompany("山田工業", "株式会社山田工業"), "法人格の有無も候補に出す");
check(likeCompany("有限会社山田工業", "山田工業株式会社"), "有限と株式も候補に出す");
check(!likeCompany("山田工業", "山本工業"), "名前が違えば候補にもしない");
/* 短すぎる名前で拾いすぎない */
check(!likeCompany("株式会社A", "有限会社A"), "1文字の名前では拾わない");
check(likeCompany("株式会社AB", "有限会社AB"), "2文字からは拾う");

console.log("── 揃えた形 ──");
check(normalizeCompany("東北三上機材（株）") === "東北三上機材株式会社",
  `法人格が揃う（${normalizeCompany("東北三上機材（株）")}）`);
check(companyCore("株式会社山田工業") === "山田工業",
  `法人格を外せる（${companyCore("株式会社山田工業")}）`);
check(normalizeCompany("  ") === "", "空白だけなら空");
check(normalizeCompany(null as unknown as string) === "", "何も渡されなくても落ちない");

console.log(`\n通り ${ok} ／ だめ ${ng}`);
process.exit(ng ? 1 : 0);
