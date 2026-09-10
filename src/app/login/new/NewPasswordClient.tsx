"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Btn } from "@/components/ui/Btn";
import { AskDone, type Ask, type RunResult } from "@/components/AskDone";

/* 合言葉を決め直す。

   メールのリンク（/auth/confirm?next=/login/new）を踏むと、
   そこでログインの状態になってからここへ来る。
   なので、ここでは新しい合言葉を入れてもらうだけ。

   ログインの状態になっていない人がここを直接開くこともある
   （リンクの期限が切れた・別の端末で開いた）。
   そのときは黙って失敗せず、もう一度メールを送るところへ戻す。 */

const MIN = 8;

export function NewPasswordClient() {
  const supabase = getBrowserClient();
  const [ready, setReady] = useState<"checking" | "ok" | "no">("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /* 確かめる→終わった（げんきさん 2026-09-10）。
     決め直すと、**前の合言葉はその場で使えなくなる。**
     打ち込んだ字が見えないので、押す前に一度止める */
  const [ask, setAsk] = useState<Ask | null>(null);

  useEffect(() => {
    if (!supabase) { setReady("no"); return; }
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setReady(data.user ? "ok" : "no");
    });
    return () => { alive = false; };
  }, [supabase]);

  const go = async (): Promise<RunResult> => {
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase!.auth.updateUser({ password: pw });
      if (error) throw error;
      return true;
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "変更できませんでした。");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const askGo = () => {
    setErr(null);
    if (pw.length < MIN) { setErr(`合言葉は${MIN}文字以上にしてください。`); return; }
    if (pw !== pw2) { setErr("2つのパスワードが一致しません。"); return; }
    setAsk({
      title: "この合言葉に決めますか",
      body: `${pw.length}文字で決め直します。前の合言葉は、この時点で使えなくなります。忘れないところに控えてください。`,
      yes: "決める",
      done: "パスワードを変更しました",
      doneBody: "次からは新しい合言葉で入ってください。",
      run: go,
      after: () => setDone(true),
    });
  };

  if (ready === "checking") return null;

  if (done) {
    return (
      <main className="px-5 py-10">
        <div className="tape -mx-5 mb-6" />
        <div className="text-[11px] font-extrabold tracking-[2px] text-grn">変更しました</div>
        <h1 className="mt-2 text-[19px] font-black leading-snug">パスワードを変更しました</h1>
        <p className="mt-4 text-[13px] leading-relaxed text-dim">
          このままお使いいただけます。次からは新しい合言葉で入ってください。
        </p>
        <Btn tone="y" className="mt-6" onClick={() => { window.location.href = "/"; }} testid="newpw-home">
          ホームへ
        </Btn>
      </main>
    );
  }

  if (ready === "no") {
    return (
      <main className="px-5 py-10" data-testid="newpw-expired">
        <div className="tape -mx-5 mb-6" />
        <div className="text-[11px] font-extrabold tracking-[2px] text-yel">リンクが使えません</div>
        <h1 className="mt-2 text-[19px] font-black leading-snug">
          もう一度、メールを
          <br />
          送り直してください
        </h1>
        <p className="mt-4 text-[13px] leading-relaxed text-dim">
          リンクには期限があります。メールを開いた端末と、いま開いている端末が
          違うときも、ここへ来ます。
        </p>
        <Btn tone="y" className="mt-6" onClick={() => { window.location.href = "/login"; }}>
          ログインの画面へ
        </Btn>
      </main>
    );
  }

  return (
    <main className="px-5 py-8" data-testid="newpw">
      <div className="tape -mx-5 mb-6" />
      <div className="text-[11px] font-extrabold tracking-[2px] text-yel">パスワードの再設定</div>
      <h1 className="mt-1.5 text-[20px] font-black">新しいパスワード</h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
        {MIN}文字以上。現場で使うものなので、覚えやすいものにしてください。
      </p>

      <div className="mt-5 grid gap-3">
        <Field label="新しいパスワード" value={pw} onChange={setPw} testid="newpw-1" />
        <Field label="もう一度" value={pw2} onChange={setPw2} testid="newpw-2" />
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-red bg-ng-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-ng-tx" data-testid="newpw-error">
          {err}
        </div>
      )}

      <Btn tone="y" className="mt-5" dis={busy} onClick={askGo} testid="newpw-go">
        {busy ? "…" : "これにする"}
      </Btn>
      <AskDone ask={ask} onClose={() => setAsk(null)} />
    </main>
  );
}

function Field({
  label, value, onChange, testid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testid?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] text-dim">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testid}
        autoCapitalize="none"
        autoCorrect="off"
        className="w-full rounded-lg border border-line bg-panel2 px-3.5 py-3 text-[15px] text-txt placeholder:text-dim2"
      />
    </label>
  );
}
