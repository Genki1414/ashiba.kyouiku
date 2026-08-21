"use client";

import { useCallback, useEffect, useState } from "react";
import { clearSaved, pickSaved } from "@/lib/resumeStore";
import type { Saved } from "@/training/resume";
import type { ChapterId } from "@/training/chapters";

/* 章を開いたときに、続きがあるかを調べる。
   あれば「続きから／最初から」を聞き、無ければそのまま始める。 */

export type Boot<S> = {
  /** 続きから始めるときの中身。null なら最初から */
  saved: Saved<S> | null;
  /** 作り直しの目印。もう一度やるときに増やす */
  n: number;
};

export function useBoot<S>(ch: ChapterId, want: { tutorial: boolean; sk: boolean }) {
  /* undefined = まだ調べていない */
  const [ask, setAsk] = useState<Saved<S> | null | undefined>(undefined);
  const [boot, setBoot] = useState<Boot<S> | null>(null);

  useEffect(() => {
    const v = pickSaved<S>(ch, want);
    setAsk(v);
    if (!v) setBoot({ saved: null, n: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = useCallback(
    (saved: Saved<S> | null) => {
      if (!saved) clearSaved(ch);
      setAsk(null);
      setBoot((b) => ({ saved, n: (b?.n ?? 0) + 1 }));
    },
    [ch],
  );

  return { ask, boot, begin };
}
