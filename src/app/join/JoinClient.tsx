"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui/Btn";
import { codeKind, normalizeJoinCode } from "@/training/joinCode";
import { wipeDevice } from "@/lib/device";

/* 自分の会社と紐付ける画面。入り方は2つある。

   ① 会社をさがして申し込む → 会社が許可する
      コードを渡されていなくても、自分から入れる。
      よその会社の名簿に勝手に入れないよう、許可を挟む。

   ② コードを入れる（渡されている場合）
      ・受講コード（12文字）… 1人1枚の席。これが本筋
      ・参加コード（8文字）　… 名簿に入るだけ（席を使わない人）
      コードを渡した時点で会社が認めているので、許可は要らない。

   外すのはどちらからでもよい（退職は会社の返事を待てない）。
   外しても、その会社の席で受けた記録は、その会社の名簿に残る。 */

type Found = { id: string; name: string };
type Mine =
  | { state: "none" }
  | { state: "active"; company: Found }
  | { state: "pending"; pending: { id: string; company: Found; at: string }[] };

export function JoinClient() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{ company: string; kind: string } | null>(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);

  const loadMine = useCallback(async () => {
    try {
      const res = await fetch("/api/member", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) setMine(j as Mine);
    } catch {
      /* 圏外。さがす方は使えないが、コードは入れられる */
    }
  }, []);

  useEffect(() => { void loadMine(); }, [loadMine]);

  const search = async () => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch(`/api/companies?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "さがせませんでした。");
        return;
      }
      setFound(j.rows ?? []);
      if (j.hint) setNote(j.hint);
    } catch {
      setNote("つながりません。電波の届く所でもう一度。");
    } finally {
      setBusy(false);
    }
  };

  const ask = async (c: Found) => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/member", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "request", companyId: c.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "申し込めませんでした。");
        return;
      }
      setFound(null);
      setQ("");
      await loadMine();
    } finally {
      setBusy(false);
    }
  };

  const drop = async (companyId: string) => {
    setBusy(true);
    setNote("");
    try {
      await fetch("/api/member", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "leave", companyId }),
      });
      await loadMine();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const go = async () => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: normalizeJoinCode(code) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "入れませんでした。");
        return;
      }
      /* 受講コードを入れたら、その時点で受講は始めからになる。
         サーバ側の記録は取り消しのときに消しているので、
         端末に残っている分（受講の準備・実務の成績・間違いノート・途中経過）も
         ここで消す。残すと前の続きから始まってしまう */
      if (j.kind === "seat") wipeDevice();
      setDone({ company: j.company ?? "", kind: j.kind ?? "join" });
      router.refresh();
    } catch {
      setNote("つながりません。電波の届く所でもう一度。");
    } finally {
      setBusy(false);
    }
  };

  if (done !== null) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <h1 className="text-[18px] font-black">{done.company} に入りました</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-dim">
          {done.kind === "seat"
            ? "受講コードが1枚あなたのものになりました。学科を最後まで進めると修了証が出ます。"
            : "名簿に入りました。修了証には受講コードが要ります。担当者に聞いてください。"}
        </p>
        <Link
          href="/"
          className="mt-6 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
        >
          はじめる
        </Link>
      </main>
    );
  }

  return (
    <main className="px-5 py-8">
      <div className="tape -mx-5 mb-6" />
      <Link href="/" className="backlink text-[13px] text-dim no-underline">
        ← ホーム
      </Link>
      <h1 className="mt-2 text-[18px] font-black">会社とつなぐ</h1>

      {/* いまの状態 */}
      {mine?.state === "active" && (
        <div className="mt-3 rounded-xl border border-grn bg-panel p-4" data-testid="join-active">
          <div className="text-[11px] tracking-[2px] text-grn">いまの所属</div>
          <div className="mt-1 text-[15px] font-black">{mine.company.name}</div>
          <button
            onClick={() => void drop(mine.company.id)}
            disabled={busy}
            className="mt-3 w-full rounded-lg border border-line p-2 text-[11.5px] text-dim2"
            data-testid="join-leave"
          >
            この会社との紐付けを外す（退職）
          </button>
          <div className="mt-1 text-[11px] leading-relaxed text-dim2">
            許可は要りません。外しても、この会社の受講コードで受けた記録は
            会社の名簿に残ります（事業者が保存する決まりのため）。
          </div>
        </div>
      )}

      {mine?.state === "pending" && (
        <div className="mt-3 rounded-xl border border-yel bg-[#1A1F14] p-4" data-testid="join-pending">
          <div className="text-[11px] tracking-[2px] text-yel">許可待ち</div>
          {mine.pending.map((x) => (
            <div key={x.id} className="mt-1.5">
              <div className="text-[14px] font-black">{x.company.name}</div>
              <button
                onClick={() => void drop(x.company.id)}
                disabled={busy}
                className="mt-1.5 rounded border border-line px-2 py-1 text-[11px] text-dim2"
                data-testid="join-cancel"
              >
                取り下げる
              </button>
            </div>
          ))}
          <div className="mt-2 text-[11.5px] leading-relaxed text-dim">
            会社の教育担当者が許可すると、名簿に入って受講できるようになります。
          </div>
        </div>
      )}

      {/* ① 会社をさがして申し込む */}
      {mine?.state !== "active" && (
        <div className="mt-4 rounded-xl border border-line bg-panel p-4" data-testid="join-search">
          <div className="mb-1 text-[11px] tracking-[2px] text-dim">① 会社をさがす</div>
          <p className="mb-2.5 text-[11.5px] leading-relaxed text-dim2">
            自分の会社を見つけて申し込みます。会社の担当者が許可すると名簿に入ります。
          </p>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void search(); }}
              placeholder="会社名の一部"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2.5 text-[13.5px]"
              data-testid="join-q"
            />
            <button
              onClick={() => void search()}
              disabled={busy || q.trim().length < 2}
              className="shrink-0 rounded-lg border border-line px-3 py-2 text-[12.5px] text-dim"
              data-testid="join-search-go"
            >
              さがす
            </button>
          </div>

          {found !== null && (
            <div className="mt-3 grid gap-1.5">
              {!found.length && (
                <div className="text-[12px] leading-relaxed text-dim2">
                  見つかりません。会社名を短く入れてみてください。
                  それでも出ないときは、まだこの仕組みを使っていない会社です。
                  担当者に聞いてください。
                </div>
              )}
              {found.map((c) => (
                <button
                  key={c.id}
                  onClick={() => void ask(c)}
                  disabled={busy}
                  className="rounded-lg border border-line bg-bg px-3 py-2.5 text-left text-[13px]"
                  data-testid="join-found"
                >
                  {c.name}
                  <span className="ml-2 text-[11px] text-yel">申し込む</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <h2 className="mt-6 text-[13px] font-black">② コードを入れる</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-dim">
        担当者からコードを渡されている場合は、こちらが早いです（許可は要りません）。
        <br />
        受講コード（12文字）でも、参加コード（8文字）でも構いません。
      </p>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ABCD-2345-6789"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        className="mt-5 w-full rounded-lg border border-line bg-panel px-3 py-3 text-center font-mono text-[20px] tracking-[4px]"
        data-testid="join-code"
      />
      <div className="mt-1 text-[11px] text-dim2">
        小文字で入れても構いません。数字の0と1、英字のO・I・Lは使っていません。
      </div>

      <div className="mt-4">
        <Btn
          tone="y"
          dis={busy || !codeKind(code)}
          onClick={go}
          testid="join-go"
        >
          {busy ? "確かめています…" : "この会社に入る"}
        </Btn>
      </div>
      {note && (
        <div className="mt-3 text-[12.5px] text-red" data-testid="join-note">
          {note}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-line bg-panel p-4 text-[12px] leading-relaxed text-dim">
        コードを持っていない場合は、会社の教育担当者に聞いてください。
        <br />
        自分の会社でこれから使い始める場合は{" "}
        <Link href="/admin" className="text-cyan no-underline">
          事業者を作る
        </Link>
        {" "}へ。
      </div>
    </main>
  );
}
