/* 店が二つあることの決まり。
   実行: npm run test:brand

   足場屋革命          … 足場屋さん向け。特別教育・職長教育＋実務トレーニング
   特別教育ドットコム  … それ以外の業種向け。特別教育・職長教育だけ

   **足場屋革命が正。**中身（講座・席・修了証・migration）は一つで、
   ここで変わるのは名前と表紙と、実務トレーニングを出すかどうかだけ。

   いちばん怖いのは、**特別教育ドットコムに足場屋の文字が残ること**。
   塗装屋さんや解体屋さんが開いて「足場屋のところか」と思って閉じる。
   げんきさんの決めごと（これは全ての業種の人が受ける）が、
   講座の中身では守られていても、看板で壊れる。 */

import { readFileSync, readdirSync } from "node:fs";
import { BRAND, BRANDS, type Brand } from "../src/content/brand";
import { COURSES } from "../src/content/courses";
import { tokubetsuOfCourse } from "../src/content/tokubetsu";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`); }
};
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

console.log("── 店は二つ、既定は足場屋革命 ──");
{
  check(BRANDS.length === 2, `店は2つ（いま ${BRANDS.length}）`);
  check(BRAND.id === "ashibaya",
    "**環境変数を書かなければ足場屋革命。**いまの本番は何も足さなくてよい", BRAND.id);
  const ids = BRANDS.map((b) => b.id);
  check(new Set(ids).size === ids.length, "同じ id の店が二つない");
}

console.log("\n── どちらの店も、名前が全部そろっている ──");
{
  const keys: (keyof Brand)[] = [
    "name", "shortName", "eyebrow", "title", "manifestName",
    "description", "metaDescription", "mailFrom", "notifyPrefix",
  ];
  for (const b of BRANDS) {
    for (const k of keys) {
      check(typeof b[k] === "string" && (b[k] as string).trim().length > 0,
        `${b.id}: ${String(k)} が空でない`);
    }
    check(b.lead.length === 2 && b.lead.every((x) => x.trim().length > 0),
      `${b.id}: 表紙の一言が2行そろっている`);
    /* ホーム画面のアイコンの下は短い名前。長いと途中で切れる */
    check(b.shortName.length <= 12, `${b.id}: 短い名前が12文字以内`, b.shortName);
    /* 差出人は「名前 <住所>」の形。崩れると送れない */
    check(/^.+ <[^@\s]+@[^@\s]+>$/.test(b.mailFrom),
      `${b.id}: メールの差出人の形が正しい`, b.mailFrom);
  }
  /* 二つの店で、名前がかぶっていない。かぶると別サービスにならない */
  for (const k of ["name", "shortName", "title", "notifyPrefix"] as const) {
    check(BRANDS[0][k] !== BRANDS[1][k], `${k} が二つの店で違う`);
  }
}

console.log("\n── 送信の住所は変えていない ──");
{
  /* ドメインを増やすと SPF・DKIM をもう一度通すことになる。
     通るまでメールが1通も届かない。名前だけ変える */
  const at = BRANDS.map((b) => b.mailFrom.replace(/^.*</, "").replace(/>$/, ""));
  check(new Set(at).size === 1, "差出人の住所は二つの店で同じ", at.join(" / "));
}

console.log("\n── 特別教育ドットコムに足場屋の文字が出ない ──");
{
  const t = BRANDS.find((b) => b.id === "tokubetsu")!;
  const words = [...Object.values(t).filter((v) => typeof v === "string") as string[], ...t.lead];
  for (const w of words) {
    check(!w.includes("足場"),
      `特別教育ドットコムの文字に「足場」が入っていない`, w);
  }
  check(!t.training, "特別教育ドットコムでは実務トレーニングを出さない");
  /* 業種を選ばないので、どれかを大きく出すと、その業種以外には邪魔になる。
     足場も含めて平らに並べ、探す窓ひとつで選んでもらう */
  check(t.flatList, "特別教育ドットコムは、足場も含めて一覧＋探す窓にする");
}

console.log("\n── 足場屋革命は、いままでのまま ──");
{
  const a = BRANDS.find((b) => b.id === "ashibaya")!;
  check(a.name === "足場屋革命", "名前", a.name);
  check(a.shortName === "足場屋革命", "ホーム画面の名前", a.shortName);
  check(a.eyebrow === "ASHIBAYA KAKUMEI", "英字", a.eyebrow);
  check(a.title === "足場屋革命｜特別教育・職長教育と実務トレーニング", "タブの題", a.title);
  check(a.manifestName === "足場屋革命｜足場の特別教育と実務トレーニング",
    "ホーム画面に追加するときの名前", a.manifestName);
  check(a.mailFrom === "足場屋革命 <noreply@ashibase.jp>", "メールの差出人", a.mailFrom);
  check(a.notifyPrefix === "足場屋革命", "知らせの頭", a.notifyPrefix);
  check(a.training, "実務トレーニングを出す");
  check(!a.flatList, "足場と職長は大きな札のまま");
}

console.log("\n── 名前を決め打ちで書き残していないか ──");
{
  /* 画面やメールに「足場屋革命」と直に書くと、特別教育ドットコムでも
     そのまま出る。名前は brand.ts から取る。
     （changelog と講座の中身は、書かれた当時の記録なので見ない） */
  const files = (readdirSync(new URL("../src/", import.meta.url), { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(`${f}`))
    .map((f) => `src/${f}`)
    .filter((f) => !f.includes("content/brand.ts")
      && !f.includes("content/changelog.ts")
      && !f.includes("content/courses/"));
  for (const f of files) {
    const src = code(f);
    check(!/["'`][^"'`]*足場屋革命/.test(src),
      `${f}：「足場屋革命」を直に書いていない（brand.ts から取る）`);
  }
  check(files.length > 50, `見たファイルは ${files.length}本`);
}

