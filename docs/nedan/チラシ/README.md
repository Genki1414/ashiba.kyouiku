# チラシ（A4・両面）

`chirashi.html` が元（表 `#flyer`・裏 `#flyer2`）。`chirashi.pdf` が印刷用（A4・余白なし・2ページ）、
`chirashi-1.png`（表）・`chirashi-2.png`（裏）が LINE などに貼る画像（1588×2246）。
`qr-try.svg` は https://kyouiku.ashibase.jp/try の QR（npm の qrcode で作った）。

裏面の画面写真は `screens/` にある。手元の開発サーバを 390×844（3倍）で撮ったもの。
開発用の印（Next の「N」、「端末内記録」「＋1分（開発用）」）は撮る前に消してある。本番には出ない。
撮り直すときは、受講の準備を済ませた状態を localStorage（ashiba.prep:local）に入れてから開く
（tests/e2e-lesson.mjs と同じ）。

値段・連絡先は 2026-11-25 時点。値段を変えたら HTML を書き換えて撮り直す
（playwright-core で #flyer / #flyer2 を撮り、page.pdf で A4 に出す）。
