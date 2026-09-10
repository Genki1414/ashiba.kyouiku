"use client";

import { useCallback, useEffect, useState } from "react";
import { emailLabel } from "@/lib/lineEmail";
import { BRAND } from "@/content/brand";
import Link from "next/link";
import { Loading } from "@/components/Loading";
import { Btn } from "@/components/ui/Btn";
import { Bar } from "@/components/ui/Bar";
import { dur } from "@/components/ui/format";
import { claimDevice, wipeDevice } from "@/lib/device";

import { HeldQuals } from "./HeldQuals";
import { Notices } from "@/components/Notices";

/* マイページ。受講者が自分のことを見る所。

   ・氏名と生年月日 … 修了証に載る。ここで直せる
   ・所属 … いまどこに居るか。外すのもここから（許可は要らない）
   ・受講 … 講座ごとの進み具合と修了証

   会社と切れていると受講できないので、いまの状態が
   ひと目で分かることを優先している。 */

type Member =
  | { state: "none" }
  | { state: "active"; company: { id: string; name: string } }
  | { state: "pending"; pending: { id: string; name: string }[] };

type Learn = {
  courseId: string;
  name: string;
  short: string;
  started: boolean;
  lessonsPassed: number;
  lessonsTotal: number;
  watchedSec: number;
  requiredSec: number;
  examPassed: boolean;
  cert: { no: string; at: string } | null;
  hasSeat: boolean;
  requested: boolean;
};

type Loaded = {
  name: string;
  email: string;
  birth: string;
  admin: boolean;
  member: Member;
  learning: Learn[];
  /** 外部で取得した資格のうち、この仕組みの講座に当たるもの */
  held?: string[];
  /** この店で LINE を使えるか（設定してあるか） */
  lineReady?: boolean;
  /** この店の LINE と結び付いているか。**店ごとに違う** */
  lineLinked?: boolean;
  /** 繋がっている LINE の表示名。どれと繋がっているかを見せるため */
  lineName?: string;
};

const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

