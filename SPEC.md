# 足場トレーニング 実装仕様書

このドキュメントは、プロトタイプを本番アプリとして実装するための指示書です。
Claude Code に読み込ませて、ここから実装を進めます。

---

## 0. 何を作るのか

足場業界向けの教育アプリ。2つの機能を1つのアプリに収める。

| 機能 | 内容 | 課金 |
|---|---|---|
| 実務トレーニング | 作業員を操作して足場を組むゲーム | 第1章のみ無料、第2章以降は買い切り |
| 特別教育 | 労働安全衛生法に基づく学科6時間 | 受講コード制（法人まとめ購入） |

利用者は3種類。**受講者**、**購入担当者**、**教育担当者（管理）**。

---

## 1. 手元にある資産

| ファイル | 中身 | 扱い |
|---|---|---|
| `curriculum.json` | 特別教育の全教材（400KB） | **そのまま使う**。DBに投入するかCDNに置く |
| `narration-all.csv` | ナレーション1,683行（音声生成用） | 音声ファイル名と1対1対応 |
| `ashiba-app-v11.jsx` | プロトタイプ全体 | **仕様の参照用**。コードは移植しない |

`curriculum.json` の構造：

```
subjects[] → id, name, legal_min, lessons[]
  lessons[] → id, title, legal_scope, legal_min, scene, budget,
              script[]   … ナレーション本文（1行=1音声）
              figures[]  … 図解（id, t, lead, parts[], task）
              cases[]    … 災害事例（situation[], options[], causes[], prevention[], lesson）
              quiz[]     … 確認問題（q, a[], ok, why）
```

---

## 2. 技術構成（推奨）

```
フロント : Next.js (App Router) + TypeScript + Tailwind
状態管理 : Zustand（軽量。Reduxは過剰）
バックエンド : Supabase（Postgres + Auth + Storage）
決済 : Stripe（Checkout + Invoice）
音声 : 事前生成した mp3 を Storage に配置
顔検出 : MediaPipe Face Detection（ブラウザ内で完結）
ホスティング : Vercel
```

**この構成を選ぶ理由**

- Supabase は Auth・DB・Storage が揃うので、個人開発でも管理対象が少ない
- Stripe の Checkout を使えば、カード情報が自社サーバを通らない（PCI DSS の負担を回避）
- 顔検出をブラウザ内で完結させれば、映像をサーバへ送らずに済む（法務リスクが激減）

---

## 3. データモデル

```sql
-- 事業者
companies (id, name, responsible_name, created_at)

-- ユーザー（受講者・担当者）
users (id, company_id, name, birth_date, email, role, created_at)
  role: 'learner' | 'admin'

-- 注文
orders (id, company_id, seats, unit_price, amount, method, status,
        stripe_session_id, due_date, paid_at, created_at)
  method: 'card' | 'invoice'
  status: 'pending' | 'paid' | 'cancelled'

-- 受講コード
seats (id, order_id, code, used_by, used_at, expires_at)

-- 受講状態
enrollments (id, user_id, seat_id, consented_at, face_registered_at,
             id_document_at, started_at, completed_at)

-- 視聴記録（単元ごと）
progress (id, enrollment_id, lesson_id, watched_sec, quiz_passed_at, updated_at)

-- 照合ログ（顔認証）
verify_logs (id, enrollment_id, lesson_id, result, reason, created_at)
  result: 'ok' | 'ng'
  reason: 'no_face' | 'multi_face' | 'blocked' | 'no_motion'
  ※画像は保存しない

-- 修了試験
exams (id, enrollment_id, score, total, passed, attempt, created_at)

-- 修了証
certificates (id, enrollment_id, cert_no, issued_at, issued_by, revoked_at)
```

---

## 4. 実装の順序

### フェーズ1：受講できる状態にする

