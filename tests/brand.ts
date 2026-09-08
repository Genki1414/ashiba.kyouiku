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
    /* **短い名前は、長い名前の一部にすること。**

       別の綴りにすると、ホーム画面のアイコンの下だけ違う名前になり、
       押した人が「これは何のアプリだったか」と迷う。
       実際にそうなっていた（特別教育ドットコムなのに
       アイコンの下は「特別教育.com」。2026-09-08）。

       **これは本番の作りでしか出なかった**（manifest は
       出来上がった配信を見ないと読めない）ので、ここでも見る。 */
    check(b.manifestName.includes(b.shortName),
      `${b.id}: 短い名前は、ホーム画面に入れる名前の一部`, `${b.shortName} ⊂ ${b.manifestName}`);
    check(b.name.includes(b.shortName) || b.shortName.includes(b.name),
      `${b.id}: 短い名前とサービス名がずれていない`, `${b.shortName} / ${b.name}`);
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
  /* ここを店で分けない。分けると片方の店に穴が残る。

     この画面で BRAND を使ってよいのは、実務トレーニングの一文だけ
     （足場屋革命だけの売り物なので、売っていない店では出さない）。
     リクエストの札そのものを店で分けたら止める。 */
  {
    const i = cards.indexOf("home-request");
    /* 札の条件（直前）と中身（直後）に BRAND が入っていないこと */
    check(!cards.slice(i - 500, i + 900).includes("BRAND"),
      "受講リクエストの入口は店で分けない（両方の店で出す）");
    const uses = [...cards.matchAll(/BRAND\.(\w+)/g)].map((m) => m[1]);
    check(uses.every((u) => u === "training"),
      `この画面で店ごとに変えてよいのは実務トレーニングだけ（${[...new Set(uses)].join("・") || "無し"}）`);
  }
  check(/!me\.admin/.test(cards.slice(cards.indexOf("home-request") - 400, cards.indexOf("home-request"))),
    "教育担当者には出さない（自分に頼むことになる）");
  check(cards.includes('href="/join"'), "行き先は受講コードの画面（そこにリクエストが出る）");

  /* 札が二重に出ないこと。席が無い人には home-seat、
     席がある人には home-request。両方に当てはまる状態は無い */
  check(cards.indexOf("home-request") < cards.indexOf("home-seat"),
    "リクエストの札は、受講コードの札より前に置く（条件が重ならない）");
}

