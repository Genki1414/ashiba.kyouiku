"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn } from "@/components/ui/Btn";
import { KINDS, OTHER, byKind, type QualKind } from "@/content/quals";
import type { Held } from "@/lib/quals";

/* よそで取った資格。本人が足す所。

   足場の職人が持っているものは、この仕組みの外で取ったものが多い。
   前の会社で受けた特別教育、教習機関で取った技能講習、免許。

   なぜ足せるようにするか。
   特別教育は「その業務に就かせる前に」行う決まりで、
   すでに受けている人に受け直させる決まりではない。
   ただ、事業者は「受けている」ことを確かめないと就かせられない。
   ここに入れておけば、入った会社の担当者がそれを見られる。

   ここで書けるのは自己申告まで。「確かめた」印は会社が押す。
   自分で確かめたことにできると、印の意味が無くなる。 */

const day = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

export function HeldQuals() {
  const [held, setHeld] = useState<Held[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  /* 入れるもの */
  const [kind, setKind] = useState<QualKind>("特別教育");
  const [qualId, setQualId] = useState("");
  const [label, setLabel] = useState("");
  const [issuer, setIssuer] = useState("");
  const [gotOn, setGotOn] = useState("");
  const [certNo, setCertNo] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/quals", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) setHeld(j.held ?? []);
      else setHeld([]);
    } catch {
      setHeld([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const clear = () => {
    setQualId("");
    setLabel("");
    setIssuer("");
    setGotOn("");
    setCertNo("");
  };

  const add = async () => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/quals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "add", qualId, label, issuer, gotOn, certNo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "足せませんでした。");
        return;
      }
      setHeld(j.held ?? []);
      clear();
      setOpen(false);
    } catch {
      setNote("つながりません。電波の届く所でもう一度。");
    } finally {
      setBusy(false);
    }
  };

  const drop = async (id: string) => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/quals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "drop", id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) setNote(j.reason ?? "外せませんでした。");
      else setHeld(j.held ?? []);
    } finally {
      setBusy(false);
    }
  };

  if (!held) return null;

  const list = byKind(kind);

  return (
    <div className="mt-3" data-testid="me-quals">
      <div className="mb-2 text-[11px] tracking-[2px] text-dim">よそで取った資格</div>

      <div className="rounded-xl border border-line bg-panel p-4">
        <p className="text-[11.5px] leading-relaxed text-dim2">
          前の会社で受けた特別教育や、教習機関で取った技能講習を入れておけます。
          入れておくと、いま所属している会社の教育担当者が見られます。
          <br />
          <strong className="text-dim">同じ特別教育を受け直す必要はありません。</strong>
          ただし会社は修了証の現物を見て確かめます。
        </p>

        {!held.length && (
          <div className="mt-3 text-[12px] text-dim2">まだ入っていません。</div>
        )}

        <div className="mt-3 grid gap-2">
          {held.map((h) => (
            <div key={h.id} className="rounded-lg border border-line bg-bg p-3" data-testid="me-qual">
              <div className="flex items-baseline gap-2">
                <div className="min-w-0 flex-1 text-[13px] font-black leading-snug">{h.name}</div>
                {h.confirmedAt ? (
                  <span
                    className="shrink-0 rounded border border-grn px-1.5 py-0.5 text-[10px] text-grn"
                    data-testid="me-qual-ok"
                  >
                    確認済み
                  </span>
                ) : (
                  <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-dim2">
                    自己申告
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-dim2">
                {h.kind}
                {h.issuer ? `　${h.issuer}` : ""}
                {h.gotOn ? `　${day(h.gotOn)} 取得` : ""}
                {h.certNo ? <><br />修了証番号 {h.certNo}</> : null}
              </div>
              <button
                onClick={() => void drop(h.id)}
                disabled={busy}
                className="mt-2 rounded border border-line px-2 py-1 text-[11px] text-dim2"
                data-testid="me-qual-drop"
              >
                外す
              </button>
            </div>
          ))}
        </div>

        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="mt-3 w-full rounded-lg border border-line p-2.5 text-[12.5px] text-dim"
            data-testid="me-qual-open"
          >
            資格を足す
          </button>
        ) : (
          <div className="mt-3 rounded-lg border border-yel bg-[#1A1F14] p-3" data-testid="me-qual-form">
            {/* 種類でしぼる。全部いっぺんに並べると、探すのに時間がかかる */}
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => { setKind(k); setQualId(""); }}
                  className={`rounded border px-2 py-1 text-[11.5px] ${
                    kind === k ? "border-yel text-yel" : "border-line text-dim2"
                  }`}
                  data-testid="me-qual-kind"
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="mt-2 grid gap-1">
              {list.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setQualId(q.id)}
                  className={`rounded border px-2.5 py-2 text-left text-[12.5px] leading-snug ${
                    qualId === q.id ? "border-yel bg-bg text-yel" : "border-line bg-bg text-txt"
                  }`}
                  data-testid="me-qual-pick"
                >
                  {q.name}
                </button>
              ))}
              <button
                onClick={() => setQualId(OTHER)}
                className={`rounded border px-2.5 py-2 text-left text-[12.5px] ${
                  qualId === OTHER ? "border-yel bg-bg text-yel" : "border-line bg-bg text-dim"
                }`}
                data-testid="me-qual-other"
              >
                この一覧にない（自分で書く）
              </button>
            </div>

            {qualId === OTHER && (
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="資格の名前"
                className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px]"
                data-testid="me-qual-label"
              />
            )}

            <label className="mt-2.5 block text-[11px] text-dim2">どこで受けたか</label>
            <input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="前の会社名・教習機関の名前"
              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px]"
              data-testid="me-qual-issuer"
            />

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-dim2">取った日</label>
                <input
                  type="date"
                  value={gotOn}
                  onChange={(e) => setGotOn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-bg px-2.5 py-2 text-[13px]"
                  data-testid="me-qual-date"
                />
              </div>
              <div>
                <label className="block text-[11px] text-dim2">修了証番号</label>
                <input
                  value={certNo}
                  onChange={(e) => setCertNo(e.target.value)}
                  placeholder="分かれば"
                  className="mt-1 w-full rounded-lg border border-line bg-bg px-2.5 py-2 text-[13px]"
                  data-testid="me-qual-no"
                />
              </div>
            </div>

            <div className="mt-3">
              <Btn tone="y" dis={busy || !qualId} onClick={add} testid="me-qual-add">
                {busy ? "足しています…" : "この資格を足す"}
              </Btn>
            </div>
            <button
              onClick={() => { setOpen(false); clear(); setNote(""); }}
              className="mt-2 w-full rounded-lg border border-line p-2 text-[11.5px] text-dim2"
            >
              やめる
            </button>
          </div>
        )}

        {note && <div className="mt-2 text-[12px] text-red" data-testid="me-qual-note">{note}</div>}
      </div>
    </div>
  );
}
