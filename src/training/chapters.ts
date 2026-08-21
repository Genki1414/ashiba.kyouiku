/* 章の一覧。章選択・成績・間違いノートで共通に使う。 */

export type ChapterId = "ch1" | "ch2" | "ch3" | "ch4" | "ch5" | "ch6";

export type Chapter = {
  id: ChapterId;
  /** 章の番号 */
  n: number;
  /** 章の名前 */
  t: string;
  /** ひとこと */
  d: string;
  /** 遊べる状態か */
  ready: boolean;
  /** 結果画面で出す、Cランクの呼び方 */
  lowText?: string;
};

export const CHAPTERS: Chapter[] = [
  {
    id: "ch1", n: 1, t: "段取りと根がらみ",
    d: "割り付け・内柱・ジャッキ合わせ・建方の基準",
    ready: true, lowText: "まだ現場に出せん",
  },
  {
    id: "ch2", n: 2, t: "高所作業",
    d: "筋交・安全帯の掛け替え・壁当てジャッキ",
    ready: true, lowText: "まだ上に上げられん",
  },
  {
    id: "ch3", n: 3, t: "火打とシート",
    d: "出隅の火打・シートの縦張りと緊結",
    ready: true, lowText: "まだ任せられん",
  },
  { id: "ch4", n: 4, t: "本足場", d: "準備中", ready: false },
  { id: "ch5", n: 5, t: "壁つなぎ・層間ネット", d: "準備中", ready: false },
  { id: "ch6", n: 6, t: "技能士試験の実技", d: "準備中", ready: false },
];

export const READY_CHAPTERS = CHAPTERS.filter((c) => c.ready);

export const chapterOf = (id: string): Chapter | undefined =>
  CHAPTERS.find((c) => c.id === id);

/** 「第1章 段取りと根がらみ」 */
export const chapterLabel = (id: string): string => {
  const c = chapterOf(id);
  return c ? `第${c.n}章 ${c.t}` : id;
};