console.log("\n── 平らな一覧の並び順 ──");
{
  /* COURSES の並びは足場屋革命の看板順で、足場がいちばん上にある。
     そのまま出すと、塗装屋さんが開いて最初に見るのが足場になる。
     売り文句ではなく**法令（目録）の号順**に置く */
  const page = code("src/app/page.tsx");
  check(page.includes("flatOrder("), "平らな一覧は並べ替えてから渡す");
  check(page.includes("tokubetsuOfCourse"), "並べ替えは目録の号で決める");

  const ready = COURSES.filter((c) => c.ready);
  const sorted = [...ready].sort((a, b) =>
    (tokubetsuOfCourse(a.id)?.no ?? 0) - (tokubetsuOfCourse(b.id)?.no ?? 0));
  check(sorted[0].id !== "ashiba", "先頭が足場になっていない", sorted[0].id);
  /* 足場も必ず一覧に入っている（探して出る）。
     業種で講座を隠すと、受けられるはずの人が行き着けない */
  check(sorted.some((c) => c.id === "ashiba"), "足場も一覧に入っている");
  check(sorted.length === ready.length, "並べ替えで講座が減っていない");
  const nos = sorted.map((c) => tokubetsuOfCourse(c.id)?.no ?? 0);
  check(nos.every((n, i) => i === 0 || nos[i - 1] <= n), "号の小さい順に並んでいる");
}

console.log("\n── 売っていないものを、規約に書いていないか ──");
{
  /* **特別教育ドットコムは実務トレーニングを売っていない。**
     それなのに利用規約の書き出しが
     「…提供する教育（…）**および実務トレーニング**（以下「本サービス」）の
     利用条件を定めます」になっていた。
     個人情報の取扱いにも「実務トレーニングの成績」「端末に残る途中の状態」
     「預かるもの：実務トレーニングの記録」が並んでいた。

     **売っていないものの利用条件を、売る前に読ませることになる。**
     規約と特商法は買う前に読まれる文書なので、ここは実害がある。

     terms/page.tsx には前から同じ趣旨の注意書きがある
     （「対象の講座は決め打ちにしない。職長教育を売り始めたときに
       規約の対象から外れていた」）。**店でも決め打ちにしない。** */
  const terms = code("src/app/legal/terms/page.tsx");
  check(!/および実務トレーニング（以下/.test(terms),
    "規約の書き出しで実務トレーニングを決め打ちにしていない");
  check(terms.includes("BRAND.training"), "規約は店で出し分ける");

  const priv = code("src/app/legal/privacy/page.tsx");
  check(priv.includes("BRAND.training"), "個人情報の取扱いも店で出し分ける");
  check(priv.includes("TRAINING_DATA"),
    "**預かるものの一覧**も店で出し分ける（売っていない物を預かると書かない）");

  /* 一覧そのものに混ぜ戻していないか。混ぜると出し分けが効かない */
  const legal = code("src/content/legal.ts");
  const pd = legal.slice(legal.indexOf("PERSONAL_DATA"), legal.indexOf("THIRD_PARTIES"));
  check(!pd.includes("実務トレーニング"),
    "PERSONAL_DATA に実務トレーニングを混ぜ戻していない");
}

