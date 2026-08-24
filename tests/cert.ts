/* 修了証の決まりのテスト。
   実行: npm run test:cert */

import { CERT_NO_RE, certNo, eligible, isCertNo, totalLabel } from "../src/lib/cert";
import { CERT_MIN_H, CERT_W, certHeight } from "../src/components/edu/drawCert";
import { ISSUER_NAME, ISSUER_RESPONSIBLE, issuerName, issuerResponsible } from "../src/lib/issuer";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`); }
};

console.log("── 発行名義 ──");
check(ISSUER_NAME === "東北三上機材株式会社", "事業者名が入っている", ISSUER_NAME);
check(ISSUER_RESPONSIBLE === "中川元基", "教育実施責任者が入っている", ISSUER_RESPONSIBLE);
check(issuerName() === ISSUER_NAME, "設定が無ければそのまま使う");
check(issuerResponsible() === ISSUER_RESPONSIBLE, "責任者も同じ");
{
  /* Vercel の環境変数で上書きできる（会社が変わったとき） */
  process.env.CERT_ISSUER_NAME = "別の会社";
  process.env.CERT_ISSUER_RESPONSIBLE = "別の人";
  check(issuerName() === "別の会社", "環境変数があればそちらを使う");
  check(issuerResponsible() === "別の人", "責任者も上書きできる");
  delete process.env.CERT_ISSUER_NAME;
  delete process.env.CERT_ISSUER_RESPONSIBLE;
  check(issuerName() === ISSUER_NAME, "外せば元に戻る");
}

console.log("── 出せるかどうか ──");
check(eligible({ lessons: 13, lessonsPassed: 13, examPassed: true }).ok, "全部済んでいれば出せる");
{
  const v = eligible({ lessons: 13, lessonsPassed: 12, examPassed: true });
  check(!v.ok, "単元が残っていれば出せない");
  check(!v.ok && v.reason.includes("残り1単元"), "あと何単元かを言う", !v.ok ? v.reason : "");
}
{
  const v = eligible({ lessons: 13, lessonsPassed: 13, examPassed: false });
  check(!v.ok, "修了試験に受かっていなければ出せない");
  check(!v.ok && v.reason.includes("修了試験"), "何が足りないかを言う");
}
{
  const v = eligible({ lessons: 13, lessonsPassed: 0, examPassed: false });
  check(!v.ok && v.reason.includes("残り13単元"), "単元が先に出る（試験は最後だから）");
}
check(!eligible({ lessons: 0, lessonsPassed: 0, examPassed: true }).ok, "教材が無いのに出さない");

console.log("── 証明番号 ──");
const d = new Date("2026-08-22T00:00:00Z");
const a = certNo("55555555-5555-5555-5555-555555555555", d);
check(CERT_NO_RE.test(a), `形が合っている（${a}）`);
check(a === certNo("55555555-5555-5555-5555-555555555555", d), "同じ受講なら何度作っても同じ番号");
check(
  a !== certNo("66666666-6666-6666-6666-666666666666", d),
  "受講が違えば番号も違う",
);
check(a.startsWith("AT-202608-"), "年月が入る");
check(
  certNo("55555555-5555-5555-5555-555555555555", new Date("2026-09-01T00:00:00Z")).startsWith("AT-202609-"),
  "月が変われば番号も変わる",
);
/* 取り違えが起きにくいか。1000件でぶつかりが多すぎないこと */
{
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) seen.add(certNo(`enroll-${i}`, d));
  check(seen.size > 900, `1000件で${seen.size}通り（下4桁なので多少はぶつかる）`);
}

console.log("── 照会の入り口 ──");
check(isCertNo("AT-202608-1234"), "正しい番号は通す");
check(isCertNo(" at-202608-1234 "), "小文字・前後の空白は直して通す");
check(!isCertNo("AT-2026-1234"), "年月が短いものは弾く");
check(!isCertNo("XX-202608-1234"), "頭が違うものは弾く");
check(!isCertNo(""), "空は弾く");
check(!isCertNo("AT-202608-12345"), "桁が多いものは弾く");

console.log("── 合計時間 ──");
check(totalLabel([{ min: 180 }, { min: 30 }, { min: 90 }, { min: 60 }]) === "6時間（学科）", "6時間");
check(totalLabel([{ min: 90 }]) === "1時間30分（学科）", "端数は分で出す");

console.log("── 紙の大きさ ──");
/* 科目が増えたら紙も伸びる。伸ばさないと、下の署名欄が本文に重なる */
check(CERT_W === 1240, "横は1240");
check(certHeight(4) === 966, `科目4つで966（いま ${certHeight(4)}）`);
check(certHeight(5) - certHeight(4) === 30, "科目が1つ増えると30伸びる");
check(certHeight(8) > certHeight(4), "科目が多いほど高い");
check(certHeight(1) === CERT_MIN_H, `科目が少なくても${CERT_MIN_H}より低くしない`);
check(certHeight(0) === CERT_MIN_H, "科目0でも紙の形は保つ");

console.log("── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
