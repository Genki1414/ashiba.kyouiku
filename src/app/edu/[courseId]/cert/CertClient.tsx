"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { drawCert } from "@/components/edu/drawCert";
import type { CertData } from "@/lib/cert";
import { KIND_TEXT, type CourseKind } from "@/content/courses";
import { Btn } from "@/components/ui/Btn";

/* 修了証の画面。
   出せるかどうかはサーバが決める（/api/cert）。
   絵はこの端末で描く。押した瞬間にPNGとして持ち帰れる。 */

type Info = {
  ok: true;
  issued: boolean;
  certNo: string;
  name: string;
  birth: string;
  date: string;
  exam: { score: number; total: number };
  subjects: { id: number; name: string; min: number }[];
  course: { id: string; name: string; basis: string; kind: CourseKind };
  company: string;
  responsible: string;
};

const jpDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

export function CertClient({ courseId }: { courseId: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/cert?courseId=${encodeURIComponent(courseId)}`);
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setReason(j.reason ?? "修了証はまだ出せません。");
        return;
      }
      setInfo(j as Info);
      setName(j.name === "（氏名未登録）" ? "" : (j.name ?? ""));
      setBirth(j.birth ?? "");
      setReason(null);
    } catch {
      setReason("うまく読み込めませんでした。電波の届く所でもう一度。");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* 絵を描き直す */
  useEffect(() => {
    if (!info || !cv.current) return;
    const data: CertData = {
      courseName: info.course?.name ?? "",
      /* 表題・結び・根拠は講座から。決め打ちにすると、
         職長教育で「59条3項に基づく特別教育」という嘘の紙が出る */
      certTitle: KIND_TEXT[info.course?.kind ?? "special"].certTitle,
      certLine: KIND_TEXT[info.course?.kind ?? "special"].certLine,
      courseBasis: info.course?.basis ?? "",
      name,
      birth: birth ? jpDate(birth) : "",
      date: jpDate(info.date),
      certNo: info.certNo,
      examScore: info.exam.score,
      examTotal: info.exam.total,
      company: info.company,
      responsible: info.responsible,
      subjects: info.subjects,
    };
    drawCert(cv.current, data);
    try {
      setUrl(cv.current.toDataURL("image/png"));
    } catch {
      setUrl(null);
    }
  }, [info, name, birth]);

  const issue = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/cert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, name, birth }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setReason(j.reason ?? "発行できませんでした。");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!url || !info) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `特別教育修了証_${name || "受講者"}_${info.certNo}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!info) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <Link href={`/edu/${courseId}`} className="backlink text-[13px] text-dim no-underline">
          ← 科目一覧
        </Link>
        <h1 className="mt-2 text-[19px] font-black">修了証</h1>
        {reason ? (
          <div
            className="mt-4 rounded-xl border border-line bg-panel p-4 text-[13px] leading-relaxed text-dim"
            data-testid="cert-reason"
          >
            {reason}
          </div>
        ) : (
          <div className="mt-4 text-[13px] text-dim">読み込んでいます…</div>
        )}
      </main>
    );
  }

  return (
    <main className="px-5 py-8" data-testid="cert">
      <div className="tape -mx-5 mb-6" />
      <Link href={`/edu/${courseId}`} className="backlink text-[13px] text-dim no-underline">
        ← 科目一覧
      </Link>
      <h1 className="mt-2 text-[19px] font-black">修了証</h1>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-dim">
        {info.certNo ? (
          <>
            証明番号 <span className="font-mono text-txt">{info.certNo}</span>
            <br />
          </>
        ) : null}
        {info.issued
          ? "発行済みです。"
          : "内容を確かめてから発行してください。証明番号は発行したときに決まります。"}
      </p>


      {/* 氏名と生年月日はここで直せる。修了証に載る名前だから */}
      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-dim">氏名（修了証に載ります）</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="足場　太郎"
            data-testid="cert-name"
            disabled={info.issued}
            className="w-full rounded-lg border border-line bg-panel2 px-3.5 py-3 text-[15px] disabled:text-dim"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-dim">生年月日</span>
          <input
            type="date"
            value={birth}
            onChange={(e) => setBirth(e.target.value)}
            data-testid="cert-birth"
            disabled={info.issued}
            className="w-full rounded-lg border border-line bg-panel2 px-3.5 py-3 text-[15px] disabled:text-dim"
          />
        </label>
      </div>

      {/* 出来上がり */}
      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
        <canvas ref={cv} className="block w-full" data-testid="cert-canvas" />
      </div>

      {reason && (
        <div className="mt-3 rounded-lg border border-red bg-ng-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-ng-tx">
          {reason}
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {!info.issued && (
          <Btn tone="y" dis={busy || !name.trim()} onClick={issue} testid="cert-issue">
            {busy ? "…" : "この内容で発行する"}
          </Btn>
        )}
        <Btn tone={info.issued ? "y" : undefined} dis={!url} onClick={save} testid="cert-save">
          画像として保存する
        </Btn>
      </div>

      <p className="mt-5 text-[11.5px] leading-relaxed text-dim2">
        事業者名と教育実施責任者は空欄で出ます。刷ってから書き入れ、事業者の印を押してください。
        <br />
        （決まっている場合は、設定で入れておくこともできます）
      </p>
    </main>
  );
}
