"use client";

import { useCallback, useEffect, useState } from "react";
import { emailLabel } from "@/lib/lineEmail";
import { AskDone, type Ask, type RunResult } from "@/components/AskDone";

/* 3年たった記録の、個人の部分を消す。

   特別教育を行ったときは、受講者・科目等の記録を作成して
   3年間保存する決まり（安衛則 第38条）。
   教育を行っているのはこの仕組みなので、保存するのもこちら。

   一方で、要らなくなった個人情報は置いておかないのが筋。
   過ぎたぶんを、ここから消す。

   自動では消さない。まとめて消すボタンも作らない。
   決まりの記録なので、誰が消えるかを見てから、1人ずつ押してもらう。 */

type Row = {
  userId: string;
  name: string;
  email: string | null;
  lastAt: string | null;
  until: string | null;
  records: number;
  certs: number;
};

const day = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

export function RetentionClient({ onNote }: { onNote: (s: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [years, setYears] = useState(3);
  const [busy, setBusy] = useState<string | null>(null);
  /* 二度押しで確かめる。名前を消すのは戻せない */
  /* 消すのは戻せない。確かめる→やる→終わった（2026-09-10） */
  const [ask, setAsk] = useState<Ask | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/retention", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        onNote(j.reason ?? "読み込めませんでした。");
        setRows([]);
        return;
      }
      setRows(j.rows ?? []);
      setYears(j.years ?? 3);
    } catch {
      onNote("接続できません。");
      setRows([]);
    }
  }, [onNote]);

  useEffect(() => { void load(); }, [load]);

  const erase = async (r: Row): Promise<RunResult> => {
    setBusy(r.userId);
    onNote("");
    try {
      const res = await fetch("/api/owner/retention", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: r.userId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        onNote(j.reason ?? "消せませんでした。");
        if (j.rows) setRows(j.rows as Row[]);
        return false;
      }
      setRows(j.rows ?? []);
      return true;
    } finally {
      setBusy(null);
    }
  };

  const askErase = (r: Row) =>
    setAsk({
      title: `${r.name} さんの個人情報を削除しますか`,
      body: (
        <>
          氏名・メール・生年月日と、顔の照合の記録を消します。
          <span className="text-red">戻せません。</span>
          <br />
          受講 {r.records}件・修了証 {r.certs}枚の番号と日付は残ります。
        </>
      ),
      yes: "消す",
      danger: true,
      done: "削除しました",
      run: () => erase(r),
    });

  if (!rows) return null;

  return (
    <div data-testid="owner-retention">
      <div className="mt-4 rounded-xl border border-line bg-panel p-4 text-[11.5px] leading-relaxed text-dim2">
        <div className="mb-1 text-[11px] tracking-[2px] text-dim">保存期間</div>
        特別教育を行ったときは、受講者・科目等の記録を{years}年間保存する決まりです
        （労働安全衛生規則 第38条）。教育を行っているのはこの仕組みなので、保存するのもこちらです。
        <br />
        <br />
        {years}年を過ぎたぶんは、<strong className="text-dim">個人の部分だけ</strong>消せます。
        <span className="text-dim">残るもの</span>… 受講の記録（単元・時間・修了試験）、修了証の番号と発行日。
        <span className="text-dim">消えるもの</span>… 氏名・メール・生年月日、顔の照合の記録、自己申告の資格。
        <br />
        <br />
        修了証の番号を残すのは、元請や監督署が番号で照会するためです
        （照会の画面は前から名前を伏せ字にしてあります）。
        <br />
        <strong className="text-dim">自動では消しません。</strong>
        まだ在籍している人と、受講の記録が1件でも{years}年以内に残っている人は、ここに出ません。
      </div>

      {!rows.length && (
        <p className="mt-4 text-[13px] leading-relaxed text-dim" data-testid="owner-retention-none">
          いま消せるものはありません。
          <br />
          <span className="text-[12px] text-dim2">
            {years}年を過ぎていて、どこの事業者にも在籍していない人が、ここに並びます。
          </span>
        </p>
      )}

      <div className="mt-3 grid gap-2">
        {rows.map((r) => (
          <div
            key={r.userId}
            className="rounded-xl border border-line bg-panel p-4"
            data-testid="owner-retention-row"
          >
            <div className="text-[14px] font-black">{r.name || "（名前なし）"}</div>
            {r.email && <div className="mt-0.5 truncate text-[11px] text-dim2">{emailLabel(r.email)}</div>}
            <div className="mt-1 text-[11.5px] leading-relaxed text-dim2">
              最後の記録 {day(r.lastAt)}　／　保存期間は {day(r.until)} まで
              <br />
              受講 {r.records}件　修了証 {r.certs}枚（番号と日付は残ります）
            </div>

            <button
              onClick={() => askErase(r)}
              disabled={busy === r.userId}
              className="mt-3 w-full rounded-lg border border-line p-2 text-[12px] text-dim2 disabled:opacity-50"
              data-testid="owner-retention-ask"
            >
              {busy === r.userId ? "消しています…" : "個人情報を削除する"}
            </button>
          </div>
        ))}
      </div>
      <AskDone ask={ask} onClose={() => setAsk(null)} />
    </div>
  );
}
