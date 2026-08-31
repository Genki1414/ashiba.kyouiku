"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { claimDevice } from "@/lib/device";
import { siteUrl } from "@/lib/siteUrl";
import { Btn } from "@/components/ui/Btn";
import { SERVICE_NAME } from "@/content/courses";
import { AUTH_MAIL_FROM, showMailFrom } from "@/content/authMail";

/* メールと合言葉でログインする。
   受講の記録を本人のものとして残すために要ります。

   はじめての人は「はじめて使う」から。氏名を入れてもらうのは、
   修了証と受講記録に載るためです。 */

type Mode = "in" | "up" | "forgot";

/* 合言葉を忘れたときの戻り先。

   登録の確認（/auth/confirm）とは道を分けてある。
   いまの作りのリンクには code しか付いてこないので、
   中身を見ても「決め直しかどうか」が分からない。
   分からないまま中へ通すと、決め直さないまま入ってしまい、
   次に閉じたときにまた入れなくなる。

   住所そのものは決め打ち。Vercel は配信のたびに違う住所も配るので、
   いま開いている住所を使うと、Supabase の許した住所と合わずに弾かれる
   （src/lib/siteUrl.ts） */
const RESET_PATH = "/auth/reset";

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
  const [mailed, setMailed] = useState(false);

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

  /* 合言葉を忘れた人へ、決め直しのメールを送る。

     いちばん困るのは、その会社で**唯一の教育担当者**が忘れたとき。
     画面には「教育担当者に連絡してください」と書いてあったが、
     その本人が忘れたら頼む相手が居ない。前は詰んでいた。

     登録の無いメールでも「送りました」と出す。
     出し分けると、誰が登録しているかを外から当てられる。 */
  const sendReset = async () => {
    setErr(null);
    if (!email.trim()) { setErr("メールアドレスを入れてください。"); return; }
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${siteUrl(window.location.origin)}${RESET_PATH}`,
      });
    } catch {
      /* 押し黙る。ここで出し分けると、登録の有無が外から分かる */
    } finally {
      setBusy(false);
      setMailed(true);
    }
  };

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
      /* 端末を人から人へ渡して使う。前の人の記録が残っていたら、ここで消す
         （前の人の氏名・視聴時間を引き継がせない） */
      const { data: me } = await supabase.auth.getUser();
      claimDevice(me.user?.id ?? null);
      /* サーバ側のクッキーを確実に見せるため、まるごと読み直す */
      window.location.href = next;
    } catch (e) {
      setErr(readable(e));
    } finally {
      setBusy(false);
    }
  };

  if (mailed) {
    return (
      <main className="px-5 py-10" data-testid="login-mailed">
        <div className="tape -mx-5 mb-6" />
        <div className="text-[11px] font-extrabold tracking-[2px] text-yel">決め直しのメールを送りました</div>
        <h1 className="mt-2 text-[19px] font-black leading-snug">
          メールの中のリンクを
          <br />
          押してください
        </h1>
        <p className="mt-4 text-[13px] leading-relaxed text-dim">
          {email} 宛てに送りました。
          <br />
          届かないときは、迷惑メールに入っていないか見てください。
          <br />
          <span className="text-dim2">
            そのメールで登録していない場合は、届きません。
          </span>
        </p>
        {/* 差出人を先に伝える。自前の SMTP を入れるまでは
            知らない英語の差出人から届くので、詐欺メールと思われて
            押してもらえない（src/content/authMail.ts・docs/21） */}
        {showMailFrom() && (
          <div
            className="mt-4 rounded-xl border border-line bg-panel p-3.5 text-[12.5px] leading-relaxed text-dim"
            data-testid="mail-from"
          >
            <div className="mb-1 text-[11px] tracking-[2px] text-dim2">差出人</div>
            <div className="break-all font-bold text-txt">{AUTH_MAIL_FROM}</div>
            <div className="mt-1.5">
              英語のメールで届くことがあります。こちらから送ったものなので、
              そのままリンクを押して構いません。
            </div>
          </div>
        )}
        <Btn onClick={() => { setMailed(false); setMode("in"); }} className="mt-6">
          ログインの画面へ戻る
        </Btn>
      </main>
    );
  }

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
        {/* 差出人を先に伝える。自前の SMTP を入れるまでは
            知らない英語の差出人から届くので、詐欺メールと思われて
            押してもらえない（src/content/authMail.ts・docs/21） */}
        {showMailFrom() && (
          <div
            className="mt-4 rounded-xl border border-line bg-panel p-3.5 text-[12.5px] leading-relaxed text-dim"
            data-testid="mail-from"
          >
            <div className="mb-1 text-[11px] tracking-[2px] text-dim2">差出人</div>
            <div className="break-all font-bold text-txt">{AUTH_MAIL_FROM}</div>
            <div className="mt-1.5">
              英語のメールで届くことがあります。こちらから送ったものなので、
              そのままリンクを押して構いません。
            </div>
          </div>
        )}
        <Btn onClick={() => { setSent(false); setMode("in"); }} className="mt-6">
          ログインの画面へ戻る
        </Btn>
      </main>
    );
  }

  return (
    <main className="px-5 py-8" data-testid="login">
      <div className="tape -mx-5 mb-6" />
      <div className="text-[11px] font-extrabold tracking-[2px] text-yel">{SERVICE_NAME}</div>
      <h1 className="mt-1.5 text-[20px] font-black">
        {mode === "in" ? "ログイン" : mode === "up" ? "はじめて使う" : "合言葉を忘れた"}
      </h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
        {mode === "in"
          ? "受講の記録を残すために、ログインが要ります。"
          : mode === "up"
            ? "氏名は修了証と受講記録に載ります。本名を入れてください。"
            : "登録したメールアドレスを入れてください。決め直しのリンクを送ります。"}
      </p>

      {/* 規約に同意する場面は、これまで申込みの画面（/order）にしか無かった。
          受講コードや参加コードで入った人は、そこを通らないまま修了していた。
          登録はどの入り方でも必ず通るので、ここに置く。
          氏名とメールを預かるのもここなので、個人情報の扱いも同じ場所で示す */}
      {mode === "up" && (
        <p
          className="mt-3 rounded-lg border border-line bg-panel p-3 text-[11.5px] leading-relaxed text-dim2"
          data-testid="login-consent"
        >
          登録すると{" "}
          <Link href="/legal/terms" className="text-cyan no-underline">利用規約</Link>{" "}
          と{" "}
          <Link href="/legal/privacy" className="text-cyan no-underline">個人情報の取扱い</Link>{" "}
          に同意したものとします。
        </p>
      )}

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
        {mode !== "forgot" && (
          <Field
            label="合言葉（パスワード）"
            value={pw}
            onChange={setPw}
            type="password"
            placeholder={mode === "up" ? "8文字以上" : ""}
            testid="login-pw"
          />
        )}
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-red bg-ng-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-ng-tx" data-testid="login-error">
          {err}
        </div>
      )}

      <div className="mt-5 grid gap-2">
        <Btn
          tone="y"
          dis={busy}
          onClick={mode === "forgot" ? () => void sendReset() : go}
          testid="login-go"
        >
          {busy ? "…" : mode === "in" ? "ログインする" : mode === "up" ? "登録して始める" : "決め直しのメールを送る"}
        </Btn>
        <Btn
          onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(null); }}
          className="text-[12.5px] font-normal text-cyan"
          testid="login-switch"
        >
          {mode === "in" ? "はじめて使う方はこちら" : "すでに登録した方はこちら"}
        </Btn>
      </div>

      {/* 唯一の教育担当者が忘れたときに、頼む相手が居ない。
          自分で決め直せる道が要る */}
      {mode !== "forgot" ? (
        <button
          onClick={() => { setMode("forgot"); setErr(null); }}
          data-testid="login-forgot"
          className="mt-6 text-[12px] text-cyan underline"
        >
          合言葉を忘れた
        </button>
      ) : (
        <button
          onClick={() => { setMode("in"); setErr(null); }}
          className="mt-6 text-[12px] text-dim underline"
        >
          ログインの画面へ戻る
        </button>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-dim2">
        メールが使えないときは、教育担当者に連絡してください。
      </p>

      {/* ログインしていない人が開ける画面は、ここと /verify だけ。
          ここにリンクが無いと、買う前の人が条件を読む道がどこにも無い。
          特定商取引法の表記は、買う前に見られることが要る */}
      <nav
        className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-[11.5px]"
        data-testid="login-legal"
      >
        <Link href="/legal/tokushoho" className="text-dim no-underline">
          特定商取引法に基づく表記
        </Link>
        <Link href="/legal/terms" className="text-dim no-underline">利用規約</Link>
        <Link href="/legal/privacy" className="text-dim no-underline">個人情報の取扱い</Link>
      </nav>
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
