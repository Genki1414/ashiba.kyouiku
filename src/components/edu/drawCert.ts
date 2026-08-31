"use client";

import type { CertData } from "@/lib/cert";

/* 修了証を1枚の絵にする。名刺サイズ（91mm × 55mm）。

   財布や免許証入れに入る大きさにしてある。
   現場に持って行くものなので、A4では持ち歩けない。

   ── 載せないもの ──
   科目と時間、合計、受講方法、修了試験の点数。
   名刺サイズに全部は入らないし、カード型の修了証には普通載っていない。
   受講の記録（どの単元を何分見て、試験が何点だったか）は
   こちらのデータベースに3年残るので、求められれば出せる。

   ── 事業者印 ──
   public/seal.png があれば、それを刷り込む。
   無ければ社名から角印を描く（drawKakuin）。
   枠だけ出して手で押させると、1枚ずつ押すことになる。

   拡張子は問わない（png / jpg / jpeg / webp を順に探す）。
   手元の印の画像が png とは限らないので、変換させないため。
   ただし iPhone の HEIC は、ブラウザによって出ないので不可。 */

const JP = '"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif';

/** 朱肉の色。印と事業者名で同じ色を使う */
const SEAL_RED = "#B03A2E";

/* 名刺サイズ 91mm × 55mm を 300dpi で。
   刷ることを考えて300dpi。画面で見るぶんには大きすぎるくらいでちょうどいい */
export const CARD_MM = { w: 91, h: 55 } as const;
export const DPI = 300;
const px = (mm: number) => Math.round((mm / 25.4) * DPI);

export const CERT_W = px(CARD_MM.w); // 1075
export const CERT_H = px(CARD_MM.h); // 650

/* 科目の数で大きさが変わらなくなった（科目を載せないので）。
   古い呼び出しのために残してある */
export const CERT_MIN_H = CERT_H;
export const certHeight = (): number => CERT_H;

/** 事業者印の画像。置いてあれば刷り込む。
    拡張子を揃えさせない。手元にある形のまま public に置けばよい */
export const SEAL_SRCS = ["/seal.png", "/seal.jpg", "/seal.jpeg", "/seal.webp"] as const;

/** 古い呼び出しのために残してある */
export const SEAL_SRC = SEAL_SRCS[0];

/* 印の画像は読み込みに時間がかかる。1度読んだら覚えておく。
   読めなければ null のまま（枠だけ出す） */
let sealImg: HTMLImageElement | null = null;
/* 紙を抜いたあとの絵。1度作ったら使い回す */
let sealArt: HTMLCanvasElement | null = null;
let sealTried = false;

/* 1つ読んでみる。読めなければ false。次の拡張子へ進むため、ここでは覚えない */
const tryOne = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((done) => {
    const img = new Image();
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = src;
  });

/** 印の画像を先に読んでおく。読めたら true。

    候補を順に当たる。置いていない拡張子は 404 になるが、
    画面には出ないし、1度で終わる（読めても読めなくても sealTried が立つ）。 */
export async function loadSeal(
  src?: string | readonly string[],
): Promise<boolean> {
  if (sealTried) return !!sealImg;
  if (typeof window === "undefined") return false;
  const list = src === undefined ? SEAL_SRCS : typeof src === "string" ? [src] : src;
  for (const one of list) {
    const img = await tryOne(one);
    if (img) {
      sealImg = img;
      sealArt = null;
      sealTried = true;
      return true;
    }
  }
  sealTried = true;
  return false;
}

/** 試験から差し替えるための入口 */
export function setSeal(img: HTMLImageElement | null): void {
  sealImg = img;
  sealArt = null;
  sealTried = true;
}

/* 印の画像から紙を抜く。

   写真やスキャンで撮った印は、白い紙の上に朱色が乗っている。
   そのまま貼ると、生成りの台紙（#F7F4EC）の上に白い四角が出る。
   朱肉の印に白いインクは無いので、白い所は紙だと見なして抜いてよい。

   すでに透過を持っている画像（自分で背景を抜いた png）は、
   作った人の意図なので触らない。 */

/** 透過を持っているか。1画素でも透けていれば、抜く作業はしない */
function hasAlpha(d: Uint8ClampedArray): boolean {
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

/** 紙の明るさを見積もる。真っ白とは限らない（影・黄ばみ）ので、
    明るいほうから1割の所を「紙」とみなす */
function paperLevel(d: Uint8ClampedArray): number {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    hist[Math.round((d[i] + d[i + 1] + d[i + 2]) / 3)]++;
    n++;
  }
  let seen = 0;
  for (let v = 255; v >= 0; v--) {
    seen += hist[v];
    if (seen >= n * 0.1) return v;
  }
  return 255;
}

