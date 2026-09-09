"use client";

import { useCallback, useEffect, useState } from "react";
import { yen } from "@/lib/pricing";

/* クーポンと、紹介してくれた人への広告費（0032）。本部だけ。

   げんきさんの依頼（2026-09-09）。
     「紹介クーポンや業界団体向けクーポンを出すことになる」
     「どのクーポンが利用されて、どのくらいの売上になってるかも把握したい」
     「広告費としてクーポン利用売上の何%かを支払いしようと思ってる」

   ── 出し方で気を付けたこと ──
   ・**入金済みと入金待ちを分ける。**まだ振り込まれていないぶんまで
     広告費を払うと、取り消されたときに払い過ぎになる。
     払ってよい額は「入金済み」の列だけ
   ・金額はぜんぶ税抜。広告費の元が税抜なので、並べて確かめられる
   ・支払先ごとの合計を上に出す。**払う相手ごとに1つの数字**が要る */

type Box = { uses: number; net: number; discount: number; reward: number };
type Row = {
  groupId: string; company: string; net: number; discount: number;
  reward: number; rate: number; usedAt: string; status: "paid" | "pending" | "cancelled";
};
type Coupon = {
  id: string; code: string; name: string;
  percentOff: number | null; amountOff: number | null;
  partnerId: string | null; rewardRate: number;
  startsAt: string | null; expiresAt: string | null;
  maxUses: number | null; companyUses: number | null;
  active: boolean; note: string;
  paid: Box; pending: Box; rows: Row[];
};
type Partner = {
  id: string; name: string; contact: string; active: boolean; coupons: number;
  paid: { uses: number; net: number; reward: number };
  pending: { uses: number; net: number; reward: number };
};

const day = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

const offText = (c: Coupon) =>
  c.percentOff != null ? `${c.percentOff}%引き` : c.amountOff != null ? `${yen(c.amountOff)}引き` : "—";

