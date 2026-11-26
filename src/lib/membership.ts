/* 法人会員・販売代理店・営業パートナー（0040・docs/119・docs/120）の、
   画面とサーバの両方から使う計算と言い方。

   ── ここに置くもの ──
   環境変数を読まない・データベースに触らない、純粋な計算だけ。
   画面（"use client"）からも読むので、サーバだけの設定（MEMBERSHIP_ENABLED など）
   はここに書かない（tests/env-usage.mts が見張る）。
   サーバだけのものは src/lib/membership.server.ts。

   ── 決めたこと ──
   ・金額は全部 int（円）。税抜で持ち、税込は出すときに floor(net × 10%) を足す
   ・月は**日本の日付**で切る（世界標準時のまま切ると、月初の朝9時前がひと月前になる）
   ・報酬は入金1件ごとに floor(税抜 × 率 / 100)。SQL（pay_contract_payment）と同じ式 */

import { TAX_RATE } from "@/lib/pricing";

/** プラン。plans の行をそのまま画面へ出す形 */
export type Plan = {
  id: string;
  kind: "member" | "agency";
  name: string;
  /** 月額会費（税抜） */
  monthlyFee: number;
  /** 毎月付与するチケット（円） */
  ticketAmount: number;
  /** 付与から何か月で失効するか */
  ticketMonths: number;
  public: boolean;
  sortOrder: number;
  note: string;
};

/* ── 決めた条件（0041・docs/121。げんきさん 2026-11-25「届出不要な状態にして。他もおすすめの構成で」）──
   ここに1か所で持ち、案内・申込み・規約・特商法の表記が全部ここを読む。2か所に書かない */
export const TERMS = {
  /** チケットは付与から何か月以内か。**6 を超えない**（資金決済法 第4条第2号。6か月内なら届出・供託の対象外） */
  ticketMonthsMax: 6,
  /** 契約期間（か月）。満了の1か月前までに申し出が無ければ同じ期間で自動更新 */
  contractMonths: 12,
  /** 途中解約：申し出の月の翌月末で終了。以後の会費は請求しない */
  cancelNotice: "申し出の月の翌月末",
  /** 会費の支払期限（請求書の発行から日数）。受講コードの注文と同じ */
  dueDays: 7,
  /** 期限を過ぎて何日で停止するか。入金で再開 */
  suspendAfterDays: 14,
  /** 営業パートナーの報酬：月末締め・翌月末払い */
  payoutRule: "月末締め・翌月末払い",
  /** 報酬の最低支払額（円）。未達は翌月に繰り越す */
  payoutMin: 5000,
} as const;

/** 教育費の削減額（年）。チケットは会費の2倍なので、通常価格で買うより会費のぶんだけ安い。
    年間 = （チケット − 会費）× 12。会費より少ないチケットのプランなら 0 */
export const yearlySavingsOf = (p: Pick<Plan, "monthlyFee" | "ticketAmount">): number =>
  Math.max(0, (p.ticketAmount - p.monthlyFee) * 12);

/** 年間のチケットで、その単価（税抜）の講座が何人ぶん受けられるか */
export const seatsPerYear = (p: Pick<Plan, "ticketAmount">, unitPrice: number): number =>
  unitPrice > 0 ? Math.floor((p.ticketAmount * 12) / unitPrice) : 0;

/** 初期プラン（0040 の seed と同じ。有効期間は 0041 で 6 か月）。LP がデータベースを読めなかったときの代わりと、試験に使う。
    **本物は plans の表。**運営が画面で直すので、ここを直しても本番の額は変わらない */
export const DEFAULT_PLANS: Omit<Plan, "id">[] = [
  { kind: "member", name: "ライト", monthlyFee: 5000, ticketAmount: 10000, ticketMonths: 6, public: true, sortOrder: 1, note: "" },
  { kind: "member", name: "スタンダード", monthlyFee: 10000, ticketAmount: 20000, ticketMonths: 6, public: true, sortOrder: 2, note: "" },
  { kind: "member", name: "ビジネス", monthlyFee: 20000, ticketAmount: 40000, ticketMonths: 6, public: true, sortOrder: 3, note: "" },
  { kind: "member", name: "エンタープライズ", monthlyFee: 50000, ticketAmount: 100000, ticketMonths: 6, public: true, sortOrder: 4, note: "" },
  { kind: "agency", name: "代理店 1万", monthlyFee: 10000, ticketAmount: 20000, ticketMonths: 6, public: true, sortOrder: 11, note: "" },
  { kind: "agency", name: "代理店 2万", monthlyFee: 20000, ticketAmount: 40000, ticketMonths: 6, public: true, sortOrder: 12, note: "" },
  { kind: "agency", name: "代理店 3万", monthlyFee: 30000, ticketAmount: 60000, ticketMonths: 6, public: true, sortOrder: 13, note: "" },
  { kind: "agency", name: "代理店 5万", monthlyFee: 50000, ticketAmount: 100000, ticketMonths: 6, public: true, sortOrder: 14, note: "" },
  { kind: "agency", name: "代理店 10万", monthlyFee: 100000, ticketAmount: 200000, ticketMonths: 6, public: true, sortOrder: 15, note: "" },
];

