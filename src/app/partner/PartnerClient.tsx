"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";
import { CopyBtn } from "@/components/ui/CopyBtn";
import { Loading } from "@/components/Loading";
import { AskDone, type Ask, type RunResult } from "@/components/AskDone";
import { yen } from "@/lib/pricing";
import { CONTRACT_STATUS, PARTNER_STATUS, monthLabel, ymd, type ContractStatus, type PartnerStatus } from "@/lib/membership";

/* 営業パートナー（0040・docs/120）。本人の画面。

   登録が無ければ … 名前・種別・連絡先で登録（承認待ち）
   登録があれば   … 紹介コードと URL、紹介した会社、報酬（確定・支払い済み・見込み）、振込先

   **確定と見込みは別の数字。**見込みは「いまの契約が払い続けたら」の月あたりで、
   払われる額ではない。確定は入金のあった分（運営の入金確認で立つ）だけ。 */

type Partner = {
  id: string; name: string; kind: string; status: PartnerStatus; code: string; rate: number;
  contact: string; approvedAt: string | null; createdAt: string;
};
type Bank = { bankName: string; branch: string; acctType: string; acctNo: string; holder: string; taxNote: string };
type Referral = {
  companyId: string; company: string; source: string; since: string;
  contract: { status: ContractStatus; plan: string; monthlyFee: number; startedOn: string | null; nextDueOn: string | null; expectedMonthly: number } | null;
};
type Commission = { id: string; company: string; periodMonth: string; baseNet: number; rate: number; amount: number; kind: string; status: string; at: string };
type Payout = { id: string; periodMonth: string; total: number; status: string; paidAt: string | null };
type Loaded = {
  partner: Partner | null;
  url: string;
  bank: Bank | null;
  referrals: Referral[];
  commissions: Commission[];
  payouts: Payout[];
  totals: { confirmed: number; paid: number; expectedMonthly: number; activeContracts: number } | null;
};

const EMPTY_BANK: Bank = { bankName: "", branch: "", acctType: "普通", acctNo: "", holder: "", taxNote: "" };

