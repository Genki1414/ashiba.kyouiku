/* 会員制度（0040・docs/120）の決まりを確かめる。実行: npm run test:members

   ここで見るのは2つ。
   1. 金額の式（画面・サーバ・SQL で同じ答えになること）
   2. 作りの決まり（字で突き合わせる）
      ・MEMBERSHIP_ENABLED の店でしか開かない（指示書 §17：承認前に本番で出さない）
      ・金額は整数。チケットは負にならない（SQL が raise）
      ・振込先は本人と運営の口からしか返さない
      ・確定（commissions）と見込み（契約 × 率）を足して1つにしない
      ・入金→有効→付与→報酬は1つの SQL（pay_contract_payment）だけが行う */

import { readFileSync } from "node:fs";
import {
  DEFAULT_PLANS,
  TERMS,
  addDays,
  commissionOf,
  grossOf,
  jstDate,
  makeRefCode,
  monthLabel,
  monthStart,
  mrrOf,
  nextMonth,
  normalizeRefCode,
  progressPct,
  refUrl,
  simulateCommission,
  taxOf,
} from "../src/lib/membership";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };
const eq = (a: unknown, b: unknown, m: string) => check(a === b, `${m}（${JSON.stringify(a)} ≠ ${JSON.stringify(b)}）`);
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

console.log("── 金額の式 ──");
{
  eq(taxOf(10000), 1000, "税は10%");
  eq(taxOf(4505), 450, "税の端数は切り捨て");
  eq(grossOf(10000), 11000, "税込");
  eq(grossOf(-5), 0, "負の税抜は0に");
  /* SQL（pay_contract_payment）と同じ floor(net × rate / 100) */
  eq(commissionOf(10000, 30), 3000, "報酬は税抜 × 率");
  eq(commissionOf(5000, 30), 1500, "ライトなら 1,500");
  eq(commissionOf(50001, 30), 15000, "報酬の端数は切り捨て（15000.3 → 15000）");
  eq(commissionOf(10000, 0), 0, "率 0 なら 0");
  eq(simulateCommission(10, 10000, 30).monthly, 30000, "10社 × スタンダード = 月 30,000");
  eq(simulateCommission(10, 10000, 30).yearly, 360000, "年は12倍");
  eq(simulateCommission(-3, 10000).monthly, 0, "負の社数は 0 社");
  eq(mrrOf([5000, 10000, 20000]), 35000, "MRR は月額の合計");
  eq(progressPct(250000, 500000), 50, "進みは %");
  eq(progressPct(900000, 800000), 100, "100 を超えない");
  eq(progressPct(1, 0), 0, "目標 0 なら 0");
  /* 指示書のプラン：チケットは会費の2倍 */
  for (const p of DEFAULT_PLANS) eq(p.ticketAmount, p.monthlyFee * 2, `${p.name} のチケットは会費の200%`);
  eq(DEFAULT_PLANS.filter((p) => p.kind === "member").length, 4, "法人会員は4プラン");
  eq(DEFAULT_PLANS.filter((p) => p.kind === "agency").length, 5, "販売代理店は5プラン");
}

console.log("── 月と日 ──");
{
  /* 日本の日付で切る。世界標準時 23:30 は日本の翌日 8:30 */
  eq(jstDate(new Date("2026-11-30T23:30:00Z")), "2026-12-01", "日本の今日");
  eq(monthStart(new Date("2026-11-30T23:30:00Z")), "2026-12-01", "月の1日も日本の日付で");
  eq(monthStart(new Date("2026-12-01T10:00:00Z")), "2026-12-01", "月の途中は1日に");
  eq(nextMonth("2026-12-01"), "2027-01-01", "翌月（年またぎ）");
  eq(nextMonth("2026-01-01"), "2026-02-01", "翌月");
  eq(addDays("2026-12-25", 10), "2027-01-04", "日を足す（年またぎ）");
  eq(monthLabel("2026-12-01"), "2026年12月分", "月の言い方");
  eq(monthLabel(""), "", "空は空");
}

