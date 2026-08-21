/* 第2章の判定。
   HANDOFF.md 3章「現場のルール　第2章 高所作業」をそのまま判定条件にしたもの。
   重さの区別は第1章と同じ（PROMPT.md 4章）。
     kind:"foul" … 安全に関わる。技能点を減らし、なぜ危ないかを返す
     kind:"note" … 効率の問題・置き直し。親方が一言添えるだけ */

import {
  BRACE_FROM,
  POST_NAME,
  SPAN_IDS,
  isInner,
  spanName,
  type PostId,
  type SpanId,
} from "./layout";
import {
  allDecked,
  allRail2,
  current,
  has,
  type Ch2State,
  type Level,
} from "./state";

export type Tool =
  | "move"
  | "brace"
  | "rail"
  | "post"
  | "wjack"
  | "brk"
  | "rail6"
  | "deck"
  | "fall";

export const TOOL_NAME: Record<Tool, string> = {
  move: "移動",
  brace: "筋交",
  rail: "手摺",
  post: "支柱",
  wjack: "壁当てジャッキ",
  brk: "ブラケット",
  rail6: "踏板手摺",
  deck: "踏板",
  fall: "転落防止手摺",
};

/** 安全帯をどこに掛けるか（コマはファール） */
export type BeltMode = "post" | "rail";

export type Scene =
  /** 安全帯の掛け先を選ぶ */
  | { type: "belt"; mode: BeltMode }
  /** 筋交の入れ方（上のコマへ先端を入れてから、後端を下のコマへ振り下ろす） */
  | { type: "brace"; span: SpanId; first: boolean }
  /** 壁当てジャッキ。踏板手摺のすぐ下のコマへ */
  | { type: "wjack"; post: PostId };

export type Action =
  | { type: "tapPost"; tool: Tool; post: PostId }
  | { type: "tapSpan"; tool: Tool; span: SpanId }
  | { type: "climb" }
  | { type: "sceneDone"; scene: Scene }
  | { type: "sceneFoul"; tag: string; message: string; why: string };

export type Verdict =
  | { kind: "good"; message: string; state: Ch2State; scene?: Scene }
  | { kind: "note"; message: string }
  | { kind: "foul"; message: string; why: string; penalty: number; tag: string };

