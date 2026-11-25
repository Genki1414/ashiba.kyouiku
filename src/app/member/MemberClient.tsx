"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";
import { Loading } from "@/components/Loading";
import { AskDone, type Ask, type RunResult } from "@/components/AskDone";
import { yen } from "@/lib/pricing";
import {
  CONTRACT_STATUS,
  PAYMENT_STATUS,
  TERMS,
  grossOf,
  monthLabel,
  normalizeRefCode,
  ymd,
  type ContractStatus,
  type PaymentStatus,
  type Plan,
} from "@/lib/membership";

/* 法人会員（0040・docs/120）。事業者の教育担当者の画面。

   契約が無ければ … プランを選んで申し込む（請求書払い。入金の確認は運営）
   契約があれば   … チケットの残高・失効の予定・月々の請求書・付与と消費の履歴

   金額は全部サーバから。ここでは税込の見せ方（grossOf）だけ計算する。 */

type Contract = {
  id: string;
  kind: string;
  status: ContractStatus;
  method: string;
  startedOn: string | null;
  endsOn: string | null;
  nextDueOn: string | null;
  /** 解約の申し出があった日。あれば ends_on で終わる */
  cancelRequestedOn: string | null;
  createdAt: string;
  plan: Plan | null;
};
type Payment = {
  id: string; periodMonth: string; net: number; tax: number; amount: number; ticketAmount: number;
  method: string; status: PaymentStatus; dueOn: string | null; invoicedAt: string | null; paidAt: string | null;
};
type Lot = { id: string; amount: number; remaining: number; grantedAt: string; expiresAt: string };
type Txn = { id: string; kind: string; amount: number; orderId: string | null; note: string; at: string };
type Loaded = {
  company: string;
  plans: Plan[];
  refCode: string;
  contract: Contract | null;
  balance: { total: number; expiring: number; nextExpire: string | null };
  lots: Lot[];
  txns: Txn[];
  payments: Payment[];
};

const TXN: Record<string, string> = {
  grant: "付与",
  spend: "消費",
  expire: "失効",
  return: "戻し",
  refund: "返金",
  adjust: "調整",
};

