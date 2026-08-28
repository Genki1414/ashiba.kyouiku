"use client";

import { useEffect, useRef } from "react";
import { clearSaved, writeSaved } from "@/lib/resumeStore";
import type { ChapterId } from "@/training/chapters";
import type { Score } from "@/training/score";

/* 途中の状態を、端末に控え続ける。

   ── なぜ「手を動かしたとき」だけでは足りないか ──
   前は、盤面・道具・親方の一言・場面が変わったときにだけ控えていた。
   ところが**かかった時間は1秒ごとに動く**ので、
   最後に手を動かしてからの時間が、まるごと落ちていた。

     ・3分置いてから、どう組むか考えて手を動かす
     ・そこで用事が入って閉じる
     → 画面には 05:00 と出ていたのに、控えは 02:00 のまま

   時間だけの話でもない。技能点・コンボ・指摘も、
   手を動かさずに変わることがある。
   なので、**そのつど**に加えて**数秒おきにも**控える。

   1秒ごとに書かないのは、localStorage の書き込みが同期で、
   組んでいる最中に指の反応が鈍るため。5秒で足りる。 */

const EVERY_MS = 5000;

export function useKeepSaved<S>(
  ch: ChapterId,
  done: boolean,
  make: () => { s: S; score: Score; tutorial: boolean; sk?: boolean; tool?: string; msg?: string; scene?: unknown },
  deps: unknown[],
) {
  /* いちばん新しい中身を、いつでも取り出せるようにしておく */
  const makeRef = useRef(make);
  makeRef.current = make;
  const doneRef = useRef(done);
  doneRef.current = done;

  /* ① 手を動かしたとき */
  useEffect(() => {
    if (done) { clearSaved(ch); return; }
    writeSaved<S>(ch, makeRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch, done, ...deps]);

  /* ② 手が止まっているあいだも、数秒おきに */
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      if (doneRef.current) return;
      writeSaved<S>(ch, makeRef.current());
    }, EVERY_MS);
    return () => clearInterval(id);
  }, [ch, done]);

  /* ③ 閉じる・裏に回すとき。
        現場では画面を伏せたまま置かれるので、ここが効く */
  useEffect(() => {
    const save = () => {
      if (doneRef.current) return;
      writeSaved<S>(ch, makeRef.current());
    };
    const onHide = () => { if (document.visibilityState === "hidden") save(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [ch]);
}
