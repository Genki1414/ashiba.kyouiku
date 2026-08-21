/* 第3章の状態。火打（出隅4箇所）→ シート（垂らす → ピッチ → 結ぶ）の順に進む。 */

import type { CornerId, Pitch, PostKey } from "./layout";

/** いまどの作業をしているか */
export type Phase =
  /** 火打を4箇所に掛ける */
  | "hiuchi"
  /** シートを全スパン垂らす */
  | "hang"
  /** 緊結ピッチを決める */
  | "pitch"
  /** 支柱に結ぶ */
  | "tie"
  | "done";

export type Ch3State = {
  phase: Phase;
  /** 火打を掛け終えた出隅 */
  hiuchi: CornerId[];
  /** シートを垂らし終えたスパン */
  hung: number[];
  /** 足で挟んで押さえることを覚えたか */
  footOK: boolean;
  pitch: Pitch | null;
  /** いま結んでいる段（0=2段目） */
  band: number;
  /** その段で結び終えた支柱 */
  tied: PostKey[];
  /** いま結んでいる支柱 */
  tying: PostKey | null;
  /** その支柱で結んだコマ */
  dots: number[];
};

export const initialState = (): Ch3State => ({
  phase: "hiuchi",
  hiuchi: [],
  hung: [],
  footOK: false,
  pitch: null,
  band: 0,
  tied: [],
  tying: null,
  dots: [],
});

export const isComplete = (s: Ch3State) => s.phase === "done";