function knockOutPaper(img: HTMLImageElement): HTMLCanvasElement | null {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  let px: ImageData;
  try {
    px = ctx.getImageData(0, 0, w, h);
  } catch {
    /* よそのドメインの画像だと読めない。そのときは元のまま使う */
    return null;
  }
  const d = px.data;
  if (hasAlpha(d)) return null;

  /* 紙より少し暗い所から下を、だんだん残す。
     境目をきっぱり切ると、輪郭がぎざぎざになる */
  const paper = paperLevel(d);
  const keepBelow = paper * 0.72;
  const span = Math.max(1, paper - keepBelow);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const lum = (r + g + b) / 3;
    /* 色が付いていれば（朱色）、明るくても印。無彩色だけを紙とみなす */
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat > 40) continue;
    if (lum >= paper) d[i + 3] = 0;
    else if (lum > keepBelow) d[i + 3] = Math.round(255 * (1 - (lum - keepBelow) / span));
  }
  ctx.putImageData(px, 0, 0);
  return cv;
}

/** 枠に収まるまで字を小さくする。長い講座名で紙からはみ出さないため */
function fit(
  ctx: CanvasRenderingContext2D,
  text: string,
  max: number,
  from: number,
  min: number,
  weight = 700,
): number {
  let size = from;
  ctx.font = `${weight} ${size}px ${JP}`;
  while (size > min && ctx.measureText(text).width > max) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${JP}`;
  }
  return size;
}

/* 社名から角印を描く。

   印の画像を置いていないときの代わり。枠と「事業者印」だけを出していたが、
   それだと誰が出した紙か分からない。角印は社名が彫ってあるものなので、
   社名をそのまま彫る。

   縦書きで、右の列から左へ。印はそう読む。
   列の数は字数から決める。10字を2列にすると縦に細長くなって印に見えない。 */
export function drawKakuin(
  ctx: CanvasRenderingContext2D,
  company: string,
  x: number,
  y: number,
  size: number,
): void {
  /* 空白は彫らない。字数がずれて列が崩れる */
  const chars = [...company.replace(/[\s\u3000]/g, "")];
  if (!chars.length) return;

  const edge = Math.max(3, Math.round(size * 0.035));
  ctx.strokeStyle = SEAL_RED;
  ctx.lineWidth = edge;
  ctx.strokeRect(x + edge / 2, y + edge / 2, size - edge, size - edge);

  /* 正方形に近い並びにする。列数と行数が離れるほど印から遠ざかる */
  const cols = Math.min(4, Math.max(2, Math.round(Math.sqrt(chars.length))));
  const rows = Math.ceil(chars.length / cols);

  const pad = edge * 2;
  const inner = size - pad * 2;
  const cw = inner / cols;
  const ch = inner / rows;
  /* 字は枠いっぱいに。印は字が詰まっているほうがそれらしい */
  const fs = Math.floor(Math.min(cw, ch) * 0.94);

  ctx.fillStyle = SEAL_RED;
  ctx.font = `700 ${fs}px ${JP}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  chars.forEach((ch1, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    /* 右の列から。col が増えるほど左へ */
    const cx = x + size - pad - (col + 0.5) * cw;
    const cy = y + pad + (row + 0.5) * ch;
    ctx.fillText(ch1, cx, cy);
  });
  /* 触ったものは戻す。この後の行が縦にずれる */
  ctx.textBaseline = "alphabetic";
}

