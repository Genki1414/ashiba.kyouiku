/* 申込の知らせの決まり。
   実行: npm run test:notify */

import { readFileSync } from "node:fs";
import { checkNotify, kindText, notifyText, type NotifyKind } from "../src/lib/notifyText";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`); }
};
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const SITE = "https://kyouiku.ashibase.jp";
const KINDS: NotifyKind[] = ["member", "order", "cert", "train", "company"];

console.log("── 本文に何を書くか ──");
{
  for (const k of KINDS) {
    const t = notifyText(k, SITE);
    check(t.includes("足場屋革命"), `${k}: どこから来た知らせか分かる`);
    check(t.includes(kindText(k)), `${k}: 何の申込か分かる`, t.split("\n")[0]);
    check(t.includes(SITE), `${k}: 開く場所が入っている`);
    check(checkNotify(t).ok, `${k}: 送れる形`);
    /* 押した先が、実際に手を動かす画面であること。
       ホームに送ると、そこから探し直すことになる */
    check(/https:\/\/\S+\/(admin|owner)\b/.test(t), `${k}: 画面まで案内する`, t);
  }
  /* 件数。1件のときに「1件」、まとめたときに数を出す */
  check(notifyText("member", SITE).includes("1件"), "1件のときは1件");
  check(notifyText("member", SITE, 3).includes("3件"), "まとめたときは数を出す");
}

console.log("\n── 個人情報を送らない ──");
{
  /* LINE はよその会社の仕組み。氏名を流せば第三者提供になり、
     ロック画面に人の名前が出る。誰かはアプリを開けば分かる */
  for (const k of KINDS) {
    const t = notifyText(k, SITE);
    for (const ng2 of ["氏名", "様", "さん", "@"]) {
      check(!t.includes(ng2), `${k}: 「${ng2}」を含まない`, t);
    }
  }
  /* 本文を作る所に、人や会社を**渡す口**が無いこと。
     引数が増えると、そのうち誰かが名前を入れる。
     （"company" は申込の種類の名前なので、字面で探すと引っかかる。
       受け口そのものを見る） */
  const src = code("src/lib/notifyText.ts");
  const sig = /export function notifyText\(([^)]*)\)/.exec(src)?.[1] ?? "";
  check(!!sig, "notifyText の受け口が読める", sig);
  /* 「n = 1」のような既定値も剥がしてから名前を見る */
  const args = sig
    .split(",")
    .map((a) => a.split(/[:=]/)[0].trim())
    .filter(Boolean);
  check(
    args.length === 3 && args[0] === "k" && args[1] === "site" && args[2] === "n",
    "受け取るのは 種類・住所・件数 の3つだけ",
    args.join(" / "),
  );
  /* 型にも人や会社を入れられないこと */
  check(!/name\s*[:?]|email\s*[:?]|user\s*[:?]/i.test(src),
    "型に氏名やメールの欄が無い");

  /* 個人情報の取扱いの第三者提供に LINE を足していないこと。
     足す必要が無い作りにした、というのがこの決まりの意味 */
  const legal = read("src/content/legal.ts");
  const tp = legal.slice(legal.indexOf("THIRD_PARTIES"), legal.indexOf("THIRD_PARTIES") + 400);
  check(!tp.includes("LINE"), "第三者提供に LINE を足さずに済んでいる");
}

console.log("\n── 送れない形をはじく ──");
{
  check(!checkNotify("").ok, "空は送らない");
  check(!checkNotify("   ").ok, "空白だけも送らない");
  const noUrl = checkNotify("【足場屋革命】参加申込が1件");
  check(!noUrl.ok && noUrl.reason.includes("開く場所"), "行き先が無ければ送らない");
  check(!checkNotify("https://x.jp " + "あ".repeat(5000)).ok, "長すぎる本文は送らない");
  /* http の行き先は作らない。site が壊れていたら気づけるように */
  check(!checkNotify("参加申込 http://kyouiku.ashibase.jp/admin").ok, "https でなければ送らない");
}

console.log("\n── 送る所の作り ──");
{
  const s = code("src/lib/notify.server.ts");
  check(s.includes('import "server-only"'), "画面から読めないようにしてある");
  /* 鍵に NEXT_PUBLIC_ を付けると画面に埋まって、誰でも運営の
     アカウントから送れるようになる */
  check(!s.includes("NEXT_PUBLIC_LINE"), "鍵に NEXT_PUBLIC_ を付けていない");
  check(s.includes("LINE_TOKEN") && s.includes("LINE_TO"), "鍵と宛先を環境変数から読む");
  /* 知らせが送れなくても、申込そのものは通す */
  check(s.includes("catch"), "失敗を握りつぶす");
  check(s.includes("AbortSignal.timeout"), "待ち時間に上限がある");
  check(!/throw/.test(s), "呼んだ側に例外を投げない");
  check(s.includes("api.line.me"), "LINE の push へ送る");

  /* 設定していなければ、何もせず false。手元で動かすとき */
  check(s.includes("if (!token || !to) return false"), "未設定なら何もしない");
}

console.log("\n── どこから知らせるか ──");
{
  /* 運営が手を動かさないと先へ進まない所すべてから知らせること。
     1つでも抜けると、そこだけ気づけない */
  const hooks: [string, NotifyKind][] = [
    ["src/app/api/member/route.ts", "member"],
    ["src/app/api/order/route.ts", "order"],
    ["src/app/api/issue/route.ts", "cert"],
    ["src/app/api/train-order/route.ts", "train"],
    ["src/app/api/admin/setup/route.ts", "company"],
  ];
  for (const [p, k] of hooks) {
    const c = code(p);
    check(c.includes(`notify("${k}")`), `${p}: ${kindText(k)} を知らせる`);
    check(c.includes('from "@/lib/notify.server"'), `${p}: server 側から呼ぶ`);
  }
  check(hooks.length === KINDS.length, "知らせる種類と、知らせる所の数が合っている");
}

console.log("\n── /setup に出す ──");
{
  const h = code("src/app/api/health/route.ts");
  check(h.includes("notifyReady()"), "設定済みかどうかを返す");
  const st = code("src/app/setup/SetupClient.tsx");
  check(st.includes("h.sell.notify"), "画面に出す");
  check(st.includes("LINE_TOKEN"), "入れる変数の名前を出す");
  /* 無くても売れる。「！」にすると、本当に困る橙が埋もれる */
  const row = st.slice(st.indexOf("申込の知らせ"), st.indexOf("申込の知らせ") + 300);
  check(row.includes("false,"), "「！」にはしない（無くても売れる）");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
