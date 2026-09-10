import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UpdateNotice } from "@/components/UpdateNotice";
import { BottomNav } from "@/components/BottomNav";
import { AppCode } from "@/components/AppCode";
import { ServiceWorker } from "@/components/ServiceWorker";
import { LATEST } from "@/content/changelog";
import { BRAND } from "@/content/brand";

export const metadata: Metadata = {
  title: BRAND.title,
  description: BRAND.metaDescription,
  manifest: "/manifest.webmanifest",
  applicationName: BRAND.name,
  appleWebApp: {
    capable: true,
    /* ホーム画面のアイコンの下に出る名前。長いと途中で切れる */
    title: BRAND.shortName,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14171B",
  /* ── 画面のふちまで使う（2026-09-10）──
     げんきさん「下部タブが小さくてiPhoneのバーと被って変な挙動する」。

     下の札には env(safe-area-inset-bottom) で余白を取っていたが、
     **これを付けないと env は 0 になる。**iPhone のホーム画面から
     開いたとき（アプリ表示）は、下の横棒のぶんが誰にも取られないまま
     札の字と重なっていた。

     ふちまで使うと、上も status bar の下に潜るので、
     globals.css の body で上のぶんも取り返す。**両方を必ず組で持つ** */
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      {/* いま出ているのがどの更新かが分かるように印を付けておく */}
      <body data-app-version={LATEST}>
        {/* スマホ基準の1カラム。広い画面でも中央に絞る */}
        <div className="shell mx-auto min-h-dvh max-w-md bg-bg">
          {children}
          {/* いつも下に出ている行き先。受講の邪魔になる画面では出ない */}
          <BottomNav />
          <AppCode />
        </div>
        {/* 直したところ・足したところを、開いたときに知らせる */}
        <UpdateNotice />
        {/* 圏外でも、一度開いた画面は開けるようにする */}
        <ServiceWorker />
      </body>
    </html>
  );
}
