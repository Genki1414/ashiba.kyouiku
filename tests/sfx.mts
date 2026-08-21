/* 効果音のテスト。波形を作って、WAVとして正しい形になっているかを見る。
   ブラウザが無いので Audio と btoa と localStorage を用意してから読み込む。
   実行: npm run test:sfx */

type PlayedAudio = { src: string; volume: number };
const played: PlayedAudio[] = [];

/* ブラウザの代わり */
class FakeAudio {
  src: string;
  volume = 1;
  constructor(src: string) {
    this.src = src;
  }
  play() {
    played.push({ src: this.src, volume: this.volume });
    return Promise.resolve();
  }
}
const store = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.Audio = FakeAudio;
g.window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
};
if (typeof g.btoa !== "function") {
  g.btoa = (s: string) => Buffer.from(s, "binary").toString("base64");
}

const { SFX } = await import("../src/lib/sfx");

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else {
    ng++;
    console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`);
  }
};

/* ── 鳴らすと data URI の <audio> ができる ── */
SFX.hammer();
check(played.length === 1, "叩く音が鳴る");
check(played[0].src.startsWith("data:audio/wav;base64,"), "WAVのdata URIになっている");
check(played[0].volume === 0.6, "音量は0.6");

/* ── 中身がWAVとして読める ── */
const decode = (uri: string) => Buffer.from(uri.split(",")[1], "base64");
const buf = decode(played[0].src);
check(buf.subarray(0, 4).toString() === "RIFF", "RIFFヘッダがある");
check(buf.subarray(8, 12).toString() === "WAVE", "WAVE形式");
check(buf.readUInt16LE(22) === 1, "モノラル");
check(buf.readUInt32LE(24) === 22050, "22050Hz");
check(buf.readUInt16LE(34) === 16, "16bit");
const dataLen = buf.readUInt32LE(40);
check(buf.length === 44 + dataLen, `長さが宣言と合う（${buf.length} = 44 + ${dataLen}）`);
/* 0.3秒 × 22050Hz × 2byte */
check(dataLen === Math.floor(22050 * 0.3) * 2, "叩く音は0.3秒");

/* 無音ではない */
let peak = 0;
for (let i = 44; i < buf.length; i += 2) peak = Math.max(peak, Math.abs(buf.readInt16LE(i)));
check(peak > 3000, `音が入っている（山 ${peak}）`);

/* ── 音の種類ごとに長さが違う ── */
played.length = 0;
SFX.shout();
const shout = decode(played[0].src);
check(shout.readUInt32LE(40) === Math.floor(22050 * 0.72) * 2, "怒鳴り声は0.72秒");
played.length = 0;
SFX.tick();
check(decode(played[0].src).readUInt32LE(40) === Math.floor(22050 * 0.05) * 2, "押した音は0.05秒");

/* ── コンボは段が上がるほど高くなる（別の波形になる） ── */
played.length = 0;
SFX.combo(3);
const c3 = played[0].src;
played.length = 0;
SFX.combo(9);
check(played[0].src !== c3, "コンボの音は段で変わる");

/* ── 同じ音は作り直さない ── */
played.length = 0;
SFX.hammer();
const a = played[0].src;
played.length = 0;
SFX.hammer();
check(played[0].src === a, "二度目は作り直さず同じものを使う");

/* ── 音を切ると鳴らない。覚えておく ── */
played.length = 0;
SFX.setOn(false);
SFX.hammer();
SFX.shout();
check(played.length === 0, "音を切ると鳴らない");
check(store.get("ashiba.sound") === "0", "切ったことを覚えている");
check(SFX.isOn() === false, "切れている");
SFX.setOn(true);
SFX.hammer();
check(played.length === 1, "戻すと鳴る");
check(store.get("ashiba.sound") === "1", "入れたことを覚えている");

console.log("── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
