/* 値段の計算の試験。実行: npx tsx tests/pricing.ts */

import { DEFAULT_UNIT_PRICE, MAX_SEATS, TAX_RATE, dueDate, parseUnitPrice, quote, yen } from "@/lib/pricing";
import { DEFAULT_COURSE_PRICE, pickUnitPrice, priceEnvName } from "@/lib/pricing";
import { COURSES } from "@/content/courses";

/* 環境変数を読むのはサーバだけ（price.server.ts は server-only なので
   ここからは読み込めない）。決め方そのものは pricing.ts にあるので、
   値を渡して確かめる */
const unitPrice = (courseId?: string, own?: string, all?: string) =>
  pickUnitPrice({ courseId, own, all });

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

console.log("── 単価 ──");
/* 環境変数を読むのはサーバだけ（src/lib/price.server.ts）。
   ここでは、読んだ値の解釈だけを確かめる */
check(parseUnitPrice(undefined) === DEFAULT_UNIT_PRICE, `未設定なら仮の値（${DEFAULT_UNIT_PRICE}円）`);
check(parseUnitPrice("4500") === 4500, "設定してあればその値");
check(parseUnitPrice("へんな値") === DEFAULT_UNIT_PRICE, "数字でなければ仮の値に戻す");
check(parseUnitPrice("-100") === DEFAULT_UNIT_PRICE, "負の値は使わない");
check(parseUnitPrice("") === DEFAULT_UNIT_PRICE, "空も仮の値");
check(parseUnitPrice("  ") === DEFAULT_UNIT_PRICE, "空白だけも仮の値");
check(parseUnitPrice("3000.6") === 3001, "小数は丸める");
check(parseUnitPrice("0") === 0, "0円も設定できる（無料で配るとき）");

console.log("── 金額 ──");
{
  const q = quote(10, 3000)!;
  check(q.subtotal === 30000, `10名の小計（${q.subtotal}）`);
  check(q.tax === 3000, `消費税${TAX_RATE * 100}%（${q.tax}）`);
  check(q.total === 33000, `税込（${q.total}）`);
  check(q.unitPrice === 3000 && q.seats === 10, "内訳が入る");
}
{
  /* 端数は切り捨て。1円多く請求しない */
  const q = quote(1, 3333)!;
  check(q.tax === 333, `端数は切り捨て（${q.tax}）`);
  check(q.total === 3666, `税込（${q.total}）`);
}
check(quote(1, 3000) !== null, "1名は通る");
check(quote(MAX_SEATS, 3000) !== null, `${MAX_SEATS}名は通る`);
check(quote(0, 3000) === null, "0名は通さない");
check(quote(10, Number.NaN) === null, "単価が数字でなければ出さない");
check(quote(10, -1) === null, "単価が負なら出さない");
check(quote(-3, 3000) === null, "負の人数は通さない");
check(quote(MAX_SEATS + 1, 3000) === null, "上限より多い人数は通さない（押し間違い避け）");
check(quote(1.5, 3000) === null, "半端な人数は通さない");
check(quote(Number.NaN, 3000) === null, "数字でないものは通さない");

console.log("── 見せ方 ──");
check(yen(33000) === "33,000円", `桁を区切る（${yen(33000)}）`);
check(yen(0) === "0円", "0円");

