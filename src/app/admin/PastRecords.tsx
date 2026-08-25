"use client";

import { useState } from "react";

/* その事業者の受講記録ぜんぶ（辞めた人もふくむ）。

   毎日の名簿からは抜けた人を外した。
   ただ「誰にいつ受けさせたか」を問われるのは事業者の側なので、
   担当者が自分でも出せないと困る（本部に聞かないと出せない、では回らない）。

   ふだんは畳んでおく。押したときだけ読みに行く。
   名簿と同じ重さで並べると、毎日の仕事の邪魔になる。 */

type Rec = {
  id: string;
  course: string;
  seatCode: string;
  lessonsPassed: number;
  watchedSec: number;
  exam: { score: number; total: number; passed: boolean } | null;
  cert: { no: string; at: string } | null;
  completedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
};
type Person = {
  userId: string;
  name: string;
  email: string;
  state: string;
  approvedAt: string | null;
  leftAt: string | null;
  records: Rec[];
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
const tone = (s: string) =>
  s === "在籍" ? "border-grn text-grn" : s === "申し込み中" ? "border-yel text-yel" : "border-line text-dim2";

/* 表計算で開ける形にして落とす。監督署に出すのは紙か表なので、
   画面を見せるだけでは足りない。Excel が化けないよう BOM を付ける */
function csv(company: string, people: Person[]) {
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const head = [
    "事業者", "氏名", "メール", "状態", "在籍日", "退職日",
    "講座", "受講コード", "合格した単元", "見た時間（分）",
    "修了試験", "修了証番号", "修了証の発行日", "受講の開始日", "取り消し",
  ];
  const lines = [head.map(esc).join(",")];
  for (const p of people) {
    if (!p.records.length) {
      lines.push([company, p.name, p.email, p.state, day(p.approvedAt), day(p.leftAt),
        "", "", "", "", "", "", "", "", ""].map(esc).join(","));
      continue;
    }
    for (const r of p.records) {
      lines.push([
        company, p.name, p.email, p.state, day(p.approvedAt), day(p.leftAt),
        r.course, r.seatCode, String(r.lessonsPassed), String(Math.round(r.watchedSec / 60)),
        r.exam ? `${r.exam.score}/${r.exam.total} ${r.exam.passed ? "合格" : "不合格"}` : "未受験",
        r.cert?.no ?? "", day(r.cert?.at ?? null), day(r.createdAt),
        r.closedAt ? "取り消し済み" : "",
      ].map(esc).join(","));
    }
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function PastRecords() {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [company, setCompany] = useState("");
  const [totals, setTotals] = useState({ people: 0, active: 0, gone: 0, certs: 0 });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  /* 退職した人だけに絞るか。ふだん見たいのはそちら（名簿に出ていない分） */
  const [goneOnly, setGoneOnly] = useState(false);

  const load = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (people) return;
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/admin/past", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "読めませんでした。");
        return;
      }
      setPeople(j.people ?? []);
      setCompany(j.company ?? "");
      setTotals(j.totals ?? { people: 0, active: 0, gone: 0, certs: 0 });
    } catch {
      setNote("つながりません。電波の届く所でもう一度。");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!people) return;
    const blob = new Blob([csv(company, people)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const d = new Date();
    a.download = `受講記録_${company}_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shown = people ? (goneOnly ? people.filter((p) => p.state === "退職") : people) : [];

  return (
    <div className="mx-5 mt-8" data-testid="admin-past">
      <button
        onClick={() => void load()}
        className="w-full rounded-xl border border-line bg-panel p-3.5 text-left"
        data-testid="admin-past-open"
      >
        <div className="text-[11px] tracking-[2px] text-dim">保存している記録</div>
        <div className="mt-0.5 text-[13.5px] font-black">
          過去の受講記録を出す（退職した人もふくむ）
        </div>
        <div className="mt-1 text-[11.5px] leading-relaxed text-dim2">
          特別教育の記録は3年保存する決まりです。名簿から外れた人のぶんも、ここから出せます。
        </div>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-line bg-panel p-4" data-testid="admin-past-list">
          {busy && <div className="text-[12px] text-dim2">読んでいます…</div>}
          {note && <div className="text-[12px] text-red">{note}</div>}

          {people && (
            <>
              <div className="text-[11.5px] text-dim">
                関わった人 {totals.people}人（在籍 {totals.active}／退職 {totals.gone}）　修了証{" "}
                {totals.certs}枚
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setGoneOnly((v) => !v)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] ${
                    goneOnly ? "border-yel text-yel" : "border-line text-dim2"
                  }`}
                  data-testid="admin-past-gone"
                >
                  {goneOnly ? "全員を出す" : "退職した人だけ"}
                </button>
                <button
                  onClick={save}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] text-dim2"
                  data-testid="admin-past-csv"
                >
                  表にして保存（CSV）
                </button>
              </div>

              {!shown.length && (
                <div className="mt-3 text-[12px] text-dim2">
                  {goneOnly ? "退職した人は居ません。" : "まだ記録がありません。"}
                </div>
              )}

              <div className="mt-3 grid gap-2">
                {shown.map((p) => (
                  <div
                    key={p.userId}
                    className="rounded-lg border border-line bg-bg p-3"
                    data-testid="admin-past-person"
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

                    {!p.records.length && (
                      <div className="mt-1.5 text-[11.5px] text-dim2">受講の記録はありません。</div>
                    )}
                    {p.records.map((r) => (
                      <div
                        key={r.id}
                        className="mt-2 rounded border border-line px-2.5 py-2 text-[11.5px] leading-relaxed"
                        data-testid="admin-past-record"
                      >
                        <div className="font-bold">
                          {r.course}
                          {r.closedAt ? <span className="ml-1.5 text-dim2">（取り消し済み）</span> : null}
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
                          <div className="mt-0.5 text-grn" data-testid="admin-past-cert">
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
  );
}
