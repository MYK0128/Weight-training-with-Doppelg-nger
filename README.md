# Muscle Quest MVP

現実の筋トレの努力を、ゲーム内アバターの成長として可視化する Web アプリの MVP です。  
ユーザーはトレーニング記録と身体情報を保存し、その結果をもとにアバターの見た目・能力値・レベルが更新されます。

デモアカウント:

- `demo@muscle.quest`
- `demo1234`

## 1. システム概要

Muscle Quest は、以下の 3 つのレイヤーで構成するシンプルなフルスタック Web アプリです。

- フロントエンド: ユーザー登録、ログイン、筋トレ記録、身体情報記録、ダッシュボード表示
- アプリケーション層: 認証、記録保存、アバター成長計算、成長率比較
- データ層: SQLite にユーザーごとの筋トレ履歴、身体情報、アバタープロフィールを保存

MVP の中心体験:

- 現実の筋トレ記録を保存できる
- 身体データを保存できる
- 保存されたデータからアバター成長パラメータを算出できる
- 現実の成長率とアバター成長率を比較ダッシュボードで可視化できる

## 2. 使用技術の提案

今回の MVP では、立ち上がりの速さと保守性を優先して以下を採用しています。

- フロントエンド: `Next.js(App Router) + React + TypeScript`
- バックエンド: `Next.js Route Handlers`
- DB: `SQLite`
- ORM: `Prisma`
- グラフ: `Recharts`
- バリデーション: `Zod`
- 認証: 独自のシンプルな Cookie Session 認証

この構成の理由:

- Next.js 単体で画面と API を同居でき、MVP の開発速度が高い
- Prisma により、将来的な PostgreSQL などへの移行がしやすい
- App Router により、ダッシュボードのサーバーサイド取得と UI 分離がしやすい
- アバター成長ロジックを `lib/avatar.ts` に閉じ込めているため、将来 3D 表現や装備要素を追加しやすい

## 3. データベース設計

主要テーブル:

- `User`: ユーザー基本情報
- `Session`: ログインセッション
- `WorkoutLog`: 筋トレ記録
- `BodyMetric`: 身体情報記録
- `AvatarProfile`: アバター成長ステータス
- `Goal`: 将来の目標設定用
- `BadgeAward`: 将来のバッジ永続化用

主な項目:

- `WorkoutLog`
  - 日付
  - 種目名
  - 部位
  - 重量
  - 回数
  - セット数
  - メモ
- `BodyMetric`
  - 体重
  - 体脂肪率
  - 筋肉量
  - 胸囲
  - 腕囲
  - 脚囲
- `AvatarProfile`
  - レベル
  - 経験値
  - Power
  - 胸、腕、脚、持久力の部位別ステータス
  - Body Shape Score
  - Visual Tier

## 4. 画面一覧

- `/login`
  - ログイン
  - 新規登録
- `/dashboard`
  - サマリー KPI
  - アバター表示
  - 成長比較サマリー
  - 筋トレ記録フォーム
  - 身体情報記録フォーム
  - 現実 x アバター比較グラフ
  - 部位別トレーニング分析
  - 最近の記録一覧

将来追加しやすい画面:

- `/goals`
- `/reports/weekly`
- `/avatar/customize`
- `/recommendations`

## 5. API 設計

### 認証

- `POST /api/auth/register`
  - 新規登録
- `POST /api/auth/login`
  - ログイン
- `POST /api/auth/logout`
  - ログアウト

### 記録

- `POST /api/workouts`
  - 筋トレ記録を追加
- `POST /api/body-metrics`
  - 身体情報を追加

### ダッシュボード

- `GET /api/dashboard`
  - 比較ダッシュボード用データを取得

レスポンス例の考え方:

- 認証 API は `ok`, `user`, `error`
- 記録 API は保存結果のオブジェクトを返却
- ダッシュボード API は `summary`, `chartPoints`, `avatar`, `workouts`, `bodyMetrics` などを返却

## 6. アバター成長ロジック案

MVP ではわかりやすさ重視で、以下のルールを採用しています。

### 基本ルール

- 筋トレ 1 件ごとにボリュームを計算
  - `volume = weightKg * reps * sets`
- ボリュームに応じて経験値を加算
- 部位ごとに対応するアバターステータスを上昇

### 部位対応

- `CHEST` -> `chestStat`
- `ARMS` -> `armStat`
- `LEGS` -> `legStat`
- その他部位 -> `enduranceStat`

### 見た目成長

- 体重増加
- 筋肉量増加
- 胸囲、腕囲、脚囲

これらをもとに `bodyShapeScore` を算出し、一定値を超えるごとに `visualTier` を上げます。

### レベルアップ

- 経験値に応じてレベル上昇
- `sqrt` ベースの緩やかな成長曲線を採用し、序盤は成長を体感しやすくしています

### 比較表示

- 現実の体重成長率
- 現実の筋肉量成長率
- 扱う重量の伸び率
- Avatar Power 成長率
- Avatar Visual 成長率

## 7. ディレクトリ構成

```txt
.
├── app
│   ├── api
│   │   ├── auth
│   │   ├── body-metrics
│   │   ├── dashboard
│   │   └── workouts
│   ├── dashboard
│   ├── login
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components
│   ├── auth
│   └── dashboard
├── lib
│   ├── auth.ts
│   ├── avatar.ts
│   ├── dashboard.ts
│   ├── prisma.ts
│   └── validators.ts
├── prisma
│   ├── schema.prisma
│   └── seed.ts
├── package.json
└── README.md
```

## 8. MVP 実装手順

1. 依存関係をインストール
2. `.env` を作成して `DATABASE_URL` を設定
3. `prisma db push` で DB を作成
4. `prisma/seed.ts` でダミーデータを投入
5. `npm run dev` で起動
6. デモアカウントまたは新規登録でログイン
7. 筋トレ記録と身体情報を登録し、ダッシュボードで成長を確認

起動コマンド:

```bash
cp .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

## 9. 将来の拡張案

- 週間・月間レポートの自動生成
- 目標設定と進捗率表示
- 部位別の推奨メニュー提示
- アバター装備、カラー、職業カスタマイズ
- 3D アバターや Live2D 連携
- 通知、リマインダー、継続チャレンジ
- ソーシャル共有
- Apple Health / Google Fit 連携
- PostgreSQL への移行
- 管理画面と分析基盤の追加

## 実装メモ

- UI は「モダンな筋トレアプリ x ゲーム HUD」の中間を意識して設計
- コメントは複雑度の高い箇所を中心に最小限で付与
- アバター表現は今は SVG シルエットだが、将来差し替えしやすい設計
- ダミーデータを投入すれば、画面遷移と主要機能をすぐ確認可能
