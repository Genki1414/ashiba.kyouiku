"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn } from "@/components/ui/Btn";
import { SLOT_MAX, SLOT_LEAD_DAYS, type IssueStatus, type Slot } from "@/lib/issue";
import { TALK_MIN } from "@/content/shokucho";

/* 発行申請（本部の側）。

   学科を見終わった人が申請を出してくる。ここで討議の候補日を返す。
   自動では発行しない。討議が済んでいないから。

   候補日を出すのはこちらだけ。受講する人には作らせない。
   作らせると、講師の都合と関係なく日が入る。 */

type Req = {
  id: string;
  courseId: string;
  course: string;
  kind: "talk" | "drill";
  status: IssueStatus;
  name: string;
  email: string | null;
  company: string | null;
  note: string;
  requestedAt: string;
  drillOn: string | null;
  drillBy: string;
  replyNote: string;
  repliedAt: string | null;
  sessionId: string | null;
  decidedAt: string | null;
  slots: Slot[];
  talk: { min: number; ok: boolean; why: string | null } | null;
  /** つなぎ先（Zoom）が入っているか。URL そのものは返さない */
  hasRoom: boolean;
};

const STATUS: Record<IssueStatus, { label: string; tone: string }> = {
  none: { label: "未申請", tone: "text-dim" },
  open: { label: "返事待ち", tone: "text-yel" },
  offered: { label: "候補日を出した", tone: "text-cyan" },
  picked: { label: "日が決まった", tone: "text-cyan" },
  cleared: { label: "修了", tone: "text-dim" },
  declined: { label: "返した", tone: "text-dim" },
};

const WHY: Record<string, string> = {
  time: "居た時間が足りません",
  answer: "課題への答えがまだです",
  teacher: "講師の確認がまだです",
};

