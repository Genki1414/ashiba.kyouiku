"use client";

import { totalLabel, type CertData } from "@/lib/cert";

/* 修了証を1枚の絵にする。
   プロトタイプ（handoff/ashiba-app-v16h.tsx の drawCert）の様式のまま。

   事業者名と教育実施責任者は、決まっていなければ空欄で出す。
   印を押す枠も入れてあるので、そのまま刷って手で書き入れられる。 */

const JP = '"Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif';
export const CERT_W = 1240;
/** いちばん短いときの高さ。科目が増えれば下へ伸びる */
export const CERT_MIN_H = 880;

/* 縦の位置は上から順に積み上げる。
   科目の数で中身の丈が変わるので、先に丈を測ってから紙の大きさを決める。
   （固定の高さにすると、科目名が長い年に下の署名欄と重なる） */
const TOP_TO_SUBJECTS = 272 + 62 + 48 * 3 + 8 + 34 + 34;
const AFTER_SUBJECTS = 4 + 46 + 30 + 44;
const SIGN_BLOCK = 30 + 92 + 46;

export function certHeight(subjectCount: number): number {
  const flow = TOP_TO_SUBJECTS + 30 * subjectCount + AFTER_SUBJECTS;
  return Math.max(CERT_MIN_H, flow + SIGN_BLOCK);
}

export function drawCert(cv: HTMLCanvasElement, c: CertData) {
  const W = CERT_W;
  const H = certHeight(c.subjects.length);
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  cv.width = W;
  cv.height = H;

  /* 紙と枠 */
  ctx.fillStyle = "#F7F4EC";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#1A1D21";
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.strokeStyle = "#C8B26A";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  /* 表題 */
  ctx.fillStyle = "#1A1D21";
  ctx.textAlign = "center";
  ctx.font = `500 22px ${JP}`;
  ctx.fillText("特 別 教 育 修 了 証", W / 2, 118);
  /* 表題は講座の正式名称。長い名前でも枠に収まるよう、はみ出す分だけ縮める */
  const title = c.courseName || "特別教育";
  let size = 40;
  ctx.font = `700 ${size}px ${JP}`;
  while (size > 22 && ctx.measureText(title).width > W - 200) {
    size -= 2;
    ctx.font = `700 ${size}px ${JP}`;
  }
  ctx.fillText(title, W / 2, 178);
  ctx.strokeStyle = "#1A1D21";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(150, 208);
  ctx.lineTo(W - 150, 208);
  ctx.stroke();

  /* 受講者 */
  ctx.textAlign = "left";
  const L = 150;
  let y = 272;
  const row = (k: string, v: string, big?: boolean) => {
    ctx.font = `400 20px ${JP}`;
    ctx.fillStyle = "#5A5A55";
    ctx.fillText(k, L, y);
    ctx.font = big ? `700 32px ${JP}` : `500 24px ${JP}`;
    ctx.fillStyle = "#1A1D21";
    ctx.fillText(v || "（　　　　　）", L + 200, y + (big ? 4 : 0));
    y += big ? 62 : 48;
  };
  row("氏　　名", c.name, true);
  row("生年月日", c.birth);
  row("修 了 日", c.date);
  row("証明番号", c.certNo);

  /* 科目と時間 */
  y += 8;
  ctx.strokeStyle = "#C8C2B4";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L, y);
  ctx.lineTo(W - L, y);
  ctx.stroke();
  y += 34;
  ctx.font = `400 19px ${JP}`;
  ctx.fillStyle = "#5A5A55";
  ctx.fillText("教育科目および時間", L, y);
  y += 34;
  for (const s of c.subjects) {
    ctx.font = `400 19px ${JP}`;
    ctx.fillStyle = "#1A1D21";
    ctx.fillText(`科目${s.id}　${s.name}`, L + 12, y);
    ctx.textAlign = "right";
    ctx.fillText(`${s.min}分`, W - L, y);
    ctx.textAlign = "left";
    y += 30;
  }
  ctx.font = `700 20px ${JP}`;
  ctx.fillText("合　計", L + 12, y + 4);
  ctx.textAlign = "right";
  ctx.fillText(totalLabel(c.subjects), W - L, y + 4);
  ctx.textAlign = "left";
  y += 46;

  /* 根拠 */
  ctx.font = `400 19px ${JP}`;
  ctx.fillStyle = "#1A1D21";
  ctx.fillText("上記の者は、労働安全衛生法第59条第3項及び労働安全衛生規則第36条第39号に基づく", L, y);
  y += 30;
  ctx.fillText("特別教育を修了したことを証する。", L, y);
  y += 44;

  ctx.font = `400 17px ${JP}`;
  ctx.fillStyle = "#5A5A55";
  ctx.fillText(
    `受講方法：個人受講（顔認証による本人確認・在席確認）　修了試験：${c.examScore}/${c.examTotal}問　合格`,
    L,
    y,
  );

  /* 発行名義。空なら手で書き入れる欄になる。
     印の枠は右端に置き、名義の行はその左で終わらせる（重ならないように） */
  const signTop = y + 30;
  ctx.strokeStyle = "#B03A2E";
  ctx.lineWidth = 3;
  ctx.strokeRect(W - 190, signTop, 92, 92);
  ctx.fillStyle = "#B03A2E";
  ctx.font = `700 17px ${JP}`;
  ctx.textAlign = "center";
  ctx.fillText("事業者", W - 144, signTop + 38);
  ctx.fillText("印", W - 144, signTop + 64);

  ctx.textAlign = "right";
  ctx.font = `400 20px ${JP}`;
  ctx.fillStyle = "#1A1D21";
  ctx.fillText(`事業者名　　${c.company || "（　　　　　　　）"}`, W - 210, signTop + 34);
  ctx.fillText(`教育実施責任者　　${c.responsible || "（　　　　　　　）"}`, W - 210, signTop + 76);
}

/* 開発中だけ、この関数を窓口に出しておく。
   様式を目で確かめる試験（tests/e2e-cert.mjs）から呼ぶため。
   本番の組み立てでは消える。 */
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __drawCert?: typeof drawCert }).__drawCert = drawCert;
}
