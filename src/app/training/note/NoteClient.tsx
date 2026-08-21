"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readRecord, clearRecord } from "@/lib/trainingRecord";
import {
  countOf,
  fixedItems,
  lastOf,
  noteItems,
  type NoteItem,
  type Record_,
} from "@/training/record";
import { CHAPTERS, READY_CHAPTERS } from "@/training/chapters";
import { Btn } from "@/components/ui/Btn";

/* 親方に言われたことを、章をまたいでまとめて読み返す画面。
   結果画面は閉じたら消えるので、ここに溜める。
   多く言われたものが上に来る。ここが弱いところ。 */

const day = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export function NoteClient() {
  const [rec, setRec] = useState<Record_ | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => setRec(readRecord()), []);
  if (!rec) return null;

  const items = noteItems(rec);
  const fixed = fixedItems(rec);
  const fixedKey = new Set(fixed.map((f) => `${f.ch}/${f.tag}/${f.message}`));
  /* 直したものは下にまわす */
  const open = items.filter((i) => !fixedKey.has(`${i.ch}/${i.tag}/${i.message}`));
  const total = items.reduce((s, i) => s + i.n, 0);

  return (
    <main className="pb-10">
      <div className="tape" />
      <div className="px-5 pb-4 pt-6">
        <Link href="/training" className="backlink text-[13px] text-dim no-underline">
          ← 章の一覧
        </Link>
        <h1 className="mt-2 text-[18px] font-black">間違いノート</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-dim">
          親方に言われたことを、章をまたいで溜めてあります。
          <br />
          多く言われたものが上です。ここが自分の弱いところです。
        </p>
      </div>

      {/* 通した章のまとめ */}
      <div className="mx-5 rounded-xl border border-line bg-panel p-4">
        <div className="mb-2 text-[11px] tracking-[2px] text-dim">これまで</div>
        {READY_CHAPTERS.map((c) => {
          const n = countOf(rec, c.id);
          const last = lastOf(rec, c.id);
          return (
            <div key={c.id} className="flex items-center gap-2 py-1 text-[12.5px]">
              <span className={n ? "text-grn" : "text-dim2"}>{n ? "✓" : "□"}</span>
              <span className="flex-1">
                第{c.n}章 {c.t}
              </span>
              <span className="font-mono text-[11.5px] text-dim">
                {n ? `${n}回　技能 ${last!.skill}` : "まだ"}
              </span>
            </div>
          );
        })}
        <div className="mt-2 border-t border-line pt-2 text-[12px] text-dim">
          言われた回数　
          <span className={`font-mono font-extrabold ${total ? "text-red" : "text-grn"}`}>
            {total}回
          </span>
          {fixed.length > 0 && (
            <span className="ml-3">
              直せた　
              <span className="font-mono font-extrabold text-grn">{fixed.length}件</span>
            </span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mx-5 mt-4 rounded-xl border border-grn bg-panel p-4 text-[13px] leading-relaxed text-grn">
          まだ何も言われていません。章を通すと、ここに溜まります。
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <Section title="まだ言われる" items={open} tone="open" />
          )}
          {fixed.length > 0 && (
            <Section title="直せた（最後の1回では言われなかった）" items={fixed} tone="fixed" />
          )}
        </>
      )}

      {/* 記録を消す。渡す端末を変えるときなど */}
      {items.length > 0 && (
        <div className="mx-5 mt-6">
          {asking ? (
            <div className="rounded-xl border border-red bg-panel p-4">
              <div className="text-[13px] leading-relaxed">
                これまでの成績と、言われたことを全部消します。戻せません。
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Btn
                  onClick={() => {
                    clearRecord();
                    setRec({});
                    setAsking(false);
                  }}
                  className="border-red text-ng-tx"
                  testid="note-clear-yes"
                >
                  消す
                </Btn>
                <Btn onClick={() => setAsking(false)}>やめる</Btn>
              </div>
            </div>
          ) : (
            <Btn onClick={() => setAsking(true)} className="text-[12.5px] font-normal text-dim2">
              記録を消す
            </Btn>
          )}
        </div>
      )}
    </main>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: NoteItem[];
  tone: "open" | "fixed";
}) {
  return (
    <div className="mt-5 px-5" data-section={tone}>
      <div
        className={`mb-2 text-[11px] tracking-[2px] ${tone === "open" ? "text-yel" : "text-grn"}`}
      >
        {title}
      </div>
      {items.map((e, i) => (
        <div
          key={i}
          className={`mb-2 rounded-lg border bg-panel px-3.5 py-3 ${
            tone === "open" ? "border-line" : "border-line opacity-70"
          }`}
          data-note-item
        >
          <div className="mb-1 flex items-baseline gap-2">
            <span className="font-mono text-[10px] text-dim2">
              第{CHAPTERS.find((c) => c.id === e.ch)?.n ?? "?"}章
            </span>
            <span
              className={`text-[12px] font-extrabold ${tone === "open" ? "text-red" : "text-grn"}`}
            >
              {e.tag}
            </span>
            {e.n > 1 && <span className="font-mono text-[11px] text-dim">×{e.n}</span>}
            <span className="ml-auto font-mono text-[10px] text-dim2">{day(e.last)}</span>
          </div>
          <div className="text-[13px] font-bold leading-snug">{e.message}</div>
          {e.why && (
            <div className="mt-1 text-[12.5px] leading-relaxed text-dim">{e.why}</div>
          )}
        </div>
      ))}
    </div>
  );
}
