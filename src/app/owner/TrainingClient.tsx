"use client";

import { useCallback, useEffect, useState } from "react";
import { emailLabel } from "@/lib/lineEmail";
import { AskDone, type Ask, type RunResult } from "@/components/AskDone";

/* 実務トレーニングの利用権。

   第1章は誰でも遊べる。第2章から先は、ここで付けた人だけ。

   カード払いが通るまでは、この道で売る。
   振込を確認したら、メールで探して付ける。
   後からカード払いを足しても同じ表に入るので、作り直しにならない。 */

type Row = { userId: string; name: string; email: string; at: string; source: string; note: string };
type Found = { userId: string; name: string; email: string; has: boolean };

const day = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};
const how = (s: string) =>
  s === "card" ? "カード払い" : s === "code" ? "コード" : "本部が付けた";

export function TrainingClient({ onNote }: { onNote: (s: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [found, setFound] = useState<Found[] | null>(null);
  const [q, setQ] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  /* 確かめる→やる→終わった（2026-09-10）。売り物を付ける・取り消す */
  const [ask, setAsk] = useState<Ask | null>(null);

  const load = useCallback(async (search?: string) => {
    try {
      const url = search ? `/api/owner/training?q=${encodeURIComponent(search)}` : "/api/owner/training";
      const res = await fetch(url, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        onNote(j.reason ?? "読み込めませんでした。");
        setRows([]);
        return;
      }
      setRows(j.rows ?? []);
      if (search !== undefined) setFound(j.found ?? []);
      if (j.hint) onNote(j.hint);
    } catch {
      onNote("接続できません。");
      setRows([]);
    }
  }, [onNote]);

  useEffect(() => { void load(); }, [load]);

  const send = async (userId: string, action: "grant" | "revoke"): Promise<RunResult> => {
    setBusy(userId);
    onNote("");
    try {
      const res = await fetch("/api/owner/training", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, userId, note: memo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        onNote(j.reason ?? "処理できませんでした。");
        return false;
      }
      setRows(j.rows ?? []);
      if (q.trim()) await load(q.trim());
      if (action === "grant") setMemo("");
      return true;
    } finally {
      setBusy(null);
    }
  };

  const askSend = (p: { userId: string; name: string }, action: "grant" | "revoke") =>
    setAsk(action === "grant"
      ? {
          title: `${p.name || "この方"}に実務トレーニングを付けますか`,
          body: (
            <>
              第2章から先が開きます。ご本人にお知らせが届きます。
              {memo.trim() && <div className="mt-1">控え　{memo.trim()}</div>}
            </>
          ),
          yes: "付ける",
          done: "付けました",
          doneBody: "ご本人にお知らせが届きました。",
          run: () => send(p.userId, "grant"),
        }
      : {
          title: `${p.name || "この方"}の実務トレーニングを取り消しますか`,
          body: "第2章から先が閉じます。遊んだ記録は残ります。",
          yes: "取り消す",
          danger: true,
          done: "取り消しました",
          run: () => send(p.userId, "revoke"),
        });

  if (!rows) return null;

  return (
    <div data-testid="owner-training">
      <div className="mt-4 rounded-xl border border-line bg-panel p-4 text-[11.5px] leading-relaxed text-dim2">
        <div className="mb-1 text-[11px] tracking-[2px] text-dim">実務トレーニングの利用権</div>
        第1章「段取りと根がらみ」と、資材カタログ・通し見学は、
        ログインすれば<strong className="text-dim">誰でも</strong>遊べます（試し）。
        第2章から先は、ここで付けた人だけです。
        <br />
        <br />
        利用権は<strong className="text-dim">人に付きます</strong>。会社ではありません。
        教育担当者を通さずに本人が買えるようにするためで、会社を移っても持っていけます。
        <br />
        無償利用の事業者に在籍している人は、ここに無くても全部使えます。
      </div>

      {/* 探して付ける。メールで探す（名前だと同姓同名で取り違える） */}
      <div className="mt-3 rounded-xl border border-line bg-panel p-4">
        <div className="mb-2 text-[11.5px] leading-relaxed text-dim2">
          振込を確認したら、ここから付けてください。メールで探します。
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void load(q.trim()); }}
            placeholder="メールの一部（3文字以上）"
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2.5 text-[13px]"
            data-testid="owner-training-q"
          />
          <button
            onClick={() => void load(q.trim())}
            className="shrink-0 rounded-lg border border-line px-3 py-2 text-[12.5px] text-dim"
            data-testid="owner-training-find"
          >
            検索
          </button>
        </div>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="覚え書き（振込日・注文番号など）"
          className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[12.5px]"
          data-testid="owner-training-note"
        />

        {found !== null && (
          <div className="mt-3 grid gap-1.5">
            {!found.length && (
              <div className="text-[12px] text-dim2">見つかりません。</div>
            )}
            {found.map((f) => (
              <div
                key={f.userId}
                className="flex items-center gap-2 rounded-lg border border-line bg-bg p-2.5"
                data-testid="owner-training-found"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{f.name || "（名前なし）"}</div>
                  <div className="truncate text-[11px] text-dim2">{emailLabel(f.email)}</div>
                </div>
                {f.has ? (
                  <span className="shrink-0 rounded border border-grn px-1.5 py-0.5 text-[10px] text-grn">
                    もう付いています
                  </span>
                ) : (
                  <button
                    onClick={() => askSend(f, "grant")}
                    disabled={busy === f.userId}
                    className="shrink-0 rounded-lg border border-yel px-2.5 py-1.5 text-[11.5px] text-yel"
                    data-testid="owner-training-grant"
                  >
                    {busy === f.userId ? "…" : "付ける"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-[11px] tracking-[2px] text-dim">
        いま持っている人 {rows.length}人
      </div>
      {!rows.length && (
        <p className="mt-2 text-[12.5px] text-dim2">まだ誰も持っていません。</p>
      )}
      <div className="mt-2 grid gap-2">
        {rows.map((r) => (
          <div
            key={r.userId}
            className="rounded-xl border border-line bg-panel p-3"
            data-testid="owner-training-row"
          >
            <div className="text-[13.5px] font-black">{r.name || "（名前なし）"}</div>
            <div className="mt-0.5 truncate text-[11px] text-dim2">{emailLabel(r.email)}</div>
            <div className="mt-0.5 text-[11px] text-dim2">
              {day(r.at)}　{how(r.source)}
              {r.note ? `　${r.note}` : ""}
            </div>
            <button
              onClick={() => askSend(r, "revoke")}
              disabled={busy === r.userId}
              className="mt-2 w-full rounded-lg border border-line p-1.5 text-[11px] text-dim2"
              data-testid="owner-training-revoke"
            >
              {busy === r.userId ? "…" : "取り消す（遊んだ記録は残ります）"}
            </button>
          </div>
        ))}
      </div>
      <AskDone ask={ask} onClose={() => setAsk(null)} />
    </div>
  );
}
