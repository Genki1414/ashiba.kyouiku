"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gainOf, isComboBeat, multOf, type Err, type Score } from "@/training/score";
import { SFX } from "@/lib/sfx";

/** 点の吹き出し（+300 / −10） */
export type Pop = { id: number; t: string; k: "g" | "b" };

/** 章のあいだ、点・コンボ・時間・指摘をまとめて持つ。
    プロトタイプの Game が持っていた score/combo/best/pop/sec/hints/asks/skill/errs と同じ。

    init を渡すと、その続きから始める（途中で閉じたときの再開）。
    コンボだけは切れた扱いにする。手が途切れているので。 */
export function useScore(init?: Score) {
  const [skill, setSkill] = useState(init?.skill ?? 100);
  const [score, setScore] = useState(init?.score ?? 0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(init?.best ?? 0);
  const [pop, setPop] = useState<Pop | null>(null);
  const [errs, setErrs] = useState<Err[]>(init?.errs ?? []);
  const [hints, setHints] = useState(init?.hints ?? 0);
  const [asks, setAsks] = useState(init?.asks ?? 0);
  const [sec, setSec] = useState(init?.sec ?? 0);
  /* 続きのときは、そこまでにかかった時間から数え直す */
  const t0 = useRef(Date.now() - (init?.sec ?? 0) * 1000);
  const seq = useRef(0);

  useEffect(() => {
    const i = setInterval(() => setSec(Math.floor((Date.now() - t0.current) / 1000)), 1000);
    return () => clearInterval(i);
  }, []);

  const mult = multOf(combo);

  const showPop = useCallback((t: string, k: "g" | "b") => {
    seq.current += 1;
    setPop({ id: seq.current, t, k });
  }, []);

  /** 正しい手。コンボが伸び、倍率ぶんの点が入る。
      sound は鳴らす音。段取りで材料を置くときは "place"、叩くときは "hammer"。
      場面の中で既に音が鳴っているときは "none" */
  const good = useCallback(
    (sound: "hammer" | "place" | "none" = "hammer") => {
      if (sound !== "none") SFX[sound]();
      setCombo((c) => {
        const n = c + 1;
        setBest((b) => Math.max(b, n));
        const g = gainOf(c);
        setScore((v) => v + g);
        showPop(`+${g}`, "g");
        if (isComboBeat(n)) setTimeout(() => SFX.combo(n), 90);
        return n;
      });
    },
    [showPop],
  );

  /** 指摘。コンボが切れ、技能点が引かれる */
  const bad = useCallback(
    (penalty: number, err: Err) => {
      SFX.buzz();
      setCombo(0);
      if (penalty > 0) {
        setSkill((v) => Math.max(0, v - penalty));
        showPop(`−${penalty}`, "b");
      }
      setErrs((e) => [...e, err]);
    },
    [showPop],
  );

  /* 減点にはならないが手は止まった（置き直し・効率の問題）。
     プロトタイプの bad(t) と同じく、コンボだけ切れる */
  const miss = useCallback(() => { SFX.buzz(); setCombo(0); }, []);

  const countHint = useCallback(() => { SFX.tick(); setHints((v) => v + 1); }, []);
  const countAsk = useCallback(() => { SFX.tick(); setAsks((v) => v + 1); }, []);

  const result = useMemo<Score>(
    () => ({ skill, score, best, sec, hints, asks, errs }),
    [skill, score, best, sec, hints, asks, errs],
  );

  return { skill, score, combo, best, mult, pop, errs, hints, asks, sec, good, bad, miss, countHint, countAsk, result };
}
