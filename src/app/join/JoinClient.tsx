"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui/Btn";
import { codeKind, normalizeJoinCode } from "@/training/joinCode";
import { wipeDevice } from "@/lib/device";
import { AskDone, type Ask, type RunResult } from "@/components/AskDone";

/* 受講を始めるための画面。**その人がどこに立っているかで、名前も並びも変わる。**

   | いる所 | 画面の名前 | 上から順に |
   | --- | --- | --- |
   | 在籍している | 受講をはじめる | 受講コードを入れる／受講リクエスト／いまの所属 |
   | 承認待ち | 承認を待っています | 申し込んだ会社／受講コードを入れる／さがす・登録する |
   | まだどこにも | 会社とつなぐ | さがす／登録する／受講コードを入れる |

   ── できること ──
   ・会社をさがして申し込む → 会社が許可する
     コードを渡されていなくても、自分から入れる。
     よその会社の名簿に勝手に入れないよう、許可を挟む
   ・会社を登録する
     まだこの仕組みを使っていない会社のため。登録した人が担当者になる。
     同じ会社が2つ登録されると名簿が割れるので、
     作る前にもう一度探して、あれば「申し込む」に回す
   ・受講コードを入れる（渡されている場合）
     受講コード（12文字）… 1人1枚。
     コードを渡した時点で会社が認めているので、許可は要らない。

     参加コード（8文字）も、入れれば今までどおり通る。
     ただし受講する人の画面には書かない。入れても教材が開かない
     コードなので、渡された8文字を試して「開かない」と詰まるだけになる。
     案内は担当者の画面にだけ置く
   ・受講リクエストを送る（在籍している人だけ）

   外すのはどちらからでもよい（退職は会社の返事を待てない）。
   外しても、その会社の受講コードで受けた記録は、その会社の名簿に残る。 */

