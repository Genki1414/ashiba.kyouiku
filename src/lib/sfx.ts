/* 効果音。プロトタイプと同じく、WAVをその場で作って <audio> で鳴らす。
   音のファイルを持たないので、置き場所も読み込み待ちも要らない。

   ・波形の式は handoff/ashiba-app-v16h.tsx と prototypes/ashiba-ch2-v6.tsx のまま
   ・組み立ては初めて鳴らすときだけ。以後は data URI を使い回す
   ・サーバ側では何もしない（Audio も btoa も無いため） */

const RATE = 22050;

/** 音の種類と長さ（秒） */
const DUR: Record<string, number> = {
  hammer: 0.3,   // 単管を叩く
  place: 0.24,   // 材料を置く
  combo: 0.3,    // コンボが伸びた
  buzz: 0.2,     // 違う
  shout: 0.72,   // 親方の怒鳴り声
  tick: 0.05,    // 押した
  chime: 0.6,    // ひと区切り
  ok: 0.35,      // 場面が片付いた
  step: 0.12,    // 足音
  fanfare: 0.78, // 章の終わり
};

export type SfxKey = keyof typeof DUR;

const rnd = () => Math.random() * 2 - 1;
const sq = (x: number) => (Math.sin(x) >= 0 ? 1 : -1);

function gen(k: string, arg?: number): Float32Array {
  const n = Math.floor(RATE * (DUR[k] ?? 0.3));
  const o = new Float32Array(n);
  const T = (i: number) => i / RATE;

  if (k === "hammer") {
    for (let i = 0; i < n; i++) {
      const t = T(i);
      o[i] = rnd() * Math.exp(-55 * t) * 0.55
        + Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-16 * t) * 0.2
        + Math.sin(2 * Math.PI * 2840 * t) * Math.exp(-26 * t) * 0.09
        + Math.sin(2 * Math.PI * 180 * t) * Math.exp(-42 * t) * 0.3;
    }
  } else if (k === "place") {
    for (let i = 0; i < n; i++) {
      const t = T(i);
      o[i] = Math.sin(2 * Math.PI * (190 - 380 * t) * t) * Math.exp(-22 * t) * 0.45
        + rnd() * Math.exp(-75 * t) * 0.18;
    }
  } else if (k === "combo") {
    const s = Math.min(arg ?? 3, 12);
    const fs = [0, 4, 7].map((iv) => 440 * Math.pow(2, (s + iv) / 12));
    for (let i = 0; i < n; i++) {
      const t = T(i);
      let v = 0;
      fs.forEach((f, j) => {
        const st = j * 0.06;
        if (t > st) { const u = t - st; v += sq(2 * Math.PI * f * u) * Math.exp(-24 * u) * 0.07; }
      });
      o[i] = v;
    }
  } else if (k === "buzz") {
    for (let i = 0; i < n; i++) {
      const t = T(i);
      o[i] = sq(2 * Math.PI * (190 - 180 * t) * t) * Math.exp(-13 * t) * 0.14;
    }
  } else if (k === "shout") {
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = T(i);
      const f = 150 - 55 * t + 32 * Math.sin(2 * Math.PI * 24 * t);
      let v = ((t * f) % 1) * 2 - 1;
      v = v * 0.82 + rnd() * 0.22;
      lp += (v - lp) * 0.24;
      const e = t < 0.03 ? t / 0.03
        : t < 0.16 ? 1 - (t - 0.03) * 4.2
          : t < 0.22 ? 0.45 + (t - 0.16) * 9
            : Math.max(0, 1 - (t - 0.22) / 0.44);
      o[i] = lp * e * 0.55;
    }
  } else if (k === "tick") {
    for (let i = 0; i < n; i++) o[i] = rnd() * Math.exp(-260 * T(i)) * 0.45;
  } else if (k === "step") {
    for (let i = 0; i < n; i++) o[i] = rnd() * Math.exp(-90 * T(i)) * 0.3;
  } else if (k === "ok") {
    for (let i = 0; i < n; i++) {
      const t = T(i);
      let v = 0;
      [880, 1320].forEach((fq, j) => {
        const st = j * 0.07;
        if (t > st) v += Math.sin(2 * Math.PI * fq * (t - st)) * Math.exp(-7 * (t - st)) * 0.12;
      });
      o[i] = v;
    }
  } else if (k === "chime") {
    const fs = [880, 1320, 1760];
    for (let i = 0; i < n; i++) {
      const t = T(i);
      let v = 0;
      fs.forEach((f, j) => {
        const st = j * 0.07;
        if (t > st) { const u = t - st; v += Math.sin(2 * Math.PI * f * u) * Math.exp(-6 * u) * 0.13; }
      });
      o[i] = v;
    }
  } else if (k === "fanfare") {
    const fs = [523, 659, 784, 1047];
    for (let i = 0; i < n; i++) {
      const t = T(i);
      let v = 0;
      fs.forEach((f, j) => {
        const st = j * 0.12;
        if (t > st) {
          const u = t - st;
          v += Math.sin(2 * Math.PI * f * u) * Math.exp(-5 * u) * 0.12
            + Math.sin(4 * Math.PI * f * u) * Math.exp(-9 * u) * 0.04;
        }
      });
      o[i] = v;
    }
  }
  return o;
}

