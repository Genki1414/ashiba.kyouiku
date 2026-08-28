"use client";

import { useCallback, useEffect, useState } from "react";
import { yen } from "@/lib/pricing";

/* 本部の元帳。事業者の一覧と、事業者ごとの受講記録。

   特別教育を行っているのはこの仕組みなので、記録はこちら側に残る。
   受講した人が辞めても、会社が使うのをやめても消えない。
   教育担当者の名簿からは抜けた人を外したので、
   辞めた人の分を後から示せるのは、ここだけになる。 */

type Co = {
  id: string;
  name: string;
  trial: boolean;
  joinCode: string;
  createdAt: string;
  active: number;
  waiting: number;
  gone: number;
  learners: number;
  certs: number;
  sales: number;
  orders: number;
};

type Rec = {
  id: string;
  course: string;
  seatCode: string;
  lessonsPassed: number;
  watchedSec: number;
  exam: { score: number; total: number; passed: boolean } | null;
  cert: { no: string; at: string } | null;
  startedAt: string | null;
  completedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
};

type Person = {
  userId: string;
  name: string;
  email: string;
  state: string;
  /** その会社の教育担当者か */
  admin: boolean;
  requestedAt: string | null;
  approvedAt: string | null;
  leftAt: string | null;
  records: Rec[];
};

type Detail = {
  company: { id: string; name: string; trial: boolean; joinCode: string; createdAt: string };
  people: Person[];
  totals: { people: number; active: number; gone: number; certs: number };
};

