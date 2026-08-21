"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Btn } from "@/components/ui/Btn";

/* メールと合言葉でログインする。
   受講の記録を本人のものとして残すために要ります。

   はじめての人は「はじめて使う」から。氏名を入れてもらうのは、
   修了証と受講記録に載るためです。 */

type Mode = "in" | "up";

export function LoginClient() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [mode, setMode] = useState<Mode>("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const supabase = getBrowserClient();

  if (!supabase) {
    return (
      <main className="px-5 py-10">
        <div className="tape -mx-5 mb-6" />
        <h1 className="text-[19px] font-black">ログインは要りません</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-dim">
          記録の置き場所（Supabase）がまだ設定されていないので、
          記録はこの端末の中だけに残ります。そのまま使えます。
        </p>
        <Btn tone="y" onClick={() => router.push("/")} className="mt-6">
          ホームへ
        </Btn>
      </main>
    );
  }

  const go = async () => {
    setErr(null);
    if (!email.trim() || !pw) {
      setErr("メールアドレスと合言葉を入れてください。");
      return;
    }
    if (mode === "up" && !name.trim()) {
      setErr("氏名を入れてください。修了証に載る名前です。");
      return;
    }
    if (mode === "up" && pw.length < 8) {
      setErr("合言葉は8文字以上にしてください。");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: pw,
          options: { data: { name: name.trim() } },
        });
        if (error) throw error;
        /* メールの確認が要る設定のときは、ここではまだ入れない */
        if (!data.session) {
          setSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: pw,
        });
        if (error) throw error;
      }
      /* サーバ側のクッキーを確実に見せるため、まるごと読み直す */
      window.location.href = next;
    } catch (e) {
      setErr(readable(e));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <main className="px-5 py-10">
        <div className="tape -mx-5 mb-6" />
        <div className="text-[11px] font-extrabold tracking-[2px] text-yel">確認のメールを送りました</div>
        <h1 className="mt-2 text-[19px] font-black leading-snug">
          メールの中のリンクを
          <br />
          押してください
        </h1>
        <p className="mt-4 text-[13px] leading-relaxed text-dim">
          {email} 宛てに送りました。
          <br />
          届かないときは、迷惑メールに入っていないか見てください。
        </p>
        <Btn onClick={() => { setSent(false); setMode("in"); }} className="mt-6">
          ログインの画面へ戻る
        </Btn>
      </main>
    );
  }

  return (
    <main className="px-5 py-8" data-testid="login">
      <div className="tape -mx-5 mb-6" />
      <div className="text-[11px] font-extrabold tracking-[2px] text-yel">足場の特別教育</div>
      <h1 className="mt-1.5 text-[20px] font-black">
        {mode === "in" ? "ログイン" : "はじめて使う"}
      </h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
        {mode === "in"
          ? "受講の記録を残すために、ログインが要ります。"
          : "氏名は修了証と受講記録に載ります。本名を入れてください。"}
      </p>

      <div className="mt-5 grid gap-3">
        {mode === "up" && (
          <Field label="氏名" value={name} onChange={setName} placeholder="足場　太郎" testid="login-name" />
        )}
        <Field
          label="メールアドレス"
          value={email}
          onChange={setEmail}
          type="email"
          placeholder="you@example.com"
          testid="login-email"
        />
        <Field
          label="合言葉（パスワード）"
          value={pw}
          onChange={setPw}
          type="password"
          placeholder={mode === "up" ? "8文字以上" : ""}
          testid="login-pw"
        />
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-red bg-ng-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-ng-tx" data-testid="login-error">
          {err}
        </div>
      )}

      <div className="mt-5 grid gap-2">
        <Btn tone="y" dis={busy} onClick={go} testid="login-go">
          {busy ? "…" : mode === "in" ? "ログインする" : "登録して始める"}
        </Btn>
        <Btn
          onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(null); }}
          className="text-[12.5px] font-normal text-cyan"
          testid="login-switch"
        >
          {mode === "in" ? "はじめて使う方はこちら" : "すでに登録した方はこちら"}
        </Btn>
      </div>

      <p className="mt-6 text-[11.5px] leading-relaxed text-dim2">
        合言葉を忘れたときは、教育担当者に連絡してください。
      </p>
    </main>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, testid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  testid?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] text-dim">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testid}
        autoCapitalize="none"
        autoCorrect="off"
        className="w-full rounded-lg border border-line bg-panel2 px-3.5 py-3 text-[15px] text-txt placeholder:text-dim2"
      />
    </label>
  );
}

/** Supabase の英語の言い分を、現場の言葉に直す */
function readable(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return "メールアドレスか合言葉が違います。";
  if (/User already registered/i.test(m)) return "そのメールアドレスは登録済みです。「すでに登録した方はこちら」から入ってください。";
  if (/Password should be at least/i.test(m)) return "合言葉が短すぎます。8文字以上にしてください。";
  if (/Unable to validate email address|invalid format/i.test(m)) return "メールアドレスの形が違います。";
  if (/Email not confirmed/i.test(m)) return "メールの確認がまだです。届いたメールのリンクを押してください。";
  if (/rate limit|too many/i.test(m)) return "短い間に何度も試しました。少し待ってからもう一度。";
  /* 設定がまだのとき。何を触ればよいかまで言う */
  if (/logins are disabled|Email signups are disabled|Signups not allowed/i.test(m)) {
    return "メールでのログインが、まだ使える状態になっていません。Supabase の Authentication → Providers → Email を有効にしてください。";
  }
  if (/Database error|relation .* does not exist|violates foreign key/i.test(m)) {
    return "受け皿がまだできていません。supabase/apply-all.sql を SQL Editor で実行してください。";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) {
    return "つながりませんでした。電波の届く所でもう一度。それでも駄目なら、Supabase の設定（URLと鍵）を確かめてください。";
  }
  return `うまくいきませんでした。（${m}）`;
}
