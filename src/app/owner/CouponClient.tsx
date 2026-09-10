"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { yen } from "@/lib/pricing";
import { AskDone, type Ask } from "@/components/AskDone";
import { CopyBtn } from "@/components/ui/CopyBtn";
import { monthLabel } from "@/lib/coupon";
import { BRAND } from "@/content/brand";
import { COUPON_H, COUPON_W, couponFileName, drawCoupon } from "@/components/owner/drawCoupon";

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
   ・支払先ごとの合計を上に出す。**払う相手ごとに1つの数字**が要る

   ── 月別（2026-09-10）──
   げんきさん
     「クーポンと広告費を月別に見れるようにする」
     「更に支払い先毎で月別に見れるようにもする」
     「クーポン画面でクーポンコードのコピーと、クーポン画像作成機能」

   広告費は月ぎめで払う。だから**その月にいくら払うのか**が要る。
   全体・クーポンごと・支払先ごとの3か所に、月別を畳んで置いた。
   数えるのはサーバの1か所だけ（/api/owner/coupons）。
   画面で数え直すと、同じ月なのに場所によって違う額が出る。 */

type Box = { uses: number; net: number; discount: number; reward: number };
type Month = { ym: string; paid: Box; pending: Box };
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
  paid: Box; pending: Box; rows: Row[]; months: Month[];
};
type Partner = {
  id: string; name: string; contact: string; active: boolean; coupons: number;
  paid: { uses: number; net: number; reward: number };
  pending: { uses: number; net: number; reward: number };
  months: Month[];
};

const day = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

const offText = (c: Coupon) =>
  c.percentOff != null ? `${c.percentOff}%引き` : c.amountOff != null ? `${yen(c.amountOff)}引き` : "—";

/* ── 月別の並び ──

   同じ形を3か所（全体・クーポンごと・支払先ごと）で使う。
   **1つの部品にする。**別々に書くと、片方だけ列が増えて読み比べられない。

   ・新しい月が上（サーバがその順で返す）
   ・払ってよいのは「入金済み」の列だけ。入金待ちは、その下に小さく
   ・広告費は緑。**探しているのはこの数字**（月ぎめで振り込む額）
   ・畳んである。開くのは、その月を締めるときだけ */
function Months({
  months,
  label,
  testId,
  showNet = true,
}: {
  months: Month[];
  label: string;
  testId: string;
  /** 売上の列を出すか。支払先の所は、払う額だけ見たいので省く */
  showNet?: boolean;
}) {
  if (!months.length) return null;
  const reward = months.reduce((n, m) => n + m.paid.reward, 0);
  return (
    <details className="mt-2 rounded-xl border border-line bg-panel" data-testid={testId}>
      <summary className="cursor-pointer list-none p-3 text-[12px] text-dim">
        <span className="text-yel">▾</span> {label}（{months.length}か月）
        <span className="ml-2 text-[11px] text-dim2">入金済みの広告費 {yen(reward)}</span>
      </summary>
      <div className="border-t border-line px-3 pb-3">
        {/* 字を折り返させない。クーポンの札の中は狭いので、
            折り返すと「60,750」と「円」が上下に割れて読めなくなる */}
        <div className="mt-2 flex items-baseline gap-1.5 whitespace-nowrap text-[10.5px] text-dim2">
          <span className="w-[4.5rem] shrink-0">月</span>
          <span className="w-9 shrink-0 text-right">件数</span>
          {showNet && <span className="flex-1 text-right">売上</span>}
          <span className="w-[5.5rem] shrink-0 text-right">広告費</span>
        </div>
        {months.map((m) => (
          <div key={m.ym} data-testid="coupon-month-row">
            <div className="mt-1.5 flex items-baseline gap-1.5 whitespace-nowrap text-[12px]">
              <span className="w-[4.5rem] shrink-0 font-bold">{monthLabel(m.ym)}</span>
              <span className="w-9 shrink-0 text-right">{m.paid.uses}件</span>
              {showNet && <span className="flex-1 text-right">{yen(m.paid.net)}</span>}
              <span className="w-[5.5rem] shrink-0 text-right font-bold text-grn">{yen(m.paid.reward)}</span>
            </div>
            {m.pending.uses > 0 && (
              <div className="text-[10.5px] text-dim2">
                入金待ち {m.pending.uses}件・売上 {yen(m.pending.net)}・広告費 {yen(m.pending.reward)}
              </div>
            )}
          </div>
        ))}
        <p className="mt-2 text-[10.5px] leading-relaxed text-dim2">
          上の行は入金を確認した分です。お支払いの対象はこの分のみで、
          取り消された申込みは含みません。金額は税抜です。
        </p>
      </div>
    </details>
  );
}

/* ── 配るためのクーポンの絵 ──
   げんきさん「クーポン画像作成機能付けて欲しい」。
   canvas に描いて、そのまま保存してもらう。**サーバは通さない**
   （作るだけなので、置いておく必要が無い）。
   広告費の率と支払先は載せない。渡した相手に読まれる */