const day = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};
const hm = (sec: number) => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}時間${m % 60}分` : `${m}分`;
};
const tone = (state: string) =>
  state === "在籍"
    ? "border-grn text-grn"
    : state === "申し込み中"
      ? "border-yel text-yel"
      : "border-line text-dim2";

export function LedgerClient({ onNote }: { onNote: (s: string) => void }) {
  const [cos, setCos] = useState<Co[] | null>(null);
  const [totals, setTotals] = useState({
    companies: 0, users: 0, loose: 0, linked: 0, trial: 0, learners: 0, certs: 0, sales: 0,
  });
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /* 無償利用の切り替えを確かめる相手。押した瞬間に切り替わると、
     在籍している人が受講コードなしでは学科を開けなくなり、
     受講中の人もその場で止まる。戻し忘れると現場が止まる */
  const [ask, setAsk] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/ledger", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        onNote(j.reason ?? "読めませんでした。");
        return;
      }
      setCos(j.companies ?? []);
      setTotals(
        j.totals ?? { companies: 0, users: 0, loose: 0, linked: 0, trial: 0, learners: 0, certs: 0, sales: 0 },
      );
    } catch {
      onNote("つながりません。");
    }
  }, [onNote]);

  useEffect(() => { void load(); }, [load]);

  const openCompany = async (id: string) => {
    if (open === id) { setOpen(null); setDetail(null); return; }
    setOpen(id);
    setDetail(null);
    try {
      const res = await fetch(`/api/owner/ledger?companyId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        onNote(j.reason ?? "読めませんでした。");
        return;
      }
      setDetail(j as Detail);
    } catch {
      onNote("つながりません。");
    }
  };

  const setTrial = async (c: Co) => {
    setBusy(c.id);
    setAsk(null);
    onNote("");
    try {
      const res = await fetch("/api/owner/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "trial", companyId: c.id, trial: !c.trial }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) onNote(j.reason ?? "切り替えられませんでした。");
      else await load();
    } finally {
      setBusy(null);
    }
  };

  /* 教育担当者を立て直す。担当者が1人も居なくなった会社は、
     ここからしか戻せない（担当者を立てられるのは担当者だけなので） */
  const setAdmin = async (companyId: string, p: Person) => {
    setBusy(p.userId);
    onNote("");
    try {
      const res = await fetch("/api/owner/ledger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyId, userId: p.userId, admin: !p.admin }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { onNote(j.reason ?? "変えられませんでした。"); return; }
      onNote(
        j.self
          ? "自分を教育担当者にしました。画面を開き直してください。"
          : `${p.name || "その人"}を${!p.admin ? "教育担当者にしました" : "受講者に戻しました"}。`,
      );
      /* 中身を引き直す */
      const r2 = await fetch(`/api/owner/ledger?companyId=${encodeURIComponent(companyId)}`, { cache: "no-store" });
      const d2 = await r2.json().catch(() => ({}));
      if (d2?.ok) setDetail(d2 as Detail);
    } finally {
      setBusy(null);
    }
  };

  if (!cos) return null;

  const hit = q.trim()
    ? cos.filter((c) => c.name.includes(q.trim()))
    : cos;

  return (
    <div data-testid="owner-ledger">
      {/* いくつの事業者に、何人まで来たか。まずここで分かるようにする */}
      <div className="mt-4 grid grid-cols-3 gap-2" data-testid="ledger-totals">
        {[
          { t: "事業者", v: String(totals.companies), s: `無償利用 ${totals.trial}` },
          { t: "登録した人", v: String(totals.users), s: `未所属 ${totals.loose}` },
          { t: "在籍している人", v: String(totals.linked), s: "" },
          { t: "受講した人", v: String(totals.learners), s: "" },
          { t: "修了証", v: String(totals.certs), s: "" },
          { t: "売上（税込）", v: yen(totals.sales), s: "" },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-panel px-1.5 py-2.5 text-center">
            <div className="text-[10px] text-dim">{x.t}</div>
            <div className="text-[15px] font-black">{x.v}</div>
            {x.s && <div className="text-[9.5px] text-dim2">{x.s}</div>}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10.5px] leading-relaxed text-dim2">
        「登録した人」は、ログインを作った人ぜんぶ。まだどこの事業者にも入っていない人（未所属）もふくみます。
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="事業者名でしぼる"
        className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px]"
        data-testid="ledger-q"
      />

      <p className="mt-3 text-[11.5px] leading-relaxed text-dim2">
        押すと、その事業者の受講記録が出ます。<strong className="text-dim">辞めた人もふくめて全部</strong>出ます。
        特別教育を行ったのはこの仕組みなので、記録はこちら側に残ります。
        担当者の画面（名簿）からは、抜けた人を外してあります。
      </p>

      <div className="mt-3 grid gap-2">
        {hit.map((c) => (
          <div key={c.id} className="rounded-xl border border-line bg-panel" data-testid="ledger-co">
            <div className="flex items-center gap-2 p-3">
              <button
                onClick={() => void openCompany(c.id)}
                className="min-w-0 flex-1 text-left"
                data-testid="ledger-open"
              >
                <div className="truncate text-[14px] font-black">{c.name}</div>
                <div className="mt-0.5 text-[11px] text-dim2">
                  在籍 {c.active}　申込 {c.waiting}　退職 {c.gone}　受講 {c.learners}　修了証 {c.certs}
                  {c.sales > 0 ? `　${yen(c.sales)}` : ""}
                </div>
              </button>
              <button
                className={`shrink-0 rounded border px-2 py-1 text-[11px] ${
                  c.trial ? "border-yel text-yel" : "border-line text-dim2"
                }`}
                data-testid="owner-trial"
                disabled={busy === c.id}
                onClick={() => setAsk(ask === c.id ? null : c.id)}
                title="押すと切り替えの確認が出ます"
              >
                {c.trial ? "無償利用 中" : "有償"}
              </button>
            </div>

            {/* 切り替えの確認。何人が影響を受けるかまで出す。
               「試しに有償にしてみた」まま戻し忘れると、
               その会社の人は全員、学科を開けなくなる */}
            {ask === c.id && (
              <div
                className="border-t border-line bg-bg p-3"
                data-testid="owner-trial-ask"
              >
                <div className="text-[12px] leading-relaxed text-dim">
                  {c.trial ? (
                    <>
                      <span className="font-bold text-ng-tx">有償に切り替えます。</span>
                      <br />
                      在籍 {c.active}人は、<span className="text-txt">受講コードを引き換えていないと学科を開けなくなります</span>。
                      いま受講中の人も、その場で止まります。
                      <br />
                      <span className="text-dim2">試しに切り替えたときは、必ず戻してください。</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-yel">無償利用に切り替えます。</span>
                      <br />
                      在籍 {c.active}人が、<span className="text-txt">受講コードなしで学科と実務トレーニングを全部開けます</span>。
                      <br />
                      <span className="text-dim2">売る相手ではなく、試用・社内利用の事業者にだけ。</span>
                    </>
                  )}
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button
                    className={`rounded border px-3 py-1.5 text-[12px] font-bold ${
                      c.trial ? "border-red text-ng-tx" : "border-yel text-yel"
                    }`}
                    data-testid="owner-trial-yes"
                    disabled={busy === c.id}
                    onClick={() => void setTrial(c)}
                  >
                    {c.trial ? "有償にする" : "無償利用にする"}
                  </button>
                  <button
                    className="rounded border border-line px-3 py-1.5 text-[12px] text-dim"
                    onClick={() => setAsk(null)}
                  >
                    やめる
                  </button>
                </div>
              </div>
            )}

            {open === c.id && (
              <div className="border-t border-line p-3" data-testid="ledger-detail">
                {!detail && <div className="text-[12px] text-dim2">読んでいます…</div>}
                {detail && detail.company.id === c.id && (
                  <>
                    <div className="text-[11.5px] text-dim">
                      関わった人 {detail.totals.people}人（在籍 {detail.totals.active}／退職{" "}
                      {detail.totals.gone}）　修了証 {detail.totals.certs}枚
                      <br />
                      参加コード <span className="font-mono">{detail.company.joinCode || "—"}</span>
                      　{day(detail.company.createdAt)} から
                    </div>

                    {!detail.people.length && (
                      <div className="mt-2 text-[12px] text-dim2">まだ誰も居ません。</div>
                    )}

                    <div className="mt-3 grid gap-2">
                      {detail.people.map((p) => (
                        <div
                          key={p.userId}
                          className="rounded-lg border border-line bg-bg p-3"
                          data-testid="ledger-person"
                        >
                          <div className="flex items-baseline gap-2">
                            <div className="min-w-0 flex-1 truncate text-[13.5px] font-black">
                              {p.name || "（名前なし）"}
                            </div>
                            <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${tone(p.state)}`}>
                              {p.state}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-dim2">
                            {p.email}
                            {p.approvedAt ? `　${day(p.approvedAt)} 在籍` : ""}
                            {p.leftAt ? `　${day(p.leftAt)} 退職` : ""}
                          </div>

                          {/* 担当者が1人も居なくなった会社は、ここからしか戻せない */}
                          {p.state === "在籍" && (
                            <button
                              onClick={() => void setAdmin(detail.company.id, p)}
                              disabled={busy === p.userId}
                              data-testid="ledger-admin"
                              className={`mt-2 rounded border px-2 py-1 text-[11.5px] ${
                                p.admin ? "border-grn text-grn" : "border-line text-dim"
                              }`}
                            >
                              {p.admin ? "教育担当者　押すと外す" : "教育担当者にする"}
                            </button>
                          )}

                          {!p.records.length && (
                            <div className="mt-1.5 text-[11.5px] text-dim2">受講の記録はありません。</div>
                          )}
                          {p.records.map((r) => (
                            <div
                              key={r.id}
                              className="mt-2 rounded border border-line px-2.5 py-2 text-[11.5px] leading-relaxed"
                              data-testid="ledger-record"
                            >
                              <div className="font-bold">
                                {r.course}
                                {r.closedAt ? (
                                  <span className="ml-1.5 text-dim2">（取り消し済み）</span>
                                ) : null}
                              </div>
                              <div className="text-dim">
                                学科 {r.lessonsPassed}単元　見た時間 {hm(r.watchedSec)}
                                {r.exam
                                  ? `　修了試験 ${r.exam.score}/${r.exam.total}（${r.exam.passed ? "合格" : "不合格"}）`
                                  : "　修了試験 未"}
                              </div>
                              <div className="text-dim2">
                                {r.seatCode ? `受講コード ${r.seatCode}　` : ""}
                                {r.createdAt ? `${day(r.createdAt)} 開始` : ""}
                              </div>
                              {r.cert && (
                                <div className="mt-0.5 text-grn" data-testid="ledger-cert">
                                  修了証 {r.cert.no}　{day(r.cert.at)} 発行
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
