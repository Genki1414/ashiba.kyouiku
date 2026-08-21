/* 第3章の判定。
   HANDOFF.md 3章「現場のルール　第3章 火打とシート」をそのまま判定条件にしたもの。
   重さの区別は第1・2章と同じ。 */

import {
  CORNERS,
  KOMA_PER_LEVEL,
  NEXT_TO_CORNER,
  POSTS,
  PITCH_OK,
  SHEET_SPANS,
  postName,
  tieOrder,
  type CornerId,
  type Pitch,
  type PostKey,
} from "./layout";
import type { Ch3State } from "./state";

/** 火打の取付点。f=面（a／b）、k=支柱か手摺、n=出隅から何本目 */
export type HiuchiPoint = { f: "a" | "b"; k: "post" | "rail"; n: number };

export type Scene =
  /** 火打を掛ける（2箇所を選ぶ） */
  | { type: "hiuchi"; corner: CornerId }
  /** シートを広げるとき、足で挟むか */
  | { type: "spread"; span: number }
  /** 結ぶ位置（コマ）を選ぶ */
  | { type: "tie"; post: PostKey };

export type Action =
  /** 出隅をタップして火打の場面を開く */
  | { type: "tapCorner"; corner: CornerId }
  /** 火打の取付点を2箇所選んだ */
  | { type: "hiuchiPick"; corner: CornerId; a: HiuchiPoint; b: HiuchiPoint }
  /** シートを垂らすスパンをタップ */
  | { type: "tapSpan"; span: number }
  /** 広げ方を選ぶ */
  | { type: "spreadPick"; span: number; foot: boolean }
  /** 緊結ピッチを選ぶ */
  | { type: "pickPitch"; pitch: Pitch }
  /** 結ぶ支柱をタップ */
  | { type: "tapPost"; post: PostKey }
  /** 結ぶコマをタップ */
  | { type: "tapKoma"; koma: number }
  /** 次の支柱へ */
  | { type: "nextPost" };

export type Verdict =
  | { kind: "good"; message: string; state: Ch3State; scene?: Scene }
  | { kind: "note"; message: string }
  | { kind: "foul"; message: string; why: string; penalty: number; tag: string };

const good = (state: Ch3State, message: string, scene?: Scene): Verdict => ({
  kind: "good",
  message,
  state,
  ...(scene ? { scene } : {}),
});
const note = (message: string): Verdict => ({ kind: "note", message });
const foul = (message: string, why: string, tag: string, penalty = 8): Verdict => ({
  kind: "foul",
  message,
  why,
  penalty,
  tag,
});

/* ══════════════════════════════════════════
   火打（HANDOFF.md 3章 第3章）
   足場と二等辺三角形になるように、支柱に付ける。
   ══════════════════════════════════════════ */

/** 掛け方の可否だけを見る。画面（HiuchiZoom）と判定で同じものを使う */
export type HiuchiNg = "rail" | "face" | "iso" | null;

export function checkHiuchi(p: HiuchiPoint, q: HiuchiPoint): HiuchiNg {
  if (p.k === "rail" || q.k === "rail") return "rail";
  if (p.f === q.f) return "face";
  if (p.n !== q.n) return "iso";
  return null;
}

