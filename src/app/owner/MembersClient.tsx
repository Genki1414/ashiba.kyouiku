"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AskDone, type Ask, type RunResult } from "@/components/AskDone";
import { overdue, yen } from "@/lib/pricing";
import {
  CONTRACT_STATUS,
  PARTNER_STATUS,
  PAYMENT_STATUS,
  TERMS,
  grossOf,
  monthLabel,
  monthStart,
  nextMonth,
  progressPct,
  ymd,
  type ContractStatus,
  type PartnerStatus,
  type PaymentStatus,
  type Plan,
} from "@/lib/membership";

/* 本部の「会員と報酬」（0040・docs/120）。

   上から順に：目標と今の数字 → 入金待ち → 契約 → パートナー → プラン → 月次 → 操作ログ。
   運営がここへ来る理由のいちばん多いのは「入金を確認した」なので、入金待ちを上に。

   金が動く操作は全部、確かめる札（AskDone）を通す。 */

type Payment = {
  id: string; contractId: string; periodMonth: string; net: number; tax: number; amount: number; ticketAmount: number;
  method: string; status: PaymentStatus; dueOn: string | null; invoicedAt: string | null; paidAt: string | null; refundedAt: string | null;
};
type Contract = {
  id: string; companyId: string; company: string; kind: string; status: ContractStatus; method: string;
  startedOn: string | null; endsOn: string | null; nextDueOn: string | null; cancelRequestedOn?: string | null; note: string; createdAt: string;
  plan: Plan | null;
  referrer: { id: string; name: string; code: string; locked: boolean } | null;
  balance: { total: number; expiring: number; nextExpire: string | null };
  payments: Payment[];
};
type Partner = {
  id: string; userId: string; email: string; name: string; kind: string; status: PartnerStatus; code: string; rate: number;
  contact: string; note: string; approvedAt: string | null; createdAt: string;
  contracts: number; activeContracts: number; confirmed: number; paid: number; expectedMonthly: number;
};
type Commission = {
  id: string; paymentId: string | null; partnerId: string; contractId: string | null; periodMonth: string;
  baseNet: number; rate: number; amount: number; kind: string; status: string; payoutId: string | null; at: string;
};
type Targets = { deadline: string; mrrMin: number; mrrGoal: number; netGoal: number; partnersGoal: number; contractsGoal: number };
type Dash = {
  mrr: number; arr: number; net: number; expectedCommission: number; activeContracts: number; pendingContracts: number;
  approvedPartners: number; pendingPartners: number; pendingPayments: number; confirmedUnpaid: number; paidCommissions: number; cashIn: number;
};
type Company = { id: string; name: string; parentId: string | null };
type Loaded = {
  plans: Plan[]; companies: Company[]; contracts: Contract[]; partners: Partner[]; commissions: Commission[];
  payouts: { id: string; partnerId: string; periodMonth: string; total: number; status: string; paidAt: string | null }[];
  targets: Targets; dashboard: Dash;
  logs: { id: string; actor: string; action: string; target: string; after: unknown; at: string }[];
};

const ACTION: Record<string, string> = {
  paid: "入金を確認", invoiced: "請求書を送付", cancel_payment: "請求を取消", refund: "返金", open: "請求を起票",
  month_open: "日次処理", expire: "失効", contract_status: "契約の状態", contract_plan: "プラン変更", cancel: "解約の申し出",
  suspend_overdue: "滞納で停止", remind: "支払いの催促", set_parent: "協力会社",
  referrer: "紹介元の変更", partner_status: "パートナーの状態", partner_rate: "報酬率", partner_code: "紹介コード",
  payout: "報酬を支払い済み", plan_save: "プラン編集", targets: "目標",
};

