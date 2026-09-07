/* 講座の一覧の決まり。
   実行: npm run test:menu

   特別教育は種類が増えていく。足すたびにそのまま並べると、
   足場を受けに来た人が長い一覧から探すことになる。
   これから足す特別教育は「その他特別教育」を開いてから選ぶ。 */

import { readFileSync, readdirSync } from "node:fs";
import {
  COURSES,
  KIND_TEXT,
  hoursText,
  kindOf,
  menuOf,
  splitMenu,
  totalNoteOf,
  type CourseMeta,
} from "../src/content/courses";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`); }
};
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/* 試験のための作り物。本物の講座を書き換えずに仕分けを見る */
const fake = (id: string, menu?: "main" | "other"): CourseMeta =>
  ({ id, kind: "special", name: id, basis: "x", totalMin: 360, file: `${id}.json`, ready: true, menu }) as CourseMeta;

console.log("── どこに出すか ──");
{
  check(menuOf(fake("a")) === "main", "書いていなければ、そのまま並べる");
  check(menuOf(fake("a", "other")) === "other", "other なら「その他特別教育」の中");

  const g = splitMenu([fake("a"), fake("b", "other"), fake("c"), fake("d", "other")]);
  check(g.main.map((c) => c.id).join(",") === "a,c", "main だけ取り出せる", g.main.map((c) => c.id).join(","));
  check(g.other.map((c) => c.id).join(",") === "b,d", "other だけ取り出せる");
  /* 並べ替えると、足場をいちばん上に置いてある意味が無くなる */
  const g2 = splitMenu([fake("z", "other"), fake("a", "other")]);
  check(g2.other.map((c) => c.id).join(",") === "z,a", "COURSES の順のまま");
  const empty = splitMenu([]);
  check(!empty.main.length && !empty.other.length, "空でも落ちない");
}

console.log("\n── 見出しが嘘にならないか ──");
{
  /* 見出しが「その他特別教育」なので、ここへ入れてよいのは特別教育だけ。
     職長教育を入れると、見出しと中身が食い違う */
  for (const c of COURSES) {
    check(
      menuOf(c) === "main" || kindOf(c) === "special",
      `${c.id}: その他特別教育に入れてよいのは特別教育だけ`,
      `kind=${kindOf(c)}`,
    );
  }
  /* いまの2つは、どちらもそのまま並べる。
     足場は看板、職長は特別教育ではない */
  check(menuOf(COURSES.find((c) => c.id === "ashiba")!) === "main", "足場はそのまま並べる");
  check(menuOf(COURSES.find((c) => c.id === "shokucho")!) === "main", "職長はそのまま並べる");
}

console.log("\n── 一覧の書き方 ──");
{
  const page = code("src/app/edu/page.tsx");
  check(page.includes("splitMenu("), "仕分けは splitMenu を使う");
  check(page.includes("<details"), "開け閉めは details（JS が動かなくても開く）");
  check(page.includes("その他特別教育"), "見出しが出る");
  check(page.includes("others > 0"), "中身が無ければ開く所を出さない");

  /* 講座の札は1か所にまとめた（src/components/CourseCard.tsx）。
     出す場所が2つある（一覧の上と、「その他特別教育」を開いた中）ので、
     2か所に書くと、開く前と開いたあとで札の形が変わる */
  const card = code("src/components/CourseCard.tsx");
  /* 種類の決め打ちをやめる。職長教育のカードに「特別教育」と出ていた */
  check(!card.includes('"特別教育（学科）"'), "カードの種類を決め打ちにしていない");
  check(card.includes("KIND_TEXT[kindOf(c)]"), "種類は講座から出す");
  check(card.includes("totalNoteOf(c)"), "学科だけか、討議まで含むかも講座から出す");
  check(!card.includes("Math.floor(c.totalMin / 60)"), "時間の切り捨てをやめた");
  /* 札を書くのは1か所だけ。page 側に書き戻したら気づく */
  check(!page.includes("KIND_TEXT[kindOf(c)]"), "札を page.tsx に書き戻していない");

  /* 探す所は、いちばん上。71講座がここに並ぶので、下に置くと
     71枚めくらないと窓に届かない。そして上に出した窓は、
     下にある講座も探せなければ意味がない */
  const other = code("src/components/OtherCourses.tsx");
  const iSearch = other.indexOf('data-testid="other-search"');
  const iCard = other.indexOf("<CourseCard");
  check(iSearch > 0 && iCard > 0 && iSearch < iCard, "探す窓は、講座の札より上にある");
  check(other.includes("matchesCourse"), "受けられる講座も、同じ窓で絞る");
  check(other.includes("hitReady") && other.includes("hitSoon") && other.includes("hitTodo"),
    "受けられる講座・準備中・目録の3つとも絞る");
  check(!page.includes("r.other.map("), "その他の中身を page.tsx で並べていない（窓の下に来てしまう）");

  /* **「その他特別教育」を出す所は2つある。**講座の一覧（/edu）と、
     ホーム（OtherTokubetsu）。/edu だけ直して、ホームを直し忘れ、
     ホームでは窓が最下部のままになっていた。

     どちらか片方を直しても、もう片方が残る。だから
     **OtherCourses を出しているファイルを全部見て、
     そのファイルが自分で札を並べていないこと**を見る。
     札を並べるのは OtherCourses だけ。並べれば必ず窓の下に来る */
  const users = readdirSync(new URL("../src/", import.meta.url), { recursive: true })
    .filter((f) => `${f}`.endsWith(".tsx"))
    .map((f) => [`src/${f}`, code(`src/${f}`)] as const)
    .filter(([, src]) => /<OtherCourses\b/.test(src));
  check(users.length >= 2, `OtherCourses を出しているのは ${users.length}か所（2か所以上あるはず）`);
  for (const [name, src] of users) {
    check(/<OtherCourses\s+ready=/.test(src), `${name}：受けられる講座を OtherCourses に渡している`);
    /* 見るのは「その他」の一覧を回していないか。
       **OtherCourses に渡した物を、同じファイルで自分でも並べていないか**が芯。
       ホームは「その他」の外（足場・職長）でも札を出すので、
       その札まで止めない（mainCourses という別の名前にしてある） */
    check(!/\.other\.map\(/.test(src)
      && !/\bready\.map\(/.test(src)
      && !/\botherReady\.map\(/.test(src),
      `${name}：その他の中身を自分で並べていない（並べると窓の下に来る）`);
  }
}

console.log("\n── 時間の書き方 ──");
{
  /* Math.floor(min/60) だと、半端のある講座で法定時間を短く見せる */
  check(hoursText(360) === "6時間", "6時間", hoursText(360));
  check(hoursText(840) === "14時間", "14時間", hoursText(840));
  check(hoursText(390) === "6時間30分", "半端を切り捨てない", hoursText(390));
  check(hoursText(45) === "45分", "1時間未満", hoursText(45));
  check(hoursText(0) === "0分", "0でも落ちない", hoursText(0));
  check(hoursText(-10) === "0分", "負でも落ちない", hoursText(-10));
}

console.log("\n── いまの講座の見え方 ──");
{
  for (const c of COURSES.filter((x) => x.ready)) {
    const label = KIND_TEXT[kindOf(c)].label;
    check(!!label, `${c.id}: 種類の言い方がある`);
    check(!!totalNoteOf(c), `${c.id}: 学科か学科・討議かが出る`);
  }
  const sc = COURSES.find((c) => c.id === "shokucho")!;
  check(!KIND_TEXT[kindOf(sc)].label.includes("特別教育"), "職長のカードに特別教育と出ない");
  check(totalNoteOf(sc) === "学科・討議", "職長は討議まで含むと出る", totalNoteOf(sc));
  const as = COURSES.find((c) => c.id === "ashiba")!;
  check(totalNoteOf(as) === "学科", "足場は学科だけ");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
