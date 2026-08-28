"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui/Btn";
import { CamWindow } from "@/components/edu/CamWindow";
import { VerifyModal } from "@/components/edu/VerifyModal";
import { loadPrep, prepDone } from "@/lib/prep";
import { useVerification } from "@/lib/useVerification";
import { hm } from "@/lib/hours";

/* 討議の画面。

   ── 討議は講座に1回だけ、45分 ──
   科目ごとに討議を置くと、科目の数だけ日を合わせて集まることになる。
   受ける人にも講師にも重すぎるので、45分の回を1度だけにした。
   その45分は12時間の中に入る。

   ── つなぎ先（Zoom）は、顔の照合を通ってから ──
   一覧に URL が出ていると、申し込んだ人が誰かに渡せてしまう。
   URL は「入る」を押したときにサーバから受け取り、
   受け取った時点で入室が記録される。

   顔の照合は、学科の受講中とまったく同じ作りにしてある
   （src/lib/useVerification.ts）。顔の特徴量は端末の中だけにあり、
   サーバへは送らない。外れたときは /api/verify-log に残る。

   「討議の画面を開いた」では修了にしない。
   実際に居た時間・課題への回答・講師の確認、3つそろって修了。 */

/* 照合の記録を、学科と同じ場所に残すための目印 */
const TALK_LESSON = "talk";

type Session = {
  id: string;
  startsAt: string;
  minutes: number;
  capacity: number;
  booked: number;
  note: string;
  full: boolean;
  mine: boolean;
  min: number;
  answered: boolean;
  teacherOk: boolean;
  done: boolean;
  why: "time" | "answer" | "teacher" | null;
};

type Talk = {
  minutes: number;
  subjectId: number;
  subject: string;
  question: string;
  done: boolean;
  sessionId: string | null;
};

type Data = { course: { name: string }; max: number; talk: Talk; sessions: Session[] };

const WHY: Record<string, string> = {
  time: "居た時間が足りません",
  answer: "課題に答えていません",
  teacher: "講師の確認待ちです",
};

