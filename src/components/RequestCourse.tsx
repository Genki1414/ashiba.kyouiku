"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findCourse } from "@/content/courses";

/* 「この講座を受けたい」を、断られたその場から送る。

   ── なぜここに要るか ──
   受講リクエストの仕組み（0025）は前からあり、送る所は /join にある。
   ところが**そこへ辿り着く案内は、ホームの札1枚だけ**だった。
   しかもその札は「席を持っている人」にしか出ない（HomeCards の home-request）。

   いちばん「受けたい」と思うのは、**講座を押して、受講コードが要ると
   断られた瞬間**（この画面）なのに、そこに送る所が無かった。
   /join まで行って、73講座の中からさっき見ていた講座を探し直すことになる。
   講座が73本ある店（特別教育ドットコム）では、これが特にきつい。

   ── どの講座かは、住所から取る ──
   この札が出るのは /edu/<講座>/… の下だけ。見張り（src/app/edu/layout.tsx）は
   レイアウトなので courseId を受け取れないため、住所から読む。
   目録に無い id なら、何も出さない。

   ── 席そのものはここでは作らない ──
   送るのは「受けたい」という声だけ。席（受講コード）は、いままでどおり
   教育担当者が申し込んで配る。ここが席を作れると、金額を見ないまま
   売り物が出てしまう。 */

type Row = { courseId: string; requested: boolean; hasSeat: boolean };
type Load =
  | { s: "yet" }
  /** ログインしていない・つながらない。この札は出さない */
  | { s: "no" }
  /** どこの事業者にも在籍していない。誰宛か決まらないので送れない */
  | { s: "nocompany" }
  | { s: "ok"; company: string; sent: boolean };

export function RequestCourse() {
  const path = usePathname() ?? "";
  /* /edu/<courseId> … 以下に単元が続くこともある。2つ目だけ見る */
  const id = path.split("/").filter(Boolean)[1] ?? "";
  const course = findCourse(id);

  const [st, setSt] = useState<Load>({ s: "yet" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!course) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/course-request", { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok || !j.ok) { setSt({ s: "no" }); return; }
        if (j.member?.state !== "active") { setSt({ s: "nocompany" }); return; }
        const row = (j.courses ?? []).find((c: Row) => c.courseId === course.id);
        setSt({ s: "ok", company: j.member?.company ?? "", sent: !!row?.requested });
      } catch {
        /* 圏外。コードを入れる方は使えるので、この札だけ引っ込める */
        if (alive) setSt({ s: "no" });
      }
    })();
    return () => { alive = false; };
  }, [course]);

  if (!course || st.s === "yet" || st.s === "no") return null;

  /* 在籍していないと、誰に頼むかが決まらない。
     黙って消すと「送れないのか、壊れているのか」が分からないので、
     何をすれば送れるようになるかを書く */
  if (st.s === "nocompany") {
    return (
      <div
        className="mt-5 rounded-xl border border-line bg-panel p-4 text-[12.5px] leading-relaxed text-dim"
        data-testid="need-seat-request-none"
      >
        この講座を「受けたい」と会社の教育担当者に送れます。
        <br />
        送るには、先に会社とつないでください。
        <Link href="/join" className="ml-1 text-cyan no-underline">
          会社をさがす
        </Link>
      </div>
    );
  }

  if (st.sent) {
    return (
      <div
        className="mt-5 rounded-xl border border-grn bg-panel p-4 text-[12.5px] leading-relaxed text-grn"
        data-testid="need-seat-request-sent"
      >
        「{course.name}」を受けたいと送ってあります。
        <br />
        <span className="text-dim">
          {st.company ? `${st.company}の教育担当者の画面に出ています。` : "教育担当者の画面に出ています。"}
          席が用意されると、この画面が開きます。
        </span>
      </div>
    );
  }

  return (
    <div className="mt-5" data-testid="need-seat-request">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setNote("");
          try {
            const res = await fetch("/api/course-request", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ courseId: course.id, action: "request" }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok || !j.ok) { setNote(j.reason ?? "送れませんでした。"); return; }
            setSt({ s: "ok", company: st.company, sent: true });
          } catch {
            setNote("つながりません。電波の届く所でもう一度。");
          } finally {
            setBusy(false);
          }
        }}
        className="block w-full rounded-lg border border-cyan p-3 text-center text-[13px] font-bold text-cyan disabled:opacity-50"
        data-testid="need-seat-request-send"
      >
        {busy ? "送っています…" : "この講座を受けたいと担当者に送る"}
      </button>
      <div className="mt-1.5 text-[11.5px] leading-relaxed text-dim2">
        送ると、会社の教育担当者の画面に出ます。担当者が席を用意すると、この画面が開きます。
      </div>
      {!!note && <div className="mt-1.5 text-[12px] text-yel">{note}</div>}
    </div>
  );
}
