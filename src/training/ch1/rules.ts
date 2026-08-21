/* 第1章の判定。
   HANDOFF.md 3章「現場のルール」をそのまま判定条件にしたもの。
   一般論へ寄せず、書かれているとおりに実装する。

   ファールのときは「何が駄目か」ではなく「なぜ駄目か」を返す（HANDOFF.md 4章）。
   重さの区別は PROMPT.md 4章のとおり：
     安全の問題 → ファール（技能点を減らす）
     効率の問題 → 親方が一言添えるだけ
     両方       → ファールにしたうえで、なぜ危ないかを先に言う */

import {
  END_INNER,
  JACK_SCENE_MAX,
  JACK_TARGET,
  JACK_TOL,
  MID_NEED,
  MID_OK,
  POSTS,
  faceOf,
  spanById,
  type PostId,
  type SpanId,
} from "./layout";
import { STAGE_A } from "./queue";
import {
  activeSteps,
  currentStageA,
  danDone,
  has,
  inStageA,
  type Ch1State,
} from "./state";

export type Tool = "move" | "ledger" | "rail6" | "jack" | "post" | "inner" | "brk" | "deck";

/** 判定のあとに画面へ出す場面。状態は「場面が終わった」通知で進む */
/** 水平器をどこに置くか（HANDOFF.md 3章 第1章 ルール6）
    end = 手摺の端 / in = 端から少し中（正解）/ mid = 手摺の中ほど */
export type LevelSpot = "end" | "in" | "mid";

export const LEVEL_SPOT_NAME: Record<LevelSpot, string> = {
  end: "手摺の端",
  in: "端から少し中",
  mid: "手摺の中ほど",
};

/** 置き場所を外したときの理由。なぜ駄目かを必ず言う */
export const LEVEL_SPOT_WHY: Record<LevelSpot, string> = {
  end: "端は差し込みの都合で凹んどる。面が出とらんから、気泡が中央でも水平は出ていない。前にこれで測って、4面が一周したときに高さが合わんかった。",
  in: "",
  mid: "中ほどはジャッキから遠い。回しながら気泡が見えんから、合わせようがない。",
};

export type Scene =
  | { type: "jackAdjust"; post: PostId }        // 挿す手前のジャッキ合わせ
  | { type: "hanare"; post: PostId; label: string }
  /** 外柱の水平。根がらみ手摺のどこに水平器を置くかを選ばせる。
      spots と作業員は進行方向側（dir）に出す */
  | { type: "level"; a: PostId; b: PostId; dir: "south" | "east"; spots: LevelSpot[] }
  | { type: "innerNext"; post: PostId };         // 内柱を立てた直後（600手摺 → 離れ → 水平は支柱に当てる）

export type Action =
  | { type: "tapPost"; tool: Tool; id: PostId }
  | { type: "tapInner"; tool: Tool; id: PostId }
  | { type: "tapSpan"; tool: Tool; id: SpanId }
  | { type: "useHanare" }
  | { type: "useLevel" }
  | { type: "toTate" }
  | { type: "sceneDone"; scene: Scene; value?: number; spot?: LevelSpot };

export type Verdict =
  | { kind: "good"; message: string; state: Ch1State; scene?: Scene }
  /** 効率の問題・置き直しなど。技能点は減らさない */
  | { kind: "note"; message: string }
  /** 安全に関わる。技能点を減らし、なぜ危ないかを返す */
  | { kind: "foul"; message: string; why: string; penalty: number; tag: string };