function judgeHiuchi(s: Ch3State, a: Extract<Action, { type: "hiuchiPick" }>): Verdict {
  const { a: p, b: q } = a;
  const bad = checkHiuchi(p, q);

  /* 手摺には付けない。やむを得ず手摺の場合は抜け止め措置 */
  if (bad === "rail") {
    return foul(
      "火打は支柱に付ける。どうしても手摺に付けるときは、その手摺に抜け止め措置をすること。",
      "手摺は差し込みに遊びがある。引っ張られて抜ければ、火打が効かん。",
      "火打の取付先",
    );
  }
  /* 出隅をまたいで両方の面に振り分ける */
  if (bad === "face") {
    return foul(
      "同じ面の支柱どうしでは三角形にならない。出隅をまたいで、両方の面に振り分ける。",
      "火打は平面内でひし形に変形するのを防ぐ材だ。1つの面の中だけでは効かん。",
      "火打の掛け方",
    );
  }
  /* 出隅から同じ距離＝二等辺三角形 */
  if (bad === "iso") {
    return foul(
      "二等辺になっていない。出隅から同じ距離の支柱に掛ける。",
      "左右で長さが違うと、力が片側へ偏る。二等辺にして初めて突っ張りが効く。",
      "火打の掛け方",
    );
  }

  const hiuchi = [...s.hiuchi, a.corner];
  const cn = CORNERS.find((c) => c.id === a.corner)!.nm;
  if (hiuchi.length === CORNERS.length) {
    return good(
      { ...s, hiuchi, phase: "hang" },
      "4隅とも入った。これで平面がひし形に崩れん。次はシートだ。",
    );
  }
  return good({ ...s, hiuchi }, `${cn}に火打が入った。残り${CORNERS.length - hiuchi.length}箇所。`);
}

/* ══════════════════════════════════════════
   シート（HANDOFF.md 3章 第3章）
   縦張り、1スパンに1枚、重ねしろ無し。
   まず全スパンを垂らしてから、支柱に結ぶ。
   ══════════════════════════════════════════ */

function judgeSheet(s: Ch3State, a: Action): Verdict {
  /* ① 垂らす */
  if (a.type === "tapSpan") {
    if (s.phase !== "hang") return note("いまシートを垂らす場面じゃない。");
    if (s.hung.includes(a.span)) return note("そのスパンはもう垂らしてある。");
    /* 広げ方を覚えるまでは、毎回どうするか聞く */
    if (!s.footOK) return good(s, "シートを広げる。", { type: "spread", span: a.span });
    return hang(s, a.span);
  }

  if (a.type === "spreadPick") {
    if (!a.foot) {
      return foul(
        "オイ！　シートを落としたぞ。下に人が居たらどうする。広げるときは足で挟んで押さえながらだ。",
        "シートを落とすのが、この作業でいちばん多い失敗だ。",
        "シートを落とす",
        10,
      );
    }
    return hang({ ...s, footOK: true }, a.span);
  }

  /* ② 緊結ピッチ */
  if (a.type === "pickPitch") {
    if (s.phase !== "pitch") return note("いまピッチを決める場面じゃない。");
    if (!PITCH_OK.includes(a.pitch)) {
      return foul(
        "粗すぎる。緊結ピッチは450か900だ。戸建なら900でよい。",
        "間隔が空くと、風であおられたときにシートが支柱から離れる。",
        "緊結ピッチ",
      );
    }
    return good(
      { ...s, pitch: a.pitch, phase: "tie" },
      "2段目から結んでいく。どの支柱からでもいいが、出隅は最後だ。",
    );
  }

  /* ③ 結ぶ支柱を選ぶ。出隅は最後 */
  if (a.type === "tapPost") {
    if (s.phase !== "tie") return note("いま結ぶ場面じゃない。");
    if (s.tied.includes(a.post)) return note("その支柱はもう結んである。");
    if (s.tying) return note("いまの支柱を結び終えてからだ。");
    if (a.post === "corner" && !NEXT_TO_CORNER.every((n) => s.tied.includes(n))) {
      const rest = NEXT_TO_CORNER.filter((n) => !s.tied.includes(n)).map(postName).join("と");
      return foul(
        `まだ${rest}が結べていない。出隅を先に結ぶとシートが出隅側へ寄って、隣の支柱の側に隙間が空く。`,
        "隙間が空けば、そこから物が落ちる。出隅は最後だ。",
        "出隅を先に結んだ",
      );
    }
    return good({ ...s, tying: a.post, dots: [] }, `${postName(a.post)}の支柱を結ぶ。`, {
      type: "tie",
      post: a.post,
    });
  }

  /* ④ 結ぶ位置。上から下へ */
  if (a.type === "tapKoma") {
    if (!s.tying || !s.pitch) return note("いま結ぶ場面じゃない。");
    if (s.dots.includes(a.koma)) return note("そこはもう結んである。");
    if (a.koma === 0) {
      return foul(
        "そこは自分が立っている踏板の高さだ。踏板高さは下の段に立って結んだ方が効率が良い。ここからは上を結べ。",
        "足元を結ぼうとすると屈むことになる。下の段から手を伸ばせば楽に届く。",
        "結ぶ位置",
      );
    }
    const order = tieOrder(s.pitch);
    const need = order[s.dots.length];
    if (a.koma !== need) {
      return foul(
        order.includes(a.koma) ? "上から順に結んでいけ。" : `${s.pitch}mmで結ぶと決めただろう。その位置は間だ。`,
        "上から結べば、シートの重みで下が自然に張る。下から結ぶと弛みが上に溜まる。",
        "結ぶ順序",
      );
    }
    const dots = [...s.dots, a.koma];
    return good({ ...s, dots }, `${a.koma}コマ目を結んだ。`);
  }

  /* 次の支柱へ */
  if (a.type === "nextPost") {
    if (!s.tying || !s.pitch) return note("いま結ぶ場面じゃない。");
    const order = tieOrder(s.pitch);
    if (s.dots.length < order.length) {
      return foul(
        "まだ結び終わっていない。この支柱を終わらせてから次だ。",
        "途中で next へ移ると、結んでいないところが残る。",
        "結び残し",
      );
    }
    const tied = [...s.tied, s.tying];
    const next: Ch3State = { ...s, tied, tying: null, dots: [] };
    if (tied.length === POSTS.length) {
      /* 1段目・地上は同じ繰り返しなので省略 */
      return good(
        { ...next, phase: "done" },
        "2段目が全部結べた。あとは1段目、地上と同じことを繰り返すだけだ。",
      );
    }
    return good(next, "結べた。次の支柱へ。");
  }

  return note("いまその手はない。");
}

