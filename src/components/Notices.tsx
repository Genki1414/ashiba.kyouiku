"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/* 本部・担当者からの返事を、ホームのいちばん上に出す。

   ── なぜホームか ──
   返事が返るのは、その人が**待っている**とき。
   参加申込の許可、入金の確認、討議の候補日。
   どれも、こちらが動いたことが伝わらなければ、
   相手は何度も開き直すか、開くのをやめる。

   ── 決めたこと ──
   ・**開いたら全部を読んだことにする。** 1件ずつ押させると、
     押し忘れた1件で丸い数字が消えなくなる。消えない数字は見られなくなる
   ・ただし、**その場では数字も印も消さない。** 未読があると
     開いた形で出すので、消してしまうと「2件」も黄色い点も一瞬で消えて、
     **届いた回に限って、どれが新しいのか分からない**。
     覚えるのはサーバだけにして、画面は次に開いたときに変わる
   ・読んだ知らせも、しばらく残す。消すと「さっき何て書いてあった？」に
     答えられない。薄く出す
   ・**押せるのは行き先のある知らせだけ**ではなく、全部押せる。
     行き先は種類から決まっていて、必ず1つある（src/lib/noticeText.ts）
   ・1件も無ければ、枠ごと出さない */

type Notice = {
  id: string;
  kind: string;
  t: string;
  d: string;
  href: string;
  note: string;
  at: string;
  read: boolean;
};

/** 「3日前」くらいの粗さで出す。何時何分は要らない */
function ago(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "たったいま";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 31) return `${d}日前`;
  return new Date(t).toLocaleDateString("ja-JP");
}

export function Notices() {
  const [rows, setRows] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notices", { cache: "no-store" });
      const j = (await r.json()) as { ok?: boolean; unread?: number; notices?: Notice[] };
      if (!j.ok) return;
      setRows(j.notices ?? []);
      setUnread(j.unread ?? 0);
      /* 未読があれば、開いた形で出す。読んだものだけなら畳んでおく。
         畳んだままだと、届いたことに気づかない */
      setOpen((j.unread ?? 0) > 0);
    } catch {
      /* 読めなくても、ホームのほかは出る。ここで止めない */
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* 読んだ印は、開いたときに付ける。**画面はそのまま**（上の理由）。
     二度送らないように、送ったかどうかだけ覚える */
  const [sent, setSent] = useState(false);
  const markRead = useCallback(async () => {
    if (!unread || sent) return;
    setSent(true);
    try {
      await fetch("/api/notices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "read" }),
      });
    } catch {
      /* 付かなくても困らない。次に開いたときにまた出るだけ */
    }
  }, [unread, sent]);

  useEffect(() => { if (open) void markRead(); }, [open, markRead]);

  if (!rows.length) return null;
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group rounded-xl border border-line bg-panel p-4"
      data-testid="notices"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-extrabold tracking-widest text-dim2">おしらせ</span>
          {unread > 0 && (
            <span
              className="rounded-full bg-yel px-2 py-0.5 text-[11px] font-black text-bg"
              data-testid="notices-unread"
            >
              {unread}
            </span>
          )}
        </span>
        <span className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-bold text-dim">
          <span className="group-open:hidden">ひらく</span>
          <span className="hidden group-open:inline">とじる</span>
        </span>
      </summary>

      <div className="mt-3 grid gap-1 border-t border-line pt-2">
        {rows.map((n) => (
          <Link
            key={n.id}
            href={n.href}
            className="block rounded-lg px-2 py-2 no-underline"
            data-testid="notice"
          >
            <div className="flex items-baseline gap-2">
              {/* 読んでいない印。数字が消えたあとも、どれが新しいか分かる */}
              <span
                className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                  n.read ? "bg-transparent" : "bg-yel"
                }`}
              />
              <span
                className={`min-w-0 text-[13px] font-bold ${n.read ? "text-dim" : "text-txt"}`}
              >
                {n.t}
              </span>
              <span className="ml-auto shrink-0 text-[11px] text-dim2">{ago(n.at)}</span>
            </div>
            <div className="mt-0.5 pl-3.5 text-[12px] leading-relaxed text-dim">{n.d}</div>
            {/* こちらが書いた一言。断った理由はここに出る。
                これを出さないと「断られました」だけが残って、
                受け取った人は次に何をすればいいか分からない */}
            {n.note && (
              <div
                className="mt-1 ml-3.5 rounded border-l-2 border-line pl-2 text-[12px] leading-relaxed text-dim2"
                data-testid="notice-note"
              >
                {n.note}
              </div>
            )}
          </Link>
        ))}
      </div>
    </details>
  );
}
