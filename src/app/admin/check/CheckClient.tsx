"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CheckRow } from "@/training/verifyLog";

/* 照合の記録。教育担当者だけ。

   受講中に「本人が画面の前に居たか」を見た記録です。
   これが本人が受けた証拠になります。監督署や元請に聞かれたとき、
   事業者が出せないと意味が無いので、印刷して渡せる形にしてあります。

   映像も静止画も顔の特徴量も残っていません。残っているのは
   確かめた時刻と、通ったか外れたか、外れた理由だけです。 */

type Totals = { people: number; ok: number; ng: number; stopped: number };

type Loaded = {
  company: string;
  days: number;
  capped: boolean;
  rows: CheckRow[];
  totals: Totals;
};

const stamp = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const DAYS = [30, 90, 365];

export function CheckClient() {
  const [st, setSt] = useState<Loaded | null>(null);
  const [ng, setNg] = useState("");
  const [days, setDays] = useState(90);
  const [open, setOpen] = useState<string>("");

  const load = useCallback(async (d: number) => {
    try {
      const res = await fetch(`/api/admin/verify?days=${d}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setNg(j.reason ?? "開けません。");
        return;
      }
      setSt({
        company: j.company ?? "",
        days: j.days ?? d,
        capped: !!j.capped,
        rows: j.rows ?? [],
        totals: j.totals,
      });
      setNg("");
    } catch {
      setNg("つながりません。電波の届く所でもう一度。");
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [load, days]);

  if (ng) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <Link href="/admin" className="backlink text-[13px] text-dim no-underline">← 教育担当者の画面</Link>
        <h1 className="mt-2 text-[18px] font-black">照合の記録</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-dim" data-testid="check-ng">{ng}</p>
      </main>
    );
  }
  if (!st) return null;

  return (
    <main className="px-5 py-8 pb-12" data-testid="check">
      <div className="tape -mx-5 mb-6 print:hidden" />
      <Link href="/admin" className="backlink text-[13px] text-dim no-underline print:hidden">
        ← 教育担当者の画面
      </Link>
      <h1 className="mt-2 text-[18px] font-black">照合の記録</h1>
      <p className="mt-1 text-[12px] text-dim">{st.company}　直近{st.days}日</p>
      <p className="mt-2 text-[11.5px] leading-relaxed text-dim2">
        受講中に「画面の前に本人が居たか」を3秒ごとに確かめた記録です。
        映像も写真も顔の特徴量も残っていません。残るのは確かめた時刻と、
        通ったか外れたか、外れた理由だけです。
      </p>

      <div className="mt-4 grid grid-cols-4 gap-2" data-testid="check-totals">
        {[
          { t: "受講者", v: st.totals.people },
          { t: "確認できた", v: st.totals.ok },
          { t: "止まった", v: st.totals.ng },
          { t: "止まった人", v: st.totals.stopped },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-panel px-2 py-3 text-center">
            <div className="text-[10px] text-dim">{x.t}</div>
            <div className="text-[18px] font-black">{x.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 print:hidden">
        <span className="text-[11px] tracking-[2px] text-dim">期間</span>
        {DAYS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded border px-2.5 py-1 text-[11.5px] ${
              days === d ? "border-yel text-yel" : "border-line text-dim2"
            }`}
            data-testid={`check-days-${d}`}
          >
            {d}日
          </button>
        ))}
        <button
          onClick={() => window.print()}
          className="ml-auto rounded border border-line px-2.5 py-1 text-[11.5px] text-dim"
          data-testid="check-print"
        >
          印刷する
        </button>
      </div>

      {st.capped && (
        <div className="mt-3 rounded-lg border border-yel bg-[#1A1F14] px-3.5 py-3 text-[12px] leading-relaxed text-yel">
          記録が多いため、古い分は出していません。期間を短くして見てください。
        </div>
      )}

      {!st.rows.length && (
        <p className="mt-5 text-[13px] leading-relaxed text-dim">まだ受講者が居ません。</p>
      )}

      <div className="mt-4 grid gap-2.5">
        {st.rows.map((r) => (
          <div key={r.userId} className="rounded-xl border border-line bg-panel p-3.5" data-testid="check-row">
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-[14px] font-black">{r.name}</span>
              {r.ng > 0 ? (
                <span className="rounded border border-red px-1.5 py-0.5 text-[10.5px] text-ng-tx">
                  {r.ng} 回 止まった
                </span>
              ) : r.ok > 0 ? (
                <span className="rounded border border-grn px-1.5 py-0.5 text-[10.5px] text-grn">
                  止まらず受講
                </span>
              ) : (
                <span className="text-[10.5px] text-dim2">記録なし</span>
              )}
            </div>
            {r.email && <div className="mt-0.5 truncate text-[10.5px] text-dim2">{r.email}</div>}

            <div className="mt-2 text-[11.5px] leading-[1.8] text-dim">
              <div>
                確認できた <span className="font-bold text-txt">{r.ok}</span> 回
              </div>
              {/* 日時は折り返すと読めなくなるので、行を分けて塊で置く */}
              <div className="flex flex-wrap gap-x-4">
                <span className="whitespace-nowrap">はじめ {stamp(r.first)}</span>
                <span className="whitespace-nowrap">おわり {stamp(r.last)}</span>
              </div>
            </div>

            {!!r.reasons.length && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ng-tx">
                {r.reasons.map((x) => (
                  <span key={x.reason}>
                    {x.label} <span className="font-bold">{x.n}</span>
                  </span>
                ))}
              </div>
            )}

            {!!r.rows.length && (
              <>
                <button
                  onClick={() => setOpen(open === r.userId ? "" : r.userId)}
                  className="mt-2 w-full rounded-lg border border-line p-1.5 text-[11.5px] text-dim2 print:hidden"
                  data-testid="check-detail"
                >
                  {open === r.userId ? "明細を閉じる" : `明細を見る（新しい順 ${r.rows.length} 件）`}
                </button>
                <div className={open === r.userId ? "mt-2" : "mt-2 hidden print:block"}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="text-dim2">
                        <tr>
                          <th className="py-1 pr-3 font-normal">日時</th>
                          <th className="py-1 pr-3 font-normal">単元</th>
                          <th className="py-1 font-normal">結果</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.rows.map((x, i) => (
                          <tr key={`${x.at}-${i}`} className="border-t border-line">
                            <td className="whitespace-nowrap py-1 pr-3 font-mono text-dim">{stamp(x.at)}</td>
                            <td className="py-1 pr-3 text-dim">{x.lesson ?? "—"}</td>
                            <td className={`py-1 ${x.ok ? "text-grn" : "text-ng-tx"}`}>
                              {x.ok ? "本人を確認" : x.why}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
