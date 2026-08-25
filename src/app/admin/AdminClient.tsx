"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";
import { Bar } from "@/components/ui/Bar";
import { dur, hm } from "@/components/ui/format";
import { CHAPTERS } from "@/training/chapters";
import type { LearnerRow } from "@/training/roster";

/* 教育担当者の画面。

   誰が学科のどこまで進んで、修了試験に受かって、実務トレーニングを
   どの章まで通したか。そして修了証を出したか。
   出せるのにまだ出していない人が上に来る。担当者がやることはそこなので。

   見えるのは自社の受講者だけ。判断はすべてサーバ（/api/admin/*）で行う。 */

type Totals = { people: number; left: number; pending: number; done: number; issued: number; waiting: number };

type CourseTab = { id: string; short: string; name: string };

/** 参加の申し込み。許可するまで名簿には入らない */
type Request = { userId: string; name: string; email: string | null; at: string | null };

type Loaded =
  | {
      kind: "ok";
      company: string;
      joinCode: string;
      seats: { total: number; used: number; paid: number };
      rows: LearnerRow[];
      totals: Totals;
      /* いま見ている講座と、切り替えられる講座 */
      course: CourseTab | null;
      courses: CourseTab[];
      /* 参加の申し込み。担当者がやることなので上に出す */
      requests: Request[];
      /* 断った申し込み（直近30日）。押し間違いを戻せるように */
      rejected: Request[];
      /* 在籍の内訳。申し込んだはずの人が居ないときに、どこへ行ったか分かる */
      member: { active: number; waiting: number; gone: number };
    }
  | { kind: "setup"; reason: string }
  | { kind: "ng"; reason: string; signIn?: boolean };

const day = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

