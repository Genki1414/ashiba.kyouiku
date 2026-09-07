import type { MetadataRoute } from "next";
import { BRAND } from "@/content/brand";

/* ホーム画面に追加したときの名前とアイコン。/manifest.webmanifest に出る。

   前は public/manifest.webmanifest に置いた文字そのものだった。
   店が二つになったので、名前と入口だけ店ごとに変える
   （src/content/brand.ts）。アイコンと色は同じ。

   住所は全部 "/" 始まりにしておく。絶対URLを書くと、
   ドメインを増やしたときに直しきれない（特別教育ドットコムで実際に増えた）。 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.manifestName,
    short_name: BRAND.shortName,
    description: BRAND.description,
    lang: "ja",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#14171B",
    theme_color: "#14171B",
    categories: ["education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    /* 長押しで出る近道。実務トレーニングは足場屋さんの店にだけ */
    shortcuts: [
      ...(BRAND.training ? [{ name: "実務トレーニング", url: "/training" }] : []),
      { name: "特別教育（学科）", url: "/edu" },
    ],
  };
}