export function MeClient() {
  const [st, setSt] = useState<Loaded | null>(null);
  const [ng, setNg] = useState("");
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [busyReq, setBusyReq] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/mypage", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setNg(j.reason ?? "画面を表示できません。");
        return;
      }
      setSt(j as Loaded);
      setName(j.name ?? "");
      setBirth(j.birth ?? "");
      setNg("");
    } catch {
      setNg("接続できません。電波の届く場所で、もう一度お試しください。");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/mypage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, birth }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "変更できませんでした。");
        return;
      }
      setEdit(false);
      setNote("変更しました。");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const leave = async (companyId: string) => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/member", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "leave", companyId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "削除できませんでした。");
        return;
      }
      setAsking(false);
      setNote("紐付けを外しました。受けた記録は残っています。");
      await load();
    } finally {
      setBusy(false);
    }
  };

  /* 講座ごとに、教育担当者へ「受けたい」を送る・取り消す。
     席そのものはここでは作らない。担当者が見て、いつもどおり
     受講コードを渡す。ここは声を画面に残すだけ */
  const requestCourse = async (courseId: string, cancel: boolean) => {
    setBusyReq(courseId);
    setNote("");
    try {
      const res = await fetch("/api/course-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, action: cancel ? "cancel" : "request" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "送信できませんでした。");
        return;
      }
      await load();
    } finally {
      setBusyReq(null);
    }
  };

  const signOut = async () => {
    /* Supabase の道具を画面に積まないために、サーバでログアウトする */
    await fetch("/api/signout", { method: "POST" }).catch(() => {});
    /* 端末を次の人に渡すためのボタン。端末に残る記録もここで消す */
    wipeDevice();
    claimDevice(null);
    window.location.href = "/login";
  };

  if (ng) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
        <h1 className="mt-2 text-[18px] font-black">マイページ</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-dim" data-testid="me-ng">{ng}</p>
      </main>
    );
  }
  /* 読み終わるまで真っ暗にしない。押したのに何も出ないと、
     同じ待ち時間でもずっと遅く感じる */
  if (!st) return <Loading title="マイページ" back="/" rows={4} />;

  /* **いま自分に関わりのある講座だけ。**
     受講コードがある・受け始めている・修了証が出ている、のどれか。

     ── 外部で取得した資格だけの講座は出さない（げんきさん 2026-09-09）──
     「マイページに取得済みの受講不要な講座は表示しない」。
     受け直す必要が無いものを並べても、**やることの一覧が埋まるだけ。**
     持っていること自体は、下の「取得済みの資格」に出ている。

     修了証が出ているものは残す。**受け取る道がここにしか無い。**
     受け始めたあとに自己申告した場合も残る（記録があるので）。 */
  /* **受講の欄は、これからやることだけ。**
     げんきさん（2026-09-10）「取得済みはマイページの受講には表示しない」。
     修了したものも、外部で取得したものも、下の「取得済みの資格」に出る
     （修了証もそこから受け取れる）。 */
  /* 外部で取得したと登録した講座（自己申告） */
  const held = new Set(st.held ?? []);
  /* **受講の欄は、これからやることだけ。**
     修了したもの（修了証あり）も、外部で取得したものも出さない。
     げんきさん（2026-09-10）「取得済みなのに『続きから受講』と
     表示されてる」「取得済みはマイページの受講には表示しない」。
     持っていること自体は、下の「取得済みの資格」に出る */
  const mine = st.learning.filter(
    (c) => (c.hasSeat || c.started) && !c.cert && !held.has(c.courseId),
  );


  /* 講座1つぶんの札。**やることのある講座と、修了した講座で同じものを出す。**
     修了したほうは下に畳むだけで、中身は変えない（げんきさん 2026-09-10） */
  const CourseRow = ({ c }: { c: Learn }) => (
    <div className="rounded-xl border border-line bg-panel p-4" data-testid="me-course">
              <div className="text-[14px] font-black leading-snug">{c.name}</div>
              <div className="mt-2 flex items-baseline gap-2 text-[12.5px]">
                <span className="shrink-0 text-dim">学科</span>
                <span className={c.lessonsPassed >= c.lessonsTotal ? "font-bold text-grn" : ""}>
                  {c.lessonsPassed} / {c.lessonsTotal} 単元
                </span>
                <span className="ml-auto text-[11.5px] text-dim2">
                  {dur(c.watchedSec)} / {dur(c.requiredSec)}
                </span>
              </div>
              <div className="mt-1.5">
                <Bar
                  v={c.lessonsPassed}
                  max={c.lessonsTotal}
                  color={c.lessonsPassed >= c.lessonsTotal ? "var(--color-grn)" : undefined}
                />
              </div>

              {c.cert ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-[12px] text-grn">証明番号 {c.cert.no}</span>
                  <span className="text-[11px] text-dim2">{day(c.cert.at)} 発行</span>
                </div>
              ) : (
                <div className="mt-2 text-[11.5px] text-dim2">
                  修了試験　{c.examPassed ? "合格" : "まだ"}
                </div>
              )}

              {/* 受講リクエスト。まだこの講座の席が無い人だけ出す。
                  会社に居ないと誰宛か決まらないので、在籍しているときだけ */}
              {!c.cert && !c.hasSeat && st.member.state === "active" && (
                <div className="mt-2.5">
                  {c.requested ? (
                    <button
                      className="w-full rounded-lg border border-line p-2.5 text-[12px] text-dim2 disabled:opacity-50"
                      data-testid="me-course-request-cancel"
                      disabled={busyReq === c.courseId}
                      onClick={() => void requestCourse(c.courseId, true)}
                    >
                      教育担当者にリクエスト送信済み（取り消す）
                    </button>
                  ) : (
                    <button
                      className="w-full rounded-lg border border-cyan p-2.5 text-[12.5px] font-bold text-cyan disabled:opacity-50"
                      data-testid="me-course-request"
                      disabled={busyReq === c.courseId}
                      onClick={() => void requestCourse(c.courseId, false)}
                    >
                      教育担当者に受講リクエストを送る
                    </button>
                  )}
                </div>
              )}

              {/* **受講の欄は、これからやることだけ。**
                  修了したものはここに並ばない（下の「取得済みの資格」に出て、
                  修了証もそこから受け取れる。げんきさん 2026-09-10）。 */}
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <Link
                  href={`/edu/${c.courseId}`}
                  className="rounded-lg border border-yel bg-yel p-2.5 text-center text-[12.5px] font-extrabold text-bg no-underline"
                  data-testid="me-go"
                >
                  {c.started ? "続きから受講" : "受講を開始"}
                </Link>
                <Link
                  href={`/edu/${c.courseId}/cert`}
                  className="rounded-lg border border-line p-2.5 text-center text-[12.5px] text-dim no-underline"
                >
                  修了証
                </Link>
              </div>
            </div>
  );

  return (
    <main className="px-5 py-8 pb-12" data-testid="me">
      <div className="tape -mx-5 mb-6" />
      <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
      <h1 className="mt-2 text-[18px] font-black">マイページ</h1>

      {note && (
        <div className="mt-3 rounded-lg border border-yel bg-[#1A1F14] px-3.5 py-3 text-[12.5px] leading-relaxed text-yel" data-testid="me-note">
          {note}
        </div>
      )}

      {/* 自分のこと */}
      <div className="mt-4 rounded-xl border border-line bg-panel p-4">
        <div className="mb-2 text-[11px] tracking-[2px] text-dim">受講者</div>
        {edit ? (
          <>
            <label className="mb-1 block text-[11px] text-dim2">氏名（修了証に載ります）</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-2 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px]"
              data-testid="me-name"
            />
            <label className="mb-1 block text-[11px] text-dim2">生年月日</label>
            <input
              type="date"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              className="mb-3 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px]"
              data-testid="me-birth"
            />
            <div className="grid grid-cols-2 gap-2">
              <Btn tone="y" dis={busy || !name.trim()} onClick={() => void save()} testid="me-save">
                {busy ? "…" : "変更"}
              </Btn>
              <button
                onClick={() => { setEdit(false); setName(st.name); setBirth(st.birth); }}
                className="rounded-lg border border-line p-3 text-[13px] text-dim"
              >
                キャンセル
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className={`text-[17px] font-black ${st.name ? "" : "text-org"}`}
              data-testid="me-shown-name"
            >
              {st.name || "（氏名未登録）"}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-dim2">{emailLabel(st.email)}</div>
            <div className={`mt-0.5 text-[12px] ${st.birth ? "text-dim2" : "text-org"}`}>
              生年月日　{st.birth ? day(st.birth) : "未登録"}
            </div>
            <button
              onClick={() => setEdit(true)}
              className="mt-2 w-full rounded-lg border border-line p-2 text-[12px] text-dim"
              data-testid="me-edit"
            >
              氏名・生年月日を直す
            </button>
            {/* ここが唯一の入り口。受講の準備の画面では入力させない
                （src/lib/prep.ts に理由）。だから「ここだけ」と書いておく */}
            <div className="mt-1 text-[11px] leading-relaxed text-dim2">
              {st.name && st.birth ? (
                <>
                  修了証に載る名前です。間違っていると出し直しになります。
                  <br />
                  <strong className="text-dim">
                    入れるのはここだけです。
                  </strong>
                  どの講座でも、別の端末でも、これが使われます。
                </>
              ) : (
                <strong className="text-org">
                  これを入れないと受講を始められません。どの講座でも、ここの1回だけです。
                </strong>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── LINE をつなぐ（0034）──

          げんきさん（2026-09-09）「元々のアカウントにLINEを接続したい」。

          **入り口はここしか無い。**ログイン画面の「LINEではじめる」は
          入っていない人のためのもので、入っている人は開けない
          （見張りがログイン画面から追い返す）。
          先にメールで作ったアカウントに LINE を足す道が無かった。

          番号は**店ごとに違う**ので、二つの店を使う人は両方でつなぐ。
          つないでおくと、受講コードや修了証の知らせが LINE に届く */}
      {st.lineReady && (
        <div className="mt-4 rounded-xl border border-line bg-panel p-4" data-testid="me-line">
          <div className="mb-1 text-[11px] tracking-[2px] text-dim">LINE</div>
          {st.lineLinked ? (
            <>
              {/* **どのLINEと繋がっているかを出す**（げんきさん 2026-09-10）。
                  スマホを持ち替えた人・LINEを使い分けている人は、
                  「そもそも別のLINEに繋いでいた」を疑えない */}
              <div className="text-[12.5px] leading-relaxed text-grn" data-testid="me-line-on">
                {st.lineName ? (
                  <>
                    LINEの
                    <span className="font-black text-txt">「{st.lineName}」</span>
                    とつながっています。
                  </>
                ) : (
                  <>このアカウントとLINEがつながっています。</>
                )}
                <br />
                <span className="text-dim">受講コードや修了証の知らせが、LINEに届きます。</span>
              </div>

              {/* **つなぎ直す道を残す**（げんきさん 2026-09-10「LINEをつなぐが無い」）。
                  スマホやLINEを替えたとき、つなぎ先を移せないと知らせが届かない。
                  押しても新しく作り直さない（いまのアカウントに付け替えるだけ） */}
              <a
                href="/api/line/login?next=%2Fme"
                className="mt-2.5 block rounded-lg border border-line p-2.5 text-center text-[12.5px] font-bold text-txt no-underline"
                data-testid="me-line-relink"
              >
                別のLINEにつなぎ直す
              </a>
              <div className="mt-1.5 text-[11px] leading-relaxed text-dim2">
                スマホやLINEを替えたときは、ここから新しいLINEに移せます。
                いまのアカウントはそのままです。
              </div>
            </>
          ) : (
            <>
              <p className="text-[12.5px] leading-relaxed text-dim">
                つないでおくと、受講コードが配られたときや修了証が出たときに、
                <span className="text-txt">LINEに知らせが届きます。</span>
                次からはLINEだけで入れます。
              </p>
              <a
                href="/api/line/login?next=%2Fme"
                className="mt-3 block rounded-lg bg-[#06C755] p-3 text-center text-[14px] font-extrabold text-white no-underline"
                data-testid="me-line-link"
              >
                LINEをつなぐ
              </a>
              <div className="mt-1.5 text-[11px] leading-relaxed text-dim2">
                いまのアカウントに足すだけです。新しく作り直しません。
              </div>
            </>
          )}
        </div>
      )}

      {/* 所属 */}
      <div className="mt-3 rounded-xl border border-line bg-panel p-4" data-testid="me-member">
        <div className="mb-2 text-[11px] tracking-[2px] text-dim">所属している会社</div>

        {st.member.state === "active" && (
          <>
            <div className="text-[15px] font-black">{st.member.company.name}</div>
            <div className="mt-0.5 text-[11.5px] text-grn">在籍中</div>
            {asking ? (
              <div className="mt-3 rounded-lg border border-red bg-ng-bg p-3">
                <div className="text-[12.5px] leading-relaxed text-ng-tx">
                  この会社との紐付けを外します。外すと、この会社の受講コードで
                  受けている学科はそこで終わりになります。
                  <br />
                  受けた記録は消えません。会社の名簿にも「退職」として残ります。
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => void leave((st.member as { company: { id: string } }).company.id)}
                    disabled={busy}
                    className="rounded-lg border border-red p-2.5 text-[12.5px] text-ng-tx"
                    data-testid="me-leave-yes"
                  >
                    {busy ? "…" : "削除"}
                  </button>
                  <button
                    onClick={() => setAsking(false)}
                    className="rounded-lg border border-line p-2.5 text-[12.5px] text-dim"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAsking(true)}
                className="mt-2 w-full rounded-lg border border-line p-2 text-[12px] text-dim2"
                data-testid="me-leave"
              >
                紐付けを外す（退職・会社を変わる）
              </button>
            )}
            <div className="mt-1 text-[11px] leading-relaxed text-dim2">
              会社の許可は要りません。次の会社へは、また申し込むか、
              コードをもらって入れてください。
            </div>
          </>
        )}

        {st.member.state === "pending" && (
          <>
            <div className="text-[11.5px] text-yel">承認待ち</div>
            {st.member.pending.map((c) => (
              <div key={c.id} className="mt-1 text-[15px] font-black">{c.name}</div>
            ))}
            <div className="mt-1.5 text-[11.5px] leading-relaxed text-dim2">
              会社の教育担当者が許可すると、名簿に入って受講できるようになります。
            </div>
            <Link
              href="/join"
              className="mt-2 block rounded-lg border border-line p-2 text-center text-[12px] text-dim no-underline"
            >
              申し込みを取り下げる／別の会社を検索
            </Link>
          </>
        )}

        {st.member.state === "none" && (
          <>
            <div className="text-[13px] leading-relaxed text-dim">
              まだどの会社ともつながっていません。
              <br />
              つながっていないと名簿に載らず、修了証も出せません。
            </div>
            <Link
              href="/join"
              className="mt-2.5 block rounded-lg border border-yel bg-yel p-3 text-center text-[13.5px] font-extrabold text-bg no-underline"
              data-testid="me-join"
            >
              会社とつなぐ
            </Link>
          </>
        )}
      </div>

      {/* ── 受講 ──

          **受けられる講座だけを出す**（げんきさん 2026-09-09）。
          前は73講座すべてが並び、受講コードを持っていない講座にも
          「受講を開始」が出ていた。押しても中で断られるだけだった。

          出すのは、受講コードがある・受け始めている・修了証が出ている・
          外部で取得している、のどれか。ほかの講座は「講座を探す」から */}
      <div className="mt-3">
        <div className="mb-2 flex items-baseline">
          <span className="text-[11px] tracking-[2px] text-dim">受講</span>
          <Link href="/edu" className="ml-auto text-[12px] text-cyan no-underline" data-testid="me-find-course">
            ほかの講座を探す
          </Link>
        </div>
        {!mine.length && (
          <div className="rounded-xl border border-line bg-panel p-4 text-[12.5px] leading-relaxed text-dim" data-testid="me-course-none">
            受講できる講座がまだありません。
            受講コードを受け取るか、教育担当者に受講リクエストを送ってください。
          </div>
        )}
        <div className="grid gap-2">
          {mine.map((c) => (
            <CourseRow key={c.courseId} c={c} />
          ))}
        </div>

      </div>

      {/* これまでのおしらせ。ホームは未読のときだけ出すので、
          読んだあとに読み返す場所がここに要る（げんきさん 2026-09-09） */}
      <div className="mt-3">
        <Notices mode="all" />
      </div>

      {/* 取得済みの資格。この仕組みで取ったものと、よそで取ったもの */}
      <HeldQuals />

      {st.admin && (
        <Link
          href="/admin"
          className="mt-3 block rounded-xl border border-line bg-panel p-3.5 text-center text-[13px] text-txt no-underline"
        >
          受講管理へ
        </Link>
      )}

      <button
        onClick={() => void signOut()}
        className="mt-6 w-full rounded-lg border border-line p-2.5 text-[12px] text-dim2"
        data-testid="me-signout"
      >
        ログアウトする
      </button>
      <div className="mt-1 text-[11px] leading-relaxed text-dim2">
        {/* 実務の成績は足場屋革命だけ。売っていない店で書くと、
            その店の個人情報の取扱い（第7条 端末に残るもの）と食い違う */}
        端末を次の人に渡すときに押してください。この端末に残っている
        受講の準備（氏名・顔の登録）と、視聴時間
        {BRAND.training ? "・実務の成績" : ""}が消えます。
        サーバに残っている記録は消えません。
      </div>
    </main>
  );
}
