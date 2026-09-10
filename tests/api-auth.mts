/* すべての入口（/api/…）に、見張りが付いているか。実行: npx tsx tests/api-auth.mts

   ── なぜ要るか ──
   げんきさん（2026-09-09）「まだまだリリース出来る状態じゃないね 全ての穴を無くして」。

   画面を塞いでも、入口が開いていれば道具で直接叩ける。
   入口は52本あり、**1本ずつ目で見て回るのは続かない。**
   足したときに必ず落ちる形にして、機械に見張らせる。

   ここが見るのは「見張りを呼んでいるか」まで。
   中身が正しいかは、それぞれの試験（admin-db・auth-gate・line ほか）が見る。 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = new URL("../src/app/api/", import.meta.url).pathname;

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };
/** 書いてある理由（コメント）は、検査の対象から外す */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/* ── 誰でも叩いてよい入口 ──
   足すときは、**なぜ開けてよいのか**をここに書くこと。
   書かずに足せば、下の検査で落ちる。 */
const PUBLIC: Record<string, string> = {
  "health/route.ts":       "接続の確認。鍵は返さない。ログインできないときにこそ開く必要がある",
  "verify-cert/route.ts":  "修了証の照会。元請や監督署が番号を確かめる。名前は伏せ字",
  "tokubetsu/route.ts":    "特別教育の目録。法令で決まっていて誰でも読めるもの。個人情報も値段も無い",
  "drill-record/route.ts": "実技の実施記録の様式。白紙の用紙。個人情報は入らない",
  "line/login/route.ts":   "LINEログインの入口。**まだ入っていない人が押す**ので閉じられない",
  "signout/route.ts":      "ログアウト。入っていない人が叩いても何も起きない",
  "line/webhook/route.ts": "LINE から届く。向こうはログインを持たない。代わりに署名を確かめる",
  "stripe/webhook/route.ts": "Stripe から届く。同上。署名を確かめる",
  "handoff/use/route.ts":  "ログインの引き継ぎ。**入っていない人が叩く**ので閉じられない。見張りはコードそのもの（1回きり・5分）",
};

/* 見張りと認められる呼び出し */
const GUARDS = [
  "currentOwner(",      // 運営だけ
  "currentAdmin(",      // 教育担当者だけ
  "currentEnrollment(", // その講座の受講コードを持っている本人だけ
  "canLearn(",
  "canTrain(",
  "currentUser(",       // ログインしている本人だけ
  "verifyLineSignature(",
  "stripe.webhooks",
  "constructEvent",
];

const routes: string[] = [];
const walk = (dir: string, rel = "") => {
  for (const e of readdirSync(dir)) {
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) walk(full, path.join(rel, e));
    else if (e === "route.ts") routes.push(path.join(rel, e));
  }
};
walk(ROOT);

console.log(`── 入口 ${routes.length}本 ──`);
check(routes.length >= 50, `入口が見つかる（${routes.length}本）`);

for (const r of routes) {
  const src = readFileSync(path.join(ROOT, r), "utf8");
  const guarded = GUARDS.some((g) => src.includes(g));
  const why = PUBLIC[r];
  if (why) {
    /* 開けてある入口。**理由が書いてあること**だけを見る */
    check(why.length > 10, `${r} 開けてある理由が書いてある`);
  } else {
    check(guarded, `${r} に見張りが無い（誰でも叩ける）`);
  }
}

console.log("\n── 開けてある入口の見直し ──");
{
  /* 消えた入口が並びっぱなしにならないように */
  for (const r of Object.keys(PUBLIC)) {
    check(routes.includes(r), `${r} は実在する（消えた入口が残っていないか）`);
  }
}

console.log("\n── 記録を書く所は、その講座の受講コードで通す ──");
{
  /* 画面を塞いでも、ここが開いていれば道具で直接叩ける。
     見るのは currentEnrollment。**中で canLearn を通している** */
  const en = readFileSync(new URL("../src/lib/enrollment.ts", import.meta.url), "utf8");
  check(/canLearn\(courseId\)/.test(en), "受講の宛先を作る前に、その講座の権利を見る");
  check(/requireSeat/.test(en), "例外は名前を付けて渡す（黙って素通ししない）");

  /* 例外は実務トレーニングだけ。増えていたら気づけるようにする */
  const users = routes.filter((r) =>
    readFileSync(path.join(ROOT, r), "utf8").includes("requireSeat: false"),
  );
  check(
    users.length === 2 && users.every((r) => r.startsWith("training")),
    `素通しを許しているのは実務トレーニングだけ（${users.join(" ") || "なし"}）`,
  );
}