type Found = { id: string; name: string };
/** 受講リクエストに出す講座。名前と、送ってあるか・もう席があるか */
type ReqCourse = { courseId: string; name: string; short: string; requested: boolean; hasSeat: boolean };
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
  /* 会社を登録する。まだこの仕組みを使っていない会社のため */
  const [newName, setNewName] = useState("");
  const [maybe, setMaybe] = useState<Found[] | null>(null);
  const [made, setMade] = useState("");
  /* 受講コードをもらっていない人が、担当者に「受けたい」を送る */
  const [reqs, setReqs] = useState<ReqCourse[] | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqQ, setReqQ] = useState("");
  const [reqBusy, setReqBusy] = useState("");
  const [reqNote, setReqNote] = useState("");
  /* 確かめる→やる→終わった（2026-09-10）。申し込む・登録する・
     コードを使う・外す・送る——決める操作は全部これを通す */
  const [ask, setAsk] = useState<Ask | null>(null);

  const loadMine = useCallback(async () => {
    try {
      const res = await fetch("/api/member", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) setMine(j as Mine);
    } catch {
      /* 圏外。さがす方は使えないが、コードは入れられる */
    }
  }, []);

  /* 講座の一覧と、送ってあるかの印。ログインしていなければ取れないので、
     取れなかったときは黙って何も出さない（コードを入れる方は使える） */
  const loadReqs = useCallback(async () => {
    try {
      const res = await fetch("/api/course-request", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) setReqs(j.courses ?? []);
    } catch {
      /* 圏外 */
    }
  }, []);

  useEffect(() => { void loadMine(); void loadReqs(); }, [loadMine, loadReqs]);

  /* 受けたい・取り消す。席そのものはここでは作らない。
     担当者が見て、いつもどおり受講コードを渡す */
  const sendReq = async (courseId: string, cancel: boolean): Promise<RunResult> => {
    setReqBusy(courseId);
    setReqNote("");
    try {
      const res = await fetch("/api/course-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, action: cancel ? "cancel" : "request" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setReqNote(j.reason ?? "送信できませんでした。");
        return false;
      }
      await loadReqs();
      return true;
    } finally {
      setReqBusy("");
    }
  };

  const askReq = (c: ReqCourse, cancel: boolean) =>
    setAsk(cancel
      ? {
          title: "受講リクエストを取り消しますか",
          body: <>{c.name}</>,
          yes: "取り消す",
          done: "取り消しました",
          run: () => sendReq(c.courseId, true),
        }
      : {
          title: "受講リクエストを送りますか",
          body: (
            <>
              <div>{c.name}</div>
              <div className="mt-2">会社の教育担当者に届きます。担当者が受講コードを用意すると、この講座が開きます。</div>
            </>
          ),
          yes: "送る",
          done: "受講リクエストを送りました",
          doneBody: "担当者が受講コードを用意すると、お知らせが届きます。",
          run: () => sendReq(c.courseId, false),
        });

  const search = async () => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch(`/api/companies?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "検索できませんでした。");
        return;
      }
      setFound(j.rows ?? []);
      if (j.hint) setNote(j.hint);
    } catch {
      setNote("接続できません。電波の届く場所で、もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  const apply = async (c: Found): Promise<RunResult> => {
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
        setNote(j.reason ?? "申し込みできませんでした。");
        return false;
      }
      setFound(null);
      setQ("");
      await loadMine();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const askApply = (c: Found) =>
    setAsk({
      title: `${c.name} に申し込みますか`,
      body: "会社の教育担当者が許可すると、名簿に入って受講できるようになります。よその会社に申し込むと、その会社の担当者に名前が届きます。",
      yes: "申し込む",
      done: "申し込みました",
      doneBody: "担当者が許可すると、お知らせが届きます。",
      run: () => apply(c),
    });

  const drop = async (companyId: string): Promise<RunResult> => {
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
      return true;
    } finally {
      setBusy(false);
    }
  };

  /* 外すのは戻せない（申し込み直しになる）。赤い札で確かめる */
  const askDrop = (c: Found, pendingOne: boolean) =>
    setAsk(pendingOne
      ? {
          title: `${c.name} への申し込みを取り下げますか`,
          body: "取り下げても、あとからもう一度申し込めます。",
          yes: "取り下げる",
          danger: true,
          done: "取り下げました",
          run: () => drop(c.id),
        }
      : {
          title: `${c.name} との紐付けを外しますか`,
          body: "退職などで会社を離れるときに使います。許可は要りません。外しても、この会社の受講コードで受けた記録は会社の名簿に残ります。戻るには、もう一度申し込むことになります。",
          yes: "外す",
          danger: true,
          done: "紐付けを外しました",
          run: () => drop(c.id),
        });

  /* 会社を登録する。force は「似た名前を見たうえで、それでも作る」 */
  const make = async (force: boolean): Promise<RunResult> => {
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
        return false;
      }
      if (j.maybe) {
        setMaybe(j.maybe as Found[]);
        return false;
      }
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "登録できませんでした。");
        return false;
      }
      setMade(j.company ?? newName.trim());
      router.refresh();
      return true;
    } catch {
      setNote("接続できません。電波の届く場所で、もう一度お試しください。");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const askMake = (force: boolean) =>
    setAsk({
      title: `「${newName.trim()}」を登録しますか`,
      body: force
        ? "似た名前の会社とは別の会社として、新しく登録します。あなたがこの会社の教育担当者になります。"
        : "あなたがこの会社の教育担当者になります。あとから他の人を担当者にすることもできます。",
      yes: "登録する",
      done: "登録しました",
      doneBody: "受講する人には、名簿に申し込んでもらうか、受講コードを渡してください。",
      run: () => make(force),
    });

  const go = async (): Promise<RunResult> => {
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
        setNote(j.reason ?? "登録できませんでした。");
        return false;
      }
      /* 受講コードを入れたら、その時点で受講は始めからになる。
         サーバ側の記録は取り消しのときに消しているので、
         端末に残っている分（受講の準備・実務の成績・間違いノート・途中経過）も
         ここで消す。残すと前の続きから始まってしまう */
      if (j.kind === "seat") wipeDevice();
      setDone({ company: j.company ?? "", kind: j.kind ?? "join" });
      router.refresh();
      return j.kind === "seat"
        ? { done: `${j.company ?? "会社"} の受講コードを使いました`, doneBody: "学科を最後まで受講すると修了証を発行できます。" }
        : { done: `${j.company ?? "会社"} に入りました`, doneBody: "名簿に登録されました。修了証の発行には受講コードが必要です。" };
    } catch {
      setNote("接続できません。電波の届く場所で、もう一度お試しください。");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const askGo = () =>
    setAsk({
      title: codeKind(code) === "join" ? "このコードを使いますか" : "この受講コードを使いますか",
      body: (
        <>
          <div className="font-mono text-[16px] font-black tracking-[3px] text-yel">
            {normalizeJoinCode(code).replace(/(.{4})(?=.)/g, "$1-")}
          </div>
          <div className="mt-2">
            {codeKind(code) === "seat"
              ? "この受講コードは1人1回きりです。使うと、その講座の受講が最初から始まります。"
              : "会社の名簿に入ります。"}
          </div>
        </>
      ),
      yes: "使う",
      done: "登録しました",
      run: go,
    });

  /* ── 終わった画面 ──
     **確かめる札（AskDone）は、どの画面でも同じ場所に置く。**
     早く return して画面ごと入れ替えると、札も作り直されて
     「終わった」が出る前に消える。画面だけ選んで、札は外に置く */
  let screen: React.ReactNode = null;
  if (made) {
    screen = (
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
          受講管理へ
        </Link>
        <Link
          href="/"
          className="mt-2 block rounded-lg border border-line p-3 text-center text-[12.5px] text-dim no-underline"
        >
          ホームへ
        </Link>
      </main>
    );
  } else if (done !== null) {
    screen = (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <h1 className="text-[18px] font-black">{done.company} に入りました</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-dim">
          {done.kind === "seat"
            ? "受講コードを1つ登録しました。学科を最後まで受講すると修了証を発行できます。"
            : "名簿に登録されました。修了証の発行には受講コードが必要です。教育担当者にご確認ください。"}
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

  /* いまどこに立っているか。**画面の名前も、並べる順も、ここで決まる。**

     げんきさん（2026-09-10）「UIも動線が分かりにくいから整理して欲しい」

     ── 何が分かりにくかったか ──
     ホームの札は4枚とも、この画面へ来る。札の名前は
     「会社とつなぐ」「承認待ち」「受講するには」「受けたい講座を」と
     違うのに、着いた先の見出しは**いつも「会社とつなぐ」**だった。
     押した札と違う名前が出るので、間違えて別の所へ来たのかと思う。

     番号も合っていなかった。「①会社を検索」「②会社を登録」は
     在籍している人には出ないのに、その下は「③受講コードを入力する」
     「④受講コードをお持ちでない場合」のまま。**在籍者には③から始まる**
     画面になっていた。番号はやめて、やることの名前だけ書く。

     在籍している人にとって、ここは会社とつなぐ画面ではない。
     **受講コードを入れる画面**である。だから上に出す。 */
  const active = mine?.state === "active" ? mine : null;
  const pending = mine?.state === "pending" ? mine : null;
  const kind = codeKind(code);

  /* 受講コードを入れる所。どの立場の人にも出す（渡されていれば使えるので） */
  const codeBox = (
    <div className="mt-4 rounded-xl border border-yel bg-panel p-4" data-testid="join-code-box">
      <div className="mb-1 text-[11px] tracking-[2px] text-yel">受講コードを入れる</div>
      <p className="mb-1 text-[12px] leading-relaxed text-dim2">
        {active
          ? "教育担当者から渡された12文字を入れると、その講座が開きます。"
          : "受講コード（12文字）を渡されている場合は、こちらが早いです。許可は要りません。入れた時点で名簿に入り、学科が開きます。"}
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ABCD-2345-6789"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-3 text-center font-mono text-[20px] tracking-[4px]"
        data-testid="join-code"
      />
      <div className="mt-1 text-[11px] text-dim2">
        小文字で入れても構いません。数字の0と1、英字のO・I・Lは使っていません。
      </div>
      <div className="mt-3">
        <Btn tone="y" dis={busy || !kind} onClick={askGo} testid="join-go">
          {busy ? "確認しています…" : kind === "join" ? "このコードを使う" : "この受講コードを使う"}
        </Btn>
      </div>
      {note && (
        <div className="mt-3 text-[12.5px] text-red" data-testid="join-note">
          {note}
        </div>
      )}
    </div>
  );

  /* 会社をさがして申し込む。在籍している人には出さない */
  const searchBox = (
    <div className="mt-4 rounded-xl border border-line bg-panel p-4" data-testid="join-search">
      <div className="mb-1 text-[11px] tracking-[2px] text-dim">会社をさがして申し込む</div>
      <p className="mb-2.5 text-[11.5px] leading-relaxed text-dim2">
        自分の会社を見つけて申し込みます。会社の担当者が許可すると名簿に入ります。
      </p>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void search(); }}
          placeholder="会社名（一部でも検索できます）"
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
              下の「会社を登録する」から登録できます。
            </div>
          )}
          {found.map((c) => (
            <button
              key={c.id}
              onClick={() => askApply(c)}
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
  );

  /* 会社を登録する。まだこの仕組みを使っていない会社のため */
  const newBox = (
    <div className="mt-4 rounded-xl border border-line bg-panel p-4" data-testid="join-new">
      <div className="mb-1 text-[11px] tracking-[2px] text-dim">会社を登録する</div>
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
                onClick={() => askApply(c)}
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
            onClick={() => askMake(true)}
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
          onClick={() => askMake(false)}
          disabled={busy || newName.trim().length < 2}
          className="mt-2.5 w-full rounded-lg border border-line p-2.5 text-[12.5px] text-dim"
          data-testid="join-new-go"
        >
          {busy ? "確認しています…" : "この会社を登録する"}
        </button>
      )}
    </div>
  );

  if (!screen) screen = (
    <main className="px-5 py-8">
      <div className="tape -mx-5 mb-6" />
      <Link href="/" className="backlink text-[13px] text-dim no-underline">
        ← ホーム
      </Link>

      {/* 分かる前に決め打ちで出さない。**先に「会社とつなぐ」と出して
          あとから「受講をはじめる」に変わると、いちばん紛らわしい。**
          高さだけ取って、分かってから書く（帯と同じ作り） */}
      {mine ? (
        <h1 className="mt-2 text-[18px] font-black" data-testid="join-title">
          {active ? "受講をはじめる" : pending ? "承認を待っています" : "会社とつなぐ"}
        </h1>
      ) : (
        <h1 className="mt-2 text-[18px] font-black invisible" aria-hidden>
          会社とつなぐ
        </h1>
      )}

      {/* ── 在籍している人 ──
          用があるのは受講コード。所属はもう済んでいるので、いちばん下 */}
      {active && (
        <>
          {codeBox}

          {/* 受講コードを渡されていない人が、担当者に「受けたい」を送る。
              会社に居ないと誰宛か決まらないので、在籍しているときだけ出す。
              受講コードはここでは作らない。担当者が見て、いつもどおり渡す */}
          {!!reqs?.length && (
            <div className="mt-4 rounded-xl border border-cyan bg-panel p-4" data-testid="join-request">
              <div className="text-[11px] tracking-[2px] text-cyan">受講リクエストを送る</div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-dim">
                受講コードを渡されていない講座は、ここから頼めます。選んで送ると、
                <span className="text-cyan">{active.company.name}</span>の受講管理の画面に出ます。
                担当者が受講コードを用意して渡してくれます。
              </p>

              {!reqOpen ? (
                <button
                  onClick={() => setReqOpen(true)}
                  className="mt-3 w-full rounded-lg border border-cyan p-2.5 text-[12.5px] font-bold text-cyan"
                  data-testid="join-request-open"
                >
                  受けたい講座を選ぶ
                </button>
              ) : (
                <>
                  <input
                    value={reqQ}
                    onChange={(e) => setReqQ(e.target.value)}
                    placeholder="講座名で検索（例：足場、玉掛け）"
                    className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[13px]"
                    data-testid="join-request-find"
                  />
                  <div className="mt-2 grid max-h-[320px] gap-1.5 overflow-y-auto">
                    {reqs
                      .filter((c) => !reqQ.trim() || c.name.includes(reqQ.trim()) || c.short.includes(reqQ.trim()))
                      .map((c) => (
                        <div
                          key={c.courseId}
                          className="flex items-center gap-2 rounded-lg border border-line bg-bg p-2.5"
                          data-testid="join-request-row"
                        >
                          <div className="min-w-0 flex-1 text-[12.5px] leading-snug">{c.name}</div>
                          {c.hasSeat ? (
                            <span className="shrink-0 text-[11px] text-grn">受講コードあり</span>
                          ) : c.requested ? (
                            <button
                              onClick={() => askReq(c, true)}
                              disabled={reqBusy === c.courseId}
                              className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-dim2 disabled:opacity-50"
                              data-testid="join-request-cancel"
                            >
                              送信済み（取り消す）
                            </button>
                          ) : (
                            <button
                              onClick={() => askReq(c, false)}
                              disabled={reqBusy === c.courseId}
                              className="shrink-0 rounded-lg border border-cyan bg-cyan px-2.5 py-1.5 text-[11px] font-extrabold text-bg disabled:opacity-50"
                              data-testid="join-request-send"
                            >
                              送る
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                  {reqNote && (
                    <div className="mt-2 text-[12px] text-red" data-testid="join-request-note">
                      {reqNote}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-8 rounded-xl border border-line bg-panel p-4" data-testid="join-active">
            <div className="text-[11px] tracking-[2px] text-grn">いまの所属</div>
            <div className="mt-1 text-[15px] font-black">{active.company.name}</div>
            <button
              onClick={() => askDrop(active.company, false)}
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
        </>
      )}

      {/* ── 承認を待っている人 ──
          待つあいだにできることは1つ。**受講コードを渡されていれば、
          待たずに始められる。**それを取り下げの次に出す */}
      {pending && (
        <>
          <div className="mt-3 rounded-xl border border-yel bg-[#1A1F14] p-4" data-testid="join-pending">
            <div className="text-[11px] tracking-[2px] text-yel">申し込んだ会社</div>
            {pending.pending.map((x) => (
              <div key={x.id} className="mt-1.5">
                <div className="text-[14px] font-black">{x.company.name}</div>
                <button
                  onClick={() => askDrop(x.company, true)}
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
          {codeBox}
          {searchBox}
          {newBox}
        </>
      )}

      {/* ── まだどこにも属していない人 ── */}
      {!active && !pending && (
        <>
          {searchBox}
          {newBox}
          {codeBox}
        </>
      )}

      <div className="mt-8 rounded-xl border border-line bg-bg p-4 text-[12px] leading-relaxed text-dim">
        {active
          ? "受講コードを持っていない場合は、上の「受講リクエストを送る」から頼めます。急ぐときは、会社の教育担当者に直接お伝えください。"
          : "受講コードを持っていない場合は、会社の教育担当者に聞いてください。自分の会社でこれから使い始める場合は、上の「会社を登録する」から。"}
      </div>
    </main>
  );
  return (
    <>
      {screen}
      <AskDone ask={ask} onClose={() => setAsk(null)} />
    </>
  );
}