function CouponArtBox({ c, onNote }: { c: Coupon; onNote: (s: string) => void }) {
  const cv = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (cv.current) drawCoupon(cv.current, {
      code: c.code,
      name: c.name,
      off: c.percentOff != null ? `${c.percentOff}%引き`
        : c.amountOff != null ? `${yen(c.amountOff)}引き` : "",
      expires: c.expiresAt ? day(c.expiresAt) : "",
      brand: BRAND.name,
      site: BRAND.site.replace(/^https?:\/\//, ""),
    });
  }, [c]);

  const save = () => {
    const el = cv.current;
    if (!el) return;
    try {
      const a = document.createElement("a");
      a.href = el.toDataURL("image/png");
      a.download = couponFileName(c.code, BRAND.name);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      onNote("画像を保存できませんでした。長押しで保存してください。");
    }
  };

  return (
    <div className="mt-2 border-t border-line pt-2" data-testid="coupon-art">
      <canvas
        ref={cv}
        width={COUPON_W}
        height={COUPON_H}
        className="block w-full rounded-lg"
        data-testid="coupon-art-canvas"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={save}
          className="rounded-lg border border-grn bg-grn px-3 py-2 text-[12px] font-bold text-bg"
          data-testid="coupon-art-save"
        >
          画像を保存
        </button>
        <span className="self-center text-[10.5px] leading-relaxed text-dim2">
          長押しでも保存できます。広告費の率とお支払い先は載せていません。
        </span>
      </div>
    </div>
  );
}

export function CouponClient({ onNote }: { onNote: (s: string) => void }) {
  const [list, setList] = useState<Coupon[] | null>(null);
  /* 確かめる→やる→終わった（2026-09-10）。作る・支払先・停止 */
  const [ask, setAsk] = useState<Ask | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [months, setMonths] = useState<Month[]>([]);
  const [open, setOpen] = useState("");
  /* 絵を出しているクーポン。**1枚ずつ。**全部いっぺんに描くと重い */
  const [art, setArt] = useState("");
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
      setMonths(j.months ?? []);
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

      {/* ── 全体の月別（げんきさん 2026-09-10）──
          広告費は月ぎめで払うので、その月にいくらかが1つの数字で要る */}
      <Months months={months} label="月別（全体）" testId="coupon-months-all" />

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
                {/* この先に、月ごとにいくら払うか。**請求のもとになる数字** */}
                <Months
                  months={p.months}
                  label="月別のお支払い"
                  testId="coupon-months-partner"
                  showNet={false}
                />
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
              onClick={() =>
                setAsk({
                  title: "このクーポンを作りますか",
                  body: (
                    <>
                      <div className="font-mono text-txt">{code}</div>
                      <div>{name}　{kind === "percent" ? `${off}%引き` : `${off}円引き`}</div>
                      {expiresAt && <div>期限 {expiresAt}</div>}
                      <div className="mt-2">作ったあと、字は直せません（停止はできます）。</div>
                    </>
                  ),
                  yes: "作る",
                  done: "クーポンを作りました",
                  run: async () => {
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
                    return ok;
                  },
                })}
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
                onClick={() =>
                  setAsk({
                    title: "支払先を追加しますか",
                    body: <>{pName}{pContact ? `　${pContact}` : ""}</>,
                    yes: "追加する",
                    done: "追加しました",
                    run: async () => {
                      const ok = await post({ action: "partner", name: pName, contact: pContact });
                      if (ok) { setPName(""); setPContact(""); }
                      return ok;
                    },
                  })}
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[15px] font-black text-yel" data-testid="coupon-code-text">{c.code}</span>
              <span className="text-[12.5px]">{c.name}</span>
              <span className={`rounded border px-1.5 py-0.5 text-[10.5px] ${c.active ? "border-grn text-grn" : "border-line text-dim2"}`}>
                {c.active ? "有効" : "停止中"}
              </span>
              {/* 相手に伝えるもの。打ち直すと O と 0、I と 1 で必ず間違える
                  （げんきさん 2026-09-10「クーポンコードのコピー」） */}
              <CopyBtn text={c.code} label="コードをコピー" className="ml-auto" testId="coupon-copy" />
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

            {/* このクーポン1枚の月別。締めるときに、ここだけ見れば足りる */}
            <Months months={c.months} label="月別" testId="coupon-months-one" />

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => setOpen(open === c.id ? "" : c.id)}
                className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] text-dim"
                data-testid="coupon-open"
              >
                {open === c.id ? "明細を閉じる" : `利用明細（${c.rows.length}件）`}
              </button>
              {/* 配るための絵。LINE やメールでそのまま渡せる形にする */}
              <button
                onClick={() => setArt(art === c.id ? "" : c.id)}
                className="rounded-lg border border-yel px-2.5 py-1.5 text-[11.5px] text-yel"
                data-testid="coupon-art-open"
              >
                {art === c.id ? "画像を閉じる" : "クーポン画像を作る"}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  setAsk({
                    title: c.active ? "このクーポンを停止しますか" : "このクーポンを再開しますか",
                    body: (
                      <>
                        <div className="font-mono text-txt">{c.code}</div>
                        <div className="mt-2">{c.active ? "停止すると、入れても通らなくなります。" : "再開すると、また使えるようになります。"}</div>
                      </>
                    ),
                    yes: c.active ? "停止する" : "再開する",
                    danger: c.active,
                    done: c.active ? "停止しました" : "再開しました",
                    run: () => post({ action: "toggle", id: c.id, active: !c.active }),
                  })}
                className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] text-dim disabled:opacity-50"
                data-testid="coupon-toggle"
              >
                {c.active ? "停止する" : "再開する"}
              </button>
            </div>

            {art === c.id && <CouponArtBox c={c} onNote={onNote} />}

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
      <AskDone ask={ask} onClose={() => setAsk(null)} />
    </div>
  );
}
