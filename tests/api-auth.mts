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
  const gate = readFileSync(
    new URL("../src/app/edu/[courseId]/layout.tsx", import.meta.url), "utf8",
  );
  check(/canLearn\(courseId\)/.test(gate), "講座ごとに見張っている");
  const lesson = readFileSync(
    new URL("../src/app/edu/[courseId]/[lessonId]/page.tsx", import.meta.url), "utf8",
  );
  check(/canLearn\(courseId\)/.test(lesson), "単元の本文でも、講座ごとに見張っている");
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