export function MembersClient({ onNote }: { onNote: (s: string) => void }) {
  const [st, setSt] = useState<Loaded | null>(null);
  const [ng, setNg] = useState("");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editPlan, setEditPlan] = useState<Partial<Plan> | null>(null);
  const [editTargets, setEditTargets] = useState<Targets | null>(null);
  const [reason, setReason] = useState("");
  const [showLogs, setShowLogs] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/members", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setNg(j.reason ?? "画面を表示できません。");
        return;
      }
      setSt({
        plans: j.plans ?? [],
        companies: j.companies ?? [],
        contracts: j.contracts ?? [],
        partners: j.partners ?? [],
        commissions: j.commissions ?? [],
        payouts: j.payouts ?? [],
        targets: j.targets,
        dashboard: j.dashboard,
        logs: j.logs ?? [],
      });
      setNg("");
    } catch {
      setNg("接続できません。");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const post = async (body: Record<string, unknown>): Promise<RunResult> => {
    onNote("");
    const res = await fetch("/api/owner/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) {
      onNote(j.reason ?? "処理できませんでした。");
      return false;
    }
    await load();
    return j;
  };

  if (ng) return <p className="mt-4 text-[13px] leading-relaxed text-red" data-testid="members-ng">{ng}</p>;
  if (!st) return <div className="mt-4 text-[12px] text-dim">読み込み中…</div>;

  const d = st.dashboard;
  const t = st.targets;
  const pendingPays = st.contracts.flatMap((c) => c.payments.filter((p) => p.status === "pending").map((p) => ({ ...p, c })));
  const thisMonth = monthStart();
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="mt-4" data-testid="members">
      {/* ── 目標と今 ── */}
      <div className="rounded-xl border border-line bg-panel p-4" data-testid="members-dash">
        <div className="flex items-baseline">
          <div className="text-[11px] tracking-[2px] text-dim">目標　{ymd(t.deadline)} まで</div>
          <button onClick={() => setEditTargets(editTargets ? null : { ...t })} className="ml-auto text-[11.5px] text-cyan" data-testid="members-targets-edit">
            {editTargets ? "閉じる" : "目標を直す"}
          </button>
        </div>
        {[
          { t: "MRR（月額の固定売上・税抜）", v: d.mrr, goal: t.mrrGoal, min: t.mrrMin },
          { t: "純売上の見込み（MRR − 報酬）", v: d.net, goal: t.netGoal },
          { t: "有効な契約", v: d.activeContracts, goal: t.contractsGoal, unit: "件" },
          { t: "承認済みパートナー", v: d.approvedPartners, goal: t.partnersGoal, unit: "人" },
        ].map((x) => (
          <div key={x.t} className="mt-3" data-testid="members-kpi">
            <div className="flex items-baseline text-[12px]">
              <span className="text-dim">{x.t}</span>
              <span className="ml-auto font-black">
                {x.unit ? `${x.v}${x.unit}` : yen(x.v)}
                <span className="text-[10.5px] font-normal text-dim2">　／ {x.unit ? `${x.goal}${x.unit}` : yen(x.goal)}</span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded bg-bg">
              <div className="h-full bg-yel" style={{ width: `${progressPct(x.v, x.goal)}%` }} />
            </div>
            {x.min !== undefined && (
              <div className="mt-0.5 text-[10.5px] text-dim2">最低ライン {yen(x.min)}（{progressPct(x.v, x.min)}%）</div>
            )}
          </div>
        ))}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
          {[
            { t: "ARR", v: yen(d.arr) },
            { t: "会費の入金（税込）", v: yen(d.cashIn) },
            { t: "報酬 未払い", v: yen(d.confirmedUnpaid) },
          ].map((x) => (
            <div key={x.t} className="rounded-lg border border-line px-1 py-2">
              <div className="text-dim2">{x.t}</div>
              <div className="font-black">{x.v}</div>
            </div>
          ))}
        </div>
        {editTargets && (
          <div className="mt-3 grid gap-2 border-t border-line pt-3" data-testid="members-targets-form">
            {([
              ["deadline", "期限（YYYY-MM-DD）"], ["mrrMin", "MRR 最低"], ["mrrGoal", "MRR 目標"], ["netGoal", "純売上 目標"],
              ["partnersGoal", "パートナー 目標"], ["contractsGoal", "契約数 目標"],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-[12px]">
                <span className="w-32 shrink-0 text-dim">{label}</span>
                <input
                  value={String(editTargets[k])}
                  onChange={(e) => setEditTargets((v) => v && ({ ...v, [k]: k === "deadline" ? e.target.value : Number(e.target.value) || 0 }))}
                  className="w-full rounded border border-line bg-bg px-2 py-1 text-right font-mono"
                />
              </label>
            ))}
            <button
              onClick={() => setAsk({ title: "目標を直しますか", body: <>期限 {editTargets.deadline}／MRR {yen(editTargets.mrrGoal)}</>, yes: "直す", done: "直しました",
                run: async () => { const r = await post({ action: "targets", targets: editTargets }); if (r) setEditTargets(null); return r; } })}
              className="rounded-lg border border-yel px-3 py-2 text-[12px] text-yel"
              data-testid="members-targets-save"
            >
              保存する
            </button>
          </div>
        )}
      </div>

      {/* ── 入金待ち ── */}
      <div className="mt-5 flex items-baseline">
        <div className="text-[11px] tracking-[2px] text-dim">入金待ちの会費　{pendingPays.length}件</div>
      </div>
      <div className="mt-1 grid gap-2" data-testid="members-pending">
        {pendingPays.map((p) => (
          <div key={p.id} className="rounded-xl border border-yel bg-panel p-3" data-testid="members-payment">
            <div className="flex items-baseline gap-2 text-[13px]">
              <span className="font-black">{p.c.company}</span>
              <span className="text-dim">{p.c.plan?.name}</span>
              <span className="ml-auto font-black">{yen(p.amount)}</span>
            </div>
            <div className="mt-0.5 text-[11.5px] text-dim2">
              {monthLabel(p.periodMonth)}　期限 {ymd(p.dueOn)}　付与 {yen(p.ticketAmount)}
              {p.c.referrer ? `　紹介 ${p.c.referrer.name}` : ""}
              {/* 期限超過（docs/122）。14日過ぎると日次処理が停止する。それまでに催促する */}
              {overdue(p.dueOn) && (
                <span className="ml-1 rounded border border-red px-1 py-0.5 text-[10.5px] text-red" data-testid="members-overdue">期限超過</span>
              )}
            </div>
            {overdue(p.dueOn) && (
              <button
                onClick={() => setAsk({ title: "お支払いの催促を送りますか", body: <>{p.c.company} の担当者に「会費のお支払いが確認できていません」のお知らせ（LINE にも）を送ります。</>, yes: "送る", done: "送りました",
                  run: () => post({ action: "remind", paymentId: p.id }) })}
                className="mt-1.5 w-full rounded-lg border border-red p-2 text-[11.5px] text-red"
                data-testid="members-remind"
              >
                お支払いの催促を送る
              </button>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link
                href={`/invoice/member/${p.id}?owner=1`}
                className={`rounded-lg border p-2 text-center text-[11.5px] no-underline ${p.invoicedAt ? "border-grn text-grn" : "border-yel text-yel"}`}
                data-testid="members-invoice"
              >
                {p.invoicedAt ? `請求書 送付済み（${ymd(p.invoicedAt)}）` : "請求書を発行する（未送信）"}
              </Link>
              <button
                onClick={() =>
                  setAsk({
                    title: "入金を確認しましたか",
                    body: (
                      <>
                        <div>{p.c.company}　{monthLabel(p.periodMonth)}　{yen(p.amount)}（税込）</div>
                        <div className="mt-1">契約が有効になり、チケット {yen(p.ticketAmount)} が付きます。
                          {p.c.referrer ? `紹介元（${p.c.referrer.name}）に報酬が確定します。` : ""}取り消せません。</div>
                      </>
                    ),
                    yes: "入金を確認した",
                    done: "チケットを付けました",
                    run: () => post({ action: "paid", paymentId: p.id }),
                  })
                }
                className="rounded-lg border border-grn p-2 text-[11.5px] text-grn"
                data-testid="members-paid"
              >
                入金を確認した
              </button>
            </div>
            <button
              onClick={() => setAsk({ title: "この請求を取り消しますか", body: <>{p.c.company}　{monthLabel(p.periodMonth)}。入金待ちの行だけ消えます。</>, yes: "取り消す", danger: true, done: "取り消しました",
                run: () => post({ action: "cancel_payment", paymentId: p.id }) })}
              className="mt-1 text-[11px] text-dim2"
              data-testid="members-cancel-payment"
            >
              この請求を取り消す
            </button>
          </div>
        ))}
        {!pendingPays.length && <div className="text-[12px] text-dim2">ありません。</div>}
      </div>

      {/* ── 契約 ── */}
      <div className="mt-5 text-[11px] tracking-[2px] text-dim">契約　{st.contracts.length}件（有効 {d.activeContracts}・入金待ち {d.pendingContracts}）</div>
      <div className="mt-1 grid gap-2" data-testid="members-contracts">
        {st.contracts.map((c) => (
          <div key={c.id} className="rounded-xl border border-line bg-panel p-3" data-testid="members-contract">
            <button onClick={() => toggle(c.id)} className="block w-full text-left">
              <div className="flex items-baseline gap-2 text-[13px]">
                <span className="font-black">{c.company}</span>
                {c.kind === "agency" && <span className="rounded border border-cyan px-1 text-[10px] text-cyan">代理店</span>}
                <span className={`rounded border px-1.5 py-0.5 text-[10.5px] ${c.status === "active" ? "border-grn text-grn" : c.status === "pending" ? "border-yel text-yel" : "border-line text-dim2"}`}>
                  {CONTRACT_STATUS[c.status] ?? c.status}
                </span>
                <span className="ml-auto text-dim">{c.plan?.name}　{yen(c.plan?.monthlyFee ?? 0)}／月</span>
              </div>
              <div className="mt-0.5 text-[11.5px] text-dim2">
                残高 {yen(c.balance.total)}{c.balance.expiring ? `（30日以内に ${yen(c.balance.expiring)} 失効）` : ""}
                {c.nextDueOn && c.status === "active" ? `　次回 ${monthLabel(c.nextDueOn)}` : ""}
                {c.referrer ? `　紹介 ${c.referrer.name}${c.referrer.locked ? "（固定）" : ""}` : ""}
              </div>
            </button>
            {open[c.id] && (
              <div className="mt-2 border-t border-line pt-2 text-[12px]" data-testid="members-contract-detail">
                <div className="text-dim2">
                  {ymd(c.createdAt)} 申込{c.startedOn ? `　開始 ${ymd(c.startedOn)}　満了 ${ymd(c.endsOn)}` : ""}
                  {c.cancelRequestedOn ? <span className="ml-1 rounded border border-org px-1 text-[10px] text-org">解約 {ymd(c.endsOn)} まで</span> : null}
                  {c.note ? <><br />連絡 {c.note}</> : null}
                </div>
                <div className="mt-2 grid gap-1">
                  {c.payments.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-[11.5px]">
                      <span>{monthLabel(p.periodMonth)}</span>
                      <span className="text-dim">{yen(p.amount)}</span>
                      <span className={`rounded border px-1 text-[10px] ${p.status === "paid" ? "border-grn text-grn" : p.status === "pending" ? "border-yel text-yel" : "border-line text-dim2"}`}>{PAYMENT_STATUS[p.status] ?? p.status}</span>
                      <Link href={`/invoice/member/${p.id}?owner=1`} className="text-cyan no-underline">請求書</Link>
                      {p.status === "paid" && (
                        <button
                          onClick={() => setAsk({ title: "この入金を返金あつかいにしますか", body: <>{c.company}　{monthLabel(p.periodMonth)}　{yen(p.amount)}。その月のチケットの残りは 0 になり、紹介元の報酬は取り消し（支払い済みなら負の調整）になります。実際の返金は銀行で行ってください。</>, yes: "返金あつかいにする", danger: true, done: "返金あつかいにしました",
                            run: () => post({ action: "refund", paymentId: p.id, note: reason }) })}
                          className="ml-auto text-[10.5px] text-dim2"
                        >
                          返金あつかい
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.status !== "ended" && (
                    <button onClick={() => setAsk({ title: "次の月の請求を起こしますか", body: <>{c.company}　{monthLabel(c.nextDueOn ?? nextMonth(thisMonth))}。もう起こしてあれば何も起きません。</>, yes: "起こす", done: "起こしました",
                      run: () => post({ action: "open", contractId: c.id }) })} className="rounded border border-line px-2 py-1 text-[11px]" data-testid="members-open">
                      次の月の請求を起こす
                    </button>
                  )}
                  {c.status === "active" && (
                    <button onClick={() => setAsk({ title: "契約を停止しますか", body: <>{c.company}。停止中はチケットで払えません。再開できます。</>, yes: "停止する", danger: true, done: "停止しました",
                      run: () => post({ action: "contract_status", contractId: c.id, status: "suspended" }) })} className="rounded border border-line px-2 py-1 text-[11px]">停止</button>
                  )}
                  {c.status === "suspended" && (
                    <button onClick={() => setAsk({ title: "契約を再開しますか", body: <>{c.company}</>, yes: "再開する", done: "再開しました",
                      run: () => post({ action: "contract_status", contractId: c.id, status: "active" }) })} className="rounded border border-grn px-2 py-1 text-[11px] text-grn">再開</button>
                  )}
                  {c.status !== "ended" && !c.cancelRequestedOn && (
                    <button onClick={() => setAsk({ title: "解約の申し出を受けますか", body: <>{c.company}。申し出の月の翌月末で終了し、以後の請求は起こしません。入金待ちの請求は取り消されます。払った月のチケットは失効日まで使えます。</>, yes: "受ける", danger: true, done: "受けました",
                      run: () => post({ action: "cancel", contractId: c.id }) })} className="rounded border border-org px-2 py-1 text-[11px] text-org" data-testid="members-cancel">解約を受ける</button>
                  )}
                  {c.status !== "ended" && (
                    <button onClick={() => setAsk({ title: "契約を終了しますか", body: <>{c.company}。終了した契約は戻せません。残っているチケットは失効し、入金待ちの請求は取り消されます（docs/121）。</>, yes: "終了する", danger: true, done: "終了しました",
                      run: () => post({ action: "contract_status", contractId: c.id, status: "ended" }) })} className="rounded border border-red px-2 py-1 text-[11px] text-red" data-testid="members-end">終了</button>
                  )}
                  {c.status !== "ended" && (
                    <select
                      value=""
                      onChange={(e) => {
                        const pl = st.plans.find((p) => p.id === e.target.value);
                        if (!pl) return;
                        setAsk({ title: "プランを変えますか", body: <>{c.company}　{c.plan?.name} → {pl.name}（{yen(pl.monthlyFee)}／月）。次に起こす請求から変わります。</>, yes: "変える", done: "変えました",
                          run: () => post({ action: "contract_plan", contractId: c.id, planId: pl.id }) });
                      }}
                      className="rounded border border-line bg-bg px-2 py-1 text-[11px]"
                      data-testid="members-plan-change"
                    >
                      <option value="">プラン変更…</option>
                      {st.plans.filter((p) => p.kind === c.kind && p.id !== c.plan?.id).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} {yen(p.monthlyFee)}</option>
                      ))}
                    </select>
                  )}
                </div>
                {/* 紹介元の変更。理由を必ず書く */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid="members-referrer">
                  <span className="text-[11px] text-dim2">紹介元</span>
                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      const to = v === "none" ? null : v;
                      const name = to ? st.partners.find((p) => p.id === to)?.name ?? "" : "（なし）";
                      if (!reason.trim()) { onNote("紹介元を変えるときは、理由を書いてください。"); return; }
                      setAsk({ title: "紹介元を変えますか", body: <>{c.company}　{c.referrer?.name ?? "（なし）"} → {name}。理由「{reason}」を記録に残します。</>, yes: "変える", danger: true, done: "変えました",
                        run: async () => { const r = await post({ action: "referrer", companyId: c.companyId, partnerId: to, reason }); if (r) setReason(""); return r; } });
                    }}
                    className="rounded border border-line bg-bg px-2 py-1 text-[11px]"
                  >
                    <option value="">変更…</option>
                    <option value="none">なしにする</option>
                    {st.partners.filter((p) => p.id !== c.referrer?.id).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}（{p.code}）</option>
                    ))}
                  </select>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="理由（必須）" className="min-w-0 flex-1 rounded border border-line bg-bg px-2 py-1 text-[11px]" data-testid="members-referrer-reason" />
                </div>
                {/* 協力会社（docs/122）。代理店の契約だけ。下に付けた会社の受講コードを、代理店のチケットで買える */}
                {c.kind === "agency" && (
                  <div className="mt-2 rounded-lg border border-cyan px-2.5 py-2" data-testid="members-children">
                    <div className="text-[11px] tracking-[2px] text-dim">協力会社</div>
                    <div className="mt-1 grid gap-1">
                      {st.companies.filter((x) => x.parentId === c.companyId).map((x) => (
                        <div key={x.id} className="flex items-center gap-2 text-[11.5px]">
                          <span>{x.name}</span>
                          <button onClick={() => setAsk({ title: "協力会社から外しますか", body: <>{x.name} を {c.company} の下から外します。もう買ってある受講コードはそのまま使えます。</>, yes: "外す", danger: true, done: "外しました",
                            run: () => post({ action: "set_parent", companyId: x.id, parentId: null }) })} className="ml-auto text-[10.5px] text-dim2">外す</button>
                        </div>
                      ))}
                      {!st.companies.some((x) => x.parentId === c.companyId) && <div className="text-[11px] text-dim2">まだありません。</div>}
                    </div>
                    <select
                      value=""
                      onChange={(e) => {
                        const x = st.companies.find((y) => y.id === e.target.value);
                        if (!x) return;
                        setAsk({ title: "協力会社として付けますか", body: <>{x.name} を {c.company} の下に付けます。{c.company} の担当者が、{x.name} の受講コードを自社のチケットで申し込めるようになります。</>, yes: "付ける", done: "付けました",
                          run: () => post({ action: "set_parent", companyId: x.id, parentId: c.companyId }) });
                      }}
                      className="mt-1 w-full rounded border border-line bg-bg px-2 py-1 text-[11px]"
                      data-testid="members-children-add"
                    >
                      <option value="">協力会社を足す…</option>
                      {st.companies.filter((x) => x.id !== c.companyId && !x.parentId).map((x) => (
                        <option key={x.id} value={x.id}>{x.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {!st.contracts.length && <div className="text-[12px] text-dim2">まだありません。</div>}
      </div>

      {/* ── パートナー ── */}
      <div className="mt-5 text-[11px] tracking-[2px] text-dim">営業パートナー　{st.partners.length}人（承認待ち {d.pendingPartners}）</div>
      <div className="mt-1 grid gap-2" data-testid="members-partners">
        {st.partners.map((p) => (
          <div key={p.id} className={`rounded-xl border bg-panel p-3 ${p.status === "pending" ? "border-yel" : "border-line"}`} data-testid="members-partner">
            <button onClick={() => toggle(p.id)} className="block w-full text-left">
              <div className="flex items-baseline gap-2 text-[13px]">
                <span className="font-black">{p.name}</span>
                <span className="text-[10.5px] text-dim2">{p.kind === "corp" ? "法人" : "個人"}</span>
                <span className={`rounded border px-1.5 py-0.5 text-[10.5px] ${p.status === "approved" ? "border-grn text-grn" : p.status === "pending" ? "border-yel text-yel" : "border-line text-dim2"}`}>
                  {PARTNER_STATUS[p.status] ?? p.status}
                </span>
                <span className="ml-auto font-mono text-[12px] text-dim">{p.code}　{p.rate}%</span>
              </div>
              <div className="mt-0.5 text-[11.5px] text-dim2">
                紹介 {p.contracts}社（有効 {p.activeContracts}）　確定未払い {yen(p.confirmed)}　支払済 {yen(p.paid)}　見込み {yen(p.expectedMonthly)}／月
              </div>
            </button>
            {open[p.id] && (
              <div className="mt-2 border-t border-line pt-2 text-[12px]" data-testid="members-partner-detail">
                <div className="text-dim2">{p.contact}　{p.email}　{ymd(p.createdAt)} 登録{p.approvedAt ? `　${ymd(p.approvedAt)} 承認` : ""}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.status !== "approved" && (
                    <button onClick={() => setAsk({ title: "承認しますか", body: <>{p.name}（{p.code}）。承認すると紹介コードが使えるようになります。業務委託契約書を取り交わしてから押してください。</>, yes: "承認する", done: "承認しました",
                      run: () => post({ action: "partner_status", partnerId: p.id, status: "approved" }) })} className="rounded border border-grn px-2 py-1 text-[11px] text-grn" data-testid="members-partner-approve">承認</button>
                  )}
                  {p.status === "approved" && (
                    <button onClick={() => setAsk({ title: "停止しますか", body: <>{p.name}。停止中は紹介コードが使えず、新しい報酬は付きません。</>, yes: "停止する", danger: true, done: "停止しました",
                      run: () => post({ action: "partner_status", partnerId: p.id, status: "suspended" }) })} className="rounded border border-line px-2 py-1 text-[11px]">停止</button>
                  )}
                  <button onClick={() => { const v = prompt("報酬率（%・整数）", String(p.rate)); if (v === null) return; const rate = Number(v); setAsk({ title: "報酬率を変えますか", body: <>{p.name}　{p.rate}% → {rate}%。次の入金から変わります。</>, yes: "変える", done: "変えました",
                    run: () => post({ action: "partner_rate", partnerId: p.id, rate }) }); }} className="rounded border border-line px-2 py-1 text-[11px]">報酬率</button>
                </div>
                {/* 確定した報酬を月ごとに。支払ったら「支払い済み」に */}
                {(() => {
                  const mine = st.commissions.filter((x) => x.partnerId === p.id && x.status === "confirmed");
                  const months = [...new Set(mine.map((x) => x.periodMonth))].sort();
                  return months.length ? (
                    <div className="mt-2 grid gap-1" data-testid="members-payout-months">
                      {months.map((m) => {
                        const total = mine.filter((x) => x.periodMonth === m).reduce((n, x) => n + x.amount, 0);
                        return (
                          <div key={m} className="flex items-center gap-2 text-[11.5px]">
                            <span>{monthLabel(m)}</span>
                            <span className="text-dim">確定 {yen(total)}</span>
                            {total < TERMS.payoutMin && <span className="text-[10.5px] text-org">{yen(TERMS.payoutMin)}未満（翌月に繰越）</span>}
                            <button onClick={() => setAsk({ title: "支払い済みにしますか", body: <>{p.name}　{monthLabel(m)}　{yen(total)}。実際の振込みを済ませてから押してください。{total < TERMS.payoutMin ? `${yen(TERMS.payoutMin)}未満なので、ふだんは翌月に繰り越します。` : ""}</>, yes: "支払い済みにする", done: "記録しました",
                              run: () => post({ action: "payout", partnerId: p.id, month: m }) })} className="ml-auto rounded border border-yel px-2 py-0.5 text-[10.5px] text-yel" data-testid="members-payout">
                              支払い済みにする
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div className="mt-2 text-[11px] text-dim2">未払いの確定分はありません。</div>;
                })()}
                {/* 支払い済みの明細（docs/122）。印刷して渡す・CSV */}
                {st.payouts.filter((po) => po.partnerId === p.id).map((po) => (
                  <Link key={po.id} href={`/owner/payout/${po.id}`} className="mt-1 flex items-baseline gap-2 text-[11.5px] no-underline" data-testid="members-payout-link">
                    <span className="text-dim2">{monthLabel(po.periodMonth)}</span>
                    <span className="text-txt">{yen(po.total)}</span>
                    <span className="text-[10.5px] text-dim2">{po.paidAt ? `${ymd(po.paidAt)} 支払` : ""}</span>
                    <span className="ml-auto text-cyan">明細を開く</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        {!st.partners.length && <div className="text-[12px] text-dim2">まだいません。</div>}
      </div>

      {/* ── プラン ── */}
      <div className="mt-5 flex items-baseline">
        <div className="text-[11px] tracking-[2px] text-dim">プラン</div>
        <button onClick={() => setEditPlan({ kind: "member", name: "", monthlyFee: 0, ticketAmount: 0, ticketMonths: 12, public: true, sortOrder: 0, note: "" })} className="ml-auto text-[11.5px] text-cyan" data-testid="members-plan-new">
          プランを足す
        </button>
      </div>
      <div className="mt-1 grid gap-1.5" data-testid="members-plans">
        {st.plans.map((p) => (
          <button key={p.id} onClick={() => setEditPlan({ ...p })} className="flex items-baseline gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-left text-[12px]" data-testid="members-plan">
            <span className="text-[10.5px] text-dim2">{p.kind === "agency" ? "代理店" : "会員"}</span>
            <span className="font-bold">{p.name}</span>
            <span className="text-dim">{yen(p.monthlyFee)}／月　チケット {yen(p.ticketAmount)}（{p.ticketMonths}か月）</span>
            {!p.public && <span className="ml-auto rounded border border-line px-1 text-[10px] text-dim2">非公開</span>}
          </button>
        ))}
      </div>
      {editPlan && (
        <div className="mt-2 grid gap-2 rounded-xl border border-yel bg-panel p-3" data-testid="members-plan-form">
          <div className="grid grid-cols-2 gap-2">
            {(["member", "agency"] as const).map((k) => (
              <button key={k} onClick={() => setEditPlan((v) => v && ({ ...v, kind: k }))} className={`rounded border px-2 py-1.5 text-[12px] ${editPlan.kind === k ? "border-yel text-yel" : "border-line text-dim2"}`}>{k === "agency" ? "販売代理店" : "法人会員"}</button>
            ))}
          </div>
          {([["name", "名前", "text"], ["monthlyFee", "月額（税抜）", "number"], ["ticketAmount", "毎月のチケット", "number"], ["ticketMonths", "有効期間（か月）", "number"], ["sortOrder", "並び", "number"], ["note", "注記", "text"]] as const).map(([k, label, type]) => (
            <label key={k} className="flex items-center gap-2 text-[12px]">
              <span className="w-28 shrink-0 text-dim">{label}</span>
              <input type={type} value={String(editPlan[k] ?? "")} onChange={(e) => setEditPlan((v) => v && ({ ...v, [k]: type === "number" ? Number(e.target.value) : e.target.value }))} className="w-full rounded border border-line bg-bg px-2 py-1" data-testid={`members-plan-${k}`} />
            </label>
          ))}
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={editPlan.public !== false} onChange={(e) => setEditPlan((v) => v && ({ ...v, public: e.target.checked }))} />
            公開する（申込みの画面と案内に出す）
          </label>
          {editPlan.monthlyFee !== undefined && (
            <div className="text-[11px] text-dim2">税込 {yen(grossOf(editPlan.monthlyFee ?? 0))}／月。チケットは会費の {editPlan.monthlyFee ? Math.round(((editPlan.ticketAmount ?? 0) / editPlan.monthlyFee) * 100) : 0}%</div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setAsk({ title: editPlan.id ? "プランを直しますか" : "プランを足しますか", body: <>{editPlan.name}　{yen(editPlan.monthlyFee ?? 0)}／月　チケット {yen(editPlan.ticketAmount ?? 0)}。もう結んである契約の額は変わりません（次に起こす請求から）。</>, yes: "保存する", done: "保存しました",
              run: async () => { const r = await post({ action: "plan_save", plan: editPlan }); if (r) setEditPlan(null); return r; } })} className="rounded-lg border border-yel px-3 py-2 text-[12px] text-yel" data-testid="members-plan-save">保存する</button>
            <button onClick={() => setEditPlan(null)} className="rounded-lg border border-line px-3 py-2 text-[12px] text-dim2">閉じる</button>
          </div>
        </div>
      )}

      {/* ── 月次 ── */}
      <div className="mt-5 text-[11px] tracking-[2px] text-dim">日次処理（毎朝 Vercel Cron が同じことをします）</div>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <button onClick={() => setAsk({ title: "日次処理を回しますか", body: <>期限切れのチケットの失効、満了30日前の自動更新、解約の申し出があった契約の終了、支払期限を14日過ぎた契約の停止、翌月の請求の起票。もう済んでいるものは何も起きません。</>, yes: "回す", done: "回しました",
          run: () => post({ action: "month_open" }) })} className="rounded-lg border border-line p-2.5 text-[12px]" data-testid="members-month-open">日次処理を回す</button>
        <button onClick={() => setAsk({ title: "期限切れのチケットを失効させますか", body: <>期限を過ぎて残っているチケットを 0 にし、履歴に残します。</>, yes: "失効させる", done: "失効させました",
          run: () => post({ action: "expire" }) })} className="rounded-lg border border-line p-2.5 text-[12px]" data-testid="members-expire">期限切れを失効させる</button>
      </div>

      {/* 報酬の月まとめ CSV（docs/122）。締めのときに会計へ渡す */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]" data-testid="members-csv">
        <span className="text-dim2">報酬の CSV</span>
        {[thisMonth, nextMonth(thisMonth) === thisMonth ? thisMonth : `${thisMonth.slice(0, 4)}-${String(Number(thisMonth.slice(5, 7)) - 1 || 12).padStart(2, "0")}-01`].map((m, i) => (
          <a key={m + i} href={`/api/owner/payout?month=${m.slice(0, 7)}&format=csv`} className="rounded border border-line px-2 py-1 text-cyan no-underline">
            {monthLabel(m)}
          </a>
        ))}
      </div>

      {/* ── ログ ── */}
      <button onClick={() => setShowLogs((v) => !v)} className="mt-5 text-[11px] tracking-[2px] text-dim" data-testid="members-logs-toggle">
        操作ログ {showLogs ? "▲" : "▼"}
      </button>
      {showLogs && (
        <div className="mt-1 grid gap-0.5" data-testid="members-logs">
          {st.logs.map((l) => (
            <div key={l.id} className="flex gap-2 border-b border-line py-1 text-[11px]">
              <span className="w-20 shrink-0 text-dim2">{ymd(l.at)}</span>
              <span className="shrink-0">{ACTION[l.action] ?? l.action}</span>
              <span className="min-w-0 truncate text-dim2">{l.after ? JSON.stringify(l.after) : ""}</span>
            </div>
          ))}
          {!st.logs.length && <div className="text-[12px] text-dim2">まだありません。</div>}
        </div>
      )}
      <AskDone ask={ask} onClose={() => setAsk(null)} />
    </div>
  );
}
