"use client";

/* クーポンを1枚の絵にする（2026-09-10）。

   げんきさん「クーポン画像作成機能付けて欲しい」。

   何に使うか。紹介してくれる団体さんや取引先に、LINE やメールで渡す。
   相手はそれをそのまま会員に流す。だから**字だけ**では足りない。
   「どこの・何が・いくら引きで・いつまで」が、1枚で分かる形が要る。

   ── 大きさ ──
   1200 × 630。LINE・X・Facebook に貼ったとき、切られずに出る形。
   紙に刷るためのものではないので、修了証（300dpi・名刺サイズ）とは別。

   ── 載せないもの ──
   ・広告費の率と支払先　… こちらの取り分。**相手に見せるものではない**
   ・利用回数の上限　　　… 「あと何枚」と煽る作りにしない。
                           上限に当たったら、その場で断る（0032）
   載せると、渡した相手が読める。ここは**外に出る絵**だと決めておく。

   ── 期限 ──
   期限があれば必ず出す。無ければ「期限なし」と書く。
   空欄にすると、受け取った人が「切れているのでは」と問い合わせてくる。 */

const JP = '"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif';

/** 貼ったときに切られない形（1.91:1） */
export const COUPON_W = 1200;
export const COUPON_H = 630;

export type CouponArt = {
  /** クーポンのコード。いちばん大きく出す */
  code: string;
  /** クーポンの名前。何のクーポンか */
  name: string;
  /** 「10%引き」「3,000円引き」など、できあがった字 */
  off: string;
  /** 期限。無ければ空 */
  expires: string;
  /** 店の名前 */
  brand: string;
  /** 店の住所（kyouiku.ashibase.jp など）。入れる所を伝える */
  site: string;
};

/* 画面と同じ色。別々に持つと、画面を直したときに絵だけ古い色で残る */
const C = {
  bg: "#14171B",
  panel: "#1E232A",
  line: "#2E3640",
  yel: "#F5D400",
  txt: "#E9EEF3",
  dim: "#8D98A4",
} as const;

/** 角の丸い四角 */
function round(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* 入りきらない字を、点々で詰める。
   **消さずに縮めない。**長い名前を小さくしていくと、
   1枚だけ極端に小さい絵ができて、並べたときに揃わない */
function fit(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && g.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

/** クーポンを描く。canvas の大きさも、ここで決める */
export function drawCoupon(canvas: HTMLCanvasElement, c: CouponArt): void {
  canvas.width = COUPON_W;
  canvas.height = COUPON_H;
  const g = canvas.getContext("2d");
  if (!g) return;

  /* 地 */
  g.fillStyle = C.bg;
  g.fillRect(0, 0, COUPON_W, COUPON_H);

  /* 上下の縞。現場の立入禁止テープと同じ意匠（画面と揃える） */
  const tape = (y: number) => {
    g.save();
    g.beginPath();
    g.rect(0, y, COUPON_W, 14);
    g.clip();
    g.fillStyle = C.yel;
    g.fillRect(0, y, COUPON_W, 14);
    g.strokeStyle = C.bg;
    g.lineWidth = 12;
    for (let x = -40; x < COUPON_W + 40; x += 34) {
      g.beginPath();
      g.moveTo(x, y + 18);
      g.lineTo(x + 22, y - 4);
      g.stroke();
    }
    g.restore();
  };
  tape(0);
  tape(COUPON_H - 14);

  /* 中の板 */
  const pad = 56;
  const boxY = 62;
  const boxH = COUPON_H - 62 - 62;
  g.fillStyle = C.panel;
  round(g, pad, boxY, COUPON_W - pad * 2, boxH, 28);
  g.fill();
  g.strokeStyle = C.line;
  g.lineWidth = 2;
  g.stroke();

  const left = pad + 48;
  const right = COUPON_W - pad - 48;
  const inner = right - left;

  /* 店の名前 */
  g.textBaseline = "alphabetic";
  g.fillStyle = C.dim;
  g.font = `bold 26px ${JP}`;
  g.fillText(fit(g, c.brand, inner), left, boxY + 66);

  /* 値引き。**いちばん先に目に入るもの** */
  g.fillStyle = C.yel;
  g.font = `900 92px ${JP}`;
  g.fillText(fit(g, c.off, inner), left, boxY + 176);

  /* クーポンの名前 */
  g.fillStyle = C.txt;
  g.font = `bold 34px ${JP}`;
  g.fillText(fit(g, c.name, inner), left, boxY + 234);

  /* コード。枠で囲って、打ち写す所だと分かるようにする */
  const codeY = boxY + 268;
  const codeH = 104;
  g.fillStyle = C.bg;
  round(g, left, codeY, inner, codeH, 16);
  g.fill();
  g.strokeStyle = C.yel;
  g.lineWidth = 3;
  g.stroke();

  g.fillStyle = C.dim;
  g.font = `bold 22px ${JP}`;
  g.fillText("クーポンコード", left + 26, codeY + 38);

  g.fillStyle = C.yel;
  g.font = `900 56px ui-monospace,"SFMono-Regular",Menlo,monospace`;
  g.fillText(fit(g, c.code, inner - 52), left + 26, codeY + 86);

  /* 期限と、入れる場所 */
  g.fillStyle = C.dim;
  g.font = `24px ${JP}`;
  const foot = codeY + codeH + 44;
  g.fillText(c.expires ? `${c.expires} まで` : "期限なし", left, foot);

  g.textAlign = "right";
  g.fillText(fit(g, c.site, inner * 0.6), right, foot);
  g.textAlign = "left";

  g.fillStyle = C.dim;
  g.font = `20px ${JP}`;
  g.fillText("お申込みの画面で、このコードを入れてください。", left, foot + 34);
}

/** 保存するときの名前。記号は入れない（端末によっては保存できない） */
export function couponFileName(code: string, brand: string): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "");
  return `${safe(brand)}_クーポン_${safe(code)}.png`;
}