export function MemberClient() {
  const [st, setSt] = useState<Loaded | null>(null);
  const [ng, setNg] = useState("");
  const [note, setNote] = useState("");
  const [planId, setPlanId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/member/contract", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setNg(j.reason ?? "画面を表示できません。");
        return;
      }
      setSt({
        company: j.company ?? "",
        plans: Array.isArray(j.plans) ? j.plans : [],
        refCode: j.refCode ?? "",
        contract: j.contract ?? null,
        balance: j.balance ?? { total: 0, expiring: 0, nextExpire: null },
        lots: Array.isArray(j.lots) ? j.lots : [],
        txns: Array.isArray(j.txns) ? j.txns : [],
        payments: Array.isArray(j.payments) ? j.payments : [],
      });
      /* 紹介 URL から来ていれば、コードを埋めておく。打ち直せる */
      if (j.refCode) setCode((c) => c || j.refCode);
      setNg("");
    } catch {
      setNg("接続できません。電波の届く場所で、もう一度お試しください。");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (ng) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
        <h1 className="mt-2 text-[18px] font-black">法人会員</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-dim" data-testid="member-ng">{ng}</p>
      </main>
    );
  }
  if (!st) return <Loading title="法人会員" back="/" rows={3} />;

  const apply = async (): Promise<RunResult> => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/member/contract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, code: normalizeRefCode(code) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "申し込みできませんでした。");
        return false;
      }
      await load();
      return {
        done: "お申し込みを受け付けました",
        doneBody: "初月の請求書をお送りします。お振込みの確認後、その月のチケットが付きます。",
      };
    } finally {
      setBusy(false);
    }
  };

  const picked = st.plans.find((p) => p.id === planId) ?? null;

  /* ── 申し込む ── */
  const renderApply = () => {
    return (
      <main className="px-5 py-8 pb-12">
        <div className="tape -mx-5 mb-6" />
        <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
        <h1 className="mt-2 text-[18px] font-black">法人会員に申し込む</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
          {st.company} の月額プランです。毎月の会費（税抜）の2倍のチケットが付き、
          受講コードの申込みにチケットで払えます。チケットは付与から{TERMS.ticketMonthsMax}か月で失効します。
        </p>
        <div className="mt-2 rounded-lg border border-line bg-panel px-3 py-2 text-[11.5px] leading-relaxed text-dim" data-testid="member-terms">
          契約期間は{TERMS.contractMonths}か月。満了の1か月前までに申し出が無ければ同じ期間で更新します。
          途中の解約は{TERMS.cancelNotice}で、以後の会費はかかりません。払った月のチケットは失効日まで使えます。
          会費の返金はありません。契約が終わると残っているチケットは失効します。
        </div>
        <Link href="/members" className="mt-1 inline-block text-[12px] text-cyan no-underline" data-testid="member-lp">
          制度の案内を見る
        </Link>

        <div className="mt-4 grid gap-2" data-testid="member-plans">
          {st.plans.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlanId(p.id)}
              className={`rounded-xl border p-3.5 text-left ${planId === p.id ? "border-yel bg-[#1A1F14]" : "border-line bg-panel"}`}
              data-testid="member-plan"
            >
              <div className="flex items-baseline gap-2">
                <div className="text-[15px] font-black">{p.name}</div>
                <div className="ml-auto text-[14px] font-black">{yen(p.monthlyFee)}<span className="text-[10.5px] text-dim">／月（税抜）</span></div>
              </div>
              <div className="mt-1 text-[12px] text-dim">
                税込 {yen(grossOf(p.monthlyFee))}　毎月チケット {yen(p.ticketAmount)}（{p.ticketMonths}か月有効）
              </div>
              {p.note && <div className="mt-1 text-[11.5px] text-dim2">{p.note}</div>}
            </button>
          ))}
          {!st.plans.length && (
            <div className="rounded-lg border border-line p-3 text-[12px] text-dim">いま選べるプランがありません。</div>
          )}
        </div>

        <label className="mb-1 mt-4 block text-[11px] tracking-[2px] text-dim">紹介コード（あれば）</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD2345"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-[14px] tracking-widest"
          data-testid="member-code"
        />
        {note && <div className="mt-2 text-[12px] text-red" data-testid="member-note">{note}</div>}

        <div className="mt-4">
          <Btn
            tone="y"
            dis={busy || !picked}
            testid="member-apply"
            onClick={() => {
              if (!picked) return;
              setAsk({
                title: "法人会員に申し込みますか",
                body: (
                  <>
                    <div>{picked.name}　月額 {yen(picked.monthlyFee)}（税抜）／税込 {yen(grossOf(picked.monthlyFee))}</div>
                    <div className="mt-1">毎月 {yen(picked.ticketAmount)} のチケットが付きます（付与から{picked.ticketMonths}か月有効）。</div>
                    <div className="mt-2">初月の請求書をお送りします。お振込みの確認後にチケットが付きます。</div>
                    {normalizeRefCode(code) && <div className="mt-1 text-dim">紹介コード {normalizeRefCode(code)}</div>}
                  </>
                ),
                yes: "申し込む",
                done: "お申し込みを受け付けました",
                run: apply,
              });
            }}
          >
            {busy ? "…" : "請求書払いで申し込む"}
          </Btn>
        </div>
        <div className="mt-3 border-t border-line pt-3 text-[11.5px] leading-relaxed text-dim2">
          申し込むと{" "}
          <Link href="/legal/terms" className="text-cyan no-underline">利用規約</Link>{" "}
          と{" "}
          <Link href="/legal/privacy" className="text-cyan no-underline">個人情報の取扱い</Link>{" "}
          に同意したものとします。
          <Link href="/legal/tokushoho" className="ml-1 text-cyan no-underline">特定商取引法に基づく表記</Link>
        </div>
      </main>
    );
  };

  /* ── 契約がある ── */
  const renderContract = () => {
  const c = st.contract!;
  const pendingPay = st.payments.find((p) => p.status === "pending") ?? null;
  return (
    <main className="px-5 py-8 pb-12">
      <div className="tape -mx-5 mb-6" />
      <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
      <h1 className="mt-2 text-[18px] font-black">法人会員</h1>
      <div className="mt-1 text-[12.5px] text-dim">{st.company}</div>

      <div className="mt-4 rounded-xl border border-line bg-panel p-4" data-testid="member-contract">
        <div className="flex items-baseline gap-2">
          <div className="text-[15px] font-black">{c.plan?.name ?? "プラン"}</div>
          <span
            className={`rounded border px-1.5 py-0.5 text-[10.5px] ${
              c.status === "active" ? "border-grn text-grn" : c.status === "pending" ? "border-yel text-yel" : "border-line text-dim2"
            }`}
            data-testid="member-status"
          >
            {CONTRACT_STATUS[c.status] ?? c.status}
          </span>
          <div className="ml-auto text-[13px]">{yen(c.plan?.monthlyFee ?? 0)}<span className="text-[10.5px] text-dim">／月（税抜）</span></div>
        </div>
        <div className="mt-1 text-[11.5px] text-dim2">
          {c.startedOn ? `開始 ${ymd(c.startedOn)}　満了 ${ymd(c.endsOn)}` : `${ymd(c.createdAt)} 申込`}
          {c.nextDueOn && c.status === "active" ? `　次回 ${monthLabel(c.nextDueOn)}` : ""}
        </div>
      </div>

      {/* 残高。**いちばん大きく。**担当者がここへ来る理由はこれ */}
      <div className="mt-3 rounded-xl border border-yel bg-[#1A1F14] p-4" data-testid="member-balance">
        <div className="text-[11px] tracking-[2px] text-dim">使えるチケット</div>
        <div className="mt-1 text-[26px] font-black text-yel">{yen(st.balance.total)}</div>
        {st.balance.expiring > 0 && (
          <div className="mt-1 text-[11.5px] text-org" data-testid="member-expiring">
            30日以内に {yen(st.balance.expiring)} が失効します（{ymd(st.balance.nextExpire)}）。
          </div>
        )}
        {c.status === "active" && st.balance.total > 0 && (
          <Link
            href="/order"
            className="mt-3 block rounded-lg border border-yel bg-yel p-2.5 text-center text-[13px] font-extrabold text-bg no-underline"
            data-testid="member-order"
          >
            チケットで受講コードを申し込む
          </Link>
        )}
        {c.status === "pending" && (
          <div className="mt-2 text-[12px] leading-relaxed text-dim" data-testid="member-wait">
            初月の入金が確認されると、チケットが付いて使えるようになります。
          </div>
        )}
      </div>

      {/* 届いている請求書 */}
      {pendingPay && (
        <div className="mt-3 rounded-xl border border-yel bg-panel p-4" data-testid="member-bill">
          <div className="text-[11px] tracking-[2px] text-dim">お支払い</div>
          <div className="mt-1 text-[13px]">
            {monthLabel(pendingPay.periodMonth)}の会費　<strong>{yen(pendingPay.amount)}</strong>（税込）
            {pendingPay.dueOn ? `　期限 ${ymd(pendingPay.dueOn)}` : ""}
          </div>
          {pendingPay.invoicedAt ? (
            <Link
              href={`/invoice/member/${pendingPay.id}`}
              className="mt-2 block rounded-lg border border-yel px-3 py-2 text-center text-[12.5px] font-bold text-yel no-underline"
              data-testid="member-invoice"
            >
              請求書を表示（{ymd(pendingPay.invoicedAt)} 発行）
            </Link>
          ) : (
            <div className="mt-2 rounded-lg border border-line px-3 py-2 text-[11.5px] text-dim">
              請求書は運営が発行します。発行されると、こちらから開けます。
            </div>
          )}
        </div>
      )}

      {/* 月々 */}
      <div className="mt-5 text-[11px] tracking-[2px] text-dim">月々の会費</div>
      <div className="mt-1 grid gap-1.5" data-testid="member-payments">
        {st.payments.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[12px]">
            <span>{monthLabel(p.periodMonth)}</span>
            <span className="text-dim">{yen(p.amount)}</span>
            <span className={`ml-auto rounded border px-1.5 py-0.5 text-[10.5px] ${p.status === "paid" ? "border-grn text-grn" : p.status === "pending" ? "border-yel text-yel" : "border-line text-dim2"}`}>
              {PAYMENT_STATUS[p.status] ?? p.status}
            </span>
            {p.invoicedAt && p.method === "invoice" && (
              <Link href={`/invoice/member/${p.id}`} className="text-[11px] text-cyan no-underline">請求書</Link>
            )}
          </div>
        ))}
        {!st.payments.length && <div className="text-[12px] text-dim2">まだありません。</div>}
      </div>

      {/* 解約（docs/121）。申し出の月の翌月末で終わる。払った月のチケットは失効日まで使える */}
      {c.status !== "ended" && (
        <div className="mt-5 rounded-xl border border-line bg-panel p-3 text-[12px]" data-testid="member-cancel">
          {c.cancelRequestedOn ? (
            <div className="text-dim">
              {ymd(c.cancelRequestedOn)} に解約を申し出ました。<strong className="text-txt">{ymd(c.endsOn)}</strong> で終了します。
              それまで残っているチケットは使えます。以後の会費はかかりません。
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 text-dim">
                解約は{TERMS.cancelNotice}です。申し出のあとも、終了日までチケットは使えます。
              </div>
              <button
                onClick={() =>
                  setAsk({
                    title: "解約を申し出ますか",
                    body: (
                      <>
                        <div>{c.plan?.name}　{yen(c.plan?.monthlyFee ?? 0)}／月</div>
                        <div className="mt-1">{TERMS.cancelNotice}で終了し、以後の会費はかかりません。入金待ちの請求は取り消されます。</div>
                        <div className="mt-1">払った月のチケットは失効日まで使えます。終了日に残っているチケットは失効し、返金はありません。</div>
                      </>
                    ),
                    yes: "解約を申し出る",
                    danger: true,
                    done: "解約を受け付けました",
                    run: async (): Promise<RunResult> => {
                      setBusy(true);
                      try {
                        const res = await fetch("/api/member/contract", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ action: "cancel" }),
                        });
                        const j = await res.json().catch(() => ({}));
                        if (!res.ok || !j.ok) { setNote(j.reason ?? "申し出できませんでした。"); return false; }
                        await load();
                        return { done: "解約を受け付けました", doneBody: `${ymd(j.endsOn)} で終了します。それまでチケットは使えます。` };
                      } finally {
                        setBusy(false);
                      }
                    },
                  })
                }
                className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[11.5px] text-dim2"
                data-testid="member-cancel-go"
                disabled={busy}
              >
                解約を申し出る
              </button>
            </div>
          )}
          {note && <div className="mt-2 text-[12px] text-red">{note}</div>}
        </div>
      )}

      {/* ロット */}
      <div className="mt-5 text-[11px] tracking-[2px] text-dim">チケットの内訳（失効日の順）</div>
      <div className="mt-1 grid gap-1.5" data-testid="member-lots">
        {st.lots.filter((l) => l.remaining > 0).map((l) => (
          <div key={l.id} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[12px]">
            <span>{ymd(l.grantedAt)} 付与</span>
            <span className="text-dim">残り {yen(l.remaining)}／{yen(l.amount)}</span>
            <span className="ml-auto text-[11px] text-dim2">{ymd(l.expiresAt)} 失効</span>
          </div>
        ))}
        {!st.lots.some((l) => l.remaining > 0) && <div className="text-[12px] text-dim2">使えるチケットはありません。</div>}
      </div>

      {/* 履歴 */}
      <div className="mt-5 text-[11px] tracking-[2px] text-dim">履歴</div>
      <div className="mt-1 grid gap-1" data-testid="member-txns">
        {st.txns.map((t) => (
          <div key={t.id} className="flex items-baseline gap-2 border-b border-line py-1.5 text-[12px]">
            <span className="w-24 shrink-0 text-dim2">{ymd(t.at)}</span>
            <span className="w-8 shrink-0">{TXN[t.kind] ?? t.kind}</span>
            <span className={`ml-auto font-mono ${t.amount < 0 ? "text-org" : "text-grn"}`}>
              {t.amount < 0 ? "−" : "+"}{yen(Math.abs(t.amount))}
            </span>
          </div>
        ))}
        {!st.txns.length && <div className="text-[12px] text-dim2">まだありません。</div>}
      </div>
    </main>
  );
  };
  const main = st.contract ? renderContract() : renderApply();

  /* **確かめる札は1か所。**申込みの画面と契約の画面で別々に置くと、申し込んだ瞬間に
     画面が切り替わって札が作り直され、「終わった」が出ないまま最初の問いに戻る */
  return (
    <>
      {main}
      <AskDone ask={ask} onClose={() => setAsk(null)} />
    </>
  );
}
