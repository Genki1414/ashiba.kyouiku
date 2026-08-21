"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readRecord } from "@/lib/trainingRecord";
import { noteItems } from "@/training/record";

/* 章の一覧から間違いノートへ。言われたことが無いあいだは出さない */
export function NoteLink() {
  const [n, setN] = useState(0);
  useEffect(() => setN(noteItems(readRecord()).length), []);
  if (!n) return null;
  return (
    <Link
      href="/training/note"
      className="block rounded-lg border border-yel p-3 text-center text-[13px] font-bold text-yel no-underline"
      data-testid="note-link"
    >
      間違いノートを見る（{n}件）
    </Link>
  );
}
