# Supabase につなぐ手順

プロジェクト `ashiba.kyouiku`（東京リージョン）を作成済みの前提です。
**SQL Editor に1回貼るだけ**で初期化が終わります。CLI もマイグレーションツールも要りません。

所要 5分ほど。

---

## 1. データベースを初期化する

1. Supabase の左メニューから **SQL Editor** を開く
2. リポジトリの **`supabase/apply-all.sql`** を全部コピーして貼り付ける
3. **Run**（⌘/Ctrl + Enter）

最後に次の表が出れば成功です。

| lessons | enrollments | dev_enrollment_id |
|---|---|---|
| 13 | 1 | 55555555-5555-5555-5555-555555555555 |

このSQLが作るもの：

- 9つのテーブル（`SPEC.md` 第3章のデータモデル）
- 行レベルセキュリティ（受講者は自分の行、教育担当者は自社の行だけ）
- 業務ルールを担保する関数とトリガ
  （視聴時間の頭打ち／規定時間前の合格拒否／未入金での修了証発行拒否）
- `lessons` 13件（単元の規定時間）
- 開発用の事業者・受講者・受講コード・受講が1組

**何度実行しても壊れません。** 作成済みのものは飛ばします。
教材を差し替えたときは `npm run build:sql` で作り直してから、また貼ってください。

---

## 2. 鍵を取って `.env.local` に書く

Supabase の **Project Settings → API Keys** から3つ取ります。

```sh
cp .env.example .env.local
```

`.env.local` を開いて埋めます。

```
NEXT_PUBLIC_SUPABASE_URL=https://sstgpgsnanowoaqxvcrj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=（anon public キー）
SUPABASE_SERVICE_ROLE_KEY=（service_role キー）
DEV_ENROLLMENT_ID=55555555-5555-5555-5555-555555555555
EXAM_SECRET=（適当な長い文字列。修了試験のトークン署名に使う）
```

`EXAM_SECRET` は次のように作れます。

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> **service_role キーは絶対に公開しない。** ブラウザには渡らず、
> サーバ側の API ルートだけが使います。`.env.local` は `.gitignore` 済みです。

---

## 3. つながったか確かめる

```sh
npm run dev
```

ブラウザで **http://localhost:3000/setup** を開きます。

- 「**接続できています**」→ 完了
- 「**初期化が未完了**」→ 手順1のSQLがまだ。もう一度貼って実行
- 「**未設定（端末内記録）**」→ `.env.local` が読まれていない。開発サーバを再起動

環境変数とデータベースのどこで止まっているかが画面に出ます。

---

## 4. 切り替わること

`.env.local` を置く前と後で、アプリの動きはこう変わります。

| | 未設定（端末内記録） | 設定後（サーバ記録） |
|---|---|---|
| 視聴時間 | ブラウザの localStorage | `progress` テーブル。加算量はサーバが実経過で頭打ち |
| 規定時間の判定 | 端末内の値で判定 | `mark_quiz_passed` が最終判定。未達なら 409 |
| 照合の失敗 | localStorage に控え | `verify_logs` テーブル |
| 修了試験 | 採点はサーバ（記録は残らない） | 採点はサーバ、`exams` に受験回つきで記録 |
| 画面の表示 | 「端末内記録」のバッジが出る | バッジなし |

コードは同じです。環境変数の有無だけで切り替わります。

---

## 5. 本番運用に移すとき

- **開発用の受講を消す。** `apply-all.sql` の末尾（seed 部分）で作った
  事業者・受講者・受講コード・受講の5行を削除し、`DEV_ENROLLMENT_ID` も外す。
  代わりに Supabase Auth のログイン（フェーズ2の残り）を接続する
- `EXAM_SECRET` を本番用の値にする（開発用の既定値のままにしない）
- Storage に `audio` バケットを作り、`npm run upload:curriculum` で
  教材を置く（音声 mp3 は収録後）

---

## 困ったとき

| 症状 | 原因と対処 |
|---|---|
| `/setup` が「未設定」のまま | `.env.local` の位置（リポジトリ直下）と、開発サーバの再起動を確認 |
| `lessons` が13件でない | `apply-all.sql` を最後まで実行できていない。Run し直す |
| `DEV_ENROLLMENT_ID に対応する受講がありません` | seed 部分が流れていない。`apply-all.sql` を再実行 |
| 視聴時間が思ったより増えない | 仕様です。サーバ側で実経過時間を上限に切り詰めています（`SPEC.md` 5章） |


## Vercel に載せる場合

手元の `.env.local` は Vercel には持っていかれません。同じ5つを
Vercel 側にも入れます。

1. **Settings → Environment Variables** で5つ追加（Production にチェック）
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`（`NEXT_PUBLIC_` を付けない。付けるとブラウザまで配られる）
   - `DEV_ENROLLMENT_ID`
   - `EXAM_SECRET`
2. **Deployments → 最新 → ⋯ → Redeploy**
   環境変数はビルド時に読まれるので、追加しただけでは反映されません。
3. デプロイ先の `/setup` を開いて、緑になっていることを確認

`/setup` の手順書きは、Vercel 上で開くと Vercel 用の文言に切り替わります。

### 公開範囲の注意

Auth を入れるまでは、URL を開いた人全員が `DEV_ENROLLMENT_ID` の
同じ受講記録に書き込みます。人に見せる前に
**Settings → Deployment Protection → Vercel Authentication** を有効にしてください。
