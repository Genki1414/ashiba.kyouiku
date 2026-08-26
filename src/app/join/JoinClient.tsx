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

   ③ 会社を登録する
      まだこの仕組みを使っていない会社のため。登録した人が担当者になる。
      同じ会社が2つ登録されると名簿が割れるので、
      作る前にもう一度探して、あれば「申し込む」に回す。

   ② コードを入れる（渡されている場合）
      受講コード（12文字）… 1人1枚の席。
      コードを渡した時点で会社が認めているので、許可は要らない。

      参加コード（8文字）も、入れれば今までどおり通る。
      ただし受講する人の画面には書かない。入れても教材が開かない
      コードなので、渡された8文字を試して「開かない」と詰まるだけになる。
      案内は担当者の画面にだけ置く。

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
  /* ③ 会社を登録する。まだこの仕組みを使っていない会社のため */
  const [newName, setNewName] = useState("");
  const [maybe, setMaybe] = useState<Found[] | null>(null);
  const [made, setMade] = useState("");

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

  /* 会社を登録する。force は「似た名前を見たうえで、それでも作る」 */
  const make = async (force: boolean) => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company: newName.trim(), force }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.exists) {
        /* もう同じ会社がある。作らずに申し込みへ回す */
        setMaybe([j.exists as Found]);
        setNote(j.reason ?? "");
        return;
      }
      if (j.maybe) {
        setMaybe(j.maybe as Found[]);
        return;
      }
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "登録できませんでした。");
        return;
      }
      setMade(j.company ?? newName.trim());
      router.refresh();
    } catch {
      setNote("つながりません。電波の届く所でもう一度。");
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

  if (made) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <h1 className="text-[18px] font-black">{made} を登録しました</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-dim">
          あなたがこの会社の教育担当者になりました。
          受講する人には、名簿に申し込んでもらうか、受講コードを渡してください。
        </p>
        <Link
          href="/admin"
          className="mt-6 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
          data-testid="join-new-done"
        >
          教育担当者の画面へ
        </Link>
        <Link
          href="/"
          className="mt-2 block rounded-lg border border-line p-3 text-center text-[12.5px] text-dim no-underline"
        >
          ホームへ
        </Link>
      </main>
    );
  }

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
                  下の「② 会社を登録する」から登録できます。
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

      {/* ③ 会社を登録する。まだこの仕組みを使っていない会社のため */}
      {mine?.state !== "active" && (
        <div className="mt-4 rounded-xl border border-line bg-panel p-4" data-testid="join-new">
          <div className="mb-1 text-[11px] tracking-[2px] text-dim">② 会社を登録する</div>
          <p className="mb-2.5 text-[11.5px] leading-relaxed text-dim2">
            上でさがして見つからないときは、ここから登録できます。
            <strong className="text-dim">登録した人が、その会社の教育担当者になります。</strong>
            あとから他の人を担当者にすることもできます。
          </p>
          <input
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setMaybe(null); }}
            placeholder="会社名（例：東北三上機材株式会社）"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[13.5px]"
            data-testid="join-new-name"
          />

          {/* 似た名前があったとき。前株と後株など、別の会社のこともある */}
          {maybe && !!maybe.length && (
            <div className="mt-2.5 rounded-lg border border-yel bg-[#1A1F14] p-3">
              <div className="text-[11.5px] leading-relaxed text-yel">
                似た名前の事業者があります。同じ会社なら、そちらへ申し込んでください。
              </div>
              <div className="mt-2 grid gap-1.5">
                {maybe.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => void ask(c)}
                    disabled={busy}
                    className="rounded-lg border border-line bg-bg px-3 py-2.5 text-left text-[13px]"
                    data-testid="join-maybe"
                  >
                    {c.name}
                    <span className="ml-2 text-[11px] text-yel">申し込む</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => void make(true)}
                disabled={busy}
                className="mt-2 w-full rounded-lg border border-line p-2 text-[11.5px] text-dim2"
                data-testid="join-new-force"
              >
                どれとも違う。「{newName}」を新しく登録する
              </button>
            </div>
          )}

          {(!maybe || !maybe.length) && (
            <button
              onClick={() => void make(false)}
              disabled={busy || newName.trim().length < 2}
              className="mt-2.5 w-full rounded-lg border border-line p-2.5 text-[12.5px] text-dim"
              data-testid="join-new-go"
            >
              {busy ? "確かめています…" : "この会社を登録する"}
            </button>
          )}
        </div>
      )}

      <h2 className="mt-6 text-[13px] font-black">③ 受講コードを入れる</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-dim">
        担当者から受講コード（12文字）を渡されている場合は、こちらが早いです。
        許可は要りません。入れた時点で名簿に入り、学科が開きます。
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
        自分の会社でこれから使い始める場合は、上の「② 会社を登録する」から。
      </div>
    </main>
  );
}