export function drawCert(cv: HTMLCanvasElement, c: CertData) {
  const W = CERT_W;
  const H = CERT_H;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  cv.width = W;
  cv.height = H;

  /* 紙と枠 */
  ctx.fillStyle = "#F7F4EC";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#1A1D21";
  ctx.lineWidth = 5;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.strokeStyle = "#C8B26A";
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, W - 52, H - 52);

  const L = 62;
  const R = W - 62;

  /* 表題 */
  ctx.fillStyle = "#1A1D21";
  ctx.textAlign = "center";
  ctx.font = `500 20px ${JP}`;
  ctx.fillText(c.certTitle || "特 別 教 育 修 了 証", W / 2, 74);

  /* 講座の正式名称。長い名前でも枠に収まるよう縮める */
  const title = c.courseName || "特別教育";
  fit(ctx, title, W - 150, 34, 18);
  ctx.fillText(title, W / 2, 116);

  ctx.strokeStyle = "#1A1D21";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(L, 136);
  ctx.lineTo(R, 136);
  ctx.stroke();

  /* 受講者。氏名だけ大きく */
  ctx.textAlign = "left";
  ctx.font = `400 17px ${JP}`;
  ctx.fillStyle = "#5A5A55";
  ctx.fillText("氏　名", L, 196);
  const name = c.name || "（　　　　　）";
  fit(ctx, name, R - (L + 110) - 40, 40, 22);
  ctx.fillStyle = "#1A1D21";
  ctx.fillText(name, L + 110, 200);

  const line = (k: string, v: string, y: number) => {
    ctx.font = `400 17px ${JP}`;
    ctx.fillStyle = "#5A5A55";
    ctx.fillText(k, L, y);
    ctx.font = `500 20px ${JP}`;
    ctx.fillStyle = "#1A1D21";
    ctx.fillText(v || "（　　　　　）", L + 110, y);
  };
  line("生年月日", c.birth, 246);
  line("修 了 日", c.date, 284);
  line("証明番号", c.certNo, 322);

  /* 根拠。決め打ちにすると、号の違う教育で嘘の紙が出る。
     「／」で区切って書いてあるので、紙では「及び」に直す */
  const basis = (c.courseBasis || "労働安全衛生法第59条第3項／労働安全衛生規則第36条第39号")
    .replace(/／/g, "及び");
  ctx.fillStyle = "#1A1D21";
  const b1 = `上記の者は、${basis}に基づく`;
  fit(ctx, b1, R - L, 17, 12, 400);
  ctx.fillText(b1, L, 386);
  const b2 = c.certLine || "特別教育を修了したことを証する。";
  fit(ctx, b2, R - L, 17, 12, 400);
  ctx.fillText(b2, L, 414);

  /* 発行名義。印は右下。名義の行はその左で終わらせる（重ならないように） */
  const sealSize = 118;
  const sealX = R - sealSize;
  const sealY = H - 62 - sealSize;

  if (sealImg) {
    /* 白い紙を抜いてから貼る。1度だけやって覚えておく */
    if (!sealArt) sealArt = knockOutPaper(sealImg);
    const art: CanvasImageSource = sealArt ?? sealImg;
    const iw = sealArt ? sealArt.width : sealImg.naturalWidth || sealImg.width;
    const ih = sealArt ? sealArt.height : sealImg.naturalHeight || sealImg.height;
    /* 画像は正方形に収める。縦横比が違っても潰さない */
    const s = Math.min(sealSize / iw, sealSize / ih);
    const w = iw * s;
    const h = ih * s;
    ctx.drawImage(art, sealX + (sealSize - w) / 2, sealY + (sealSize - h) / 2, w, h);
  } else {
    /* 画像が無いときは、社名から角印を描く */
    drawKakuin(ctx, c.company || "事業者印", sealX, sealY, sealSize);
  }

  ctx.textAlign = "right";
  const nameRight = sealX - 22;

  /* 事業者名は朱色。すぐ右の印と揃えて、誰が出した紙かを一目で分からせる。
     見出し（「事業者名」）は朱色にしない。朱いのは名前だけにする。

     見出しと名前で色が違うので、1つの文字列では描けない。
     大きさは見出しごと入れて決める（名前だけで測ると、
     長い社名のときに見出しが枠から出る）。 */
  const coLabel = "事業者名　";
  const coName = c.company || "（　　　　　　　）";
  const coSize = fit(ctx, coLabel + coName, nameRight - L, 19, 13, 400);
  ctx.font = `400 ${coSize}px ${JP}`;
  ctx.fillStyle = SEAL_RED;
  ctx.fillText(coName, nameRight, sealY + 46);
  /* 見出しは名前の左に置く。右揃えなので、名前のぶんだけ左へ寄せる */
  ctx.fillStyle = "#5A5A55";
  ctx.fillText(coLabel, nameRight - ctx.measureText(coName).width, sealY + 46);

  ctx.fillStyle = "#1A1D21";
  const re = `教育実施責任者　${c.responsible || "（　　　　　　　）"}`;
  fit(ctx, re, nameRight - L, 19, 13, 400);
  ctx.fillText(re, nameRight, sealY + 86);
}

/* 開発中だけ、この関数を窓口に出しておく。
   様式を目で確かめる試験（tests/e2e-cert.mjs）から呼ぶため。
   本番の組み立てでは消える。 */
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  const w = window as unknown as {
    __drawCert?: typeof drawCert;
    __loadSeal?: typeof loadSeal;
    __setSeal?: typeof setSeal;
  };
  w.__drawCert = drawCert;
  w.__loadSeal = loadSeal;
  w.__setSeal = setSeal;
}