1. Next.js プロジェクト作成、Supabase 接続
2. `curriculum.json` を Storage に配置し、読み込み
3. 受講画面（ナレーション → 図解 → 災害事例 → 確認問題）
4. 視聴時間の記録（`progress` テーブル）
5. 音声再生（mp3。未生成のあいだは Web Speech API で代替）

**この段階で、教材が最後まで通ることを確認する。**

### フェーズ2：本人確認と記録

6. Supabase Auth でログイン
7. 同意画面、顔写真登録、公的書類の撮影
8. MediaPipe による受講中の照合（3秒間隔）
9. 照合失敗で一時停止、`verify_logs` へ記録
10. 修了試験（プールから20問、16問以上で合格）

### フェーズ3：課金と発行

11. Stripe Checkout（カード決済）
12. Stripe Invoice（請求書払い）
13. 受講コードの発行と引き換え
14. 修了証の生成（PNG。プロトタイプの `drawCert` を移植）
15. **請求書払いは `orders.status = 'paid'` でないと発行不可**

### フェーズ4：管理画面

16. 注文一覧と入金確認
17. 受講者の進捗一覧
18. 資格証の一括発行、台帳CSV出力

### フェーズ5：実務トレーニング

19. ゲーム部分を移植（プロトタイプの工程データをそのまま使う）
20. 章ごとの購入

---

## 5. 実装上の重要な決まり

### 視聴時間

- **再生中のみ加算**。一時停止・離席・照合失敗中は加算しない
- 図解と災害事例を表示しているあいだも加算する
- クライアントの時刻は信用しない。サーバ側で累計を保持し、一定間隔で同期する

### 顔認証

- **映像・静止画をサーバへ送らない**。ブラウザ内で照合し、結果だけ記録
- 登録用の顔写真は特徴量に変換して保存。元画像は保存しない
- 3秒間隔で照合、2回連続で失敗したら教材を停止
- 失敗理由を4種に分類（顔なし／複数人／遮蔽／動きなし）

### 修了証

- 発行名義は**事業者**。個人ではない
- 証明番号を採番し、照会ページで真正性を確認できるようにする
- 請求書払いで未入金の場合は発行しない

### 決済

- カード情報を自社サーバに通さない（Stripe Checkout へリダイレクト）
- 請求書払いでも**受講コードは即時発行**する（教育は急ぐため）
- 資格証の発行だけを入金確認まで止める

---

## 6. 法務チェックリスト（実装と並行して進める）

- [ ] 監修者の選定（労働安全コンサルタント等）と台本の監修
- [ ] 所轄労働局への構成の照会
- [ ] 利用規約
- [ ] プライバシーポリシー（**顔特徴データ＝個人識別符号**の記載を含む）
- [ ] 特定商取引法に基づく表記
- [ ] 修了証の様式の確認

---

## 7. Claude Code への最初の指示例

```
足場業界向けの教育アプリを Next.js + Supabase で作ります。
まずフェーズ1として、特別教育の受講画面を実装してください。

- curriculum.json を読み込んで、科目・単元の一覧を表示
- 単元を選ぶと、ナレーション（字幕＋音声）→ 図解 → 災害事例 → 確認問題 の順に進む
- ナレーションは script[] を1行ずつ表示し、読み終えたら次へ
- 視聴時間は再生中のみ加算し、規定時間に達するまで確認問題は出さない
- 図解は parts[] をタップで開き、全部開くと task に答える
- 災害事例は situation[] を1行ずつ読み、options[] で原因を選ばせてから causes[] と prevention[] を表示

デザインは黒基調（#14171B）に黄色（#F5D400）のアクセント。
現場の職人がスマホで使う前提で、文字は大きめに。
```

---

## 8. 補足

- プロトタイプの `.jsx` は React で書かれているので、TypeScript 化しながら移植する形になる
- ゲーム部分の工程データ（共通ステージ＋面ごとの列）は、そのまま設計として使える
- 音声が揃うまでは Web Speech API で開発を進められる