const good = (state: Ch1State, message: string, scene?: Scene): Verdict => ({
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

const put = (s: Ch1State, k: string): Ch1State => ({ ...s, placed: [...s.placed, k] });
const jackOK = (s: Ch1State, k: string) => Math.abs((s.jack[k] ?? 0) - JACK_TARGET) <= JACK_TOL;

/** 面の進行をひとつ進める */
function advance(s: Ch1State, face: "A" | "S" | "E"): Ch1State {
  if (face === "A") return { ...s, stageA: s.stageA + 1 };
  return { ...s, face: { ...s.face, [face]: s.face[face] + 1 } };
}

/* ══════════════════════════════════════════
   段取り（HANDOFF.md 3章 第1章 ルール1・2）
   根がらみ手摺を並べる → 内柱箇所の手摺 → ジャッキを配る
   ══════════════════════════════════════════ */

const NO_LEDGER_YET =
  "根がらみ手摺が1本も無い。手摺が割り付けの現物合わせになる。無いとジャッキの位置が決まらん。";

function judgeDan(s: Ch1State, a: Action): Verdict {
  const laidLedgers = s.placed.filter((k) => k.startsWith("L:")).length;

  if (a.type === "tapSpan") {
    if (a.tool !== "ledger") return note("スパンに並べるのは根がらみ手摺だ。");
    if (has(s, `L:${a.id}`)) return note("そのスパンには並べてある。");
    return good(put(s, `L:${a.id}`), "割り付けに合わせて根がらみ手摺を並べた。");
  }

  if (a.type === "tapPost") {
    if (a.tool !== "jack") return note("柱の位置に置くのはジャッキだ。");
    if (laidLedgers === 0) {
      return foul(
        "根がらみ手摺が無かったら、どこにジャッキを置くのか分からんだろう。まず手摺を並べろ。",
        NO_LEDGER_YET,
        "段取りの順序",
      );
    }
    if (has(s, `J:${a.id}`)) return note("そこはもう置いてあるぞ。");
    return good(put({ ...s, at: a.id }, `J:${a.id}`), `${POSTS[a.id].n}の位置にジャッキを据えた。`);
  }

  if (a.type === "tapInner") {
    if (a.tool === "rail6") {
      if (POSTS[a.id].corner) {
        return foul(
          "出隅は基準柱だ。内柱の箇所にはしない。",
          "出隅は2方向の基準になる。ここを内柱にすると、どちらの面の割り付けも決まらなくなる。",
          "内柱の位置決め",
        );
      }
      if (laidLedgers === 0) {
        return foul(
          "先は根がらみ手摺だ。並べてからでないと、どこが内柱になるか決まらん。",
          NO_LEDGER_YET,
          "段取りの順序",
        );
      }
      if (s.inner.includes(a.id)) return note("そこはもう内柱に決めてある。");
      if (!END_INNER.includes(a.id)) {
        if (!MID_OK.includes(a.id)) {
          return foul(
            "その位置では間隔が空きすぎる。",
            "内柱の間隔が空くと踏板を受けきれない。中間は2スパンに1本だ。",
            "内柱の位置決め",
          );
        }
        const midN = s.inner.filter((p) => !END_INNER.includes(p)).length;
        if (midN >= MID_NEED) {
          return foul(
            "中間の内柱は足りとる。一側足場は2スパンに1本だ。",
            "要らん内柱を入れると材料も手間も増える。決まった間隔で入れる。",
            "内柱の本数",
            0,
          );
        }
      }
      const next = put({ ...s, inner: [...s.inner, a.id] }, `R6:${a.id}`);
      return good(
        next,
        END_INNER.includes(a.id)
          ? "端部は必ず内柱だ。内側に600手摺を置いた。端部に内柱が無いと足場が安定せん。"
          : "中間の内柱を決めた。",
      );
    }
    if (a.tool === "jack") {
      if (laidLedgers === 0) {
        return foul("根がらみ手摺が先だ。置く場所が決まらんだろう。", NO_LEDGER_YET, "段取りの順序");
      }
      if (!s.inner.includes(a.id)) return note("先に内柱の箇所を決めろ。600手摺を内側に置く。");
      if (has(s, `J:in:${a.id}`)) return note("もう置いてある。");
      return good(put(s, `J:in:${a.id}`), "内柱にもジャッキが要る。");
    }
    return note("内側に置くのは600手摺かジャッキだ。");
  }

  if (a.type === "toTate") {
    if (!danDone(s)) return note("段取りが残っとる。下のチェックを全部埋めろ。");
    return good(
      { ...s, phase: "tate", stageA: 0, face: { S: 0, E: 0 } },
      "よし建方だ。まず基準になる1本目を立てろ。挿す前に、計算で出した高さへハンドルを合わせろ。",
    );
  }

  return note("まだ段取り中だ。");
}

/* ══════════════════════════════════════════
   建方（HANDOFF.md 3章 第1章 ルール3〜8）
   ══════════════════════════════════════════ */

function judgeTate(s: Ch1State, a: Action): Verdict {
  const stA = currentStageA(s);
  const acts = activeSteps(s);
  const find = <T,>(pred: (st: (typeof acts)[number]["step"]) => boolean) =>
    acts.find((x) => pred(x.step));

  /* ── 柱をタップ ── */
  if (a.type === "tapPost") {
    const id = a.id;
    const p = POSTS[id];

    if (a.tool === "post") {
      if (has(s, `P:${id}`)) return note("その柱はもう立っとる。");
      const inA =
        inStageA(s) &&
        stA &&
        ((stA.k === "post" && stA.t === id) || (stA.k === "post2" && stA.ts.includes(id)));
      const m = find((st) => st.k === "post" && st.t === id);
      if (!inA && !m) {
        return foul(
          "その柱の番じゃない。",
          "基準は出隅だ。出隅 → 2方向に根がらみ手摺 → 両隣の柱。順を飛ばすと割り付けが狂う。",
          "建てる順序",
        );
      }
      /* 支柱を挿す手前で、計算した高さへハンドルを合わせる（ゲーム中2回だけ見せる） */
      if (s.jackSeen < JACK_SCENE_MAX && !jackOK(s, id)) {
        return good({ ...s, jackSeen: s.jackSeen + 1, at: id }, "挿す前だ。計算で出した高さにハンドルを合わせろ。", {
          type: "jackAdjust",
          post: id,
        });
      }
      return standPost(s, id);
    }

    if (a.tool === "brk") {
      /* 共通ステージの adjust：離れ → 水平 → ブラケット */
      if (inStageA(s) && stA && stA.k === "adjust" && stA.ts.includes(id)) {
        const f = POSTS[id].face;
        if (f && has(s, `BRK:${id}:${f}`)) return note("もう掛けてある。");
        if (s.inner.includes(id)) {
          return foul(
            "そこは内柱の箇所だ。ブラケットは要らん。",
            "内柱の箇所は内柱が踏板を受ける。ブラケットを掛けても踏板は載らん。",
            "取付位置の誤り",
          );
        }
        if (!s.hanare.includes(id)) {
          return foul(
            "先に離れを見ろ。",
            "離れが決まらんうちに受け材を付けても、あとで柱ごと動かすことになる。",
            "手順の飛ばし",
          );
        }
        if (!s.level.includes(id)) {
          return foul(
            "水平が先だ。水平を出してからブラケットを掛ける。",
            "受け材が乗ってから水平を出すと沈む。脚部の狂いは上段で拡大する。",
            "手順の飛ばし",
          );
        }
        const next = markAdjust(put(s, `BRK:${id}:${f}`), id);
        return good(next, "ブラケットを掛けた。この柱は仕上がりだ。");
      }
      const m = find((st) => st.k === "brk" && st.t === id && !has(s, `BRK:${id}:${st.face}`));
      if (!m) {
        return foul(
          "いまブラケットを掛ける場面じゃない。",
          "柱ごとの順序は 離れ → 水平 → ブラケットで固定だ。",
          "手順の飛ばし",
        );
      }
      const mf = (m.step as Extract<typeof m.step, { k: "brk" }>).face;
      return good(
        advance(put(s, `BRK:${id}:${mf}`), m.face),
        "外柱から建物側へ張り出す。ここに踏板が載る。",
      );
    }

    if (a.tool === "inner") {
      if (!s.inner.includes(id)) return note("そこは内柱の箇所じゃない。");
      if (has(s, `PI:${id}`)) return note("もう立っとる。");
      if (inStageA(s) && stA && stA.k === "adjust" && stA.ts.includes(id)) {
        if (!s.level.includes(id)) {
          return foul(
            s.hanare.includes(id)
              ? "外柱の水平が先だ。それから内柱を立てろ。"
              : "先に外柱の離れを測れ。離れ → 水平 → 内柱の順だ。",
            "外柱が決まらんうちに内柱を立てても、つないだ先が動く。",
            "手順の飛ばし",
          );
        }
        return good(put({ ...s, at: id }, `PI:${id}`), "内柱を立てた。", {
          type: "innerNext",
          post: id,
        });
      }
      const m = find((st) => st.k === "inner" && st.t === id);
      if (!m) {
        return foul(
          "いま内柱を立てる場面じゃない。",
          "内柱は外柱の離れと水平が出てからだ。",
          "手順の飛ばし",
        );
      }
      return good(put({ ...s, at: id }, `PI:${id}`), "内柱を立てた。", {
        type: "innerNext",
        post: id,
      });
    }

    if (a.tool === "move") return good({ ...s, at: id }, `${p.n}の前に立った。`);
    return note("その資材はそこには付かん。");
  }

  /* ── スパンをタップ ── */
  if (a.type === "tapSpan") {
    const sp = spanById(a.id);

    if (a.tool === "move") return good({ ...s, at: null }, "スパンの間に立った。");

    if (a.tool === "ledger") {
      if (has(s, `LU:${a.id}`)) return note("もう入っとる。");
      const inA =
        inStageA(s) && stA && stA.k === "ledger2" && (stA.ts as SpanId[]).includes(a.id);
      const m = find((st) => st.k === "ledger" && st.t === a.id);
      if (!inA && !m) {
        return foul(
          "そのスパンの番じゃない。手摺は立っとる柱のコマへ入れる。",
          "柱 → 手摺 → 次の柱の順だ。立っていない柱のコマには入らん。",
          "根がらみの順序",
        );
      }
      const next = put(s, `LU:${a.id}`);
      if (inA && stA && stA.k === "ledger2") {
        const done = stA.ts.filter((x) => x === a.id || has(s, `LU:${x}`)).length;
        if (done >= 2) return good(advance(next, "A"), "2方向とも入った。どちらから入れても構わん。");
        return good(next, "基準柱のコマに入れた。もう一方も入れろ。");
      }
      return good(advance(next, m!.face), "立っとる柱のコマへ入れた。柱を立てる前に入れておく。");
    }

    if (a.tool === "deck") {
      if (has(s, `DK:${a.id}`)) return note("もう敷いてある。");
      const m = find((st) => st.k === "deck" && st.t === a.id);
      if (!m) {
        return foul(
          "いま踏板を敷く場面じゃない。両端の受け材が先だ。",
          "受け材の無いところに踏板を載せると、踏んだ拍子に落ちる。",
          "手順の飛ばし",
        );
      }
      return good(advance(put(s, `DK:${a.id}`), m.face), "踏板を敷いた。ここが作業床になる。");
    }

    return note(`そこに付くのは根がらみ手摺だ。（${sp.a}〜${sp.b}）`);
  }

  /* ── 離れを測る（HANDOFF.md ルール5：柱ごとに 離れ → 水平 → ブラケット）── */
  if (a.type === "useHanare") {
    if (inStageA(s) && stA && stA.k === "adjust") {
      if (!s.at || !stA.ts.includes(s.at)) return note("離れは柱の前で見る。対象の柱まで移動しろ。");
      if (s.hanare.includes(s.at)) return note("その柱の離れはもう見た。もう一方の柱へ行け。");
      return good(s, "建物からの離れを測る。", {
        type: "hanare",
        post: s.at,
        label: `${faceOf(s.at)} ${POSTS[s.at].n}`,
      });
    }
    const m = find((st) => st.k === "hanare" && st.t === s.at);
    if (!m) {
      const any = find((st) => st.k === "hanare");
      if (any && any.step.k === "hanare") return note(`${POSTS[any.step.t].n}の前まで移動しろ。`);
      return foul(
        "いま離れを見る場面じゃない。",
        "柱を立ててから離れを測る。順序は全箇所で固定だ。",
        "手順の飛ばし",
      );
    }
    return good(s, "建物からの離れを測る。", {
      type: "hanare",
      post: s.at!,
      label: `${faceOf(s.at!)} ${POSTS[s.at!].n}`,
    });
  }

  /* ── 水平を出す（HANDOFF.md ルール6・7）── */
  if (a.type === "useLevel") {
    if (inStageA(s) && stA && stA.k === "adjust") {
      if (!s.at || !stA.ts.includes(s.at)) return note("水平は柱の前で見る。対象の柱まで移動しろ。");
      if (!s.hanare.includes(s.at)) {
        return foul(
          "先に離れを見ろ。離れが決まらんと水平を出しても動く。",
          "離れが決まらんうちに水平を出しても、柱ごと動かせば狂う。",
          "手順の飛ばし",
        );
      }
      if (s.level.includes(s.at)) return note("その柱の水平はもう出した。もう一方の柱へ行け。");
      return good(s, "水平を出す。どこに水平器を置く？", levelScene("C", s.at));
    }
    const m = find((st) => st.k === "level" && st.b === s.at);
    if (m && s.at && !s.hanare.includes(s.at)) {
      return foul(
        "先に離れを見ろ。離れが決まらんと水平を出しても動く。",
        "離れが決まらんうちに水平を出しても、柱ごと動かせば狂う。",
        "手順の飛ばし",
      );
    }
    if (!m) {
      const any = find((st) => st.k === "level");
      if (any && any.step.k === "level") return note(`${POSTS[any.step.b].n}の前まで移動しろ。`);
      return foul(
        "いま水平を見る場面じゃない。",
        "離れを測ってから水平だ。順序は全箇所で固定だ。",
        "手順の飛ばし",
      );
    }
    const st = m.step as Extract<typeof m.step, { k: "level" }>;
    return good(s, "水平を出す。どこに水平器を置く？", levelScene(st.a, st.b));
  }

  if (a.type === "tapInner") return note("内柱は柱の位置をタップして立てる。");
  if (a.type === "toTate") return note("もう建方に入っとる。");

  return note("いまその手はない。");
}

/** 外柱の水平の場面。候補と作業員は進行方向側に出す */
function levelScene(a: PostId, b: PostId): Scene {
  const dir = POSTS[b].face === "E" ? "east" : "south";
  return { type: "level", a, b, dir, spots: ["end", "in", "mid"] };
}

/** 支柱を立てる（ジャッキ合わせが済んだあと） */
function standPost(s: Ch1State, id: PostId): Verdict {
  const stA = currentStageA(s);
  const next0 = put({ ...s, at: id }, `P:${id}`);

  if (inStageA(s) && stA && stA.k === "post" && stA.t === id) {
    return good(advance(next0, "A"), "基準となる1本目を立てた。ここの精度が全体を決める。");
  }
  if (inStageA(s) && stA && stA.k === "post2" && stA.ts.includes(id)) {
    const ord = [...s.ord, id];
    const withOrd = { ...next0, ord };
    if (ord.length >= 2) return good(advance(withOrd, "A"), "両側とも立った。どちらから立てても構わん。");
    return good(withOrd, `${POSTS[id].n}を立てた。もう片側も立てろ。`);
  }
  const m = activeSteps(s).find((x) => x.step.k === "post" && x.step.t === id);
  if (!m) {
    return foul("その柱の番じゃない。", "根がらみ手摺を入れてから次の柱だ。", "建てる順序");
  }
  return good(advance(next0, m.face), "次の柱を立てた。");
}

/** 共通ステージ adjust で1本仕上がったときの進行 */
function markAdjust(s: Ch1State, id: PostId): Ch1State {
  const stA = currentStageA(s);
  const adjDone = s.adjDone.includes(id) ? s.adjDone : [...s.adjDone, id];
  const next = { ...s, adjDone };
  if (stA && stA.k === "adjust" && stA.ts.every((x) => adjDone.includes(x))) {
    return advance(next, "A");
  }
  return next;
}

/* ══════════════════════════════════════════
   場面（オーバーレイ）が終わったとき
   ══════════════════════════════════════════ */

function judgeScene(s: Ch1State, a: Extract<Action, { type: "sceneDone" }>): Verdict {
  const sc = a.scene;

  if (sc.type === "jackAdjust") {
    const v = a.value ?? 0;
    if (Math.abs(v - JACK_TARGET) > JACK_TOL) {
      return note("まだ合っとらん。計算で出した高さにハンドルを合わせろ。");
    }
    return standPost({ ...s, jack: { ...s.jack, [sc.post]: v } }, sc.post);
  }

  if (sc.type === "hanare") {
    const withH = { ...s, hanare: [...s.hanare, sc.post] };
    const m = activeSteps(s).find((x) => x.step.k === "hanare" && x.step.t === sc.post);
    const next = m ? advance(withH, m.face) : withH;
    return good(next, `${POSTS[sc.post].n}の離れが合った。次は水平だ。`);
  }

  if (sc.type === "level") {
    const spot = a.spot;
    if (!spot) return note("水平器を置く場所を選べ。");
    if (spot !== "in") {
      return foul(
        `そこは違う。水平器は${LEVEL_SPOT_NAME.in}に置く。`,
        LEVEL_SPOT_WHY[spot],
        "水平器の置き場所",
      );
    }
    const b = sc.b;
    const withL = { ...s, level: [...s.level, b] };
    if (inStageA(s)) {
      return good(
        withL,
        s.inner.includes(b) ? "外柱の水平が出た。次は内柱を立てろ。" : "水平が出た。次はブラケットを掛けろ。",
      );
    }
    const m = activeSteps(s).find((x) => x.step.k === "level" && x.step.b === b);
    const next = m ? advance(withL, m.face) : withL;
    return good(next, "水平が出た。脚部の狂いは上段で拡大する。");
  }

  if (sc.type === "innerNext") {
    /* 内柱を立てた → 踏板高さの600手摺でつなぐ → 離れ → 水平（水平器は支柱に当てる） */
    const withTie = { ...s, innerTied: [...s.innerTied, sc.post] };
    if (inStageA(s)) {
      return good(markAdjust(withTie, sc.post), "600手摺でつないで、内柱の水平も出した。この柱は仕上がりだ。");
    }
    const m = activeSteps(s).find((x) => x.step.k === "inner" && x.step.t === sc.post);
    const next = m ? advance(withTie, m.face) : withTie;
    return good(next, "600手摺でつないで、内柱の水平も出した。");
  }

  return note("いまその場面じゃない。");
}

/* ══════════════════════════════════════════
   入口
   ══════════════════════════════════════════ */

export function judge(s: Ch1State, a: Action): Verdict {
  if (a.type === "sceneDone") return judgeScene(s, a);
  return s.phase === "dan" ? judgeDan(s, a) : judgeTate(s, a);
}

/** 親方に聞いたときの答え（いま何をすべきか） */
export function hint(s: Ch1State): string {
  if (s.phase === "dan") {
    return "段取りだ。まず割り付けどおりに根がらみ手摺を並べろ。そのあと内柱箇所の600手摺、最後にジャッキだ。内柱のぶんも忘れるな。";
  }
  const stA = currentStageA(s);
  if (inStageA(s) && stA) {
    if (stA.k !== "adjust") return `${stA.d}。`;
    const rest = stA.ts.filter((x) => !s.adjDone.includes(x));
    const t = rest[0];
    if (!t) return "共通ステージは終わりだ。";
    if (!s.hanare.includes(t)) return `${POSTS[t].n}の離れを測れ。`;
    if (!s.level.includes(t)) return `${POSTS[t].n}の水平を出せ。`;
    return s.inner.includes(t) ? `${POSTS[t].n}は内柱の箇所だ。内柱を立てろ。` : `${POSTS[t].n}にブラケットを掛けろ。`;
  }
  const acts = activeSteps(s);
  if (!acts.length) return "終わりだ。";
  return acts.map((x) => x.step.d).join("／");
}

export { STAGE_A };