console.log("── 講座ごとの単価 ──");
{
  /* 前は全講座で1つの単価だった。それだと、14時間の職長教育が
     6時間の特別教育と同じ値段になる。講座ごとに持たせてある。 */
  check(priceEnvName("ashiba") === "SEAT_UNIT_PRICE_ASHIBA", "環境変数の名前を作れる");
  check(priceEnvName("shokucho") === "SEAT_UNIT_PRICE_SHOKUCHO", "講座ごとに名前が変わる");
  check(priceEnvName("a-b.c") === "SEAT_UNIT_PRICE_A_B_C", "使えない字は下線にする");

  /* 決め方の順番 */
  check(unitPrice("ashiba", "1234") === 1234, "講座ごとの設定がいちばん強い");
  check(unitPrice("ashiba", "", "7777") === DEFAULT_COURSE_PRICE.ashiba, "無ければ既定の値");
  check(unitPrice("よその講座", undefined, "7777") === 7777, "表に無ければ全体の設定");
  check(unitPrice("ashiba", "  ", undefined) === DEFAULT_COURSE_PRICE.ashiba, "空白は設定していないのと同じ");
  check(unitPrice("ashiba", "0") === 0, "0円も設定できる（無料で配るとき）");

  /* 公開している講座には、必ず値段が付いていること。
     付いていないと、仮置きの値で売ることになる */
  const ready = COURSES.filter((c) => c.ready);
  check(ready.length > 0, "公開している講座がある");
  for (const c of ready) check(unitPrice(c.id) > 0, `${c.id}: 値段が付いている`);

  /* 講座ごとに違う値段になっていること（同じだと分けた意味がない） */
  const set = new Set(ready.map((c) => unitPrice(c.id)));
  check(ready.length < 2 || set.size > 1, "講座ごとに値段が違う");

  /* 時間の長い講座のほうが高いこと */
  const has = (id: string) => ready.some((c) => c.id === id);
  if (has("ashiba") && has("shokucho")) {
    check(
      unitPrice("shokucho") > unitPrice("ashiba"),
      `14時間の職長教育のほうが高い（足場 ${unitPrice("ashiba")}／職長 ${unitPrice("shokucho")}）`,
    );
  }

  /* よそのいちばん安いところより下にしてある（2026年8月に調べた・税込）。
     ここが崩れたら「日本でいちばん安い」と言えなくなる。

     よその最安（オンライン受講・税込）
       足場 … 8,000円（茨城教育センター）
       職長 … 17,600円（中小建設業特別教育協会 WEB講習）
       石綿 … 7,700円（株式会社斉藤商会 WEB）
       高所作業車 … 10,500円（オンライン講習の最安。CIC は 11,000円） */
  const OTHERS: Record<string, number> = {
    ashiba: 8000, shokucho: 17600, ishiwata: 7700, kousho: 10500, funjin: 9900,
    sanketsu: 9515,
  };
  const withTax = (p: number) => p + Math.floor(p * TAX_RATE);
  for (const [id, other] of Object.entries(OTHERS)) {
    const mine = withTax(unitPrice(id));
    check(mine < other, `${id}：よその最安 ${other}円より下（${mine}円）`);
  }

  /* 決めた値段。変えたことに気づかず上げ直す事故を防ぐ */
  check(unitPrice("ashiba") === 4500, `足場は4,500円（税抜）で固定（${unitPrice("ashiba")}）`);
  check(unitPrice("shokucho") === 7000, `職長は7,000円（税抜）（${unitPrice("shokucho")}）`);
  check(withTax(4500) === 4950, "足場の税込は4,950円");
  check(withTax(7000) === 7700, "職長の税込は7,700円");
  check(unitPrice("ishiwata") === 4500, `石綿は4,500円（税抜）（${unitPrice("ishiwata")}）`);
  /* 高所作業車は 7,000円。はじめ 4,500円に置いたのを「安すぎる」と決め直した。
     実技の手引きと実施記録の様式が付く（/edu/kousho/drill） */
  check(unitPrice("kousho") === 7000, `高所作業車は7,000円（税抜）（${unitPrice("kousho")}）`);
  /* 粉じんは石綿と同じ作り（学科だけで修了）なので同じ値段。よそは 9,900円台 */
  check(unitPrice("funjin") === 4500, `粉じんは4,500円（税抜）（${unitPrice("funjin")}）`);
  /* 酸欠は学科5時間30分。石綿・粉じんより1時間長いぶん上げて 5,500円。よそは 9,515円 */
  check(unitPrice("sanketsu") === 5500, `酸欠は5,500円（税抜）（${unitPrice("sanketsu")}）`);
  /* 小型車両系は学科7時間＋実技6時間。実技の手引きが付くので高所作業車と同じ 7,000円 */
  check(unitPrice("kogata") === 7000, `小型車両系は7,000円（税抜）（${unitPrice("kogata")}）`);
  /* フォークリフトは学科6時間＋実技6時間。受ける人が広いので 6,000円 */
  check(unitPrice("forklift") === 6000, `フォークリフトは6,000円（税抜）（${unitPrice("forklift")}）`);
  /* テールゲートリフターは学科4時間＋実技2時間。配送の会社が人数分買う教育なので 5,000円 */
  check(unitPrice("tailgate") === 5000, `テールゲートリフターは5,000円（税抜）（${unitPrice("tailgate")}）`);
  /* 自由研削といしは学科4時間＋実技2時間。テールゲートリフターと同じ作りで 5,000円 */
  check(unitPrice("toishi") === 5000, `自由研削といしは5,000円（税抜）（${unitPrice("toishi")}）`);
  /* 低圧電気は学科7時間＋実技7時間。小型車両系・高所作業車と同じ 7,000円 */
  check(unitPrice("teiatsu") === 7000, `低圧電気は7,000円（税抜）（${unitPrice("teiatsu")}）`);
  /* 巻上げ機は学科6時間＋実技4時間。フォークリフトと同じ 6,000円 */
  check(unitPrice("winch") === 6000, `巻上げ機は6,000円（税抜）（${unitPrice("winch")}）`);
  /* ローラーは学科6時間＋実技4時間。フォークリフト・巻上げ機と同じ 6,000円 */
  check(unitPrice("roller") === 6000, `ローラーは6,000円（税抜）（${unitPrice("roller")}）`);
  /* チェーンソーは学科9時間＋実技9時間。うちでいちばん長い学科なので 8,000円 */
  check(unitPrice("chainsaw") === 8000, `チェーンソーは8,000円（税抜）（${unitPrice("chainsaw")}）`);
  /* アーク溶接は学科11時間＋実技10時間。うちでいちばん長いので 9,000円 */
  check(unitPrice("arc") === 9000, `アーク溶接は9,000円（税抜）（${unitPrice("arc")}）`);
  /* 機械研削といしは学科7時間＋実技3時間。低圧電気・小型車両系と同じ 7,000円 */
  check(unitPrice("kikaitoishi") === 7000, `機械研削といしは7,000円（税抜）（${unitPrice("kikaitoishi")}）`);
  check(unitPrice("shovel") === 6000, `ショベルローダー等は6,000円（税抜）（${unitPrice("shovel")}）`);
  check(unitPrice("fuseichi") === 6000, `不整地運搬車は6,000円（税抜）（${unitPrice("fuseichi")}）`);
  check(unitPrice("kouatsu") === 12000, `高圧・特別高圧電気は12,000円（税抜）（${unitPrice("kouatsu")}）`);
  check(unitPrice("ev") === 7000, `電気自動車の整備は7,000円（税抜）（${unitPrice("ev")}）`);
  check(unitPrice("zuidou") === 7000, `ずい道等の掘削等は7,000円（税抜）（${unitPrice("zuidou")}）`);
  check(unitPrice("dioxin") === 5000, `ダイオキシン類は5,000円（税抜）（${unitPrice("dioxin")}）`);
  check(unitPrice("press") === 8000, `動力プレスの金型等は8,000円（税抜）（${unitPrice("press")}）`);
  check(unitPrice("youka") === 9000, `揚貨装置は9,000円（税抜）（${unitPrice("youka")}）`);
  check(unitPrice("batsuboku") === 6000, `伐木等機械は6,000円（税抜）（${unitPrice("batsuboku")}）`);
  check(unitPrice("soukou") === 6000, `走行集材機械は6,000円（税抜）（${unitPrice("soukou")}）`);
  check(unitPrice("kikaishuzai") === 6000, `機械集材装置は6,000円（税抜）（${unitPrice("kikaishuzai")}）`);
  check(unitPrice("kanikasen") === 6000, `簡易架線集材装置等は6,000円（税抜）（${unitPrice("kanikasen")}）`);
  check(unitPrice("kisokouji") === 7000, `小型車両系（基礎工事用）は7,000円（税抜）（${unitPrice("kisokouji")}）`);
  check(unitPrice("kaitai") === 7000, `小型車両系（解体用）は7,000円（税抜）（${unitPrice("kaitai")}）`);
  check(unitPrice("kisokenki") === 7000, `基礎工事用建設機械は7,000円（税抜）（${unitPrice("kisokenki")}）`);
  check(unitPrice("kisosousa") === 5500, `基礎工事用の作業装置の操作は5,500円（税抜）（${unitPrice("kisosousa")}）`);
  check(unitPrice("concrete") === 7000, `コンクリート打設用機械は7,000円（税抜）（${unitPrice("concrete")}）`);
  check(unitPrice("boring") === 7000, `ボーリングマシンは7,000円（税抜）（${unitPrice("boring")}）`);
  check(unitPrice("jack") === 6000, `ジャッキ式つり上げ機械は6,000円（税抜）（${unitPrice("jack")}）`);
  check(unitPrice("kidou") === 6000, `軌道装置の動力車は6,000円（税抜）（${unitPrice("kidou")}）`);
  check(unitPrice("robotkyoji") === 7000, `産業用ロボット（教示等）は7,000円（税抜）（${unitPrice("robotkyoji")}）`);
  check(unitPrice("robotkensa") === 8000, `産業用ロボット（検査等）は8,000円（税抜）（${unitPrice("robotkensa")}）`);
  check(unitPrice("tire") === 5500, `自動車用タイヤの空気充てんは5,500円（税抜）（${unitPrice("tire")}）`);
  check(unitPrice("tokushu") === 10000, `特殊化学設備は10,000円（税抜）（${unitPrice("tokushu")}）`);
  check(unitPrice("tamakake") === 5500, `玉掛け（1トン未満）は5,500円（税抜）（${unitPrice("tamakake")}）`);
  check(unitPrice("crane") === 8000, `クレーン（5トン未満）・跨線テルハは8,000円（税抜）（${unitPrice("crane")}）`);

  /* 知らない講座を聞かれても、仮置きの値で答える（0円で配らない） */
  check(unitPrice("nonsense") > 0, "知らない講座でも0円にはしない");
  check(unitPrice() > 0, "講座を渡さなくても0円にはしない");
}

console.log("── 支払期限 ──");
{
  /* 30日後の、その月の末日 */
  const d = dueDate(new Date("2026-08-22T00:00:00+09:00"));
  check(d.getMonth() === 8, `9月になる（${d.getMonth() + 1}月）`);
  check(d.getDate() === 30, `末日（${d.getDate()}日）`);
  const feb = dueDate(new Date("2026-01-15T00:00:00+09:00"));
  check(feb.getDate() === 28, `2月は28日（${feb.getMonth() + 1}/${feb.getDate()}）`);
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
