"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";
import { CHAPTERS } from "@/training/chapters";
import type { LearnerRow } from "@/training/roster";

/* 教育担当者の画面。

   誰が学科のどこまで進んで、修了試験に受かって、実務トレーニングを
   どの章まで通したか。そして修了証を出したか。
   出せるのにまだ出していない人が上に来る。担当者がやることはそこなので。

   見えるのは自社の受講者だけ。判断はすべてサーバ（/api/admin/*）で行う。 */

type Totals = { people: number; done: number; issued: number; waiting: number };

type Loaded =
  | {
      kind: "ok";
      company: string;
      joinCode: string;
      seats: { total: number; used: number; paid: number };
      rows: LearnerRow[];
      totals: Totals;
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

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/summary", { cache: "no-store" });
      const j = await res.json();
      if (res.ok && j.ok) {
        setSt({
          kind: "ok",
          company: j.company ?? "",
          joinCode: j.joinCode ?? "",
          seats: j.seats ?? { total: 0, used: 0, paid: 0 },
          rows: j.rows ?? [],
          totals: j.totals,
        });
        setCompany(j.company ?? "");
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
              if (await post("/api/admin/setup", { company: company.trim() })) await load();
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

  /* ── 一覧 ── */
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

      {/* 事業者の名前と、受講者に配る参加コード */}
      <div className="mx-5 mt-3 rounded-xl border border-line bg-panel p-4">
        <div className="mb-2 text-[11px] tracking-[2px] text-dim">事業者（名簿の分け方）</div>
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
                    await load();
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
            href="/order"
            className="mt-2 block rounded-lg border border-yel bg-yel p-2.5 text-center text-[13px] font-extrabold text-bg no-underline"
            data-testid="admin-order"
          >
            {st.seats.total ? "受講コードを見る・申し込む" : "受講コードを申し込む"}
          </Link>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1 text-[11px] tracking-[2px] text-dim">受講者に配る参加コード</div>
          <div className="font-mono text-[20px] font-black tracking-[4px] text-yel" data-testid="admin-joincode">
            {st.joinCode || "—"}
          </div>
          <div className="mt-1 text-[11.5px] leading-relaxed text-dim">
            席を使わずに名簿へ入れるコードです（担当者や、見学だけの人）。
            受講する人には受講コードを渡してください。
            漏れたら作り直せます（前のコードは使えなくなります）。
          </div>
          <button
            className="mt-2 w-full rounded-lg border border-line p-1.5 text-[11.5px] text-dim2"
            data-testid="admin-newcode"
            onClick={async () => {
              setBusy("code");
              if (await post("/api/admin/company", { newCode: true })) await load();
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
          まだ受講者が居ません。受講する人に登録してもらい、上の参加コードを入れてもらうと、ここに並びます。
        </p>
      )}

      <div className="mx-5 mt-4 grid gap-3">
        {rows.map((r) => (
          <div key={r.userId} className="rounded-xl border border-line bg-panel p-4" data-testid="admin-row">
            <div className="flex items-baseline gap-2">
              <div className="min-w-0 flex-1 truncate text-[15px] font-black">{r.name}</div>
              {r.admin && (
                <span className="rounded border border-cyan px-1.5 py-0.5 text-[10px] text-cyan">担当者</span>
              )}
            </div>
            {r.email && <div className="mt-0.5 truncate text-[11px] text-dim2">{r.email}</div>}

            {/* 学科 */}
            <div className="mt-3 flex items-baseline gap-2 text-[12.5px]">
              <span className="w-16 shrink-0 text-dim">学科</span>
              <span className={r.lessonsPassed >= r.lessonsTotal ? "font-bold text-grn" : ""}>
                {r.lessonsPassed} / {r.lessonsTotal} 単元
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2 text-[12.5px]">
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
                        await load();
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
                      await load();
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

            {/* 担当者にする／戻す */}
            <button
              className="mt-2 w-full rounded-lg border border-line p-1.5 text-[11px] text-dim2"
              data-testid="admin-role"
              onClick={async () => {
                setBusy(r.userId);
                if (await post("/api/admin/role", { userId: r.userId, admin: !r.admin })) await load();
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
