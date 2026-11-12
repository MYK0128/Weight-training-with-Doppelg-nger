# Muscle Quest

週間メニューを組み、筋肉量の実測と今後の増加シナリオを見比べるアプリです。

- **週間プラン**: 曜日ごとに種目を選び、1セットの回数とセット数を登録。回数×セット数から週間総回数を計算し、主部位別にも集計します。
- **筋肉量**: 測定履歴、実測差、月あたりの傾向を表示。仮定した増加ペースで、1か月から5年までの増加量と任意の目標までの期間を試算できます。
- **記録・アバター**: 筋トレ記録でも同じ種目一覧を使用。身体情報と実測の変化率、アバターの成長を比較できます。

種目の定義は `backend/exercises.json` で管理します。過去の自由入力は残し、一覧に対応する旧名称は同じ種目として扱います。部位の分類は [ACEの種目ライブラリ](https://www.acefitness.org/resources/everyone/exercise-library/) を参考にした、このアプリでの集計区分です。

## ローカルで起動

必要な環境: Node.js 22 以上、Go 1.24 以上、C コンパイラ（macOS は Xcode Command Line Tools、Linux は GCC など）。SQLite ドライバーは [go-sqlite3](https://github.com/mattn/go-sqlite3) を使うため、Go のビルド時に CGO が必要です。

リポジトリのルートで実行します。

```sh
npm ci
```

ターミナル1で Go API を起動します。

```sh
go run ./backend
```

ターミナル2で画面を起動します。

```sh
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開き、新規登録または既存アカウントでログインします。ログイン後のホームは `/plan`、筋トレ・身体情報の記録は `/dashboard` です。API の稼働確認は `curl http://127.0.0.1:8080/api/health` で行えます。

ローカルでデモを使う場合は `go run ./backend -seed` を実行し、`demo@muscle.quest` / `demo1234` でログインします。既存のデモアカウントや記録は上書きしません。このデモ資格情報は公開環境では使わないでください。

## Go への移行と設定

SQLite の保存先は従来と同じ `prisma/dev.db` です。既存環境ではDBをバックアップし、旧サーバーを止めてから新しいGo APIを起動してください。起動時に不足しているテーブルとインデックスだけを作成します。Prisma のインストールや `db push`、デモデータの再投入は不要です。

既存のユーザー、パスワード、セッション、筋トレ記録、身体情報、週間プランをそのまま読み込みます。旧プランのメニュー名と期間は引き継ぎますが、体重は筋肉量に流用しません。アバターは画面表示時に記録から計算するため、旧DBのアバターテーブルに依存しません。

| 環境変数 | 対象 | 既定値・用途 |
| --- | --- | --- |
| `MUSCLE_DB_PATH` | Go | `prisma/dev.db`。別DBを使うときはファイルパスを指定 |
| `MUSCLE_API_ADDR` | Go | `127.0.0.1:8080`。APIの待受アドレス |
| `MUSCLE_API_URL` | Next.js | `http://127.0.0.1:8080`。Go API の内部URL |
| `MUSCLE_SECURE_COOKIES` | Go | ローカルHTTPでは未設定。HTTPSで運用するときは `true` |

Next.js はブラウザの `/api/*` をGoへ転送し、画面と同じオリジンでセッションCookieを使います。`MUSCLE_API_URL` を変更する場合は Next.js のビルド時と起動時の両方に同じ値を指定してください。公開運用では Go API を内部ネットワークに置き、フロントをHTTPSで配信してください。

## 構成

| 場所 | 担当 |
| --- | --- |
| `backend/` | Go HTTP API、認証、入力検証、SQLite、デモデータ |
| `app/`、`components/` | Next.js App Router、入力フォーム、暖色テーマ、Recharts |
| `lib/` | Go APIクライアント、部位集計、アバター・グラフ・筋肉量シナリオの計算 |
| `tests/` | TypeScript の計算テスト |

Go API: `GET /api/health`、`POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`、`POST /api/workouts`、`POST /api/body-metrics`、`GET /api/dashboard`、`GET /api/weekly-plan`、`PUT /api/weekly-plan`。ダッシュボードAPIは元の記録を返し、画面で成長グラフを組み立てます。

## 筋肉量の計算

実測ペースは、最新測定までの90日間に28日以上にわたる3日分以上の測定がある場合だけ表示します。7日以上離れた測定ペアを月換算し、中央値を使います。未測定をゼロにはしません。

回数・セット数だけで実際の筋肉の増加量は予測できません。基準の週間総回数を任意で設定すると、入力した月あたりの増加ペースに `min(週間総回数 ÷ 基準の週間総回数, 1)` を掛けるシナリオを試せます。基準が未設定なら元のペースのまま、基準が設定済みで回数・セット数が未入力の種目があれば試算を保留します。既存プランの未入力の回数は推測しません。

参考: [週間セット数と筋肥大のメタ回帰](https://pubmed.ncbi.nlm.nih.gov/41343037/)、[筋量関連指標の測定法比較](https://pmc.ncbi.nlm.nih.gov/articles/PMC6624257/)。

## テストとビルド

```sh
go test ./backend
npm test
npm run typecheck
npm run build
```

Goのテストは一時SQLiteを使い、認証、旧形式の互換性、保存・取得、ユーザー間のデータ分離を確認します。本番ビルドをローカルで動かす場合は、Go APIを起動してから `npm start` を実行します。