console.log("\n── 学科の画面 ──");
{
  /* ── 頁ごとに見張る（2026-09-10）──
     げんきさん「実技の手引きが出る講座と出ずに受講ページへ遷移する
     講座とがある。必ず実技の手引きを出すことにして」。

     まとめて layout で見張っていたら、**公開のはずの実技の手引きまで
     塞いでいた。**手引きは実技を行う会社の人が見るもので、
     受講コードを持っているのは受ける本人。持っていない人が開く画面だった。

     頁ごとに置くと忘れる。だから**ここで数える。**
     新しく頁を足したら、見張るか、開ける理由を書くまで落ちる。 */
  const dir = new URL("../src/app/edu/[courseId]/", import.meta.url).pathname;
  const pages: string[] = [];
  const walk2 = (d: string, rel = "") => {
    for (const e of readdirSync(d)) {
      const full = path.join(d, e);
      if (statSync(full).isDirectory()) walk2(full, path.join(rel, e));
      else if (e === "page.tsx") pages.push(path.join(rel, e));
    }
  };
  walk2(dir);
  check(pages.length >= 6, `講座の下の画面が見つかる（${pages.length}枚）`);

  /* 開けてある画面。**なぜ開けてよいのかを書くこと** */
  const OPEN_PAGES: Record<string, string> = {
    "drill/page.tsx":
      "実技の手引き。実技は事業者が自社で行うので、**受講コードを持っていない会社の人が見る。**中身は公開情報（何を何分やるか・記録の様式）",
  };

  for (const pg of pages) {
    const src = readFileSync(path.join(dir, pg), "utf8");
    const why = OPEN_PAGES[pg];
    if (why) check(why.length > 10, `${pg} 開けてある理由が書いてある`);
    else check(/canLearn\(courseId\)/.test(src), `${pg} に見張りが無い`);
  }
  for (const pg of Object.keys(OPEN_PAGES)) {
    check(pages.includes(pg), `${pg} は実在する（消えた画面が残っていないか）`);
  }

  /* まとめて見張る所は、もう置かない（また手引きを塞ぐ）。

     **外側（/edu）も見る。**内側から外したのに外側に残っていたので、
     本番ではまだ手引きが塞がっていた（2026-09-10 に見つけた）。
     外側は「1枚でも持っているか」しか見られないので、
     甘すぎ（他講座も通る）と厳しすぎ（手引きを塞ぐ）を同時にやる */
  for (const f of [
    "src/app/edu/[courseId]/layout.tsx",
    "src/app/edu/layout.tsx",
  ]) {
    const lay = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    check(!/canLearn/.test(strip(lay)), `${f} では見張らない（手引きを塞がない）`);
  }
}

console.log("\n── ログインの引き継ぎ（0036）──");
{
  const use = readFileSync(path.join(ROOT, "handoff/use/route.ts"), "utf8");
  check(/use_handoff/.test(use), "コードは SQL 側で消す（1回きり）");
  check(!/そんなコード|切れて/.test(strip(use)), "断り方を書き分けない（当てずっぽうの手がかりを与えない）");
  const make = readFileSync(path.join(ROOT, "handoff/route.ts"), "utf8");
  check(/currentUser\(/.test(make), "コードを作れるのは、入っている本人だけ");

  /* 見張りの手前で止まっていないか。LINE で同じ轍を踏んだ */
  const gate = readFileSync(new URL("../src/lib/authGate.ts", import.meta.url), "utf8");
  check(/"\/api\/handoff\/use"/.test(gate), "引き継ぎの入口は、ログインの手前で通す");
  check(!/"\/api\/handoff"[,\s]/.test(gate), "コードを作るほうは閉じたまま");
}

console.log("\n── 設定が欠けても、本番では開けない ──");
{
  /* げんきさん（2026-09-09）「受講コードが無いのに開けてはダメだよ」。
     設定を1つ間違えただけで73講座が誰にでも開く、という壊れ方をしていた。
     止まっているほうが、タダで配られるよりまし */
  const ent = readFileSync(new URL("../src/lib/entitle.ts", import.meta.url), "utf8");
  check(/process\.env\.VERCEL/.test(ent), "学科は、本番で設定が欠けたら閉じる");
  check(
    ent.indexOf("process.env.VERCEL") < ent.indexOf('by: "open"'),
    "閉じる判断が、通す判断より先に来る",
  );
  const tr = readFileSync(new URL("../src/lib/training.ts", import.meta.url), "utf8");
  check(/process\.env\.VERCEL/.test(tr), "実務トレーニングも、本番で設定が欠けたら閉じる");
  const srv = readFileSync(new URL("../src/lib/supabase/server.ts", import.meta.url), "utf8");
  check(/VERCEL[\s\S]{0,60}DEV_ENROLLMENT_ID/.test(srv), "手元用の仮受講は、本番では無視する");
}

console.log("\n── 無償利用は撤廃されているか ──");
{
  const files = [
    "../src/lib/entitleQuery.ts",
    "../src/lib/trainingGate.ts",
  ];
  for (const f of files) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    check(!/trial/.test(code), `${f} で無償利用を見ていない`);
  }
  const sql = readFileSync(new URL("../supabase/apply-all.sql", import.meta.url), "utf8");
  check(
    sql.lastIndexOf("v_trial") < sql.lastIndexOf("0035"),
    "修了証の見張りから、無償利用の抜け道が外れている（0035 が最後）",
  );
}

console.log(`\n${ok} 件通過 / ${ng} 件失敗`);
process.exit(ng ? 1 : 0);