console.log("\n── 断られたその場から送れるか ──");
{
  /* **ホームの札1枚では足りなかった。**

     いちばん「受けたい」と思うのは、講座を押して受講コードが要ると
     断られた瞬間（NeedSeat）。そこに送る所が無く、/join まで行って
     73講座の中からさっき見ていた講座を探し直すことになっていた。
     講座を平らに73本並べる店（特別教育ドットコム）では特にきつい。

     ホームの札は**席を持っている人**にしか出ないので、
     まだ席が1つも無い人には、どこにも入口が無かった。 */
  const seat = code("src/components/NeedSeat.tsx");
  check(seat.includes("<RequestCourse />"), "受講コードが要る画面に、送る所がある");
  const req = code("src/components/RequestCourse.tsx");
  check(req.includes('data-testid="need-seat-request-send"'), "送る釦がある");
  check(req.includes('"/api/course-request"'), "送り先は受講リクエストの口");
  /* どの講座かを持って送る。持たずに送ると、担当者の画面に
     「何かを受けたい」としか出ない */
  check(/courseId:\s*course\.id/.test(req), "**見ていた講座を持って送る**");
  check(req.includes("usePathname"), "どの講座かは住所から取る（/edu/<講座>）");
  /* 席そのものはここで作らない。作れると、金額を見ないまま売り物が出る。
     叩く口が受講リクエストの1本だけであることで見る */
  {
    const hit = [...req.matchAll(/fetch\(\s*["'`]([^"'`]+)/g)].map((m) => m[1]);
    check(hit.length > 0 && hit.every((u) => u === "/api/course-request"),
      `席そのものはここで作らない。叩く口は受講リクエストだけ（${hit.join("・") || "無し"}）`);
  }
  /* 在籍していないと誰宛か決まらない。黙って消さず、次にやることを出す */
  check(req.includes('data-testid="need-seat-request-none"'),
    "会社とつながっていない人には、先に何をするかを出す");
  /* もう送ってある人に、同じ釦をもう一度出さない */
  check(req.includes('data-testid="need-seat-request-sent"'), "送ってあるときは、そう出す");
  /* この入口も店で分けない（ホームの札と同じ考え方） */
  check(!req.includes("BRAND"), "送る所は店で分けない（両方の店で出す）");
}

console.log("\n── 売っていないものへ連れて行かないか ──");
{
  /* 特別教育ドットコムは実務トレーニングを売っていない。
     2026-09-07 に利用規約と個人情報の取扱いからは外したが、
     **画面と道はそのままだった。**

     ・受講コードが要る画面が「実務トレーニングの第1章は…」と勧めていた
     ・/training も /train（申し込み）も、住所を打てば開いた
     ・お知らせの一覧の下に「章の一覧へ」が出ていた

     規約が対象にしていないものを、有料で売れる状態だった。 */
  const seat = code("src/components/NeedSeat.tsx");
  check(/BRAND\.training &&[\s\S]{0,200}need-seat-train/.test(seat),
    "受講コードが要る画面：実務トレーニングは売っている店でだけ勧める");

  /* 札を消すだけでは足りない。住所を打てば開けてしまう */
  const tl = code("src/app/training/layout.tsx");
  check(/if \(!BRAND\.training\) notFound\(\)/.test(tl),
    "**/training は、売っていない店では 404**（札を消すだけでは開ける）");
  const trn = code("src/app/train/page.tsx");
  check(/if \(!BRAND\.training\) notFound\(\)/.test(trn),
    "**/train（申し込み）も、売っていない店では 404**");

  const up = code("src/app/updates/page.tsx");
  check(/BRAND\.training &&[\s\S]{0,200}href="\/training"/.test(up),
    "お知らせの一覧：章の一覧へ の札も店で分ける");

  /* 名簿もデータベースも両方の店で同じ。足場屋革命で利用権を買った人が
     特別教育ドットコムを開くと、行き先の無い知らせが出ていた */
  const nt = code("src/app/api/notices/route.ts");
  check(nt.includes('neq("kind", "train")'),
    "実務トレーニングの知らせは、売っている店でだけ出す");
  check((nt.match(/neq\("kind", "train"\)/g) ?? []).length >= 2,
    "**数える方からも外す**（1件と出るのに開くと空、を出さない）");

  /* 画面の外に道が残っていないか。/training への直の行き先を数える */
  const outside = [
    "src/components/NeedSeat.tsx",
    "src/app/updates/page.tsx",
    "src/app/page.tsx",
    "src/app/manifest.ts",
  ];
  for (const f of outside) {
    const src = code(f);
    if (!/["'`]\/train/.test(src)) continue;
    check(src.includes("BRAND.training"),
      `${f}：実務トレーニングへの行き先を店で分けている`);
  }
}

console.log("\n── 売っていないものの口も閉じているか ──");
{
  /* **画面を 404 にしても、口が開いていれば住所を直接叩ける。**
     扉を閉めて窓を開けたままにしない（2026-09-08）。
     とくに /api/train-order は**注文を立てる口**で、
     開いていると、あの店の利用規約が対象にしていない売り物の
     請求書が本当に出てしまう。 */
  for (const f of [
    "src/app/api/train-order/route.ts",
    "src/app/api/training/route.ts",
    "src/app/api/training/view/route.ts",
  ]) {
    const src = code(f);
    const handlers = (src.match(/export async function (?:GET|POST)\(/g) ?? []).length;
    const guards = (src.match(/if \(!BRAND\.training\) return closed\(\);/g) ?? []).length;
    check(handlers > 0 && guards === handlers,
      `${f}：口が ${handlers} 本、どれも売っていない店では閉じる（いま ${guards} 本）`);
  }

  /* 担当者の名簿に、売っていないものの成績を並べない */
  const lc = code("src/app/admin/LearnerCard.tsx");
  check(/BRAND\.training \|\| c\.k !== "training"/.test(lc),
    "担当者の名簿：売っていない店では実務トレーニングの札を出さない");
  check(!lc.includes('grid-cols-3" data-testid="admin-tabs"'),
    "札の数を決め打ちにしていない（1枠空く）");

  /* 端末に残るものの説明が、その店の個人情報の取扱いと食い違わないこと */
  const me = code("src/app/me/MeClient.tsx");
  check(/BRAND\.training \? "・実務の成績"/.test(me),
    "マイページ：端末に残るものの書き方を店で分ける（規約と食い違わせない）");
}

console.log("\n── よその店へ客を飛ばしていないか ──");
{
  /* **見つけたとき、実際にそうなっていた（2026-09-08）。**

     合言葉の決め直しは、メールのリンクで戻ってくる。その戻り先は
     src/lib/siteUrl.ts に**足場屋革命の住所が1つ**書いてあるだけだった。
     特別教育ドットコムには NEXT_PUBLIC_SITE_URL をまだ入れていないので、
     **あの店で合言葉を決め直した人が、足場屋革命に着いていた。**
     LINE の知らせのリンクも同じ所を読む（src/lib/notify.server.ts）。

     住所は店ごとに持つ。決まっていない店は空で、
     そのときは「いま開いている住所」へ戻す（よそへは送らない）。 */
  const sites = BRANDS.map((b) => [b.id, b.site] as const);
  for (const [id, site] of sites) {
    if (!site) { check(true, `${id}：住所はまだ決めていない（空。いま開いている住所へ戻す）`); continue; }
    check(site.startsWith("https://"), `${id}：住所は https（${site}）`);
    check(!site.endsWith("/"), `${id}：末尾に / を付けない（つなぐと // になる）`);
    check(!site.includes("vercel.app"), `${id}：配信ごとに変わる住所を決め打ちにしない`);
    check(!site.includes("localhost"), `${id}：手元の住所を決め打ちにしない`);
  }
  /* **同じ住所を2つの店が持たない。**持つと、片方の店の客が
     もう片方に着く。空どうしは数えない（まだ決めていないだけ） */
  const set = sites.map(([, v]) => v).filter(Boolean);
  check(new Set(set).size === set.length,
    `店ごとに別の住所（${set.join("・") || "決まっているのは無し"}）`);

  /* 住所をコードに1つだけ書き戻したら止める */
  const su = code("src/lib/siteUrl.ts");
  check(su.includes("BRAND.site"), "戻り先は店ごとの住所から取る");
  check(!/FALLBACK_SITE\s*=\s*["']https/.test(su),
    "**住所を1つ決め打ちで書き戻していない**（書き戻すと、また片方の店の客がよそへ着く）");
  /* 空のときに、よその店の住所を借りない */
  check(/FALLBACK_SITE \|\| o/.test(su),
    "住所が決まっていない店では、いま開いている住所へ戻す");

  /* /setup で気づけること。直すまで橙で出す */
  const h = code("src/app/api/health/route.ts");
  check(h.includes("brandSite"), "この店の住所を /setup へ渡している");
  const st = code("src/app/setup/SetupClient.tsx");
  check(st.includes("brandSite"), "/setup がこの店の住所を出す");
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
