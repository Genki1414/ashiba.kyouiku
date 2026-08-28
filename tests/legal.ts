/* 売るために要る表記の試験。
   ここが空のまま売ると、特定商取引法の表示義務を満たしません。
   実行: npx tsx tests/legal.ts */

import { PERSONAL_DATA, THIRD_PARTIES, invoiceOk, tidyInvoice, missingSeller, seller, tokushoho } from "@/content/legal";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

const ENVS = ["SELLER_CEO", "SELLER_ADDRESS", "SELLER_TEL", "SELLER_EMAIL", "SELLER_NAME", "SELLER_HOURS", "SELLER_CONTACT"];
const clear = () => { for (const e of ENVS) delete process.env[e]; };

console.log("── 何が空か分かる ──");
clear();
{
  const m = missingSeller();
  check(m.length === 4, `未設定が4つ（${m.join("・")}）`);
  for (const k of ["代表者", "所在地", "電話番号", "メールアドレス"]) {
    check(m.includes(k), `${k}が空だと分かる`);
  }
  check(seller().name === "東北三上機材株式会社", "事業者名は決まっている");
}
{
  process.env.SELLER_CEO = "中川 元基";
  process.env.SELLER_ADDRESS = "宮城県…";
  process.env.SELLER_TEL = "022-000-0000";
  process.env.SELLER_EMAIL = "info@example.jp";
  check(missingSeller().length === 0, "4つとも入れれば空は無くなる");
  const s = seller();
  check(s.ceo === "中川 元基" && s.tel === "022-000-0000", "入れた値が読める");
  process.env.SELLER_TEL = "   ";
  check(missingSeller().includes("電話番号"), "空白だけは未設定として扱う");
}
clear();

console.log("── 特商法の表記 ──");
{
  const items = tokushoho(3000);
  /* 決まりで載せるもの */
  for (const k of [
    "販売事業者", "代表者", "所在地", "電話番号", "メールアドレス",
    "販売価格", "商品代金以外の必要料金", "支払方法", "支払時期",
    "引渡し時期", "返品・キャンセル",
  ]) {
    check(items.some((i) => i.k === k), `「${k}」の欄がある`);
  }
  const price = items.find((i) => i.k === "販売価格")!;
  check(/税抜/.test(price.v) && /税込/.test(price.v), `税抜と税込の両方を出す（${price.v}）`);
  const back = items.find((i) => i.k === "返品・キャンセル")!;
  check(back.v.length > 30, "返品の決まりが書いてある");
  check(items.every((i) => i.k.length > 0), "見出しが空の欄は無い");
}
{
  /* 未設定の欄は、値が空のまま返る（画面が「未設定」と出せるように） */
  clear();
  const items = tokushoho(3000);
  check(items.find((i) => i.k === "所在地")!.v === "", "空の欄は空のまま返す");
  check(items.find((i) => i.k === "販売事業者")!.v !== "", "既定のある欄は埋まっている");
}

console.log("── 個人情報の表 ──");
check(PERSONAL_DATA.length >= 8, `預かるものが並んでいる（${PERSONAL_DATA.length}件）`);
check(
  PERSONAL_DATA.some((d) => d.k.includes("顔") && d.v.includes("結果")),
  "顔の照合は「結果と理由だけ」と書いてある",
);
check(
  !PERSONAL_DATA.some((d) => /映像|静止画|画像/.test(d.k)),
  "映像・画像を預かるとは書いていない（実際に保存していないため）",
);
check(THIRD_PARTIES.some((t) => t.k === "Stripe"), "Stripe を挙げている");
check(
  THIRD_PARTIES.find((t) => t.k === "Stripe")!.v.includes("カード番号"),
  "カード番号が当社を通らないことを書いてある",
);
check(THIRD_PARTIES.some((t) => t.k === "Supabase"), "Supabase を挙げている");

/* ── インボイス登録番号 ──
   課税事業者なら、請求書に載せないと相手が仕入税額控除を受けられない。
   免税事業者なら番号そのものが無いので、空で正しい。
   空を「未設定」と出すと、登録し忘れているように見えてしまう */
console.log("── インボイス登録番号 ──");
{
  const before = process.env.SELLER_INVOICE_NO;

  delete process.env.SELLER_INVOICE_NO;
  check(seller().invoiceNo === "", "登録していなければ空");
  check(invoiceOk(""), "空は通す（免税事業者）");
  check(
    !tokushoho(3000).some((i) => i.k.includes("登録番号")),
    "空のときは、特商法の表記に行ごと出さない",
  );
  check(
    !missingSeller().some((k) => k.includes("登録番号")),
    "空でも「特商法の未設定」には数えない",
  );

  process.env.SELLER_INVOICE_NO = "T1234567890123";
  check(seller().invoiceNo === "T1234567890123", "入れた番号が出る");
  check(invoiceOk("T1234567890123"), "T＋13桁は通る");
  {
    const row = tokushoho(3000).find((i) => i.k.includes("登録番号"));
    check(!!row, "入れたら、特商法の表記に行が出る");
    check(row?.v === "T1234567890123", `番号がそのまま出る（${row?.v}）`);
  }

  /* 打ち間違いを、そのまま請求書に載せない */
  check(!invoiceOk("1234567890123"), "T が無いものは通さない");
  check(!invoiceOk("T123456789012"), "12桁は通さない");
  check(!invoiceOk("T12345678901234"), "14桁は通さない");
  check(!invoiceOk("Tあいうえお"), "数字でないものは通さない");
  check(invoiceOk(" T1234567890123 "), "前後の空白は気にしない");

  if (before === undefined) delete process.env.SELLER_INVOICE_NO;
  else process.env.SELLER_INVOICE_NO = before;

  /* 打ち方の揺れは通す。国税庁の通知どおりに写せる人ばかりではない */
  check(invoiceOk("T-1234-5678-9012-3"), "ハイフン入りでも通る");
  check(invoiceOk("T 1234567890123"), "空白入りでも通る");
  check(invoiceOk("Ｔ１２３４５６７８９０１２３"), "全角でも通る");
  check(invoiceOk("t1234567890123"), "小文字の t でも通る");
  check(tidyInvoice("Ｔ－1234 5678-9012３") === "T1234567890123",
    `請求書に載る形にそろえる（${tidyInvoice("Ｔ－1234 5678-9012３")}）`);
  /* T は勝手に足さない。法人番号は登録していなくても誰にでもあるので、
     補うと「登録していない事業者の番号」を請求書に載せてしまう */
  check(!invoiceOk("1234567890123"), "13桁だけでは通さない（T は補わない）");
  check(tidyInvoice("1234567890123") === "1234567890123", "13桁だけなら、そのままにして直してもらう");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