const whenText = (iso: string) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "日時未定";
  const w = "日月火水木金土"[d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日(${w}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function TalkClient({ courseId, courseName }: { courseId: string; courseName: string }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /* 受講の準備で登録した顔。討議中はこれと比べる（端末の中だけにある） */
  const [registered, setRegistered] = useState<number[] | null>(null);
  const [useCam, setUseCam] = useState(false);
  /* 「入る」を押して受け取ったつなぎ先。一覧には出てこない */
  const [room, setRoom] = useState<{ sessionId: string; url: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");

  /* 学科と同じ：受講の準備が済んでいなければ、先にそちらへ */
  useEffect(() => {
    let alive = true;
    void loadPrep().then((p) => {
      if (!alive) return;
      if (!prepDone(p)) {
        router.replace(`/edu/${courseId}/prep?back=talk`);
        return;
      }
      setRegistered(p.faceDescriptor);
      setUseCam(!p.skipped);
    });
    return () => { alive = false; };
  }, [courseId, router]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/live?courseId=${encodeURIComponent(courseId)}`);
    const j = await r.json();
    if (!j.ok) { setErr(j.reason ?? "読み込めませんでした。"); return; }
    setErr(null);
    setData(j as Data);
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);

  /* 部屋に入っているあいだだけ照合を回す。
     外れたら止めて、記録を残す（学科の受講中と同じ） */
  const [stopped, setStopped] = useState(false);
  const v = useVerification({
    courseId,
    lessonId: TALK_LESSON,
    counting: !!room && !stopped,
    useCam,
    registered,
    onStop: () => setStopped(true),
  });

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.ok) setErr(j.reason ?? "うまくいきませんでした。");
      else setErr(null);
      return j as { ok: boolean; roomUrl?: string | null };
    } finally {
      setBusy(false);
    }
  };

  const book = async (id: string) => {
    if ((await post({ action: "book", sessionId: id })).ok) await load();
  };

  /* 顔の照合が通ってはじめて押せる。押した時点で入室が記録され、
     そこでサーバがつなぎ先を返す */
  const enter = async (id: string) => {
    const j = await post({ action: "in", sessionId: id });
    if (!j.ok) return;
    setRoom({ sessionId: id, url: j.roomUrl ?? null });
    await load();
  };

  const leave = async () => {
    if (!room) return;
    if ((await post({ action: "out", sessionId: room.sessionId })).ok) {
      setRoom(null);
      setStopped(false);
      await load();
    }
  };

  const send = async (id: string) => {
    if (!answer.trim()) return;
    if ((await post({ action: "answer", sessionId: id, answer })).ok) {
      setAnswer("");
      await load();
    }
  };

  if (!data) {
    return (
      <main className="px-4 py-6">
        <p className="text-[13px] text-dim">{err ?? "読み込み中…"}</p>
      </main>
    );
  }

  const t = data.talk;
  const camOn = useCam && !!room;

  return (
    <main className="pb-16" data-testid="talk">
      <div className="tape" />
      {camOn ? <CamWindow stream={v.cam.stream} state={v.camState} active={!stopped} /> : null}

      <div className="px-4 pt-4">
        <Link href={`/edu/${courseId}`} className="backlink text-[13px] text-dim no-underline">
          ← 科目一覧
        </Link>
      </div>

      <div className="px-4 py-4">
        <div className="text-[11px] font-extrabold tracking-[2px] text-cyan">{courseName}</div>
        <h1 className="mb-3 mt-2 text-[21px] font-black leading-snug">討議</h1>
        <p className="mb-4 text-[13px] leading-loose text-dim">
          職長教育は討議方式が原則です。録画を見るだけでは討議になりません。
          決まった時間に集まって、講師と受講者でやり取りします。
          討議は<b className="text-txt">この講座で1回、{hm(t.minutes)}</b>です。
          この{hm(t.minutes)}は12時間の中に入り、
          科目{t.subjectId}「{t.subject}」の時間として数えます。
        </p>

        {t.done ? (
          <div className="mb-4 rounded-xl border border-grn bg-ok-bg p-3.5 text-[13px] text-ok-tx" data-testid="talk-done">
            討議は済んでいます。
          </div>
        ) : null}

        {err ? (
          <div className="mb-4 rounded-xl border border-red bg-ng-bg p-3.5 text-[13px] text-ng-tx" data-testid="talk-err">
            {err}
          </div>
        ) : null}

        {/* ── お題 ── */}
        <div className="mb-4 rounded-xl border border-line bg-panel p-3.5">
          <div className="mb-2 text-[11px] tracking-widest text-yel">当日のお題</div>
          <p className="text-[13px] leading-loose">{t.question}</p>
          <p className="mt-2 text-[12px] leading-loose text-dim">
            討議の前に、自分の考えを書いておいてください。
            書いていないと、居ただけになってしまうので修了になりません。
          </p>
        </div>

        {/* ── 回の一覧 ── */}
        <div className="mb-2 text-[11px] tracking-widest text-dim">
          討議の回（1回 {data.max}人まで）
        </div>
        {data.sessions.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel p-3.5 text-[13px] text-dim" data-testid="talk-none">
            いま申し込める回はありません。日程が決まりしだい、ここに出ます。
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          {data.sessions.map((s) => {
            const here = room?.sessionId === s.id;
            return (
              <div key={s.id} className="rounded-xl border border-line bg-panel p-3.5" data-testid="talk-session">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-[15px] font-extrabold">{whenText(s.startsAt)}</div>
                  <div className="text-[12px] text-dim">{hm(s.minutes)}</div>
                </div>
                <div className="mt-1 text-[12px] text-dim">
                  {s.booked} / {s.capacity} 人{s.note ? `　${s.note}` : ""}
                </div>

                {s.done ? (
                  <div className="mt-3 text-[13px] font-extrabold text-grn">修了</div>
                ) : s.mine ? (
                  <div className="mt-3">
                    <div className="mb-2 text-[12px] text-dim">
                      申し込み済み　居た時間 {hm(s.min)} / {hm(s.minutes)}
                      {s.why ? `　（${WHY[s.why]}）` : ""}
                    </div>

                    {here ? (
                      <>
                        {room?.url ? (
                          <a
                            href={room.url}
                            target="_blank"
                            rel="noreferrer"
                            data-testid="talk-room"
                            className="block w-full rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
                          >
                            Zoom を開く
                          </a>
                        ) : (
                          <p className="text-[13px] text-dim">
                            つなぎ先がまだ登録されていません。講師に確認してください。
                          </p>
                        )}
                        <p className="mt-2 text-[12px] leading-loose text-dim">
                          この画面は閉じないでください。閉じると在席が数えられません。
                          討議が終わったら「退出する」を押してください。
                        </p>
                        <Btn className="mt-2" dis={busy} onClick={() => void leave()} testid="talk-out">
                          退出する
                        </Btn>
                      </>
                    ) : (
                      <Btn
                        tone="y"
                        dis={busy}
                        onClick={() => void enter(s.id)}
                        testid="talk-in"
                      >
                        入る（顔の照合をして Zoom へ）
                      </Btn>
                    )}

                    {/* 課題への回答。討議の前でも後でも書ける */}
                    {!s.answered ? (
                      <div className="mt-3">
                        <div className="mb-1 text-[11px] tracking-widest text-yel">お題への答え</div>
                        <textarea
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          rows={4}
                          data-testid="talk-answer"
                          className="w-full rounded-lg border border-line bg-panel2 p-2.5 text-[13px] text-txt"
                          placeholder="自分の考えを書いてください"
                        />
                        <Btn className="mt-2" dis={busy || !answer.trim()} onClick={() => void send(s.id)} testid="talk-send">
                          出す
                        </Btn>
                      </div>
                    ) : (
                      <div className="mt-3 text-[12px] text-grn">お題への答えは出してあります。</div>
                    )}
                  </div>
                ) : s.full ? (
                  <div className="mt-3 text-[13px] text-dim">いっぱいです。別の回を選んでください。</div>
                ) : (
                  <Btn className="mt-3" tone="y" dis={busy} onClick={() => void book(s.id)} testid="talk-book">
                    この回に申し込む
                  </Btn>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 顔の照合に使う映像。学科と同じで、画像はサーバへ送らない */}
      <video ref={v.videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={v.canvasRef} className="hidden" />

      {v.stop ? (
        <VerifyModal
          kind={v.stop.kind}
          message={v.stop.message}
          onResume={() => { v.resume(); setStopped(false); }}
        />
      ) : null}
    </main>
  );
}