function hang(s: Ch3State, span: number): Verdict {
  const hung = [...s.hung, span];
  if (hung.length === SHEET_SPANS.length) {
    return good({ ...s, hung, phase: "pitch" }, "全部垂れた。ここから支柱に結んでいく。");
  }
  return good({ ...s, hung }, "次のスパンも垂らす。全部垂らしてから結ぶ。");
}

/* ══════════════════════════════════════════
   入口
   ══════════════════════════════════════════ */

export function judge(s: Ch3State, a: Action): Verdict {
  if (a.type === "tapCorner") {
    if (s.phase !== "hiuchi") return note("火打はもう入っている。");
    if (s.hiuchi.includes(a.corner)) return note("そこはもう入っている。");
    const c = CORNERS.find((x) => x.id === a.corner)!;
    return good(s, `${c.nm}に火打を掛ける。`, { type: "hiuchi", corner: a.corner });
  }
  if (a.type === "hiuchiPick") return judgeHiuchi(s, a);
  return judgeSheet(s, a);
}

/** 親方に聞いたときの答え */
export function hint(s: Ch3State): string {
  switch (s.phase) {
    case "hiuchi":
      return `出隅4箇所に火打を掛ける。足場と二等辺三角形になるよう、支柱に付ける。残り${
        CORNERS.length - s.hiuchi.length
      }箇所。`;
    case "hang":
      return "シートは縦張り、1スパンに1枚、重ねしろ無し。まず全スパンを最上段から垂らす。広げるときは足で挟め。";
    case "pitch":
      return "緊結ピッチを決める。450か900だ。戸建なら900でよい。";
    case "tie":
      if (s.tying) return `${postName(s.tying)}を上から順に結ぶ。`;
      return "2段目から結ぶ。どの支柱からでもいいが、出隅は最後だ。";
    default:
      return "終わりだ。";
  }
}

/** 進み具合 */
export function progress(s: Ch3State) {
  const total = CORNERS.length + SHEET_SPANS.length + 1 + POSTS.length;
  const done =
    s.hiuchi.length + s.hung.length + (s.pitch ? 1 : 0) + s.tied.length;
  return { done, total };
}

export { KOMA_PER_LEVEL };
