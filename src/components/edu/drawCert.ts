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
   無ければ朱色の枠だけ出して、手で押せるようにする。 */

const JP = '"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif';

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

/** 事業者印の画像。置いてあれば刷り込む */
export const SEAL_SRC = "/seal.png";

/* 印の画像は読み込みに時間がかかる。1度読んだら覚えておく。
   読めなければ null のまま（枠だけ出す） */
let sealImg: HTMLImageElement | null = null;
let sealTried = false;

/** 印の画像を先に読んでおく。読めたら true */
export function loadSeal(src: string = SEAL_SRC): Promise<boolean> {
  if (sealTried) return Promise.resolve(!!sealImg);
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      sealImg = img;
      sealTried = true;
      done(true);
    };
    img.onerror = () => {
      sealTried = true;
      done(false);
    };
    img.src = src;
  });
}

/** 試験から差し替えるための入口 */
export function setSeal(img: HTMLImageElement | null): void {
  sealImg = img;
  sealTried = true;
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
    /* 画像は正方形に収める。縦横比が違っても潰さない */
    const s = Math.min(sealSize / sealImg.width, sealSize / sealImg.height);
    const w = sealImg.width * s;
    const h = sealImg.height * s;
    ctx.drawImage(sealImg, sealX + (sealSize - w) / 2, sealY + (sealSize - h) / 2, w, h);
  } else {
    /* 画像が無いときは枠だけ。刷ってから手で押せる */
    ctx.strokeStyle = "#B03A2E";
    ctx.lineWidth = 3;
    ctx.strokeRect(sealX, sealY, sealSize, sealSize);
    ctx.fillStyle = "#B03A2E";
    ctx.font = `700 16px ${JP}`;
    ctx.textAlign = "center";
    ctx.fillText("事業者", sealX + sealSize / 2, sealY + sealSize / 2 - 6);
    ctx.fillText("印", sealX + sealSize / 2, sealY + sealSize / 2 + 22);
  }

  ctx.textAlign = "right";
  ctx.fillStyle = "#1A1D21";
  const nameRight = sealX - 22;
  const co = `事業者名　${c.company || "（　　　　　　　）"}`;
  fit(ctx, co, nameRight - L, 19, 13, 400);
  ctx.fillText(co, nameRight, sealY + 46);
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
