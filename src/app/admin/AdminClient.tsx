"use client";

import { useCallback, useEffect, useState } from "react";
import { emailLabel } from "@/lib/lineEmail";
import Link from "next/link";
import { Loading } from "@/components/Loading";
import { keep, recall } from "@/lib/remember";
import { Btn } from "@/components/ui/Btn";
import type { PersonRow } from "@/training/roster";
import { LearnerCard } from "./LearnerCard";
import { AskDone, type Ask } from "@/components/AskDone";
import { PastRecords } from "./PastRecords";
import { drillMinOf, findCourse, hoursText } from "@/content/courses";

/* 教育担当者の画面。

   誰が学科のどこまで進んで、修了試験に受かって、実務トレーニングを
   どの章まで通したか。そして修了証を出したか。
   出せるのにまだ出していない人が上に来る。担当者がやることはそこなので。

   見えるのは自社の受講者だけ。判断はすべてサーバ（/api/admin/*）で行う。 */

type Totals = { people: number; left: number; pending: number; doing: number; issued: number; waiting: number };

type CourseTab = { id: string; short: string; name: string };

/** 参加の申し込み。許可するまで名簿には入らない */
type Request = { userId: string; name: string; email: string | null; at: string | null };

/** 資格の申請。本人が入れた「取得済みの資格」で、まだ現物を確かめていないもの */
type QualItem = {
  id: string;
  name: string;
  kind: string;
  issuer: string;
  gotOn: string | null;
  certNo: string;
};
type QualReq = { userId: string; name: string; email: string | null; items: QualItem[] };

/** 受講リクエスト。本人が「この講座を受けたい」と送ったもの */
type CourseReq = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  courseId: string;
  courseName: string;
  at: string | null;
};