export function PartnerClient() {
  const [st, setSt] = useState<Loaded | null>(null);
  const [ng, setNg] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  /* 登録 */
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"individual" | "corp">("individual");
  const [contact, setContact] = useState("");
  /* 振込先 */
  const [bank, setBank] = useState<Bank>(EMPTY_BANK);
  const [bankOpen, setBankOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/partner", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setNg(j.reason ?? "画面を表示できません。");
        return;
      }
      setSt({
        partner: j.partner ?? null,
        url: j.url ?? "",
        bank: j.bank ?? null,
        referrals: Array.isArray(j.referrals) ? j.referrals : [],
        commissions: Array.isArray(j.commissions) ? j.commissions : [],
        payouts: Array.isArray(j.payouts) ? j.payouts : [],
        totals: j.totals ?? null,
      });
      if (j.bank) setBank({ ...EMPTY_BANK, ...j.bank });
      setNg("");
    } catch {
      setNg("接続できません。電波の届く場所で、もう一度お試しください。");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const post = async (body: unknown): Promise<{ ok: boolean; reason?: string }> => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/partner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "処理できませんでした。");
        return { ok: false, reason: j.reason };
      }
      return { ok: true };
    } finally {
      setBusy(false);
    }
  };

  if (ng) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
        <h1 className="mt-2 text-[18px] font-black">営業パートナー</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-dim" data-testid="partner-ng">{ng}</p>
      </main>
    );
  }
  if (!st) return <Loading title="営業パートナー" back="/" rows={3} />;

  /* ── 登録 ── */
  const renderRegister = () => {
    const register = async (): Promise<RunResult> => {
      const r = await post({ action: "register", name, kind, contact });
      if (!r.ok) return false;
      await load();
      return {
        done: "登録を受け付けました",
        doneBody: "運営が確認して承認すると、紹介コードが使えるようになります。報酬の条件は業務委託契約書で定めます。",
      };
    };
    return (
      <main className="px-5 py-8 pb-12">
        <div className="tape -mx-5 mb-6" />
        <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
        <h1 className="mt-2 text-[18px] font-black">営業パートナーに登録する</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
          法人会員を紹介すると、その会社の月額会費（税抜）に応じた報酬が、入金のあった月ごとに確定します。
          紹介した会社が払い続けるかぎり続きます。紹介の紹介（多段）はありません。
        </p>
        <Link href="/partners" className="mt-1 inline-block text-[12px] text-cyan no-underline" data-testid="partner-lp">
          制度の案内を見る
        </Link>

        <label className="mb-1 mt-4 block text-[11px] tracking-[2px] text-dim">種別</label>
        <div className="grid grid-cols-2 gap-2" data-testid="partner-kind">
          {([["individual", "個人"], ["corp", "法人"]] as const).map(([k, t]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-lg border px-3 py-2.5 text-[13px] ${kind === k ? "border-yel bg-[#1A1F14] text-yel" : "border-line text-dim2"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="mb-1 mt-3 block text-[11px] tracking-[2px] text-dim">{kind === "corp" ? "会社名" : "氏名"}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[13.5px]" data-testid="partner-name" />
        <label className="mb-1 mt-3 block text-[11px] tracking-[2px] text-dim">連絡先（電話かメール）</label>
        <input value={contact} onChange={(e) => setContact(e.target.value)} className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[13.5px]" data-testid="partner-contact" />
        {note && <div className="mt-2 text-[12px] text-red" data-testid="partner-note">{note}</div>}
        <div className="mt-4">
          <Btn
            tone="y"
            dis={busy || !name.trim() || !contact.trim()}
            testid="partner-register"
            onClick={() =>
              setAsk({
                title: "営業パートナーに登録しますか",
                body: (
                  <>
                    <div>{kind === "corp" ? "法人" : "個人"}　{name}</div>
                    <div className="mt-1 text-dim">{contact}</div>
                    <div className="mt-2">運営が承認すると、紹介コードと URL が使えるようになります。</div>
                  </>
                ),
                yes: "登録する",
                done: "登録を受け付けました",
                run: register,
              })
            }
          >
            {busy ? "…" : "登録する"}
          </Btn>
        </div>
        <div className="mt-3 border-t border-line pt-3 text-[11.5px] leading-relaxed text-dim2">
          報酬の率・支払い時期・契約終了後の扱いなどの条件は、別途お送りする業務委託契約書で定めます。
          登録だけで報酬が発生することはありません。
        </div>
      </main>
    );
  };

  /* ── 登録がある ── */
  const renderPartner = () => {
  const p = st.partner!;
  const t = st.totals ?? { confirmed: 0, paid: 0, expectedMonthly: 0, activeContracts: 0 };
  const saveBank = async (): Promise<RunResult> => {
    const r = await post({ action: "bank", ...bank });
    if (!r.ok) return false;
    await load();
    setBankOpen(false);
    return { done: "振込先を保存しました" };
  };
  return (
    <main className="px-5 py-8 pb-12">
      <div className="tape -mx-5 mb-6" />
      <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
      <h1 className="mt-2 text-[18px] font-black">営業パートナー</h1>

      <div className="mt-4 rounded-xl border border-line bg-panel p-4" data-testid="partner-card">
        <div className="flex items-baseline gap-2">
          <div className="text-[15px] font-black">{p.name}</div>
          <span
            className={`rounded border px-1.5 py-0.5 text-[10.5px] ${p.status === "approved" ? "border-grn text-grn" : p.status === "pending" ? "border-yel text-yel" : "border-line text-dim2"}`}
            data-testid="partner-status"
          >
            {PARTNER_STATUS[p.status] ?? p.status}
          </span>
          <div className="ml-auto text-[12px] text-dim">報酬率 {p.rate}%</div>
        </div>
        <div className="mt-1 text-[11.5px] text-dim2">{p.kind === "corp" ? "法人" : "個人"}　{p.contact}</div>
        {p.status === "pending" && (
          <div className="mt-2 text-[12px] leading-relaxed text-dim" data-testid="partner-wait">
            運営の承認をお待ちください。承認されると、下の紹介 URL が使えるようになります。
          </div>
        )}
      </div>

      {/* 紹介コードと URL */}
      <div className={`mt-3 rounded-xl border p-4 ${p.status === "approved" ? "border-yel bg-[#1A1F14]" : "border-line bg-panel"}`} data-testid="partner-ref">
        <div className="text-[11px] tracking-[2px] text-dim">紹介コード</div>
        <div className="mt-1 font-mono text-[24px] font-black tracking-[4px] text-yel" data-testid="partner-code">{p.code}</div>
        <div className="mt-2 break-all text-[12px] text-dim" data-testid="partner-url">{st.url}</div>
        <div className="mt-2 flex gap-2">
          <CopyBtn text={st.url} label="URL をコピー" />
          <CopyBtn text={p.code} label="コードをコピー" />
        </div>
        <div className="mt-2 text-[11.5px] leading-relaxed text-dim2">
          この URL を押した会社は、法人会員の申込みにあなたの紹介が付きます（90日のあいだ）。
          申込みの画面でコードを打ってもらっても同じです。
        </div>
      </div>

      {/* 数字。確定と見込みを分ける */}
      <div className="mt-3 grid grid-cols-3 gap-2" data-testid="partner-totals">
        {[
          { t: "確定（未払い）", v: yen(t.confirmed), y: t.confirmed > 0 },
          { t: "支払い済み", v: yen(t.paid), y: false },
          { t: "月あたり見込み", v: yen(t.expectedMonthly), y: false },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-panel px-2 py-3 text-center">
            <div className="text-[10.5px] text-dim">{x.t}</div>
            <div className={`text-[14px] font-black ${x.y ? "text-yel" : ""}`}>{x.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-1 text-[11px] leading-relaxed text-dim2">
        確定は、紹介した会社の入金が確認された月ごとに立ちます。見込みは、いま有効な {t.activeContracts} 件の契約が払い続けたときの月あたりで、払われる額ではありません。
      </div>

      {/* 紹介した会社 */}
      <div className="mt-5 text-[11px] tracking-[2px] text-dim">紹介した会社</div>
      <div className="mt-1 grid gap-1.5" data-testid="partner-referrals">
        {st.referrals.map((r) => (
          <div key={r.companyId} className="rounded-lg border border-line bg-panel px-3 py-2 text-[12px]">
            <div className="flex items-baseline gap-2">
              <span className="font-bold">{r.company || "（会社名なし）"}</span>
              {r.contract ? (
                <span className={`ml-auto rounded border px-1.5 py-0.5 text-[10.5px] ${r.contract.status === "active" ? "border-grn text-grn" : "border-yel text-yel"}`}>
                  {CONTRACT_STATUS[r.contract.status] ?? r.contract.status}
                </span>
              ) : (
                <span className="ml-auto rounded border border-line px-1.5 py-0.5 text-[10.5px] text-dim2">未契約</span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-dim2">
              {ymd(r.since)} 紹介
              {r.contract ? `　${r.contract.plan} ${yen(r.contract.monthlyFee)}／月` : ""}
            </div>
          </div>
        ))}
        {!st.referrals.length && <div className="text-[12px] text-dim2">まだありません。</div>}
      </div>

      {/* 確定した報酬 */}
      <div className="mt-5 text-[11px] tracking-[2px] text-dim">確定した報酬（入金のあった月）</div>
      <div className="mt-1 grid gap-1" data-testid="partner-commissions">
        {st.commissions.map((x) => (
          <div key={x.id} className="flex items-baseline gap-2 border-b border-line py-1.5 text-[12px]">
            <span className="w-20 shrink-0 text-dim2">{monthLabel(x.periodMonth)}</span>
            <span className="min-w-0 truncate">{x.company}</span>
            <span className="shrink-0 text-dim2">{yen(x.baseNet)} × {x.rate}%</span>
            <span className={`ml-auto shrink-0 font-mono ${x.amount < 0 ? "text-org" : ""}`}>{yen(x.amount)}</span>
            <span className="shrink-0 text-[10.5px] text-dim2">{x.status === "paid" ? "支払済" : x.status === "void" ? "取消" : "確定"}</span>
          </div>
        ))}
        {!st.commissions.length && <div className="text-[12px] text-dim2">まだありません。</div>}
      </div>

      {/* 振込先。本人と運営だけが見る */}
      <div className="mt-5 flex items-baseline">
        <div className="text-[11px] tracking-[2px] text-dim">振込先</div>
        <button onClick={() => setBankOpen((v) => !v)} className="ml-auto text-[12px] text-cyan" data-testid="partner-bank-edit">
          {bankOpen ? "閉じる" : st.bank ? "直す" : "登録する"}
        </button>
      </div>
      {!bankOpen && (
        <div className="mt-1 rounded-lg border border-line bg-panel px-3 py-2 text-[12px]" data-testid="partner-bank">
          {st.bank ? (
            <>
              {st.bank.bankName}　{st.bank.branch}<br />
              {st.bank.acctType}　{st.bank.acctNo}　{st.bank.holder}
            </>
          ) : (
            <span className="text-dim2">まだ登録がありません。報酬のお支払いに要ります。</span>
          )}
        </div>
      )}
      {bankOpen && (
        <div className="mt-1 grid gap-2 rounded-lg border border-line bg-panel p-3" data-testid="partner-bank-form">
          {([
            ["bankName", "銀行名"],
            ["branch", "支店名"],
            ["acctNo", "口座番号"],
            ["holder", "口座名義（カナ）"],
            ["taxNote", "インボイス登録番号など（任意）"],
          ] as const).map(([k, label]) => (
            <label key={k} className="block">
              <div className="mb-1 text-[11px] tracking-[2px] text-dim">{label}</div>
              <input
                value={bank[k]}
                onChange={(e) => setBank((b) => ({ ...b, [k]: e.target.value }))}
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px]"
                data-testid={`partner-bank-${k}`}
              />
            </label>
          ))}
          <div>
            <div className="mb-1 text-[11px] tracking-[2px] text-dim">種別</div>
            <div className="grid grid-cols-3 gap-2">
              {["普通", "当座", "貯蓄"].map((k) => (
                <button key={k} onClick={() => setBank((b) => ({ ...b, acctType: k }))} className={`rounded-lg border px-2 py-2 text-[12px] ${bank.acctType === k ? "border-yel text-yel" : "border-line text-dim2"}`}>{k}</button>
              ))}
            </div>
          </div>
          {note && <div className="text-[12px] text-red">{note}</div>}
          <Btn
            tone="y"
            dis={busy}
            testid="partner-bank-save"
            onClick={() =>
              setAsk({
                title: "振込先を保存しますか",
                body: <>{bank.bankName} {bank.branch}　{bank.acctType} {bank.acctNo}　{bank.holder}</>,
                yes: "保存する",
                done: "保存しました",
                run: saveBank,
              })
            }
          >
            保存する
          </Btn>
        </div>
      )}
    </main>
  );
  };
  const main = st.partner ? renderPartner() : renderRegister();

  /* **確かめる札は1か所。**申込みの画面と契約の画面で別々に置くと、申し込んだ瞬間に
     画面が切り替わって札が作り直され、「終わった」が出ないまま最初の問いに戻る */
  return (
    <>
      {main}
      <AskDone ask={ask} onClose={() => setAsk(null)} />
    </>
  );
}