/** 契約の状態。pending=入金待ち／active=有効／suspended=停止／ended=終了 */
export type ContractStatus = "pending" | "active" | "suspended" | "ended";

export const CONTRACT_STATUS: Record<ContractStatus, string> = {
  pending: "入金待ち",
  active: "有効",
  suspended: "停止中",
  ended: "終了",
};

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled";

export const PAYMENT_STATUS: Record<PaymentStatus, string> = {
  pending: "入金待ち",
  paid: "入金済み",
  failed: "失敗",
  refunded: "返金",
  cancelled: "取消",
};

export type PartnerStatus = "pending" | "approved" | "suspended";

export const PARTNER_STATUS: Record<PartnerStatus, string> = {
  pending: "承認待ち",
  approved: "承認済み",
  suspended: "停止中",
};

/** 営業パートナーの報酬率（%）。指示書の既定値。実際は sales_partners.rate を使う */
export const DEFAULT_PARTNER_RATE = 30;

/** 消費税（円）。1回だけ端数を落とす */
export const taxOf = (net: number): number => Math.floor(Math.max(0, Math.floor(net)) * TAX_RATE);

/** 税込（円） */
export const grossOf = (net: number): number => Math.max(0, Math.floor(net)) + taxOf(net);

/** 報酬（円）。税抜の入金額 × 率。SQL と同じ式（floor） */
export const commissionOf = (net: number, rate: number): number =>
  Math.floor((Math.max(0, Math.floor(net)) * Math.max(0, Math.floor(rate))) / 100);

/** 日本の今日（YYYY-MM-DD） */
export const jstDate = (now: Date = new Date()): string =>
  new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** 日本の日付で、その月の1日（YYYY-MM-01）。contract_payments.period_month に入れる形 */
export const monthStart = (now: Date = new Date()): string => `${jstDate(now).slice(0, 7)}-01`;

/** YYYY-MM-01 → 次の月の1日 */
export function nextMonth(month: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(month);
  if (!m) return month;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = new Date(Date.UTC(y, mo, 1)); // mo は 0 始まりなので、これで翌月
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD に日を足す */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 「2026年12月分」 */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(month ?? "");
  return m ? `${Number(m[1])}年${Number(m[2])}月分` : "";
}

/** 日付を「2026/12/1」に */
export function ymd(s: string | null | undefined): string {
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${Number(m[1])}/${Number(m[2])}/${Number(m[3])}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 営業パートナーの報酬の見込み（LP のシミュレーター）。
    契約数 × 月額（税抜）× 率。年は 12 倍。
    **見込みは見込み。**確定は入金のあった分だけ（commissions の行） */
export function simulateCommission(
  contracts: number,
  monthlyFee: number,
  rate: number = DEFAULT_PARTNER_RATE,
): { monthly: number; yearly: number } {
  const n = Math.max(0, Math.floor(contracts));
  const monthly = n * commissionOf(monthlyFee, rate);
  return { monthly, yearly: monthly * 12 };
}

/** 月額の固定売上（MRR）。有効な契約の月額（税抜）の合計 */
export const mrrOf = (fees: number[]): number => fees.reduce((n, f) => n + Math.max(0, Math.floor(f)), 0);

/** 目標に対する進み（%）。100 を超えない。目標が 0 なら 0 */
export function progressPct(value: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.floor((Math.max(0, value) / goal) * 100));
}

/** 紹介コードを乗せるクッキーの名前（/ref が置き、/api/member/contract が読む） */
export const REF_COOKIE = "ref";

/** 紹介コード。読み違えやすい字（0/O・1/I/L）を使わない */
export const REF_CODE_RE = /^[A-Z2-9]{6,10}$/;

/** 画面やクッキーから来た紹介コードをそろえる。合わない形は空 */
export function normalizeRefCode(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
  return REF_CODE_RE.test(s) ? s : "";
}

/** 紹介コードを作る。8文字。衝突したら呼ぶ側が取り直す */
export function makeRefCode(rand: () => number = Math.random): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(rand() * chars.length) % chars.length];
  return s;
}

/** 紹介 URL。LP（法人会員）へ送る。コードはクッキーに乗って申込みまで届く */
export const refUrl = (site: string, code: string): string =>
  `${site.replace(/\/+$/, "")}/ref?code=${encodeURIComponent(code)}`;
