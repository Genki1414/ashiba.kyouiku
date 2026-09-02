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
import { DEFAULT_COURSE_PRICE } from "../src/lib/pricing";

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

console.log("\n── 独自ドメインへ移すとき ──");
{
  /* 戻り先を決める所が2つあり、読む変数が違う。
     SITE_URL だけを入れると、支払いは直るのに決め直しは古い住所のまま。
     /setup が「設定済み」と緑で出すので、そのままでは気づけない */
  const health = code("src/app/api/health/route.ts");
  check(health.includes("resetBase"), "決め直しの戻り先を /setup に出す");
  check(health.includes("payBase"), "支払いの戻り先も /setup に出す");
  /* 「設定済みか」では足りない。決め打ちを本番の住所に直したので、
     値を決め打ちと比べても、環境変数を入れたかどうかは分からない。
     いま開いている入口と突き合わせるのが、唯一まともな判定 */
  check(health.includes("resetHere"), "決め直しの戻り先を、いまの入口と突き合わせる");
  check(health.includes("payHere"), "支払いの戻り先も、いまの入口と突き合わせる");
  check(health.includes("sameSite("), "突き合わせは sameSite を使う");
  check(health.includes("x-forwarded-host"), "いまの入口は x-forwarded-host から取る");
  check(health.includes("resetEnv"), "環境変数を入れたかどうかは、値ではなく環境変数で見る");

  const setup = code("src/app/setup/SetupClient.tsx");
  check(setup.includes("resetHere"), "食い違っていたら橙にする");
  check(setup.includes("再デプロイ"), "直し方（再デプロイ）まで書く");
  /* 決め打ちと値を比べる判定に戻さないこと。
     決め打ち＝本番の住所になった今、正しく設定していても橙が出る */
  check(!setup.includes("resetFallback"), "決め打ちとの値比べに戻していない");
  check(setup.includes("NEXT_PUBLIC_SITE_URL"), "直す変数の名前を画面に出す");

  /* ホーム画面のアイコンは、入れたときの住所に張り付く。
     manifest の中を絶対URLにすると、住所を変えたときに直しきれない */
  const mani = JSON.parse(read("public/manifest.webmanifest"));
  check(mani.start_url === "/", "manifest の start_url が相対", mani.start_url);
  check(mani.scope === "/", "manifest の scope が相対", mani.scope);
  const abs = [...mani.icons.map((i: { src: string }) => i.src),
               ...(mani.shortcuts ?? []).map((x: { url: string }) => x.url)];
  check(abs.every((u: string) => u.startsWith("/")), "manifest に絶対URLが無い", abs.join(" "));
}

console.log("\n── リリース前の確認（/setup）が嘘をつかないか ──");
{
  /* 環境変数の有無で警告を出していると、決めた値が pricing.ts に
     入っている今は「未設定（仮の値）」と橙で出てしまう。
     嘘の警告を1つ出すと、本当に困る警告まで見なくなる */
  const health = code("src/app/api/health/route.ts");
  check(health.includes("priceMissing"), "0円のまま公開している講座を見ている");
  check(health.includes("allPrices()"), "実際に請求する金額を返す");

  const setup = code("src/app/setup/SetupClient.tsx");
  check(!setup.includes("未設定（仮の値）"), "環境変数の有無だけで橙にしない");
  check(setup.includes("priceMissing"), "0円のときだけ橙にする");

  /* いま公開している講座は、全部きちんと値が付いていること */
  for (const c of readyCourses()) {
    check(DEFAULT_COURSE_PRICE[c.id] > 0, `${c.id}: 既定の単価が入っている`,
      `${DEFAULT_COURSE_PRICE[c.id]}`);
  }
}

console.log("\n── 受講者情報の入り口は、マイページだけ ──");
{
  /* 前は、受講の準備の画面でも同じものを入力させていた。
     端末の中に別に持っていたので、
       ・端末を替えると、また入れ直しになる
       ・マイページの値と食い違えば、どちらが修了証に載るのか分からない
       ・実際には、講座の画面から入れた値がマイページを上書きしていた */
  const prep = code("src/lib/prep.ts");
  check(!/who\s*[:?]/.test(prep), "端末の記録に氏名・生年月日を持たない");
  check(prep.includes("whoReady"), "登録済みかを見る手がある");
  check(prep.includes("canStart"), "端末の準備と、人の登録の両方を見る");

  const ui = code("src/app/edu/[courseId]/prep/PrepClient.tsx");
  check(!/data-testid={`who-/.test(ui) && !ui.includes('data-testid="who-name"'),
    "受講の準備の画面に、氏名の入力欄が無い");
  check(ui.includes('data-testid="prep-who"'), "登録してあるものを見せる枠はある");
  check(ui.includes('href="/me"'), "未登録ならマイページへ案内する");
  /* 講座の画面から、マイページの値を書き換えられないこと */
  check(!/name:\s*p\.who|birth:\s*p\.who/.test(ui), "受講の準備から氏名を送らない");

  const api = code("src/app/api/enrollment/route.ts");
  check(!api.includes('.from("users")'), "受講の記録の口から users 表を書かない");
  check(!/\bname\b.*\bbirth\b/.test(api), "受講の記録の口が氏名・生年月日を受け取らない");

  /* 入り口はマイページの1か所 */
  const mypage = code("src/app/api/mypage/route.ts");
  check(mypage.includes('.from("users")'), "マイページからは書ける（ここが唯一の入り口）");
  const me = code("src/app/me/MeClient.tsx");
  check(me.includes("入れるのはここだけです"), "マイページに「ここだけ」と書いてある");

  /* 受講の側は、サーバから読む */
  const meApi = code("src/app/api/me/route.ts");
  check(meApi.includes("whoOf"), "/api/me が氏名と生年月日を返す");
  check(meApi.includes("birth_date"), "生年月日は users 表から読む");
  const meLib = code("src/lib/me.ts");
  check(/birth:\s*string/.test(meLib), "Me に生年月日がある");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
