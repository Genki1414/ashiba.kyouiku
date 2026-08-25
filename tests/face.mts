/* 受講中の照合（遮蔽・暗い・動きなし）の判定を確かめる。

   本物のカメラは使えないので、絵を数字で作って当てる。
   実際のパソコンの Chrome には FaceDetector が無く、
   ほとんどの人はこの簡易解析で見られている。ここが甘いと、
   手でレンズを塞いだまま受講できてしまう。

   実行: npx tsx tests/face.mts */

import { H, W, judgeLook, look } from "@/lib/face";
import { CHECK_INTERVAL_MS, FAIL_LIMIT, ID_EVERY, OK_EVERY, START, step, type Tick } from "@/lib/verifyGate";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

/* 手をレンズに当てた絵。のっぺりした肌色（白黒にすると150前後）に、
   撮像素子のざらつきが少し乗る */
function palm(seed = 1): Uint8Array {
  const g = new Uint8Array(W * H);
  let s = seed;
  for (let i = 0; i < g.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    /* ざらつきは ±3 程度。手で塞ぐと輪郭は出ない */
    g[i] = 150 + ((s >> 16) % 7) - 3;
  }
  return g;
}

/* ふつうに人が写っている絵。明るい背景に、暗い頭と目鼻の陰がある */
function person(shift = 0): Uint8Array {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - (W / 2 + shift);
      const dy = y - H / 2;
      const head = dx * dx / 400 + dy * dy / 300 < 1;
      let v = head ? 120 : 200;              // 顔と背景
      if (head && Math.abs(dy + 4) < 2 && Math.abs(Math.abs(dx) - 7) < 3) v = 40;  // 目
      if (head && dy > 6 && Math.abs(dx) < 6) v = 70;                              // 口
      g[y * W + x] = v;
    }
  }
  return g;
}

const flat = (v: number): Uint8Array => new Uint8Array(W * H).fill(v);

/* ── 手で塞いだとき ── */
{
  const l = look(palm(), palm(2));
  const r = judgeLook(l);
  check(!r.ok && r.reason === "blocked",
    `手で塞いだら止まる（${JSON.stringify(l)} → ${JSON.stringify(r)}）`);
}

/* ── 暗くしたとき ── */
{
  const r = judgeLook(look(flat(10), flat(12)));
  check(!r.ok && r.reason === "blocked", "真っ暗なら止まる");
}

/* ── うっすら明るいだけの、のっぺりした絵（手を少し離したとき）── */
{
  const g = new Uint8Array(W * H);
  for (let i = 0; i < g.length; i++) g[i] = 150 + ((i * 7) % 20) - 10;  // ばらつき6程度
  const prev = new Uint8Array(W * H);
  for (let i = 0; i < g.length; i++) prev[i] = g[i] + ((i % 3) - 1);
  const l = look(g, prev);
  const r = judgeLook(l);
  check(!r.ok && r.reason === "blocked", `のっぺりしていれば止まる（${JSON.stringify(l)}）`);
}

/* ── ライトを当てて白飛びさせたとき ── */
{
  const r = judgeLook(look(flat(252), flat(250)));
  check(!r.ok && r.reason === "blocked", "白飛びでも止まる");
}

/* ── ふつうに写っているとき ── */
{
  const l = look(person(1), person(0));
  const r = judgeLook(l);
  check(r.ok, `人が写っていれば通る（${JSON.stringify(l)} → ${JSON.stringify(r)}）`);
}

/* ── 写真を貼り付けて動かないとき ── */
{
  const same = person(0);
  const r = judgeLook(look(same, person(0)));
  check(!r.ok && r.reason === "no_motion", "まったく動かなければ止まる");
}

/* ── はじめの1枚（前の絵が無い）は、動きで止めない ── */
{
  const r = judgeLook(look(person(0), null));
  check(r.ok, "1枚目は動きなしにしない");
}

/* ── 数の意味 ── */
{
  const p = look(palm(), null);
  const h = look(person(0), null);
  check(p.sd < h.sd, `手のほうがのっぺりしている（${p.sd.toFixed(1)} < ${h.sd.toFixed(1)}）`);
  check(p.sd < 8, `手で塞ぐと ばらつきは 8 未満（${p.sd.toFixed(1)}）`);
  check(h.sd > 30, `人が写っていれば ばらつきは 30 以上（${h.sd.toFixed(1)}）`);
  check(look(flat(100), flat(100)).motion === 0, "同じ絵なら動きはゼロ");
}

/* ── 何回外れたら止めるか ──
   ここが甘いと、外れているのに いつまでも止まらない。
   実際そうなっていた（顔があるかを2回に1回しか見ていなかったので、
   外れた回と見ていない回が交互になり、2回続けて外れることが無かった）。 */
const OK: Tick = { ok: true };
const ng2 = (reason: "no_face" | "multi_face" | "blocked" | "no_motion" | "not_me"): Tick =>
  ({ ok: false, reason });

/** 並びを流して、何回目で止まるかを返す。止まらなければ null */
function runTicks(list: Tick[]): number | null {
  let g = START;
  for (let i = 0; i < list.length; i++) {
    g = step(g, list[i]);
    if (g.stop) return i + 1;
  }
  return null;
}

{
  check(FAIL_LIMIT === 2, "2回続けて外れたら止める");
  check(runTicks([ng2("no_face"), ng2("no_face")]) === 2, "顔が2回続けて無ければ止まる");
  check(runTicks([ng2("blocked"), ng2("no_face")]) === 2, "理由が違っても、2回続けて外れれば止まる");
  check(runTicks([ng2("no_face")]) === null, "1回だけなら止めない（顔を掻いた、横を向いた）");
  check(runTicks([ng2("no_face"), OK, ng2("no_face"), OK]) === null,
    "1回おきに外れるのは止めない（人は居る）");

  /* いちばん困っていた形。外れた回と、見ていない回が交互になっていた */
  const alternating: Tick[] = [];
  for (let i = 0; i < 20; i++) alternating.push(i % 2 === 0 ? ng2("no_face") : OK);
  check(runTicks(alternating) === null,
    "交互に外れる並びでは止まらない ＝ 顔の有無を間引くと止まらなくなる");

  check(runTicks([ng2("not_me")]) === 1, "別人と分かったら、その1回で止める");
  check(runTicks([OK, OK, ng2("not_me")]) === 3, "通ったあとでも、別人なら その場で止める");
  check(step(START, ng2("no_face")).miss === 1, "外れた回は数える");
  check(step({ miss: 1, stop: null }, OK).miss === 0, "通れば数え直す");

  /* 控えを残す回は、必ず本人照合をした回であること。
     倍数でなくなると、顔があっただけの回を「本人を確認」と書くことになる */
  check(OK_EVERY % ID_EVERY === 0,
    `控えを残す回は本人照合の回と重なる（${OK_EVERY} は ${ID_EVERY} の倍数）`);
  check((CHECK_INTERVAL_MS * ID_EVERY) / 1000 === 30, "本人照合は30秒ごと");
  check((CHECK_INTERVAL_MS * OK_EVERY) / 1000 === 300, "控えは5分ごと");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
