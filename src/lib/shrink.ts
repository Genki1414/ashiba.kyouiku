/* 実技の実施記録の写真を、端末の中で縮めてから送る。

   なぜ要るか
     現場で撮った写真は、そのままだと3〜8MB ある。
     人数分・枚数分が積み上がると、置き場所も、送る回線も持たない。
     **A4の紙に書いた字が読めればよい**ので、長辺2000ピクセルまで落とす。
     それでも1件 400KB 前後で、書いた字は読める。

   PDF は触らない。中で圧縮されているので、開いて縮め直す意味がない。

   端末の中でやる（サーバへ大きいまま送らない）。
   canvas が使えない・読めない形のときは、縮めずにそのまま返す。
   そのぶん大きさの上限で弾かれるが、**黙って壊すよりはよい。** */

/** 長辺の上限。A4に書いた字が読める大きさ */
export const MAX_EDGE = 2000;
/** 1件の上限（バイト）。data URL にする前の、元の大きさで見る */
export const MAX_FILE = 5 * 1024 * 1024;
/** 合計の上限（バイト） */
export const MAX_TOTAL = 10 * 1024 * 1024;
/** 添えられる数 */
export const MAX_FILES = 3;

/** 受け取る形。iPhone の HEIC は、多くの場合ブラウザが JPEG にして渡してくる */
export const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export type Shrunk = { name: string; mime: string; data: string; bytes: number };

const ok = (t: string) =>
  t === "application/pdf" || t === "image/jpeg" || t === "image/png" || t === "image/webp";

const readAsDataUrl = (f: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result ?? ""));
    r.onerror = () => rej(new Error("読めませんでした"));
    r.readAsDataURL(f);
  });

/** 画像を長辺 MAX_EDGE まで縮めて JPEG にする。できなければ null */
async function shrinkImage(file: File): Promise<{ data: string; mime: string } | null> {
  if (typeof document === "undefined") return null;
  let url = "";
  try {
    url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("画像として読めませんでした"));
      im.src = url;
    });
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    /* もともと小さい写真は、いじらない。
       拡大すると、字がにじむだけで大きさは増える */
    const k = long > MAX_EDGE ? MAX_EDGE / long : 1;
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    /* 紙は白い。透けている形（PNG）を白で塗ってから描かないと、
       JPEG にしたときに黒くなる */
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = cv.toDataURL("image/jpeg", 0.82);
    return data.startsWith("data:image/jpeg") ? { data, mime: "image/jpeg" } : null;
  } catch {
    return null;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

/** 1件を、送れる形にする。だめなときは理由を返す */
export async function prepareFile(file: File): Promise<Shrunk | { error: string }> {
  const mime = (file.type || "").toLowerCase();
  if (!ok(mime)) {
    return { error: `${file.name}：写真（JPEG・PNG）かPDFにしてください。` };
  }
  if (mime !== "application/pdf") {
    const s = await shrinkImage(file);
    if (s) {
      return { name: file.name, mime: s.mime, data: s.data, bytes: s.data.length };
    }
    /* 縮められなかった。大きさで弾かれるかもしれないが、そのまま送る */
  }
  if (file.size > MAX_FILE) {
    return { error: `${file.name}：1件 5MB までです。撮り直すか、PDFを分けてください。` };
  }
  const data = await readAsDataUrl(file);
  return { name: file.name, mime, data, bytes: data.length };
}

/** 選ばれた分を、まとめて整える。1件でもだめなら、そこで止める */
export async function prepareFiles(
  files: File[],
): Promise<{ ok: true; files: Shrunk[] } | { ok: false; reason: string }> {
  if (files.length === 0) return { ok: false, reason: "実施記録を選んでください。" };
  if (files.length > MAX_FILES) {
    return { ok: false, reason: `実施記録は${MAX_FILES}件までです。` };
  }
  const out: Shrunk[] = [];
  for (const f of files) {
    const r = await prepareFile(f);
    if ("error" in r) return { ok: false, reason: r.error };
    out.push(r);
  }
  const total = out.reduce((n, f) => n + f.bytes, 0);
  /* data URL は元より3割ほど大きくなる。上限もそのぶん見ておく */
  if (total > MAX_TOTAL * 1.4) {
    return { ok: false, reason: "実施記録が大きすぎます。枚数を減らすか、撮り直してください。" };
  }
  return { ok: true, files: out };
}

/** 画面に出す大きさ。「1.2MB」 */
export const sizeText = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