type Loaded =
  | {
      kind: "ok";
      company: string;
      joinCode: string;
      /** 会社ぶん全部の枚数。paid=買った／used=配った／free=まだ配れる */
      seats: { paid: number; used: number; free: number };
      rows: PersonRow[];
      totals: Totals;
      /* いま見ている講座と、切り替えられる講座 */
      course: CourseTab | null;
      courses: CourseTab[];
      /* 参加の申し込み。担当者がやることなので上に出す */
      requests: Request[];
      /* 却下した申し込み（直近30日）。押し間違いを戻せるように */
      rejected: Request[];
      /* 受講リクエスト。まだ対応していないもの */
      courseRequests: CourseReq[];
      /* 講座ごとの、いま配れる席の数（0028）。
         これが無いと、押してみるまで席が余っているか分からない */
      freeSeats: Record<string, number>;
      /* 在籍の内訳。申し込んだはずの人が居ないときに、どこへ行ったか分かる */
      member: { active: number; waiting: number; gone: number };
      /* 資格の申請。まだ現物を確かめていないもの */
      quals: QualReq[];
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
  /* 古いものを出しているあいだ。黙って古いものを見せない */
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /* 確かめてから変える（教育担当者の付け外し）。
     押した瞬間に効くと、押し間違いで会社が止まる */
  const [ask, setAsk] = useState<Ask | null>(null);
  const [note, setNote] = useState<string>("");
  const [company, setCompany] = useState("");
  const [edit, setEdit] = useState(false);

  const load = useCallback(async (course?: string) => {
    try {
      const q = course ? `?courseId=${encodeURIComponent(course)}` : "";
      const res = await fetch(`/api/admin/summary${q}`, { cache: "no-store" });
      const j = await res.json();
      if (res.ok && j.ok) {
        const fresh: Loaded = {
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
          courseRequests: j.courseRequests ?? [],
          freeSeats: j.freeSeats ?? {},
          member: j.member ?? { active: 0, waiting: 0, gone: 0 },
          quals: j.quals ?? [],
        };
        setSt(fresh);
        setStale(false);
        /* 次に開いたとき、待たずに出せるように覚えておく */
        keep("admin", fresh);
        setCompany(j.company ?? "");
        return;
      }
      setStale(false);
      if (j.canSetup) {
        setSt({ kind: "setup", reason: j.reason ?? "" });
        return;
      }
      setSt({ kind: "ng", reason: j.reason ?? "画面を表示できません。", signIn: j.signedIn === false });
    } catch {
      /* 圏外。覚えているものがあれば、それを出したままにする
         （出しっぱなしでも「古い」と画面に書いてある） */
      setSt((was) => was ?? { kind: "ng", reason: "つながりません。電波の届く所でもう一度開いてください。" });
    }
  }, []);

  useEffect(() => {
    /* 前に見た名簿を、まず出す。押した先が真っ白にならない。
       進み具合はそのあいだに変わっているかもしれないので、
       出しているあいだは画面に「読み直しています」と書く */
    const seen = recall<Loaded>("admin");
    if (seen?.kind === "ok") {
      setSt(seen);
      setStale(true);
      setCompany(seen.company);
    }
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
    if (!res.ok || !j.ok) setNote(j.reason ?? "処理できませんでした。");
    return !!j.ok;
  };

  /* ── 決める操作は、全部ここを通す（げんきさん 2026-09-10）──
       「ユーザーが操作を行う部分を全て洗い出して、
         全てに確認表示・完了表示のポップアップを付ける」

     承認する・配る・発行する・外す——名簿の押す所は、指が触れただけでも
     効く大きさで並んでいる。押した瞬間に効くと、隣の人に配ってしまう。
     終わったことも出す。静かに書き換わるだけだと、効いたか分からず二度押す。

     通ったら読み直す。after があるときは、札を閉じてから（画面が
     入れ替わる操作。先に入れ替えると札ごと消える） */
  const askPost = (
    a: Omit<Ask, "run"> & { url: string; payload: unknown; busyKey?: string; reloadAfter?: boolean },
  ) =>
    setAsk({
      title: a.title,
      body: a.body,
      yes: a.yes,
      danger: a.danger,
      done: a.done,
      doneBody: a.doneBody,
      after: a.reloadAfter ? () => { void load(); } : undefined,
      run: async () => {
        setBusy(a.busyKey ?? null);
        try {
          const ok = await post(a.url, a.payload);
          if (ok && !a.reloadAfter) await load();
          return ok;
        } finally {
          setBusy(null);
        }
      },
    });

  /* 読み終わるまで真っ暗にしない。押したのに何も出ないと、
     同じ待ち時間でもずっと遅く感じる */
  if (!st) return <Loading title="受講管理" back="/" rows={4} />;

  /* ── まだ担当者が決まっていない ── */
  if (st.kind === "setup") {
    return (
      <main className="pb-10">
        <div className="tape" />
        <div className="px-5 pb-4 pt-6">
          <Link href="/" className="backlink text-[13px] text-dim no-underline">
            ← ホーム
          </Link>
          <h1 className="mt-2 text-[18px] font-black">事業者を登録</h1>
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
            onClick={() =>
              askPost({
                title: `「${company.trim()}」で登録しますか`,
                body: "あなたがこの事業者の最初の教育担当者になります。名簿はこの事業者ごとに分かれます。",
                yes: "登録する",
                done: "登録しました",
                doneBody: "受講する人には、名簿に申し込んでもらうか、受講コードを渡してください。",
                url: "/api/admin/setup",
                payload: { company: company.trim() },
                busyKey: "setup",
                reloadAfter: true,
              })}
          >
            {busy === "setup" ? "登録しています…" : "この事業者で登録する"}
          </Btn>
          {note && <div className="mt-3 text-[12px] text-red">{note}</div>}
        </div>
        <AskDone ask={ask} onClose={() => setAsk(null)} />
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
          <h1 className="mt-2 text-[18px] font-black">受講管理</h1>
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
  const rows = st.rows;
  /* この会社の教育担当者の数。1人しか居なければ、外せない
     （げんきさん 2026-09-09）。サーバも同じことを断る */
  const admins = rows.filter((x) => x.admin).length;

  /* ── この会社が関わっている講座 ──
     買った受講コードが残っているか、誰かが受けている（受け終えた）講座。
     73講座あるので、**関わっていないものは出さない。**
     前は「いま見ている講座」1つだけを出していたので、
     2つ目の講座の実技の案内が、切り替えるまで出なかった */
  const touched = new Map<string, { id: string; short: string; free: number }>();
  for (const c of st.courses) {
    const free = st.freeSeats[c.id] ?? 0;
    const learning = st.rows.some((r) => [...r.doing, ...r.done].some((x) => x.courseId === c.id));
    if (free > 0 || learning) touched.set(c.id, { id: c.id, short: c.short, free });
  }
  /* 残りのあるものだけ、多い順に。残っていない講座を並べても配れない */
  const freeList = [...touched.values()].filter((c) => c.free > 0).sort((a, b) => b.free - a.free);
  /* 実技のある講座。実技はこの会社が行う */
  const drills = [...touched.values()]
    .map((c) => {
      const meta = findCourse(c.id);
      return { c, min: meta ? drillMinOf(meta) : 0 };
    })
    .filter((x) => x.min > 0);

  return (
    <main className="pb-10">
      <div className="tape" />
      <div className="px-5 pb-4 pt-6">
        <Link href="/" className="backlink text-[13px] text-dim no-underline">
          ← ホーム
        </Link>
        <h1 className="mt-2 text-[18px] font-black">受講管理</h1>
        <p className="mt-1 text-[12px] text-dim">{st.company}</p>
      </div>

      {/* ── 受講コードの残り（講座ごと）──

          前はここに「いま見ている講座」を選ぶ所があった。選んでも名簿は
          変わらず（名簿は講座に関係なく全員が並ぶ）、変わるのは残数の表示と
          実技の案内と、配る講座だけ。**それが分からないまま、73件の札が
          画面の上半分を埋めていた**（げんきさん 2026-09-09「これ必要？」）。

          選ぶのをやめて、**買った講座の残数をそのまま並べる。**
          配る講座は、配るときに選ぶ（LearnerCard） */}
      {!!freeList.length && (
        <div className="mx-5 mb-3 rounded-xl border border-line bg-panel p-3.5" data-testid="admin-free-list">
          <div className="mb-1 text-[11px] tracking-[2px] text-dim">
            まだ配っていない受講コード
          </div>
          <div className="grid gap-0.5">
            {freeList.map((c) => (
              <div key={c.id} className="flex items-baseline text-[12.5px]">
                <span className="min-w-0 flex-1 truncate">{c.short}</span>
                <span className="ml-2 shrink-0 font-black text-yel">{c.free} 枚</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[11.5px] leading-relaxed text-dim2">
            下の名簿で、配りたい方の
            <span className="text-dim">「受講コードを配る」</span>
            を押してください。コードを打たせずに渡せます。
          </div>
        </div>
      )}

      {/* ── 実技のある講座は畳む（げんきさん 2026-09-10）──
          「実技科目が必要な講座情報は折り畳んでおく」

          実技は**この会社が**行う。担当者がここを見ないと、学科を終えた人が
          止まったままになる。ただ、買った講座が増えるほど札が積み上がり、
          **名簿が下へ押し下げられる。**件数は畳んだままでも見える。 */}
      {!!drills.length && (
        <details className="mx-5 mb-3 rounded-xl border border-cyan bg-panel" data-testid="admin-drills">
          <summary
            className="cursor-pointer list-none p-3.5 text-[13px] font-extrabold text-txt"
            data-testid="admin-drills-open"
          >
            御社で行う実技　{drills.length}件
            <span className="ml-2 text-[11px] font-normal text-dim2">（押すと開きます）</span>
          </summary>
          <div className="grid gap-2 border-t border-line p-3">
            {drills.map(({ c, min }) => (
              <Link
                key={c.id}
                href={`/edu/${c.id}/drill`}
                data-testid="admin-go-drill"
                className="block rounded-lg border border-line p-3 no-underline"
              >
                <div className="text-[13px] font-extrabold text-txt">
                  「{c.short}」の実技{hoursText(min)}
                </div>
                <div className="mt-1 text-[12px] leading-relaxed text-dim">
                  何を何分やるか、誰が行うか、実施記録の様式（印刷できます）はこちら。
                  実技が済むまで、修了証は発行できません。
                </div>
              </Link>
            ))}
          </div>
        </details>
      )}

      <div className="mx-5 grid grid-cols-4 gap-2" data-testid="admin-totals">
        {[
          { t: "受講者", v: st.totals.people },
          { t: "受講中", v: st.totals.doing },
          { t: "資格取得", v: st.totals.issued },
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
            自社の方かご確認のうえ承認してください。承認すると名簿に入り、受講できるようになります。
          </p>
          <div className="mt-2.5 grid gap-2">
            {st.requests.map((q) => (
              <div key={q.userId} className="rounded-lg border border-line bg-panel p-3" data-testid="admin-request">
                <div className="text-[14px] font-black">{q.name}</div>
                {q.email && <div className="mt-0.5 truncate text-[11px] text-dim2">{emailLabel(q.email)}</div>}
                {q.at && <div className="mt-0.5 text-[10.5px] text-dim2">{day(q.at)} 申し込み</div>}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Btn
                    tone="y"
                    dis={busy === q.userId}
                    testid="admin-approve"
                    onClick={() =>
                      askPost({
                        title: `${q.name}さんを承認しますか`,
                        body: "名簿に入り、受講コードを配れるようになります。ご本人にお知らせが届きます。",
                        yes: "承認する",
                        done: "承認しました",
                        url: "/api/admin/member",
                        payload: { userId: q.userId, action: "approve" },
                        busyKey: q.userId,
                      })}
                  >
                    承認する
                  </Btn>
                  <button
                    className="rounded-lg border border-line p-2.5 text-[12.5px] text-dim"
                    data-testid="admin-reject"
                    onClick={() =>
                      askPost({
                        title: `${q.name}さんの申し込みを却下しますか`,
                        body: "名簿には入りません。ご本人に「断られました」と届きます。間違って申し込んだ人には、これでよいです。",
                        yes: "却下する",
                        danger: true,
                        done: "却下しました",
                        url: "/api/admin/member",
                        payload: { userId: q.userId, action: "reject" },
                        busyKey: q.userId,
                      })}
                  >
                    却下する
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 受講リクエスト。本人がマイページか、受講コードを入れる画面から
          「受けたい」と送ったもの。

          **講座ごとにまとめる。**1人ずつ並べると、同じ講座に3人来ていても
          3行に散って、何席買えばよいのかが読み取れない。まとめておけば
          「高所作業車 3名」と出て、そのまま3席で申し込み画面へ行ける。

          席（受講コード）はここでは作らない。申し込み画面へ渡すだけ */}
      {!!st.courseRequests.length && (
        <div className="mx-5 mt-3 rounded-xl border border-cyan bg-panel p-4" data-testid="admin-course-reqs">
          <div className="text-[11px] font-extrabold tracking-[2px] text-cyan">
            受講リクエスト {st.courseRequests.length} 件
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-dim">
            受講者から受講リクエストが届いています。そのまま申し込めます。
            受講コードを配ったら、対応済みにしてください。
          </p>
          <div className="mt-2.5 grid gap-2">
            {Object.values(
              st.courseRequests.reduce<Record<string, { courseId: string; courseName: string; rows: CourseReq[] }>>(
                (acc, q) => {
                  (acc[q.courseId] ??= { courseId: q.courseId, courseName: q.courseName, rows: [] }).rows.push(q);
                  return acc;
                },
                {},
              ),
            ).map((g) => (
              <div
                key={g.courseId}
                className="rounded-lg border border-line bg-bg p-3"
                data-testid="admin-course-req"
              >
                <div className="flex items-baseline gap-2">
                  <div className="min-w-0 flex-1 truncate text-[13.5px] font-black">{g.courseName}</div>
                  <div className="shrink-0 text-[12px] font-extrabold text-cyan" data-testid="admin-course-req-n">
                    {g.rows.length}名
                  </div>
                </div>
                {/* **席が余っていれば、その場で配れる（0028）。**
                    受講コードの12文字を口頭やLINEで伝えて打たせるのは、
                    誰に受けさせるか決まっているなら要らない手間で、
                    打ち間違いのもとになる。押せば、その人の画面に講座が出る。

                    **受講コードの方式は残してある。**その場に居ない人、
                    まだ名簿に入っていない人には、コードを渡すしかない */}
                <div className="mt-1.5 grid gap-1">
                  {g.rows.map((q) => (
                    <div key={q.id} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate text-[11.5px] text-dim">
                        {q.name}
                        {q.email ? `　${emailLabel(q.email)}` : ""}
                        {q.at && <span className="ml-1 text-[10.5px] text-dim2">{day(q.at)}</span>}
                      </div>
                      {(st.freeSeats[g.courseId] ?? 0) > 0 && (
                        <button
                          className="shrink-0 rounded-lg border border-grn px-2.5 py-1.5 text-[11px] font-extrabold text-grn disabled:opacity-50"
                          data-testid="admin-assign"
                          disabled={busy === q.id}
                          onClick={() =>
                            askPost({
                              title: `${q.name}さんに配りますか`,
                              body: (
                                <>
                                  <div className="text-txt">{g.courseName}</div>
                                  <div className="mt-2">ご本人にお知らせが届き、コードを打たずにそのまま受講できます。</div>
                                </>
                              ),
                              yes: "配る",
                              done: "配りました",
                              doneBody: "ご本人にお知らせが届きました。",
                              url: "/api/admin/assign",
                              payload: { userId: q.userId, courseId: g.courseId },
                              busyKey: q.id,
                            })}
                        >
                          受講コードを配る
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {/* 席の余りを先に出す。押してみるまで分からない、をなくす */}
                <div className="mt-1.5 text-[11px] text-dim2" data-testid="admin-free-seats">
                  {(st.freeSeats[g.courseId] ?? 0) > 0
                    ? `配れる席が ${st.freeSeats[g.courseId]}枚あります（受講コードを打たせずに渡せます）`
                    : "配布できる受講コードがありません。先に申し込んでください"}
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {/* 人数のぶんだけ席を入れた状態で申し込み画面を開く。
                      数はあちらで直せる（受けない人が混じることもある） */}
                  <Link
                    href={`/order?courseId=${encodeURIComponent(g.courseId)}&seats=${g.rows.length}`}
                    className="rounded-lg border border-yel bg-yel p-2.5 text-center text-[12px] font-extrabold text-bg no-underline"
                    data-testid="admin-course-req-order"
                  >
                    {g.rows.length}名分を申し込む
                  </Link>
                  <button
                    className="rounded-lg border border-line p-2.5 text-[12px] text-dim disabled:opacity-50"
                    data-testid="admin-course-req-done"
                    disabled={busy === g.courseId}
                    onClick={() =>
                      setAsk({
                        title: `${g.courseName}の受講リクエスト ${g.rows.length}件を対応済みにしますか`,
                        body: "受講管理の一覧から消えます。受講コードを配ったあと、または口頭で済ませたときに押してください。ご本人には何も届きません。",
                        yes: "対応済みにする",
                        done: "対応済みにしました",
                        run: async () => {
                          setBusy(g.courseId);
                          try {
                            /* まとめて閉じる。1件ずつ押させると、押し忘れが残る */
                            for (const q of g.rows) {
                              await post("/api/admin/course-request", { id: q.id, on: true });
                            }
                            await load();
                            return true;
                          } finally {
                            setBusy(null);
                          }
                        },
                      })}
                  >
                    対応済みにする
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 資格の申請。本人がマイページから入れたもの。
          出さないと、入れたことに気づかれないまま埋もれる */}
      {!!st.quals.length && (
        <div className="mx-5 mt-3 rounded-xl border border-yel bg-[#1A1F14] p-4" data-testid="admin-qual-reqs">
          <div className="text-[11px] font-extrabold tracking-[2px] text-yel">
            外部で取得した資格の確認 {st.quals.reduce((n, q) => n + q.items.length, 0)} 件
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-dim">
            受講者が「すでに取得済み」として登録した資格です。
            <strong className="text-dim">同じ特別教育を再受講させる必要はありません。</strong>
            ただし、業務に就かせる前に修了証の現物をご確認ください。
          </p>
          <div className="mt-2.5 grid gap-2">
            {st.quals.map((q) => (
              <div key={q.userId} className="rounded-lg border border-line bg-panel p-3" data-testid="admin-qual-req">
                <div className="text-[14px] font-black">{q.name}</div>
                {q.email && <div className="mt-0.5 truncate text-[11px] text-dim2">{emailLabel(q.email)}</div>}
                <div className="mt-2 grid gap-2">
                  {q.items.map((it) => (
                    <div key={it.id} className="rounded border border-line bg-bg p-2.5">
                      <div className="text-[12.5px] font-black leading-snug">{it.name}</div>
                      <div className="mt-0.5 text-[11px] leading-relaxed text-dim2">
                        {it.kind}
                        {it.issuer ? `　${it.issuer}` : ""}
                        {it.gotOn ? `　${day(it.gotOn)} 取得` : ""}
                        {it.certNo ? <><br />修了証番号 {it.certNo}</> : null}
                      </div>
                      <div className="mt-2">
                        <Btn
                          tone="y"
                          dis={busy === it.id}
                          testid="admin-qual-ok"
                          onClick={() =>
                            askPost({
                              title: "現物を確認したことにしますか",
                              body: (
                                <>
                                  <div className="text-txt">{it.name}</div>
                                  <div className="mt-2">修了証などの現物を見たうえで押してください。「確認済み」の印が付きます。</div>
                                </>
                              ),
                              yes: "確認済みにする",
                              done: "確認済みにしました",
                              url: "/api/admin/qual",
                              payload: { heldId: it.id, on: true },
                              busyKey: it.id,
                            })}
                        >
                          現物を確認した
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 却下した申し込み。**畳んでおく**（げんきさん 2026-09-09）。
          押し間違いを戻す道は要るが、ふだん見るものではない。
          開いたままだと、やることの並びに割り込んでくる */}
      {!!st.rejected.length && (
        <details className="group mx-5 mt-3 rounded-xl border border-line bg-panel" data-testid="admin-rejected">
          <summary
            className="flex cursor-pointer list-none items-center gap-2 p-4 text-[12.5px] text-dim"
            data-testid="admin-rejected-open"
          >
            <span className="inline-block text-[11px] text-dim2 transition-transform group-open:rotate-90" aria-hidden>
              ▶
            </span>
            却下した申し込み
            <span className="text-[11.5px] text-dim2">{st.rejected.length}件（直近30日）</span>
          </summary>
          <div className="px-4 pb-4">
          <p className="text-[11.5px] leading-relaxed text-dim2">
            間違って却下してしまったときは、ここから承認に戻せます。
          </p>
          <div className="mt-2 grid gap-1.5">
            {st.rejected.map((q) => (
              <div key={q.userId} className="flex items-center gap-2 rounded-lg border border-line bg-bg p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{q.name}</div>
                  {q.email && <div className="truncate text-[10.5px] text-dim2">{emailLabel(q.email)}</div>}
                </div>
                <button
                  className="shrink-0 rounded border border-line px-2.5 py-1.5 text-[11px] text-dim"
                  data-testid="admin-reapprove"
                  onClick={() =>
                    askPost({
                      title: `${q.name}さんを承認に戻しますか`,
                      body: "名簿に入り、受講できるようになります。",
                      yes: "承認に戻す",
                      done: "承認しました",
                      url: "/api/admin/member",
                      payload: { userId: q.userId, action: "approve" },
                      busyKey: q.userId,
                    })}
                >
                  承認に戻す
                </button>
              </div>
            ))}
          </div>
          </div>
        </details>
      )}

      {/* 事業者の名前と、参加コード（社員の登録用） */}
      <div className="mx-5 mt-3 rounded-xl border border-line bg-panel p-4">
        <div className="mb-2 text-[11px] tracking-[2px] text-dim">事業者情報</div>
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
                キャンセル
              </button>
              <Btn
                tone="y"
                dis={!company.trim()}
                testid="admin-company-save"
                onClick={() =>
                  setAsk({
                    title: "事業者名を変更しますか",
                    body: (
                      <>
                        <div>{st.company}</div>
                        <div>→ <span className="text-txt">{company.trim()}</span></div>
                        <div className="mt-2">名簿の見出しが変わります。修了証の名義は変わりません。</div>
                      </>
                    ),
                    yes: "変更する",
                    done: "変更しました",
                    run: async () => {
                      setBusy("company");
                      try {
                        const ok = await post("/api/admin/company", { name: company.trim() });
                        if (ok) { setEdit(false); await load(); }
                        return ok;
                      } finally {
                        setBusy(null);
                      }
                    },
                  })}
              >
                {busy === "company" ? "変更しています…" : "変更"}
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
              事業者名を変更
            </button>
            <div className="mt-2 text-[11.5px] leading-relaxed text-dim2">
              修了証の名義は{" "}
              <span className="text-dim">東北三上機材株式会社／中川元基</span>{" "}
              で決まっています。ここの名前は修了証には出ません。
            </div>
          </>
        )}

        {/* ── 受講コードの財布（2026-09-10）──
            げんきさん「配ってないコードが3件とあるが、未使用は15件ある」
            「配れる受講コード 文言変更＋タップで配れるページへ移動」

            数は**会社ぶん全部**。前は「いま見ている講座」1つに絞って
            数えていた（画面から切り替えを無くしたのに、ここだけ残っていた）。
            残りがあるときは、そのまま配る画面へ行けるようにする。 */}
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1 text-[11px] tracking-[2px] text-dim">受講コード</div>
          <div className="text-[12.5px] leading-[1.9]">
            <span className="font-black text-txt">{st.seats.paid} 枚</span>
            <span className="text-dim">
              {" "}入金済み　／　配った {st.seats.used} 枚　残り {st.seats.free} 枚
            </span>
          </div>
          <div className="mt-1 text-[11.5px] leading-relaxed text-dim2">
            修了証の発行には受講コードが必要です。人数分を申し込んでください。
          </div>

          {st.seats.free > 0 ? (
            <>
              <div className="mt-1 text-[11.5px] leading-relaxed text-yel">
                まだ配っていない受講コードが {st.seats.free} 枚あります。
              </div>
              {/* **配るのは名簿。**枚数の一覧へ戻しても配れない
                  （げんきさん 2026-09-10「配るを押してまだ配ってない
                  受講コードに遷移するのはおかしい」） */}
              <Link
                href="#roster"
                className="mt-2 block rounded-lg border border-yel bg-yel p-2.5 text-center text-[13px] font-extrabold text-bg no-underline"
                data-testid="admin-give"
              >
                名簿から配る
              </Link>
            </>
          ) : null}

          <Link
            href="/order"
            className={`mt-2 block rounded-lg border p-2.5 text-center text-[13px] no-underline ${
              st.seats.free > 0
                ? "border-line text-txt"
                : "border-yel bg-yel font-extrabold text-bg"
            }`}
            data-testid="admin-order"
          >
            {st.seats.paid ? "受講コードを追加で申し込む" : "受講コードを申し込む"}
          </Link>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1 text-[11px] tracking-[2px] text-dim">本人確認の記録</div>
          <div className="text-[11.5px] leading-relaxed text-dim2">
            受講中に「画面の前に本人が居たか」を確かめた記録です。
            監督署や元請に聞かれたときは、これを出してください。
          </div>
          <Link
            href="/admin/check"
            className="mt-2 block rounded-lg border border-line p-2.5 text-center text-[13px] text-txt no-underline"
            data-testid="admin-check"
          >
            記録を確認する
          </Link>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1 text-[11px] tracking-[2px] text-dim">参加コード（社員の登録用）</div>
          <div className="font-mono text-[20px] font-black tracking-[4px] text-yel" data-testid="admin-joincode">
            {st.joinCode || "—"}
          </div>
          <div className="mt-1 text-[11.5px] leading-relaxed text-dim">
            席を使わずに名簿へ入れるコードです（担当者や、見学だけの人）。
            <strong className="text-dim">配布した相手はそのまま名簿に登録されます</strong>
            （コードを渡した時点で認めたことになるので、許可は要りません）。
            自分でさがして申し込んできた人は、上の「参加の申し込み」で許可してください。
            漏れたら作り直せます（前のコードは使えなくなります）。
          </div>
          <button
            className="mt-2 w-full rounded-lg border border-line p-1.5 text-[11.5px] text-dim2"
            data-testid="admin-newcode"
            onClick={() =>
              askPost({
                title: "参加コードを再発行しますか",
                body: "前のコードは使えなくなります。すでに渡してある紙やメッセージは無効になるので、配り直してください。",
                yes: "再発行する",
                danger: true,
                done: "再発行しました",
                doneBody: "新しいコードを、受講する人に渡してください。",
                url: "/api/admin/company",
                payload: { newCode: true },
                busyKey: "code",
              })}
          >
            {busy === "code" ? "再発行しています…" : "参加コードを再発行"}
          </button>
        </div>
      </div>

      {stale && (
        <div className="mx-5 mt-2 text-[11px] text-dim2" data-testid="admin-stale">
          前に見たものを出しています。読み直しています…
        </div>
      )}

      {note && <div className="mx-5 mt-3 text-[12px] text-red">{note}</div>}

      {!rows.length && (
        <p className="mx-5 mt-5 text-[13px] leading-relaxed text-dim">
          まだ受講者が居ません。
          <br />
          <strong className="text-dim">登録しただけでは、こちらには表示されません。</strong>
          受講する人に上の<span className="text-yel">参加コード</span>を渡して、
          ホームの「参加コードを入れる」から入れてもらってください。
          受講コード（12文字）を渡した場合は、それを入れれば同じように並びます。
        </p>
      )}

      <div id="roster" className="mx-5 mt-4 grid scroll-mt-4 gap-3">
        {rows.map((r) => (
          <LearnerCard
            key={r.userId}
            r={r}
            busy={busy === r.userId}
            /* **受講コードを、その場で配れる（0028）。**
               出すのは3つとも満たす講座だけ
                 ・在籍している（辞めた人・申し込み中の人には渡せない）
                 ・その講座をまだ持っていない（二重に渡さない。取得済みにも渡さない）
                 ・その講座の受講コードが残っている
               ここで出し分けても、渡るかどうかは assign_seat が決める。
               画面の出し分けだけを頼りにしない */
            assign={(() => {
              if (r.left || r.pending) return null;
              const can = freeList.filter(
                (c) =>
                  ![...r.doing, ...r.done].some((x) => x.courseId === c.id) &&
                  /* よそで取ったと入れた資格も「取得済み」。取得済みの資格には配れない */
                  !r.held.some((h) => h.courseId === c.id),
              );
              if (!can.length) return null;
              return {
                courses: can,
                run: (cid: string) =>
                  askPost({
                    title: `${r.name || "この方"}に配りますか`,
                    body: (
                      <>
                        <div className="text-txt">{can.find((c) => c.id === cid)?.short ?? cid}</div>
                        <div className="mt-2">ご本人にお知らせが届き、コードを打たずにそのまま受講できます。</div>
                      </>
                    ),
                    yes: "配る",
                    done: "配りました",
                    doneBody: "ご本人にお知らせが届きました。",
                    url: "/api/admin/assign",
                    payload: { userId: r.userId, courseId: cid },
                    busyKey: r.userId,
                  }),
              };
            })()}
            onIssue={(enrollmentId, courseName) =>
              askPost({
                title: `${r.name || "この方"}の修了証を発行しますか`,
                body: (
                  <>
                    <div className="text-txt">{courseName}</div>
                    <div className="mt-2">証明番号が付き、ご本人が受け取れるようになります。氏名と生年月日は、ご本人がマイページで入れたものが載ります。</div>
                  </>
                ),
                yes: "発行する",
                done: "修了証を発行しました",
                doneBody: "ご本人にお知らせが届きました。",
                url: "/api/admin/cert",
                payload: { enrollmentId, action: "issue" },
                busyKey: r.userId,
              })}
            onRevoke={(enrollmentId, courseName) =>
              askPost({
                title: `${r.name || "この方"}の修了証を取り消しますか`,
                body: (
                  <>
                    <div className="text-txt">{courseName}</div>
                    <div className="mt-2">証明番号は無効になります。出し直すときは、もう一度発行してください。</div>
                  </>
                ),
                yes: "取り消す",
                danger: true,
                done: "修了証を取り消しました",
                url: "/api/admin/cert",
                payload: { enrollmentId, action: "revoke" },
                busyKey: r.userId,
              })}
            onMember={() =>
              askPost(r.pending
                ? {
                    title: `${r.name || "この方"}を承認しますか`,
                    body: "名簿に入り、受講コードを配れるようになります。ご本人にお知らせが届きます。",
                    yes: "承認する",
                    done: "承認しました",
                    url: "/api/admin/member",
                    payload: { userId: r.userId, action: "approve" },
                    busyKey: r.userId,
                  }
                : {
                    title: `${r.name || "この方"}を退職として登録しますか`,
                    body: "名簿から外れます。受講の記録と修了証は残ります（「名簿から外した人」から出せます）。",
                    yes: "退職として登録",
                    danger: true,
                    done: "退職として登録しました",
                    url: "/api/admin/member",
                    payload: { userId: r.userId, action: "leave" },
                    busyKey: r.userId,
                  })}
            onConfirm={(heldId, on, qualName) =>
              askPost(on
                ? {
                    title: "現物を確認したことにしますか",
                    body: (
                      <>
                        <div className="text-txt">{qualName}</div>
                        <div className="mt-2">修了証などの現物を見たうえで押してください。「確認済み」の印が付きます。</div>
                      </>
                    ),
                    yes: "確認済みにする",
                    done: "確認済みにしました",
                    url: "/api/admin/qual",
                    payload: { heldId, on },
                    busyKey: r.userId,
                  }
                : {
                    title: "確認を取り消しますか",
                    body: (
                      <>
                        <div className="text-txt">{qualName}</div>
                        <div className="mt-2">「確認待ち」に戻ります。</div>
                      </>
                    ),
                    yes: "取り消す",
                    danger: true,
                    done: "確認を取り消しました",
                    url: "/api/admin/qual",
                    payload: { heldId, on },
                    busyKey: r.userId,
                  })}
            canDropAdmin={admins > 1}
            /* **押した瞬間には変えない。**確かめてから変え、
               終わったことも出す（げんきさん 2026-09-09） */
            onRole={() =>
              setAsk({
                title: r.admin
                  ? `${r.name || "この方"}を教育担当者から外しますか`
                  : `${r.name || "この方"}を教育担当者にしますか`,
                body: r.admin ? (
                  <>
                    名簿・受講コードの配布・修了証の発行が
                    <span className="text-txt">できなくなります。</span>
                    <br />
                    受講の記録は残ります。あとで戻すこともできます。
                  </>
                ) : (
                  <>
                    名簿を開いて、
                    <span className="text-txt">
                      受講コードを配ったり、修了証を出したりできる
                    </span>
                    ようになります。
                    <br />
                    ほかの方の受講記録も見えるようになります。
                  </>
                ),
                yes: r.admin ? "外す" : "担当者にする",
                danger: r.admin,
                done: r.admin
                  ? `${r.name || "この方"}を教育担当者から外しました`
                  : `${r.name || "この方"}を教育担当者にしました`,
                run: async () => {
                  setBusy(r.userId);
                  try {
                    const ok = await post("/api/admin/role", {
                      userId: r.userId,
                      admin: !r.admin,
                    });
                    if (ok) await load();
                    return ok;
                  } finally {
                    setBusy(null);
                  }
                },
              })
            }
          />
        ))}
      </div>

      {/* 確かめる → 終わったと出す（教育担当者の付け外し） */}
      <AskDone ask={ask} onClose={() => setAsk(null)} />

      {/* 名簿から外した人のぶんは、ここから出す */}
      <PastRecords />
    </main>
  );
}
