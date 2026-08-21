# 足場トレーニング

足場業界向けの教育アプリ。実務トレーニング（足場を組むゲーム）と、
労働安全衛生法にもとづく特別教育（学科6時間）を1つに収める。

## 動かし方

```sh
npm install
npm run dev        # http://localhost:3000
```

Supabase 未設定でもそのまま動く（視聴記録は端末内＝localStorage に「端末内記録」表示付きで保存）。

**Supabase につなぐ場合**は `supabase/apply-all.sql` を SQL Editor に1回貼って実行し、
`.env.example` を `.env.local` に写して鍵を入れるだけ。
接続できたかは <http://localhost:3000/setup> で確認できます。
手順は `docs/01-Supabase接続手順.md`。

| コマンド | 用途 |
|---|---|
| `npm run build` | 本番ビルド |
| `npm run typecheck` | 型検査 |
| `npm run check:narration` | narration-all.csv と script[] の1対1を検証（音声収録前に必ず） |
| `npm run test:ch1` | 第1章の判定（現場のルール1〜8） |
| `npm run test:e2e:ch1` | 第1章をブラウザで段取り→完了まで通す |
| `npm run test:e2e:catalog` | 資材カタログと通し見学 |
| `npm run test:e2e:fit` | 場面が小さい画面に収まるか |
| `npm run build:sql` | `supabase/apply-all.sql` を生成（マイグレーション＋lessons＋seed） |
| `npm run sync:lessons` | curriculum.json → lessons 表（apply-all を使うなら不要） |
| `npm run upload:curriculum` | curriculum.json → Supabase Storage |

## ディレクトリ

| 場所 | 中身 |
|---|---|
| `src/` | アプリ本体（Next.js App Router + TypeScript + Tailwind + Zustand） |
| `content/` | 教材の正本。`curriculum.json`（そのまま使う・変更しない）と `narration-all.csv` |
| `supabase/` | `apply-all.sql`（貼るだけの初期化）・マイグレーション3本・検証SQL・開発用 seed |
| `tests/` | E2E（実ブラウザ）とサーバ記録モードの検証 |
| `scripts/` | 教材データの投入・検証スクリプト |
| `docs/` | 設計文書（フェーズ0の設計案など） |
| `handoff/` | チャットで作ったプロトタイプ。**仕様の参照用**。ビルド対象外 |

## 引き継ぎ資料

| ファイル | 用途 |
|---|---|
| `HANDOFF.md` | **最初に読む**。画面の流れ、現場のルール（判定条件）、演出の決まり、残タスク |
| `SPEC.md` | 技術構成・データモデル・実装順序 |
| `PROMPT.md` | Claude Code に貼る指示文 |
| `handoff/ashiba-app-v16h.tsx` | 統合プロトタイプ。コードは移植せず、仕様として読む |
| `handoff/prototypes/` | 章ごと・機能ごとの単体プロトタイプ |

## handoff/prototypes の中身

| ファイル | 中身 |
|---|---|
| `ashiba-ch2-v6.tsx` | 第2章 高所作業 |
| `ashiba-ch3-v13.tsx` | 第3章 火打とシート |
| `ashiba-glossary-v9.tsx` | 資材カタログ（16点） |
| `ashiba-demo-v8.tsx` | 組立の通し見学（15手・「なぜ」付き） |
| `ashiba-suihei-v2.tsx` | 水平器の置き場所を選ぶ場面 |

## 実装の進み

- [x] フェーズ0：設計案・Supabase マイグレーション（`docs/00-フェーズ0-設計案.md`）
- [x] フェーズ1：特別教育の受講画面（一覧 → ナレーション → 図解 → 災害事例 → 確認問題）
- [x] フェーズ2：本人確認と記録（同意 → 顔写真・書類の登録、受講中の照合、修了試験）
  - Supabase Auth のログインは未接続（プロジェクト作成後に接続。それまでは開発用受講に記録）
- [ ] フェーズ3：課金と発行（Stripe・受講コード・修了証）
- [ ] フェーズ4：管理画面
- [ ] フェーズ5：実務トレーニング（第1章＋資材カタログ＋通し見学は実装済み。第2〜6章が残り）
