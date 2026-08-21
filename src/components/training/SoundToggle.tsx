"use client";

import { useEffect, useState } from "react";
import { SFX } from "@/lib/sfx";

/* 音の入切。プロトタイプの「🔊 音 ON」と同じ。
   端末は画面を最初に触るまで音を鳴らさないので、最初の一触りで開けておく。 */
export function SoundToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(SFX.isOn());
    const h = () => {
      if (SFX.isOn()) SFX.warm();
      window.removeEventListener("pointerdown", h);
    };
    window.addEventListener("pointerdown", h);
    return () => window.removeEventListener("pointerdown", h);
  }, []);

  return (
    <button
      data-testid="sound-toggle"
      onClick={() => {
        const n = !on;
        setOn(n);
        SFX.setOn(n);
        if (n) SFX.unlock();
      }}
      className={`rounded border border-line px-2 py-1 text-[11px] ${on ? "text-yel" : "text-dim"}`}
    >
      音 {on ? "ON" : "OFF"}
    </button>
  );
}