const day = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const w = "日月火水木金土"[d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()}（${w}）${hh}:${mm}`;
};

/** datetime-local の値（現地時刻）を作る。既定は「N日後の10:00」 */
const defaultAt = (plusDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + plusDays);
  d.setHours(10, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function IssueClient() {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [ng, setNg] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* 候補日の入力欄。既定で3つ出す。空欄は出さない */
  const [at, setAt] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(TALK_MIN);
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/issue", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setNg(j.reason ?? "開けません。");
        return;
      }
      setRows(j.requests ?? []);
      setNg("");
    } catch {
      setNg("つながりません。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setNote("");
    try {
      const r = await fetch("/api/owner/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setNote(j.reason ?? "うまくいきませんでした。");
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const startOffer = (r: Req) => {
    setOpen(r.id);
    setReply("");
    setMinutes(TALK_MIN);
    /* 既定は 3日後・4日後・7日後 の10時。そのまま出せる形にしておく */
    setAt([defaultAt(3), defaultAt(4), defaultAt(7)]);
  };

  const offer = async (r: Req) => {
    const slots = at
      .filter((v) => v.trim())
      /* datetime-local は現地時刻。ここで UTC に直して送る */
      .map((v) => ({ startsAt: new Date(v).toISOString(), minutes, note: "" }));
    if (!slots.length) {
      setNote("候補日を1つ以上入れてください。");
      return;
    }
    if (await post({ action: "offer", requestId: r.id, slots, note: reply })) setOpen(null);
  };

  if (ng) {
    return <div className="rounded-xl border border-red bg-ng-bg p-4 text-[13px] text-ng-tx">{ng}</div>;
  }
  if (!rows) return <div className="text-[13px] text-dim">読み込んでいます…</div>;

  const waiting = rows.filter((r) => r.status === "open").length;

  return (
    <div data-testid="owner-issue">
      <p className="mb-3 text-[12.5px] leading-relaxed text-dim">
        学科を見終わった人から届く、修了証の発行申請です。
        <br />
        討議のある講座は、ここで候補日を返します。押しても、その場では発行されません。
        討議が済むと、修了証が出せるようになります。
        {waiting > 0 && (
          <>
            <br />
            <span className="font-extrabold text-yel">返事待ち {waiting} 件</span>
          </>
        )}
      </p>

      {note && (
        <div className="mb-3 rounded-lg border border-line bg-panel2 px-3.5 py-3 text-[12.5px] text-txt">
          {note}
        </div>
      )}

      {!rows.length && (
        <div className="rounded-xl border border-line bg-panel p-4 text-[13px] text-dim">
          まだ申請はありません。
        </div>
      )}

      <div className="grid gap-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-line bg-panel p-3.5"
            data-testid="issue-row"
            data-status={r.status}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[14px] font-extrabold">{r.name || "（氏名未登録）"}</span>
              <span className="text-[11.5px] text-dim">{r.company ?? "個人"}</span>
              <span className={`ml-auto text-[11.5px] font-extrabold ${STATUS[r.status].tone}`}>
                {STATUS[r.status].label}
              </span>
            </div>
            <div className="mt-1 text-[11.5px] text-dim">
              {r.course}・{r.kind === "talk" ? "討議" : "実技"}／申請 {day(r.requestedAt)}
              {r.email ? `／${r.email}` : ""}
            </div>

            {r.note && (
              <div className="mt-2 rounded-lg border border-line bg-panel2 px-3 py-2 text-[12px] leading-relaxed">
                <span className="text-dim2">本人から：</span>
                {r.note}
              </div>
            )}

            {r.kind === "drill" && r.drillOn && (
              <div className="mt-2 text-[12px] text-dim">
                実技：{r.drillOn}／実施者 {r.drillBy || "（未記入）"}
              </div>
            )}

            {r.slots.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.slots.map((s) => (
                  <span
                    key={s.id}
                    className={`rounded border px-2 py-1 text-[11.5px] ${
                      s.picked ? "border-yel text-yel" : "border-line text-dim"
                    }`}
                  >
                    {day(s.startsAt)}
                    {s.picked ? " ←選択" : ""}
                  </span>
                ))}
              </div>
            )}

            {/* つなぎ先（Zoom）。日が決まったら入れる。
                入れておかないと、当日「入る」を押しても部屋が渡らない */}
            {r.status === "picked" && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`text-[12px] ${r.hasRoom ? "text-dim" : "text-yel"}`}>
                  つなぎ先：{r.hasRoom ? "入っています" : "まだです"}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const u = window.prompt(
                      r.hasRoom ? "つなぎ先を入れ直す（https〜）" : "討議のつなぎ先（https〜）",
                    );
                    if (u?.trim()) void post({ action: "room", requestId: r.id, url: u });
                  }}
                  data-testid="issue-room"
                  className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] text-dim"
                >
                  {r.hasRoom ? "入れ直す" : "つなぎ先を入れる"}
                </button>
              </div>
            )}

            {/* 討議が済んだかどうか。判定は受講と同じ決まり */}
            {r.status === "picked" && r.talk && (
              <div className="mt-2 text-[12px] text-dim">
                討議：{r.talk.min}分
                {r.talk.ok ? (
                  <span className="ml-2 font-extrabold text-cyan">条件を満たしています</span>
                ) : (
                  <span className="ml-2">{WHY[r.talk.why ?? ""] ?? "まだです"}</span>
                )}
              </div>
            )}

            {/* 候補日を出す */}
            {open === r.id ? (
              <div className="mt-3 grid gap-2 rounded-lg border border-line bg-panel2 p-3">
                <div className="text-[11.5px] text-dim">
                  候補日（{SLOT_MAX}件まで・{SLOT_LEAD_DAYS}日より先）
                </div>
                {at.map((v, i) => (
                  <input
                    key={i}
                    type="datetime-local"
                    value={v}
                    onChange={(e) => setAt(at.map((x, j) => (j === i ? e.target.value : x)))}
                    data-testid="offer-at"
                    className="w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-[14px]"
                  />
                ))}
                {at.length < SLOT_MAX && (
                  <button
                    type="button"
                    onClick={() => setAt([...at, defaultAt(at.length + 3)])}
                    className="rounded-lg border border-line px-3 py-2 text-[12px] text-dim"
                  >
                    ＋ 候補日を足す
                  </button>
                )}
                <label className="block">
                  <span className="mb-1 block text-[11.5px] text-dim">1回の長さ（分）</span>
                  <input
                    type="number"
                    value={minutes}
                    min={1}
                    max={480}
                    onChange={(e) => setMinutes(Number(e.target.value) || TALK_MIN)}
                    className="w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-[14px]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11.5px] text-dim">添える一言（任意）</span>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    data-testid="offer-note"
                    className="w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-[13px]"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Btn tone="y" dis={busy} onClick={() => void offer(r)} testid="offer-send">
                    候補日を送る
                  </Btn>
                  <Btn dis={busy} onClick={() => setOpen(null)}>
                    やめる
                  </Btn>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.kind === "talk" && r.status !== "cleared" && (
                  <button
                    type="button"
                    onClick={() => startOffer(r)}
                    data-testid="offer-open"
                    className="rounded-lg border border-yel px-3 py-2 text-[12.5px] font-extrabold text-yel"
                  >
                    {r.status === "offered" ? "候補日を出し直す" : "候補日を出す"}
                  </button>
                )}
                {r.status !== "cleared" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void post({ action: "clear", requestId: r.id })}
                    data-testid="issue-clear"
                    className="rounded-lg border border-line px-3 py-2 text-[12.5px] text-dim"
                  >
                    修了にする
                  </button>
                )}
                {r.status !== "cleared" && r.status !== "declined" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const why = window.prompt("お返しする理由（本人に届きます）");
                      if (why?.trim()) void post({ action: "decline", requestId: r.id, note: why });
                    }}
                    className="rounded-lg border border-line px-3 py-2 text-[12.5px] text-dim"
                  >
                    返す
                  </button>
                )}
              </div>
            )}

            {r.replyNote && (
              <div className="mt-2 text-[11.5px] leading-relaxed text-dim2">
                返した一言：{r.replyNote}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