export function AdminClient() {
  const [st, setSt] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const [company, setCompany] = useState("");
  const [edit, setEdit] = useState(false);
  /* 名簿も受講コードも講座ごと。どの講座を見ているか */
  const [courseId, setCourseId] = useState<string>("");

  const load = useCallback(async (course?: string) => {
    try {
      const q = course ? `?courseId=${encodeURIComponent(course)}` : "";
      const res = await fetch(`/api/admin/summary${q}`, { cache: "no-store" });
      const j = await res.json();
      if (res.ok && j.ok) {
        setSt({
          kind: "ok",
          company: j.company ?? "",
          joinCode: j.joinCode ?? "",
          seats: j.seats ?? { total: 0, used: 0, paid: 0 },
          rows: j.rows ?? [],
          totals: j.totals,
          course: j.course ?? null,
          courses: j.courses ?? [],
          requests: j.requests ?? [],
          rejected: j.rejected ?? [],
          member: j.member ?? { active: 0, waiting: 0, gone: 0 },
        });
        setCompany(j.company ?? "");
        if (j.course?.id) setCourseId(j.course.id as string);
        return;
      }
      if (j.canSetup) {
        setSt({ kind: "setup", reason: j.reason ?? "" });
        return;
      }
      setSt({ kind: "ng", reason: j.reason ?? "開けません。", signIn: j.signedIn === false });
    } catch {
      setSt({ kind: "ng", reason: "つながりません。電波の届く所でもう一度開いてください。" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (url: string, body: unknown) => {
    setNote("");
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) setNote(j.reason ?? "できませんでした。");
    return !!j.ok;
  };

  if (!st) return null;

  /* ── まだ担当者が決まっていない ── */
  if (st.kind === "setup") {
    return (
      <main className="pb-10">
        <div className="tape" />
        <div className="px-5 pb-4 pt-6">
          <Link href="/" className="backlink text-[13px] text-dim no-underline">
            ← ホーム
          </Link>
          <h1 className="mt-2 text-[18px] font-black">事業者を作る</h1>
          <p className="mt-1 text-[12px] leading-relaxed text-dim">
            この教材は事業者ごとに使います。いまログインしている人が、
            その事業者の最初の教育担当者になります。
            <br />
            事業者名は<strong className="text-txt">名簿を分けるため</strong>のものです。
            修了証の名義（東北三上機材株式会社）とは別です。
          </p>
        </div>
        <div className="mx-5 rounded-xl border border-line bg-panel p-4">
          <label className="mb-1 block text-[11px] tracking-[2px] text-dim">事業者名</label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="○○建設株式会社"
            className="mb-3 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px]"
            data-testid="admin-company"
          />
          <Btn
            tone="y"
            dis={!company.trim()}
            testid="admin-setup"
            onClick={async () => {
              setBusy("setup");
              if (await post("/api/admin/setup", { company: company.trim() })) await load(courseId);
              setBusy(null);
            }}
          >
            {busy === "setup" ? "作っています…" : "この事業者で始める"}
          </Btn>
          {note && <div className="mt-3 text-[12px] text-red">{note}</div>}
        </div>
      </main>
    );
  }

  /* ── 担当者ではない ── */
  if (st.kind === "ng") {
    return (
      <main className="pb-10">
        <div className="tape" />
        <div className="px-5 pb-4 pt-6">
          <Link href="/" className="backlink text-[13px] text-dim no-underline">
            ← ホーム
          </Link>
          <h1 className="mt-2 text-[18px] font-black">教育担当者の画面</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-dim" data-testid="admin-ng">
            {st.reason}
          </p>
          {st.signIn && (
            <Link
              href="/login?next=/admin"
              className="mt-4 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
            >
              ログインする
            </Link>
          )}
        </div>
      </main>
    );
  }

  /* ── 一覧 ──
     抜けた人はここには出さない（返す側で外している）。
     記録は消していない。退職者ぶんも含めた元帳は本部が持つ。
     上に来るのは、担当者がやること（修了証を出す）が残っている人 */
  const rows = [...st.rows].sort((a, b) => {
    const key = (r: LearnerRow) => (r.canIssue && !r.cert ? 0 : r.canIssue ? 1 : 2);
    return key(a) - key(b) || a.name.localeCompare(b.name, "ja");
  });

  return (
    <main className="pb-10">
      <div className="tape" />
      <div className="px-5 pb-4 pt-6">
        <Link href="/" className="backlink text-[13px] text-dim no-underline">
          ← ホーム
        </Link>
        <h1 className="mt-2 text-[18px] font-black">教育担当者の画面</h1>
        <p className="mt-1 text-[12px] text-dim">{st.company}</p>
      </div>

      {/* 講座の切り替え。名簿も受講コードも講座ごとに分かれている。
          1つしか無いあいだは、選ぶ物が無いので出さない */}
      {st.courses.length > 1 && (
        <div className="mx-5 mb-3 flex flex-wrap gap-2" data-testid="admin-courses">
          {st.courses.map((c) => (
            <button
              key={c.id}
              onClick={() => { setCourseId(c.id); void load(c.id); }}
              className={`rounded-lg border px-3 py-1.5 text-[12px] ${
                st.course?.id === c.id ? "border-yel bg-[#1A1F14] text-yel" : "border-line text-dim2"
              }`}
              data-testid="admin-course-tab"
            >
              {c.short}
            </button>
          ))}
        </div>
      )}
      {st.course && (
        <p className="mx-5 mb-2 text-[11.5px] leading-relaxed text-dim2" data-testid="admin-course-name">
          {st.course.name}の名簿と受講コードです
        </p>
      )}

      <div className="mx-5 grid grid-cols-4 gap-2" data-testid="admin-totals">
        {[
          { t: "受講者", v: st.totals.people },
          { t: "学科修了", v: st.totals.done },
          { t: "修了証", v: st.totals.issued },
          { t: "未発行", v: st.totals.waiting },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-panel px-2 py-3 text-center">
            <div className="text-[10.5px] text-dim">{x.t}</div>
            <div className={`text-[19px] font-black ${x.t === "未発行" && x.v ? "text-yel" : ""}`}>
              {x.v}
            </div>
          </div>
        ))}
      </div>

      {/* 参加の申し込み。ここが担当者のいちばん先にやること */}
      {!!st.requests.length && (
        <div className="mx-5 mt-3 rounded-xl border border-yel bg-[#1A1F14] p-4" data-testid="admin-requests">
          <div className="text-[11px] font-extrabold tracking-[2px] text-yel">
            参加の申し込み {st.requests.length} 件
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-dim">
            自社の人か確かめてから許可してください。許可すると名簿に入り、受講できるようになります。
          </p>
          <div className="mt-2.5 grid gap-2">
            {st.requests.map((q) => (
              <div key={q.userId} className="rounded-lg border border-line bg-panel p-3" data-testid="admin-request">
                <div className="text-[14px] font-black">{q.name}</div>
                {q.email && <div className="mt-0.5 truncate text-[11px] text-dim2">{q.email}</div>}
                {q.at && <div className="mt-0.5 text-[10.5px] text-dim2">{day(q.at)} 申し込み</div>}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Btn
                    tone="y"
                    dis={busy === q.userId}
                    testid="admin-approve"
                    onClick={async () => {
                      setBusy(q.userId);
                      if (await post("/api/admin/member", { userId: q.userId, action: "approve" }))
                        await load(courseId);
                      setBusy(null);
                    }}
                  >
                    許可する
                  </Btn>
                  <button
                    className="rounded-lg border border-line p-2.5 text-[12.5px] text-dim"
                    data-testid="admin-reject"
                    onClick={async () => {
                      setBusy(q.userId);
                      if (await post("/api/admin/member", { userId: q.userId, action: "reject" }))
                        await load(courseId);
                      setBusy(null);
                    }}
                  >
                    断る
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 断った申し込み。押し間違いで消えたままにしない */}
      {!!st.rejected.length && (
        <div className="mx-5 mt-3 rounded-xl border border-line bg-panel p-4" data-testid="admin-rejected">
          <div className="text-[11px] tracking-[2px] text-dim">断った申し込み（直近30日）</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-dim2">
            間違って断ってしまったときは、ここから許可できます。
          </p>
          <div className="mt-2 grid gap-1.5">
            {st.rejected.map((q) => (
              <div key={q.userId} className="flex items-center gap-2 rounded-lg border border-line bg-bg p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{q.name}</div>
                  {q.email && <div className="truncate text-[10.5px] text-dim2">{q.email}</div>}
                </div>
                <button
                  className="shrink-0 rounded border border-line px-2.5 py-1.5 text-[11px] text-dim"
                  data-testid="admin-reapprove"
                  onClick={async () => {
                    setBusy(q.userId);
                    if (await post("/api/admin/member", { userId: q.userId, action: "approve" }))
                      await load(courseId);
                    setBusy(null);
                  }}
                >
                  やっぱり許可する
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 事業者の名前と、受講者に配る参加コード */}
      <div className="mx-5 mt-3 rounded-xl border border-line bg-panel p-4">
        <div className="mb-2 text-[11px] tracking-[2px] text-dim">事業者（名簿の分け方）</div>
        <div className="mb-2 text-[11.5px] text-dim2" data-testid="admin-member-count">
          在籍 {st.member.active}人　／　申し込み {st.member.waiting}件　／　抜けた {st.member.gone}人
        </div>
        {edit ? (
          <>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mb-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13.5px]"
              data-testid="admin-company"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-lg border border-line p-2 text-[12px] text-dim"
                onClick={() => { setCompany(st.company); setEdit(false); }}
              >
                やめる
              </button>
              <Btn
                tone="y"
                dis={!company.trim()}
                testid="admin-company-save"
                onClick={async () => {
                  setBusy("company");
                  if (await post("/api/admin/company", { name: company.trim() })) {
                    setEdit(false);
                    await load(courseId);
                  }
                  setBusy(null);
                }}
              >
                {busy === "company" ? "直しています…" : "直す"}
              </Btn>
            </div>
          </>
        ) : (
          <>
            <div className="text-[14px] font-black">{st.company}</div>
            <button
              className="mt-2 w-full rounded-lg border border-line p-1.5 text-[11.5px] text-dim"
              data-testid="admin-company-edit"
              onClick={() => setEdit(true)}
            >
              事業者名を直す
            </button>
            <div className="mt-2 text-[11.5px] leading-relaxed text-dim2">
              修了証の名義は{" "}
              <span className="text-dim">東北三上機材株式会社／中川元基</span>{" "}
              で決まっています。ここの名前は修了証には出ません。
            </div>
          </>
        )}

        {/* 買った受講コード（席） */}
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1 text-[11px] tracking-[2px] text-dim">受講コード（席）</div>
          <div className="text-[12.5px] leading-[1.9]">
            <span className="font-black text-txt">
              {st.seats.paid} 枚
            </span>
            <span className="text-dim"> 入金済み　／　配った {st.seats.total} 枚　使用 {st.seats.used} 枚</span>
          </div>
          <div className="mt-1 text-[11.5px] leading-relaxed text-dim2">
            修了証は受講コードが要ります。人数ぶん申し込んでください。
          </div>
          {st.seats.total > st.seats.used && (
            <div className="mt-1 text-[11.5px] leading-relaxed text-yel">
              まだ配っていないコードが {st.seats.total - st.seats.used} 件あります。
            </div>
          )}
          <Link
            href={st.course ? `/order?courseId=${st.course.id}` : "/order"}
            className="mt-2 block rounded-lg border border-yel bg-yel p-2.5 text-center text-[13px] font-extrabold text-bg no-underline"
            data-testid="admin-order"
          >
            {st.seats.total ? "受講コードを見る・申し込む" : "受講コードを申し込む"}
          </Link>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1 text-[11px] tracking-[2px] text-dim">本人が受けた証拠</div>
          <div className="text-[11.5px] leading-relaxed text-dim2">
            受講中に「画面の前に本人が居たか」を確かめた記録です。
            監督署や元請に聞かれたときは、これを出してください。
          </div>
          <Link
            href="/admin/check"
            className="mt-2 block rounded-lg border border-line p-2.5 text-center text-[13px] text-txt no-underline"
            data-testid="admin-check"
          >
            照合の記録を見る
          </Link>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1 text-[11px] tracking-[2px] text-dim">受講者に配る参加コード</div>
          <div className="font-mono text-[20px] font-black tracking-[4px] text-yel" data-testid="admin-joincode">
            {st.joinCode || "—"}
          </div>
          <div className="mt-1 text-[11.5px] leading-relaxed text-dim">
            席を使わずに名簿へ入れるコードです（担当者や、見学だけの人）。
            <strong className="text-dim">渡した相手はそのまま名簿に入ります</strong>
            （コードを渡した時点で認めたことになるので、許可は要りません）。
            自分でさがして申し込んできた人は、上の「参加の申し込み」で許可してください。
            漏れたら作り直せます（前のコードは使えなくなります）。
          </div>
          <button
            className="mt-2 w-full rounded-lg border border-line p-1.5 text-[11.5px] text-dim2"
            data-testid="admin-newcode"
            onClick={async () => {
              setBusy("code");
              if (await post("/api/admin/company", { newCode: true })) await load(courseId);
              setBusy(null);
            }}
          >
            {busy === "code" ? "作り直しています…" : "参加コードを作り直す"}
          </button>
        </div>
      </div>

      {note && <div className="mx-5 mt-3 text-[12px] text-red">{note}</div>}

      {!rows.length && (
        <p className="mx-5 mt-5 text-[13px] leading-relaxed text-dim">
          まだ受講者が居ません。
          <br />
          <strong className="text-dim">登録しただけでは、ここには並びません。</strong>
          受講する人に上の<span className="text-yel">参加コード</span>を渡して、
          ホームの「参加コードを入れる」から入れてもらってください。
          受講コード（12文字）を渡した場合は、それを入れれば同じように並びます。
        </p>
      )}

      <div className="mx-5 mt-4 grid gap-3">
        {rows.map((r) => (
          <div key={r.userId} className="rounded-xl border border-line bg-panel p-4" data-testid="admin-row">
            <div className="flex items-baseline gap-2">
              <div className="min-w-0 flex-1 truncate text-[15px] font-black">{r.name}</div>
              {/* まだ許可していない人。上の「参加の申し込み」と同じ人。
                  退職と出すと、入ったことのない人が辞めたように見える */}
              {r.pending && (
                <span className="rounded border border-yel px-1.5 py-0.5 text-[10px] text-yel" data-testid="admin-pending">
                  申し込み中
                </span>
              )}
              {r.admin && (
                <span className="rounded border border-cyan px-1.5 py-0.5 text-[10px] text-cyan">担当者</span>
              )}
            </div>
            {r.email && <div className="mt-0.5 truncate text-[11px] text-dim2">{r.email}</div>}

            {/* 学科。単元の数だけでは進み具合が分からないので、
                バーと「見た時間」と「いまどこか」を出す */}
            <div className="mt-3 rounded-lg border border-line bg-bg px-3 py-2.5" data-testid="admin-edu">
              <div className="flex items-baseline gap-2 text-[12.5px]">
                <span className="shrink-0 text-dim">学科</span>
                <span className={`font-bold ${r.lessonsPassed >= r.lessonsTotal ? "text-grn" : ""}`}>
                  {r.lessonsPassed} / {r.lessonsTotal} 単元
                </span>
                <span className="ml-auto text-[11.5px] text-dim2">
                  {Math.round((r.lessonsPassed / Math.max(1, r.lessonsTotal)) * 100)}%
                </span>
              </div>
              <div className="mt-1.5">
                <Bar
                  v={r.lessonsPassed}
                  max={r.lessonsTotal}
                  color={r.lessonsPassed >= r.lessonsTotal ? "var(--color-grn)" : undefined}
                />
              </div>
              <div className="mt-1.5 flex items-baseline gap-2 text-[11.5px]">
                <span className="shrink-0 text-dim2">見た時間</span>
                <span className={r.watchedSec >= r.requiredSec ? "text-grn" : "text-dim"}>
                  {dur(r.watchedSec)}
                </span>
                <span className="text-dim2">／ 法定 {dur(r.requiredSec)}</span>
              </div>
              {r.now ? (
                <div className="mt-1 text-[11.5px] leading-relaxed text-dim2">
                  {r.now.watchedSec > 0 ? "いま" : "次は"} {r.now.id}　{r.now.title}
                  {r.now.watchedSec > 0 && (
                    <span className="text-dim">（{hm(r.now.watchedSec)} / {r.now.needSec / 60}分）</span>
                  )}
                </div>
              ) : (
                <div className="mt-1 text-[11.5px] text-grn">全単元を終えています</div>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2 text-[12.5px]">
              <span className="w-16 shrink-0 text-dim">修了試験</span>
              {r.exam ? (
                <span className={r.exam.passed ? "font-bold text-grn" : "text-red"}>
                  {r.exam.score} / {r.exam.total}　{r.exam.passed ? "合格" : "不合格"}
                </span>
              ) : (
                <span className="text-dim2">まだ</span>
              )}
            </div>

            {/* 実務トレーニング */}
            <div className="mt-1 flex items-baseline gap-2 text-[12.5px]">
              <span className="w-16 shrink-0 text-dim">実務</span>
              <span className="min-w-0 flex-1">
                {r.training.every((t) => t.times === 0) ? (
                  <span className="text-dim2">まだ</span>
                ) : (
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {r.training.map((t) => {
                      const c = CHAPTERS.find((x) => x.id === t.ch)!;
                      return (
                        <span key={t.ch} className={t.passed ? "text-grn" : "text-dim"}>
                          第{c.n}章 {t.best === null ? "—" : `${t.best}点`}
                          {t.times > 1 ? `（${t.times}回）` : ""}
                        </span>
                      );
                    })}
                  </span>
                )}
              </span>
            </div>

            {/* 修了証 */}
            <div className="mt-3 border-t border-line pt-3">
              {r.cert ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="font-mono text-[12.5px] text-grn">証明番号 {r.cert.no}</span>
                  <span className="text-[11.5px] text-dim">{day(r.cert.at)} 発行</span>
                  <button
                    className="ml-auto rounded-lg border border-line px-2.5 py-1 text-[11px] text-dim"
                    data-testid="admin-revoke"
                    onClick={async () => {
                      setBusy(r.userId);
                      if (await post("/api/admin/cert", { enrollmentId: r.enrollmentId, action: "revoke" }))
                        await load(courseId);
                      setBusy(null);
                    }}
                  >
                    取り消す
                  </button>
                </div>
              ) : r.canIssue ? (
                <Btn
                  tone="y"
                  testid="admin-issue"
                  dis={busy === r.userId}
                  onClick={async () => {
                    setBusy(r.userId);
                    if (await post("/api/admin/cert", { enrollmentId: r.enrollmentId, action: "issue" }))
                      await load(courseId);
                    setBusy(null);
                  }}
                >
                  {busy === r.userId ? "発行しています…" : "修了証を発行する"}
                </Btn>
              ) : (
                <div className="text-[12px] text-dim2">
                  修了証はまだ出せません（全単元と修了試験の合格が要ります）
                </div>
              )}
            </div>

            {/* 在籍の出し入れ。退職しても記録は消さない。
                申し込み中の人は、ここからも許可できる */}
            <button
              className={`mt-2 w-full rounded-lg border p-1.5 text-[11px] ${
                r.pending ? "border-yel text-yel" : "border-line text-dim2"
              }`}
              data-testid="admin-member"
              onClick={async () => {
                setBusy(r.userId);
                if (
                  await post("/api/admin/member", {
                    userId: r.userId,
                    action: r.pending ? "approve" : "leave",
                  })
                )
                  await load(courseId);
                setBusy(null);
              }}
            >
              {r.pending
                ? "この申し込みを許可する（名簿に入れる）"
                : "退職にする（名簿から外れます。記録は残ります）"}
            </button>

            {/* 担当者にする／戻す */}
            <button
              className="mt-2 w-full rounded-lg border border-line p-1.5 text-[11px] text-dim2"
              data-testid="admin-role"
              onClick={async () => {
                setBusy(r.userId);
                if (await post("/api/admin/role", { userId: r.userId, admin: !r.admin })) await load(courseId);
                setBusy(null);
              }}
            >
              {r.admin ? "担当者をやめてもらう" : "この人を教育担当者にする"}
            </button>

            {r.lastAt && (
              <div className="mt-2 text-right text-[10.5px] text-dim2">最後の記録 {day(r.lastAt)}</div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