console.log("\n── 平らな店でも、押して開く ──");
{
  /* 73講座を平らに並べると、開いた瞬間に画面が札で埋まる。
     実測で縦 13,982px（スマホ17画面ぶん）。**その下に置いた
     「はじめかた」やお知らせに、誰も辿り着かない。**
     足場屋革命の「その他特別教育」と同じく、押して開く形にした
     （げんきさん 2026-09-07）。閉じていれば 812px＝1画面。 */
  const drawer = code("src/components/CourseDrawer.tsx");
  check(drawer.includes("<details"), "開け閉めは details（JS が動かなくても開く）");
  check(drawer.includes("<OtherCourses"), "中身は OtherCourses に任せる");
  /* ここで札を並べると、探す窓が札の下に来る（一度やらかしている） */
  check(!/\bready\.map\(/.test(drawer), "CourseDrawer が自分で札を並べていない");

  for (const f of ["src/app/page.tsx", "src/app/edu/page.tsx"]) {
    const src = code(f);
    check(src.includes("<CourseDrawer"), `${f}：平らな店では押して開く`);
    /* 開きっぱなしに戻していないか */
    check(!/<OtherCourses[^>]*\bready=\{(flatOrder|byLaw)/.test(src),
      `${f}：講座をいきなり並べていない（CourseDrawer に渡す）`);
  }
}

console.log("\n── 受講リクエストの入口 ──");
{
  /* 受講リクエストの仕組み（0025）は前からあり、両方の店で同じコード。
     足りていなかったのは**入口**で、/join への案内が
     「席が無い人」にしか出ていなかった。

     73講座あるのに、**席を1つ持っている人には行き先が無い。**
     「次はこれも受けたい」と思っても、押す所がどこにも無かった。
     とくに特別教育ドットコムはお客さんが全業種にまたがるので、
     石綿を受けた会社が次に酸欠を要る、が当たり前に起きる。

     **両方の店で出す。**はじめは特別教育ドットコムだけにしたが、
     講座が73本あるのは足場屋革命も同じで、足場を受けた人が石綿を
     受けたいときに行き先が無いのは変わらなかった（げんきさん 2026-09-07）。
     ここは店で分けない。分けると片方の穴が残る。 */
  const cards = code("src/components/HomeCards.tsx");
  check(cards.includes('data-testid="home-request"'), "リクエストの入口の札がある");
  check(/me\.canLearn && me\.member === "active"/.test(cards),
    "**席を持っている人**に出す（席が無い人には受講コードの札が出る）");
  /* ここを店で分けない。分けると片方の店に穴が残る */
  check(!/BRAND[\s\S]{0,60}home-request/.test(cards) && !cards.includes("BRAND"),
    "受講リクエストの入口は店で分けない（両方の店で出す）");
  check(/!me\.admin/.test(cards.slice(cards.indexOf("home-request") - 400, cards.indexOf("home-request"))),
    "教育担当者には出さない（自分に頼むことになる）");
  check(cards.includes('href="/join"'), "行き先は受講コードの画面（そこにリクエストが出る）");

  /* 札が二重に出ないこと。席が無い人には home-seat、
     席がある人には home-request。両方に当てはまる状態は無い */
  check(cards.indexOf("home-request") < cards.indexOf("home-seat"),
    "リクエストの札は、受講コードの札より前に置く（条件が重ならない）");
}

console.log("\n── 講座は両方の店で同じ ──");
{
  /* 分けているのは売り先であって、中身ではない。
     法令で決まった講座なので、業種で中身が変わることはない。
     修了証も同じ様式・同じ発行者 */
  const ready = COURSES.filter((c) => c.ready);
  check(ready.length > 70, `受けられる講座は ${ready.length}本（両方の店で同じ）`);
  const page = code("src/app/page.tsx");
  check(page.includes("BRAND.flatList"), "並べ方は店で分ける");
  check(page.includes("BRAND.training"), "実務トレーニングの札は店で分ける");
  /* 講座そのものを店で絞っていないこと。絞ると、
     足場屋さん以外が石綿を受けられない、のような穴が開く */
  check(!/BRAND[\s\S]{0,80}COURSES\.filter/.test(page),
    "講座そのものを店で絞っていない（絞ると受けられない講座ができる）");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
