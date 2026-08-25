"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui/Btn";
import { codeKind, normalizeJoinCode } from "@/training/joinCode";
import { wipeDevice } from "@/lib/device";

/* コードを入れて自分の事業者に入る。

   ・受講コード（12文字）… 1人1枚の席。これが本筋
   ・参加コード（8文字）　… 名簿に入るだけ（担当者や、席を使わない人）

   入り口は1つ。現場の人に2種類を説明したくないので、桁で見分ける。 */

export function JoinClient() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{ company: string; kind: string } | null>(null);

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
      <h1 className="mt-2 text-[18px] font-black">コードを入れる</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-dim">
        会社の教育担当者から渡されたコードを入れてください。
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
