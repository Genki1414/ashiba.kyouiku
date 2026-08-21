/* 第2章の通し見学。

   手順は工程キュー（queue.ts）そのものを使い、
   実際に判定（rules.ts）を通して盤面を進めます。
   だから、ここに出る手順は「本当にその順でしか通らない手順」です。
   キューを直せば見学も一緒に直ります。

   「なぜそうするのか」だけは、ここに書いてあります。
   ── げんきさんの確認が要る文言です（docs/09-通し見学の文言.md） */

import { judge, type Action, type Scene } from "./rules";
import { initialState, type Ch2State } from "./state";
import { buildSteps, type Step } from "./queue";
import { POST_NAME, spanName, type PostId, type SpanId } from "./layout";

export type DemoStep = {
  n: number;
  /** 何をするか（工程キューの説明そのまま） */
  t: string;
  /** なぜそうするのか */
  why: string;
  /** この手を打ち終えた盤面 */
  state: Ch2State;
};

/* ── なぜそうするのか ──
   工程の種類ごとに1つ。同じ種類の手が続くときは同じ理由を出す。 */
const WHY: Record<Step["k"], string> = {
  brace: "筋交は下端が南端側、上端が出隅側。段ごとに1スパンずつ寄せて一直線に上げる。ばらばらに入れると力の流れが切れる。",
  climb1: "昇降階段で上がる。支柱や筋交をよじ登らない。手が塞がった状態で足を掛ける所が決まっていないと落ちる。",
  rail1: "床に乗る前に囲いを作る。手摺の無い床の上で手摺を付ける時間が、いちばん落ちる。手摺は荷揚げ側から入れると材料を運ぶ距離が短い。",
  post2: "支柱は奥（南端）から手前へ継ぐ。手前から継ぐと、奥へ材料を送る道が塞がる。",
  postI: "内柱も奥から。外柱と組にして継いでいく。",
  brk: "外柱から建物側へ張り出す受け材。ここに踏板が載る。",
  rail6: "内柱の箇所は踏板高さの手摺で外柱とつなぐ。つないで初めて内柱の位置が決まる。",
  wjack: "壁当てジャッキで建物に当てる。足場が建物側へ倒れるのを止める。",
  deck2: "受け材が両端に入ってから踏板を敷く。受け材の無い所に載せると、踏んだ拍子に落ちる。",
  climb2: "踏板が全部敷けてから上がる。抜けている所があると、そこへ足が落ちる。",
  rail2: "上がったらまた囲いから。段が変わっても順番は同じ。",
  roof: "屋根へ出る。ここから先は転落防止の手摺を先に回す。",
  fall: "中さん2,250 → 上さん2,700 の順。低い方から入れる。高い方を先に入れると、次に低い方を入れるとき体が外へ出る。",
};

/** 工程キューの1手を、盤面への手に直す */
function toAction(st: Step): Action | null {
  switch (st.k) {
    case "brace": {
      const span = st.t.split(":")[1] as SpanId;
      return { type: "tapSpan", tool: "brace", span };
    }
    case "climb1":
    case "climb2":
    case "roof":
      return { type: "climb" };
    case "rail1":
      return { type: "tapSpan", tool: "rail", span: st.t };
    case "rail2":
      return { type: "tapSpan", tool: "rail", span: st.t };
    case "deck2":
      return { type: "tapSpan", tool: "deck", span: st.t };
    case "fall": {
      const span = st.t.split(":")[1] as SpanId;
      return { type: "tapSpan", tool: "fall", span };
    }
    case "post2":
    case "postI":
      return { type: "tapPost", tool: "post", post: st.t };
    case "brk":
      return { type: "tapPost", tool: "brk", post: st.t };
    case "rail6":
      return { type: "tapPost", tool: "rail6", post: st.t };
    case "wjack":
      return { type: "tapPost", tool: "wjack", post: st.t };
    default:
      return null;
  }
}

/** どこを触っているか。見出しに添える */
function where(st: Step): string {
  switch (st.k) {
    case "brace":
    case "fall":
      return spanName(st.t.split(":")[1] as SpanId);
    case "rail1":
    case "rail2":
    case "deck2":
      return spanName(st.t);
    case "post2":
    case "postI":
    case "brk":
    case "rail6":
    case "wjack":
      return POST_NAME[st.t as PostId];
    default:
      return "";
  }
}

/** 場面が続くかぎり閉じて、盤面を進める */
function settle(s: Ch2State, scene: Scene | undefined): Ch2State {
  let cur = s;
  let sc = scene;
  for (let i = 0; i < 8 && sc; i++) {
    const v = judge(cur, { type: "sceneDone", scene: sc });
    if (v.kind !== "good") break;
    cur = v.state;
    sc = v.scene;
  }
  return cur;
}

/** 通し見学の手順を組み立てる。判定を通らない手があれば、そこで止める */
export function buildDemo(): DemoStep[] {
  const steps = buildSteps();
  const out: DemoStep[] = [];
  let s = initialState();

  for (const st of steps) {
    const a = toAction(st);
    if (!a) continue;
    const v = judge(s, a);
    if (v.kind !== "good") break;
    s = settle(v.state, v.scene);
    out.push({ n: out.length + 1, t: st.d, why: WHY[st.k], state: s });
  }
  return out;
}

export { where };