const good = (state: Ch2State, message: string, scene?: Scene): Verdict => ({
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

const put = (s: Ch2State, k: string): Ch2State => ({ ...s, placed: [...s.placed, k] });
const adv = (s: Ch2State): Ch2State => ({ ...s, qi: s.qi + 1 });

/* ══════════════════════════════════════════
   昇降
   ══════════════════════════════════════════ */

function judgeClimb(s: Ch2State): Verdict {
  const cur = current(s);
  if (!cur) return note("もう終わりだ。");

  if (cur.k === "climb1") {
    /* 上がったら、まず安全帯を支柱に取る */
    const next: Ch2State = { ...adv(s), lv: 1 as Level, at: "P0" };
    return good(next, "昇降階段で1段目に上がった。", { type: "belt", mode: "post" });
  }

  if (cur.k === "climb2") {
    if (!allDecked(s)) {
      return foul(
        "踏板が全部敷けていない。",
        "床が繋がっていないところへ上がれば、隙間から落ちる。",
        "手順の飛ばし",
      );
    }
    return good({ ...adv(s), lv: 2 as Level, at: "P0" }, "昇降階段で2段目に上がった。手摺を入れろ。");
  }

  if (cur.k === "roof") {
    if (!allRail2(s)) {
      return foul(
        "2段目の手摺が全部入っていない。囲いの無い床には上がらない。",
        "屋根から降りてくるときに掴むものが無い。落ちれば2段ぶんだ。",
        "手摺の無い床に上がる",
        10,
      );
    }
    return good({ ...adv(s), lv: 3 as Level }, "屋根に上がった。まず転落防止手摺を立てる。");
  }

  return note("いま上がる場面じゃない。");
}

/* ══════════════════════════════════════════
   柱をタップ
   ══════════════════════════════════════════ */

function judgePost(s: Ch2State, tool: Tool, p: PostId): Verdict {
  const cur = current(s);

  if (tool === "move") {
    if (s.lv === 0) return note("まず1段目に上がれ。");
    return good({ ...s, at: p }, `${POST_NAME[p]}の前に立った。`);
  }
  if (s.lv === 0) return note("足場の上でやる作業だ。まず上がれ。");
  if (!cur) return note("もう終わりだ。");

  if (tool === "post") {
    /* 内柱は「内柱を継ぐ」場面のときだけ */
    if (cur.k === "postI" && cur.t === p) {
      if (has(s, `PI:${p}`)) return note("その内柱はもう継いである。");
      return good(adv(put(s, `PI:${p}`)), `${POST_NAME[p]}の内柱を継いだ。`);
    }
    if (cur.k !== "post2") {
      return foul(
        "いま支柱を継ぐ場面じゃない。",
        "順番を飛ばすと、継いだ先に受け材が付かん。",
        "手順の飛ばし",
      );
    }
    if (cur.t !== p) {
      return foul(
        "その柱の番じゃない。奥から手前へ順に継げ。",
        "手前から継ぐと、奥へ材料を送る道が塞がる。",
        "建てる順序",
      );
    }
    if (has(s, `P2:${p}`)) return note("その柱はもう継いである。");
    return good(adv(put(s, `P2:${p}`)), `${POST_NAME[p]}の支柱を継いだ。`);
  }

  if (tool === "brk") {
    if (isInner(p)) {
      return foul(
        "そこは内柱の箇所だ。ブラケットではなく踏板高さの手摺でつなぐ。",
        "内柱が踏板を受ける。ブラケットを掛けても踏板は載らん。",
        "取付位置の誤り",
      );
    }
    if (has(s, `BRK:${p}`)) return note("もう掛けてある。");
    if (cur.k !== "brk") {
      return foul("いまブラケットを掛ける場面じゃない。", "支柱を継いでからだ。", "手順の飛ばし");
    }
    if (cur.t !== p) return foul("その柱じゃない。", "奥から手前へ順に。", "取付位置の誤り");
    return good(adv(put(s, `BRK:${p}`)), "ブラケットを掛けた。");
  }

  if (tool === "rail6") {
    if (!isInner(p)) {
      return foul(
        "そこは内柱の箇所じゃない。ブラケットで受ける。",
        "内柱の無いところに踏板手摺を渡しても、受けにならん。",
        "取付位置の誤り",
      );
    }
    if (has(s, `R6:${p}`)) return note("もう入っている。");
    if (cur.k !== "rail6") return foul("いまその場面じゃない。", "支柱を継いでからだ。", "手順の飛ばし");
    if (cur.t !== p) return foul("その柱じゃない。", "奥から手前へ順に。", "取付位置の誤り");
    if (!has(s, `PI:${p}`)) {
      return foul(
        "内柱がまだ継がれていない。",
        "継いでいない内柱につないでも、上で止まっていない。",
        "手順の飛ばし",
      );
    }
    return good(adv(put(s, `R6:${p}`)), "踏板高さの手摺で内柱とつないだ。");
  }

  /* 壁当てジャッキ（HANDOFF.md 3章 第2章）
     付く相手は踏板ではなく踏板手摺。踏板手摺のすぐ下のコマ。 */
  if (tool === "wjack") {
    if (!isInner(p)) {
      return foul(
        "壁当てジャッキは内柱の箇所に付ける。",
        "建物へ突っ張る材だ。建物側の柱に付けんと効かん。",
        "取付位置の誤り",
      );
    }
    if (has(s, `WJ:${p}`)) return note("もう付いている。");
    if (cur.k !== "wjack") return foul("いまその場面じゃない。", "受け材が先だ。", "手順の飛ばし");
    if (cur.t !== p) return foul("その柱じゃない。", "奥から手前へ順に。", "取付位置の誤り");
    if (!has(s, `R6:${p}`)) {
      return foul(
        "先に踏板手摺で内柱とつなげ。",
        "壁当てジャッキが付く相手は踏板ではなく踏板手摺だ。まだ無い。",
        "手順の飛ばし",
      );
    }
    return good(s, "壁当てジャッキを回して建物へ突っ張る。", { type: "wjack", post: p });
  }

  return note("その資材はそこに付かん。");
}

/* ══════════════════════════════════════════
   スパンをタップ
   ══════════════════════════════════════════ */

function judgeSpan(s: Ch2State, tool: Tool, id: SpanId): Verdict {
  const cur = current(s);
  if (!cur) return note("もう終わりだ。");

  /* 筋交だけは地上からでも入れる */
  if (tool === "brace") {
    if (cur.k !== "brace") {
      return foul("いま筋交を入れる場面じゃない。", "1段につき1本だ。", "手順の飛ばし");
    }
    const [lvlStr, sid] = cur.t.split(":") as [string, SpanId];
    const lvl = Number(lvlStr) as 1 | 2 | 3;
    if (sid !== id) {
      return foul(
        "そのスパンじゃない。",
        "筋交は下端が南端側、上端が出隅側。段ごとに1スパン寄せて一直線に上げる。",
        "取付位置の誤り",
      );
    }
    if (has(s, `BR:${cur.t}`)) return note("もう入っている。");
    const need = BRACE_FROM[lvl];
    if (s.lv !== need) {
      const where = need === 0 ? "地上" : `${need}段目`;
      return foul(
        need === 0 ? "1本目の筋交は地上から入れる。降りろ。" : `その筋交は${where}から入れる。`,
        "入れる段から手が届く高さに掛ける。無理な姿勢で入れると落ちる。",
        "作業位置の誤り",
      );
    }
    return good(s, "筋交を入れる。", { type: "brace", span: id, first: !s.braceTaught });
  }

  if (s.lv === 0) return note("それは足場の上でやる作業だ。まず筋交を入れて上がれ。");

  if (tool === "rail") {
    if (cur.k !== "rail1" && cur.k !== "rail2") {
      return foul("いま手摺を入れる場面じゃない。", "順番がある。", "手順の飛ばし");
    }
    const lvl = cur.k === "rail1" ? 1 : 2;
    const key = `R${lvl}:${id}`;
    if (has(s, key)) return note("もう入っている。");
    if (cur.t !== id) {
      return foul(
        "そのスパンの番じゃない。",
        "手摺は荷揚げ側から入れる。材料を運ぶ順に合わせる。",
        "取付順序",
      );
    }
    if (lvl === 2 && !has(s, `D2:${id}`)) {
      return foul("先に踏板を敷け。", "床が無いところで手摺は入れられん。", "手順の飛ばし");
    }
    const next = adv(put(s, key));
    /* 1段目の1本目が入ったら、安全帯を手摺へ掛け替える */
    if (lvl === 1 && s.belt === "post") {
      return good(next, "1段目の手摺が入った。", { type: "belt", mode: "rail" });
    }
    return good(next, `${lvl}段目の手摺を入れた。`);
  }

  if (tool === "deck") {
    if (has(s, `D2:${id}`)) return note("もう敷いてある。");
    if (cur.k !== "deck2") {
      return foul("いま踏板を敷く場面じゃない。受け材が先だ。", "受けの無い床は踏んだ拍子に落ちる。", "手順の飛ばし");
    }
    if (cur.t !== id) return foul("そのスパンじゃない。", "奥から手前へ順に。", "取付位置の誤り");
    return good(adv(put(s, `D2:${id}`)), "2段目の踏板を敷いた。");
  }

  /* 転落防止手摺。中さん2,250 → 上さん2,700 の順 */
  if (tool === "fall") {
    if (s.lv !== 3) return note("屋根に上がってから付ける。");
    if (cur.k !== "fall") return foul("いまその場面じゃない。", "屋根に上がってからだ。", "手順の飛ばし");
    const [kind] = cur.t.split(":") as ["M" | "U", SpanId];
    const key = `FL:${cur.t}`;
    if (has(s, key)) return note("それはもう入っている。");
    if (cur.t !== `${kind}:${id}`) {
      return foul("そのスパンの番じゃない。", "順に入れる。", "取付順序");
    }
    if (kind === "U" && !has(s, `FL:M:${id}`)) {
      return foul(
        "中さんが先だ。低い方から入れる。",
        "上さんを先に入れると、中さんを入れるときに体を乗り出すことになる。",
        "取付順序",
      );
    }
    const next = adv(put(s, key));
    const rest = SPAN_IDS.filter((x) => !has(next, `FL:${kind}:${x}`)).length;
    return good(
      next,
      kind === "M"
        ? rest
          ? "中さんを入れた。次のスパンへ。"
          : "中さんが全部入った。次は上さんだ。"
        : rest
          ? "上さんを入れた。"
          : "上さんも全部入った。これで屋根側が囲われた。",
    );
  }

  return note("そこに付く資材じゃない。");
}

/* ══════════════════════════════════════════
   場面が終わったとき
   ══════════════════════════════════════════ */

function judgeScene(s: Ch2State, sc: Scene): Verdict {
  if (sc.type === "belt") {
    if (sc.mode === "post") {
      return good({ ...s, belt: "post" }, "支柱に安全帯を取った。ここから2段目を組む。");
    }
    return good({ ...s, belt: "rail" }, "手摺に掛け替えた。これで動ける。");
  }

  if (sc.type === "brace") {
    const cur = current(s);
    if (!cur || cur.k !== "brace") return note("いまその場面じゃない。");
    const next = adv(put({ ...s, braceTaught: true }, `BR:${cur.t}`));
    return good(next, sc.first ? "筋交が入った。面が動かなくなる。" : "筋交が入った。");
  }

  if (sc.type === "wjack") {
    const cur = current(s);
    if (!cur || cur.k !== "wjack") return note("いまその場面じゃない。");
    return good(adv(put(s, `WJ:${sc.post}`)), "壁当てジャッキで建物へ突っ張った。");
  }

  return note("いまその場面じゃない。");
}

/* ══════════════════════════════════════════
   入口
   ══════════════════════════════════════════ */

export function judge(s: Ch2State, a: Action): Verdict {
  if (a.type === "sceneFoul") return foul(a.message, a.why, a.tag, 10);
  if (a.type === "sceneDone") return judgeScene(s, a.scene);
  if (a.type === "climb") return judgeClimb(s);
  if (a.type === "tapPost") return judgePost(s, a.tool, a.post);
  return judgeSpan(s, a.tool, a.span);
}

/** 親方に聞いたときの答え */
export function hint(s: Ch2State): string {
  const cur = current(s);
  if (!cur) return "終わりだ。";
  return `${cur.d}。`;
}

/** チュートリアルで使わせる資材 */
export function usableTools(s: Ch2State): Tool[] {
  const cur = current(s);
  if (!cur) return ["move"];
  const m: Partial<Record<string, Tool>> = {
    brace: "brace",
    rail1: "rail",
    rail2: "rail",
    post2: "post",
    postI: "post",
    wjack: "wjack",
    brk: "brk",
    rail6: "rail6",
    deck2: "deck",
    fall: "fall",
  };
  const t = m[cur.k];
  return t ? ["move", t] : ["move"];
}

export { spanName };