export function CouponClient({ onNote }: { onNote: (s: string) => void }) {
  const [list, setList] = useState<Coupon[] | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [open, setOpen] = useState("");
  const [busy, setBusy] = useState(false);
  const [make, setMake] = useState(false);

  /* 作る欄 */
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [off, setOff] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [rate, setRate] = useState("0");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [companyUses, setCompanyUses] = useState("");
  const [pName, setPName] = useState("");
  const [pContact, setPContact] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/coupons", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j.ok) { onNote(j.reason ?? "画面を表示できません。"); return; }
      setList(j.list ?? []);
      setPartners(j.partners ?? []);
      onNote("");
    } catch {
      onNote("接続できません。");
    }
  }, [onNote]);

  useEffect(() => { void load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/owner/coupons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { onNote(j.reason ?? "処理できませんでした。"); return false; }
      onNote("");
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const total = (k: "paid" | "pending") => ({
    net: (list ?? []).reduce((n, c) => n + c[k].net, 0),
    reward: (list ?? []).reduce((n, c) => n + c[k].reward, 0),
    uses: (list ?? []).reduce((n, c) => n + c[k].uses, 0),
  });
  const paid = total("paid");
  const pending = total("pending");

  return (
    <div className="mt-4" data-testid="owner-coupons">
      {/* ── 合計 ── */}
      <div className="grid grid-cols-3 gap-2" data-testid="coupon-totals">
        {[
          { t: "利用件数", v: `${paid.uses + pending.uses}件` },
          { t: "売上（税抜・入金済み）", v: yen(paid.net) },
          { t: "広告費（入金済み）", v: yen(paid.reward) },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-panel px-2 py-3 text-center">
            <div className="text-[10px] leading-tight text-dim">{x.t}</div>
            <div className="mt-0.5 text-[15px] font-black">{x.v}</div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-dim2">
        入金待ちの分は、売上 {yen(pending.net)}／広告費 {yen(pending.reward)} です。
        <br />
        お支払いの対象は、入金を確認した分のみです。取り消された申込みは含みません。
      </p>

      {/* ── 支払先ごと ── */}
      {!!partners.length && (
        <div className="mt-4">
          <div className="mb-2 text-[11px] tracking-[2px] text-dim">支払先ごと</div>
          <div className="grid gap-2">
            {partners.map((p) => (
              <div key={p.id} className="rounded-xl border border-line bg-panel p-3.5" data-testid="coupon-partner">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13.5px] font-black">{p.name}</span>
                  <span className="text-[11px] text-dim2">クーポン {p.coupons} 件</span>
                  <span className="ml-auto text-[15px] font-black text-grn">{yen(p.paid.reward)}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-dim2">
                  入金済み {p.paid.uses}件・売上 {yen(p.paid.net)}
                  {p.pending.uses > 0 && `　／　入金待ち ${p.pending.uses}件・広告費 ${yen(p.pending.reward)}`}
                  {p.contact && `　／　${p.contact}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── クーポン ── */}
      <div className="mt-5 mb-2 flex items-baseline">
        <span className="text-[11px] tracking-[2px] text-dim">クーポン</span>
        <button
          onClick={() => setMake(!make)}
          className="ml-auto rounded-lg border border-yel px-2.5 py-1 text-[11.5px] text-yel"
          data-testid="coupon-make-open"
        >
          {make ? "閉じる" : "新規作成"}
        </button>
      </div>

      {make && (
        <div className="mb-3 rounded-xl border border-yel bg-panel p-4" data-testid="coupon-make">
          <div className="grid gap-2">
            <label className="text-[11.5px] text-dim">
              クーポンコード（英大文字と数字）
              <input value={code} onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-[14px] text-txt"
                placeholder="PLANT10" data-testid="coupon-code" />
            </label>
            <label className="text-[11.5px] text-dim">
              クーポン名（明細・請求書に表示されます）
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13.5px] text-txt"
                placeholder="プラント紹介 10%" data-testid="coupon-name" />
            </label>
            <div className="flex gap-2">
              <select value={kind} onChange={(e) => setKind(e.target.value as "percent" | "amount")}
                className="rounded-lg border border-line bg-bg px-2 py-2 text-[13px] text-txt"
                data-testid="coupon-kind" aria-label="値引きの形">
                <option value="percent">率（％）</option>
                <option value="amount">定額（円）</option>
              </select>
              <input value={off} onChange={(e) => setOff(e.target.value)} inputMode="numeric"
                className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-[14px] text-txt"
                placeholder={kind === "percent" ? "10" : "3000"} data-testid="coupon-off" />
            </div>
            <label className="text-[11.5px] text-dim">
              広告費の支払先（未選択なら自社負担の値引き）
              <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-bg px-2 py-2 text-[13px] text-txt"
                data-testid="coupon-partner-select">
                <option value="">（なし）</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-[11.5px] text-dim">
              広告費率（％）　割引後の税抜売上に対して
              <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] text-txt"
                data-testid="coupon-rate" />
            </label>
            <div className="flex gap-2">
              <label className="min-w-0 flex-1 text-[11.5px] text-dim">
                有効期限（未入力で無期限）
                <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-bg px-2 py-2 text-[13px] text-txt"
                  data-testid="coupon-expires" />
              </label>
              <label className="w-24 text-[11.5px] text-dim">
                利用上限（全体）
                <input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-line bg-bg px-2 py-2 text-[13px] text-txt"
                  placeholder="無制限" data-testid="coupon-max" />
              </label>
              <label className="w-24 text-[11.5px] text-dim">
                利用上限（1社）
                <input value={companyUses} onChange={(e) => setCompanyUses(e.target.value)} inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-line bg-bg px-2 py-2 text-[13px] text-txt"
                  placeholder="無制限" data-testid="coupon-percompany" />
              </label>
            </div>
            <button
              disabled={busy}
              onClick={async () => {
                const ok = await post({
                  code, name,
                  percentOff: kind === "percent" ? off : undefined,
                  amountOff: kind === "amount" ? off : undefined,
                  partnerId: partnerId || undefined,
                  rewardRate: Number(rate) || 0,
                  expiresAt: expiresAt || undefined,
                  maxUses: maxUses || undefined,
                  companyUses: companyUses || undefined,
                });
                if (ok) { setCode(""); setName(""); setOff(""); setMake(false); }
              }}
              className="rounded-lg border border-grn bg-grn px-3 py-2.5 text-[13px] font-bold text-bg disabled:opacity-50"
              data-testid="coupon-make-go"
            >
              クーポンを作成
            </button>
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-1.5 text-[11px] tracking-[2px] text-dim">支払先を追加</div>
            <div className="flex gap-2">
              <input value={pName} onChange={(e) => setPName(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-txt"
                placeholder="支払先の名称" data-testid="partner-name" />
              <input value={pContact} onChange={(e) => setPContact(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-txt"
                placeholder="連絡先" data-testid="partner-contact" />
              <button
                disabled={busy}
                onClick={async () => {
                  if (await post({ action: "partner", name: pName, contact: pContact })) {
                    setPName(""); setPContact("");
                  }
                }}
                className="shrink-0 rounded-lg border border-yel px-3 py-2 text-[12px] text-yel disabled:opacity-50"
                data-testid="partner-add"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      {list && !list.length && (
        <div className="rounded-xl border border-line bg-panel p-4 text-[12.5px] text-dim" data-testid="coupon-empty">
          クーポンがまだありません。「新規作成」から追加してください。
        </div>
      )}

      <div className="grid gap-2">
        {(list ?? []).map((c) => (
          <div key={c.id} className="rounded-xl border border-line bg-panel p-4" data-testid="coupon-row">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-[15px] font-black text-yel">{c.code}</span>
              <span className="text-[12.5px]">{c.name}</span>
              <span className={`rounded border px-1.5 py-0.5 text-[10.5px] ${c.active ? "border-grn text-grn" : "border-line text-dim2"}`}>
                {c.active ? "有効" : "停止中"}
              </span>
            </div>
            <div className="mt-1 text-[11.5px] text-dim2">
              {offText(c)}
              {c.rewardRate > 0 && `　広告費率 ${c.rewardRate}%`}
              {c.partnerId && `　→ ${partners.find((p) => p.id === c.partnerId)?.name ?? "（削除された支払先）"}`}
              {c.expiresAt && `　期限 ${day(c.expiresAt)}`}
              {c.maxUses && `　全体${c.maxUses}回まで`}
              {c.companyUses && `　1社${c.companyUses}回まで`}
            </div>

            {/* 入金済みと入金待ちを分けて出す。払ってよいのは入金済みだけ */}
            <div className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-2 text-[11.5px]">
              <div>
                <div className="text-dim2">利用件数</div>
                <div className="text-[13px] font-bold">{c.paid.uses + c.pending.uses}件</div>
              </div>
              <div>
                <div className="text-dim2">売上（税抜・入金済み）</div>
                <div className="text-[13px] font-bold">{yen(c.paid.net)}</div>
              </div>
              <div>
                <div className="text-dim2">広告費（入金済み）</div>
                <div className="text-[13px] font-bold text-grn">{yen(c.paid.reward)}</div>
              </div>
            </div>
            {c.pending.uses > 0 && (
              <div className="mt-1 text-[11px] text-dim2">
                入金待ち {c.pending.uses}件・売上 {yen(c.pending.net)}・広告費 {yen(c.pending.reward)}
              </div>
            )}

            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setOpen(open === c.id ? "" : c.id)}
                className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] text-dim"
                data-testid="coupon-open"
              >
                {open === c.id ? "明細を閉じる" : `利用明細（${c.rows.length}件）`}
              </button>
              <button
                disabled={busy}
                onClick={() => void post({ action: "toggle", id: c.id, active: !c.active })}
                className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] text-dim disabled:opacity-50"
                data-testid="coupon-toggle"
              >
                {c.active ? "停止する" : "再開する"}
              </button>
            </div>

            {open === c.id && (
              <div className="mt-2 grid gap-1 border-t border-line pt-2" data-testid="coupon-rows">
                {!c.rows.length && <div className="text-[11.5px] text-dim2">まだ利用されていません。</div>}
                {c.rows.map((r) => (
                  <div key={r.groupId} className="flex flex-wrap items-baseline gap-x-2 text-[11.5px]">
                    <span className="text-dim2">{day(r.usedAt)}</span>
                    <span>{r.company}</span>
                    <span className={r.status === "paid" ? "text-grn" : r.status === "cancelled" ? "text-dim2" : "text-yel"}>
                      {r.status === "paid" ? "入金済み" : r.status === "cancelled" ? "取消" : "入金待ち"}
                    </span>
                    <span className="ml-auto text-dim">売上 {yen(r.net)}</span>
                    <span className="w-20 text-right">{r.reward > 0 ? `広告費 ${yen(r.reward)}` : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
