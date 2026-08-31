/* 初めて登録する人の動線の決まり。
   実行: npm run test:onboard

   ・買う前の人が、決まりごとを読めるか（ログイン画面にリンクがあるか）
   ・会社経由で入った人も、規約に同意する場面を通るか
   ・領収書の品名が、買った講座と合っているか
   ・規約と特商法が、公開している講座を全部carrying しているか */

import { readFileSync } from "node:fs";
import { orderLabel, TRAIN_LABEL } from "../src/lib/orderLabel";
import { COURSES, readyCourses, findCourse, totalNoteOf, SERVICE_NAME } from "../src/content/courses";
import { isOpenPath } from "../src/lib/authGate";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`); }
};
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/* 「この字が無いこと」を見るときは、注記を外してから見る。
   外さないと、直した理由を書いた注記が引っかかって、
   直っているのに落ちる（tests/pricing.mts で一度やった） */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

console.log("── 買う前の人が読めるか ──");
{
  /* ログインしていない人が開ける画面は、ほぼログインだけ。
     そこにリンクが無いと、特商法の表記へ行く道がどこにも無い */
  const login = read("src/app/login/LoginClient.tsx");
  for (const [href, name] of [
    ["/legal/tokushoho", "特定商取引法に基づく表記"],
    ["/legal/terms", "利用規約"],
    ["/legal/privacy", "個人情報の取扱い"],
  ]) {
    check(login.includes(`href="${href}"`), `ログイン画面から ${name} へ行ける`);
    check(isOpenPath(href), `${name} はログインなしで開ける`);
  }
  check(!isOpenPath("/order"), "申込みの画面はログインが要る（念のため）");
}

console.log("\n── 会社経由で入った人も規約に同意するか ──");
{
  /* 同意の場面が申込み（/order）だけだと、受講コードや参加コードで
     入った人は、一度も同意しないまま修了する。
     登録はどの入り方でも必ず通るので、そこに置くこと */
  const login = read("src/app/login/LoginClient.tsx");
  check(login.includes('data-testid="login-consent"'), "登録の画面に同意の一言がある");
  const at = login.indexOf('data-testid="login-consent"');
  const near = login.slice(Math.max(0, at - 700), at + 700);
  check(near.includes("/legal/terms"), "同意の一言から利用規約へ行ける");
  check(near.includes("/legal/privacy"), "同意の一言から個人情報の取扱いへ行ける");
  check(near.includes('mode === "up"'), "同意の一言は、登録のときだけ出す");

  /* 受講の準備で聞く同意は、カメラと顔の話。規約の同意の代わりにはならない */
  const prep = code("src/app/edu/[courseId]/prep/PrepClient.tsx");
  check(!prep.includes("/legal/terms"), "受講の準備の同意を、規約の同意と混ぜていない");
}

console.log("\n── 領収書の品名 ──");
{
  /* 決め打ちにすると、職長を買った人の領収書に「足場の特別教育」と残る */
  const checkout = read("src/app/api/stripe/checkout/route.ts");
  check(!checkout.includes('name: "足場'), "品名を決め打ちにしていない");
  check(checkout.includes("orderLabel("), "品名は注文から作る");
  check(checkout.includes("course_id"), "注文から講座を引いている");

  for (const c of readyCourses()) {
    const label = orderLabel({ kind: "seat", courseId: c.id });
    check(label.includes(c.name), `${c.id}: 品名に講座の名前が入る`, label);
    check(label.includes(totalNoteOf(c)), `${c.id}: 品名に提供する範囲が入る`, label);
  }
  /* 職長を買って足場の名前が出ていた、というのがそもそもの不具合 */
  const sc = orderLabel({ kind: "seat", courseId: "shokucho" });
  check(!sc.includes("足場"), "職長の品名に足場が出ない", sc);
  check(orderLabel({ kind: "training", courseId: "ashiba" }) === TRAIN_LABEL,
    "実務トレーニングは講座名を出さない");
  check(!orderLabel({ kind: "seat", courseId: "no-such" }).includes("足場"),
    "引けない講座で、嘘の講座名を出さない");
  check(orderLabel({}).length > 0, "何も無くても品名は空にしない");
}

console.log("\n── 規約と表記が、公開中の講座を全部おおうか ──");
{
  const terms = code("src/app/legal/terms/page.tsx");
  const termsRaw = read("src/app/legal/terms/page.tsx");
  check(!terms.includes("足場の特別教育および実務トレーニング"),
    "規約の対象を「足場」で決め打ちにしていない");
  check(termsRaw.includes("readyCourses()"), "規約の対象は公開中の講座から作る");
  check(termsRaw.includes("c.basis"), "根拠の条文も講座から出す");
  check(terms.includes("討議"), "討議のある教育のことが規約に書いてある");
  check(!terms.includes("特別教育の学科として行われる"),
    "免責も特別教育で決め打ちにしていない");

  /* 見出しも同じ。足場だけを売っているわけではない */
  const login = code("src/app/login/LoginClient.tsx");
  check(!login.includes('>足場の特別教育<'), "ログイン画面の見出しが足場で固定でない");
  check(login.includes("SERVICE_NAME"), "見出しはサービス名を使う");
  check(SERVICE_NAME.length > 0 && !SERVICE_NAME.includes("特別教育"),
    "サービス名に講座名が混ざっていない", SERVICE_NAME);
}

console.log("\n── 講座を足したときに置き去りにならないか ──");
{
  /* 公開している講座は、必ず値段と根拠を持っていること。
     どちらも規約と特商法に出る */
  for (const c of COURSES.filter((x) => x.ready)) {
    check(!!c.basis, `${c.id}: 根拠の条文がある`);
    check(!!c.name, `${c.id}: 正式名称がある`);
    check(findCourse(c.id) !== null, `${c.id}: id から引ける`);
  }
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