/** Float32Array → 16bit モノラルWAV の data URI */
function wav(f: Float32Array): string {
  const n = f.length;
  const b = new ArrayBuffer(44 + n * 2);
  const v = new DataView(b);
  const W = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  W(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); W(8, "WAVEfmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  W(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const u = new Uint8Array(b);
  let str = "";
  const CH = 0x2000;
  for (let i = 0; i < u.length; i += CH) {
    str += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + CH)));
  }
  return "data:audio/wav;base64," + btoa(str);
}

const KEY = "ashiba.sound";
const cache: Record<string, string> = {};
let on = true;

/** 現場で使う。既定は音あり。前回の切り替えを覚えておく */
function load() {
  if (typeof window === "undefined") return;
  try {
    const v = window.localStorage.getItem(KEY);
    if (v !== null) on = v === "1";
  } catch {
    /* プライベートモードなどで読めないときは既定のまま */
  }
}
let loaded = false;

function uri(k: string, arg?: number): string {
  const key = k + (arg ?? "");
  return cache[key] ?? (cache[key] = wav(gen(k, arg)));
}

function play(k: SfxKey, arg?: number) {
  if (typeof window === "undefined") return;
  if (!loaded) { load(); loaded = true; }
  if (!on) return;
  try {
    const a = new Audio(uri(k, arg));
    a.volume = 0.6;
    void a.play().catch(() => {
      /* 画面を触る前は端末が鳴らさない。触れば鳴る */
    });
  } catch {
    /* 音が出せない端末でも進行は止めない */
  }
}

export const SFX = {
  hammer: () => play("hammer"),
  /** ch2・ch3のプロトタイプでの呼び名 */
  ham: () => play("hammer"),
  place: () => play("place"),
  combo: (n?: number) => play("combo", n),
  buzz: () => play("buzz"),
  shout: () => play("shout"),
  tick: () => play("tick"),
  step: () => play("step"),
  ok: () => play("ok"),
  chime: () => play("chime"),
  fanfare: () => play("fanfare"),

  /** 先に作っておく。初回のもたつきが無くなる */
  warm: () => {
    if (typeof window === "undefined") return;
    try {
      (["hammer", "place", "buzz", "shout", "tick", "step", "ok"] as SfxKey[]).forEach((k) => uri(k));
    } catch {
      /* 作れなくても鳴らすときに作り直す */
    }
  },
  /** 端末の音を開ける。画面を最初に触ったときに呼ぶ */
  unlock: () => { SFX.warm(); play("tick"); },

  isOn: () => {
    if (!loaded) { load(); loaded = true; }
    return on;
  },
  setOn: (v: boolean) => {
    on = v;
    loaded = true;
    try {
      window.localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* 覚えられなくてもこの回は効く */
    }
  },
};