console.log("── 紹介コード ──");
{
  eq(normalizeRefCode(" abcd-2345 "), "ABCD2345", "小文字・空白・ハイフンをそろえる");
  eq(normalizeRefCode("ABC"), "", "短すぎる形は通さない");
  eq(normalizeRefCode("ABCD0123"), "", "0 と 1 は使わない字（打ち間違いが多い）");
  eq(normalizeRefCode("<script>"), "", "変な字は通さない");
  for (let i = 0; i < 50; i++) {
    const c = makeRefCode();
    check(normalizeRefCode(c) === c, `作ったコードは形に合う（${c}）`);
  }
  eq(refUrl("https://kyouiku.ashibase.jp/", "ABCD2345"), "https://kyouiku.ashibase.jp/ref?code=ABCD2345", "紹介 URL");
}

console.log("── 作りの決まり ──");
{
  /* 承認前に本番で出ない：入口は全部 membershipEnabled() を見る */
  for (const f of [
    "src/app/api/member/contract/route.ts",
    "src/app/api/owner/members/route.ts",
    "src/app/api/partner/route.ts",
    "src/app/api/cron/members/route.ts",
    "src/app/member/page.tsx",
    "src/app/partner/page.tsx",
    "src/app/members/page.tsx",
    "src/app/agency/page.tsx",
    "src/app/partners/page.tsx",
    "src/app/invoice/member/[paymentId]/page.tsx",
    "src/app/owner/page.tsx",
  ]) {
    check(/membershipEnabled\(\)/.test(strip(read(f))), `${f} は MEMBERSHIP_ENABLED の店でだけ開く`);
  }
  const srv = strip(read("src/lib/membership.server.ts"));
  check(/import "server-only"/.test(srv) && /MEMBERSHIP_ENABLED/.test(srv), "フラグはサーバだけで読む");
  check(!/MEMBERSHIP_ENABLED|process\.env/.test(strip(read("src/lib/membership.ts"))), "画面からも読む計算の所に環境変数を書かない");
  /* 運営の札は渡された flag で出す（画面から env を読まない） */
  const oc = strip(read("src/app/owner/OwnerClient.tsx"));
  check(/membership \? \(\[\["members", "会員と報酬"\]\] as const\) : \[\]/.test(oc), "本部の札は flag のときだけ");
  check(/<OwnerClient membership=\{membershipEnabled\(\)\} \/>/.test(strip(read("src/app/owner/page.tsx"))), "flag は owner/page.tsx がサーバで決める");

  /* チケットで払う：税抜を引く・引けたら paid・引けなければ注文を下げる・席はその道だけ */
  const order = strip(read("src/app/api/order/route.ts"));
  check(/p_amount: money\.net,/.test(order), "引くのは税抜の合計（money.net）");
  check(/rpc\("spend_tickets"/.test(order) && /rpc\("return_tickets"/.test(order), "引く・戻すは SQL");
  check(/\.delete\(\)\.eq\("group_id", groupId\)/.test(order), "引けなければ注文を消す（入金待ちを運営に見せない）");
  check(/status: "paid", paid_at: now\.toISOString\(\)/.test(order), "引けたらその場で入金済み");
  check(/contract_id: ticket\.contractId/.test(order), "注文に契約を結ぶ");
  check(!/b\.amount|b\.total|b\.net/.test(order), "画面の金額は見ない");
  /* 売上の二重計上をしない */
  check(/o\.method !== "ticket"/.test(strip(read("src/app/api/owner/ledger/route.ts"))), "元帳の売上にチケット払いを足さない");
  check(/filter\(\(o\) => o\.method !== "ticket"\)/.test(oc), "本部の売上にチケット払いを足さない");

  /* 入金→有効→付与→報酬は SQL の1関数。TS 側で状態を直接書かない */
  const om = strip(read("src/app/api/owner/members/route.ts"));
  check(/rpc\("pay_contract_payment"/.test(om), "入金の確認は pay_contract_payment");
  check(!/from\("contract_payments"\)\.update\(\{ status: "paid"/.test(om), "paid を手で書かない");
  check(!/from\("ticket_lots"\)\.(insert|update)/.test(om), "ロットを手で書かない");
  check(!/from\("commissions"\)\.insert/.test(om), "報酬を手で立てない（SQL が入金1件に1行）");
  check(/rpc\("refund_contract_payment"/.test(om), "返金も SQL");
  check(/before\.status === "pending" && st === "active"/.test(om), "入金待ちを手で有効にしない");
  check(/from\("referral_changes"\)\s*\.insert/.test(om) && /if \(!reason\) return bad/.test(om), "紹介元の変更は理由を必ず残す");
  check(/adminLog\(/.test(om), "運営の操作はログに残す");
  /* 確定と見込みは別 */
  check(/confirmed:/.test(om) && /expectedMonthly:/.test(om) && !/confirmed \+ expected/.test(om), "確定と見込みを足さない（本部）");
  const pa = strip(read("src/app/api/partner/route.ts"));
  check(/totals: \{ confirmed, paid, expectedMonthly/.test(pa), "確定と見込みを足さない（パートナー）");
  /* 振込先は本人と運営だけ */
  const files = ["src/app/api/partner/route.ts", "src/app/api/owner/members/route.ts"];
  const all = ["src/app/api/member/contract/route.ts", "src/app/api/order/route.ts", "src/app/api/me/route.ts", "src/app/api/owner/orders/route.ts", "src/app/api/cron/members/route.ts"];
  for (const f of all) check(!/partner_bank/.test(read(f)), `${f} は振込先を返さない`);
  check(files.some((f) => /partner_bank/.test(read(f))), "振込先は本人の口から");
  /* 自分のコードで自分の会社を紹介しない。承認済みだけ */
  const mc = strip(read("src/app/api/member/contract/route.ts"));
  check(/sp\.user_id === admin\.userId/.test(mc), "自分の紹介コードは通さない");
  check(/sp\.status !== "approved"/.test(mc), "承認済みのパートナーだけ");
  check(/rpc\("open_contract_payment"/.test(mc) && /monthStart\(\)/.test(mc), "初月の入金行を起こす");
  check(/notify\("contract"\)/.test(mc), "運営に知らせる");
  /* 紹介 URL：クッキーは httpOnly。コードの形が合わなければ置かない */
  const rf = strip(read("src/app/ref/route.ts"));
  check(/httpOnly: true/.test(rf) && /normalizeRefCode\(/.test(rf), "紹介クッキーは httpOnly で、形を見て置く");
  /* Cron：合言葉。未設定なら誰も呼べない */
  const cr = strip(read("src/app/api/cron/members/route.ts"));
  check(/if \(!secret \|\| auth !== `Bearer \$\{secret\}`\)/.test(cr), "Cron は CRON_SECRET で見張る（未設定なら閉じる）");
  check(/runDaily\(/.test(cr) && /rpc\("expire_tickets"\)/.test(srv) && /openDuePayments\(/.test(srv), "失効と翌月の起票をする（runDaily）");
  const vj = JSON.parse(read("vercel.json")) as { crons?: { path: string; schedule: string }[] };
  check(!!vj.crons?.some((c) => c.path === "/api/cron/members"), "vercel.json に Cron がある");
  /* 条件（docs/121）は TERMS から出す。字を2か所に書かない（「12か月で失効」のような決め打ちを残さない） */
  for (const f of ["src/app/members/page.tsx", "src/app/agency/page.tsx", "src/app/partners/page.tsx", "src/app/member/MemberClient.tsx", "src/components/lp/LpShell.tsx", "src/app/legal/terms/page.tsx"]) {
    const s = read(f);
    check(!/12か月で失効|12か月有効|6か月で失効/.test(s), `${f} にチケットの期間を決め打ちで書いていない（TERMS を使う）`);
    check(/TERMS\./.test(s), `${f} は TERMS を読む`);
  }
  const lp = read("src/components/lp/LpShell.tsx");
  check(/税抜表示/.test(lp) && /自動更新/.test(lp) && /返金はなく/.test(lp), "案内に税抜・自動更新・返金なしが書いてある");
  /* 変更履歴にはまだ載せない（載せると全員に更新の知らせが出る。承認後に載せる） */
  check(!/法人会員|営業パートナー/.test(read("src/content/changelog.ts")), "承認前は更新のお知らせに載せない");
  /* 見張り */
  check(/"\/api\/cron"/.test(read("src/lib/authGate.ts")), "Cron の道は見張りを通す（ログインは無い）");
  /* ── 条件（0041・docs/121）── */
  eq(TERMS.ticketMonthsMax, 6, "チケットは6か月まで（資金決済法の届出不要）");
  for (const p of DEFAULT_PLANS) check(p.ticketMonths <= TERMS.ticketMonthsMax, `${p.name} の有効期間は 6 か月以内`);
  const mig = read("supabase/migrations/0041_members_terms.sql");
  check(/check \(ticket_months between 1 and 6\)/.test(mig), "SQL でも 6 か月までに縛る");
  check(/alter column ticket_months set default 6/.test(mig), "既定も 6 か月");
  check(/create or replace function public\.cancel_contract/.test(mig) && /interval '2 months' - interval '1 day'/.test(mig), "解約は翌月末（SQL）");
  check(/create or replace function public\.end_contract/.test(mig) && /'契約終了'/.test(mig), "終了で残りのチケットを失効（SQL）");
  check(/create or replace function public\.renew_contracts/.test(mig) && /interval '12 months'/.test(mig), "自動更新は12か月（SQL）");
  check(/select '0041'/.test(mig), "版は 0041");
  check(/NEED_SCHEMA = "0041"/.test(read("src/content/schema.ts")), "画面が待つ版も 0041");
  check(/rpc\("end_contract"/.test(om) && !/status: "ended" \}\)\.eq/.test(om), "本部の終了は end_contract（手で ended を書かない）");
  check(/rpc\("cancel_contract"/.test(om) && /rpc\("cancel_contract"/.test(mc), "解約の申し出は本部からも担当者からも cancel_contract");
  check(/months > TERMS\.ticketMonthsMax/.test(om), "プランの編集で 6 か月を超えさせない");
  check(/runDaily\(/.test(cr) && /rpc\("renew_contracts"\)/.test(srv) && /rpc\("end_contract"/.test(srv) && /TERMS\.suspendAfterDays/.test(srv), "日次処理：自動更新・解約の終了・滞納の停止");
  const tp = read("src/app/legal/terms/page.tsx");
  check(/membershipEnabled\(\)/.test(tp) && /法人会員（月額プラン）とチケット/.test(tp) && /営業パートナー/.test(tp), "規約は制度を開けた店だけ条を足す");
  const ts = read("src/app/legal/tokushoho/page.tsx");
  check(/membershipEnabled\(\) \? \(await plansForLp\("member"\)\)\.plans : \[\]/.test(ts), "特商法の表記も、開けた店だけ月額を載せる");
  check(/法人会員（月額プラン）/.test(read("src/content/legal.ts")), "表記に法人会員の欄がある");

  /* SQL の試験が残っていること */
  const sql = read("supabase/tests/members.sql");
  check(/足りなければ止まる/.test(sql) && /refund_contract_payment/.test(sql), "SQL の試験（不足・返金）がある");
}

console.log(`\n通り ${ok} ／ だめ ${ng}`);
process.exit(ng ? 1 : 0);
