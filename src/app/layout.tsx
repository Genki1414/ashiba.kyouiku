import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UpdateNotice } from "@/components/UpdateNotice";
import { LATEST } from "@/content/changelog";

export const metadata: Metadata = {
  title: "足場の特別教育",
  description: "足場の組立て等の業務に係る特別教育（学科6時間）",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14171B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      {/* いま出ているのがどの更新かが分かるように印を付けておく */}
      <body data-app-version={LATEST}>
        {/* スマホ基準の1カラム。広い画面でも中央に絞る */}
        <div className="mx-auto min-h-dvh max-w-md bg-bg">{children}</div>
        {/* 直したところ・足したところを、開いたときに知らせる */}
        <UpdateNotice />
      </body>
    </html>
  );
}
