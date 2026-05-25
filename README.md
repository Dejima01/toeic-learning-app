# TOEIC学習アプリ

TOEIC の点数向上を目指す Web 学習アプリです。

## 技術スタック

- **フロントエンド**: Vite + React 19 + TypeScript + Tailwind CSS v4
- **認証/DB**: Firebase Authentication + Firestore
- **AI 連携**: Gemini 1.5 Flash（中継サーバ経由）

---

## 開発環境のセットアップ

### 1. 環境変数の設定

```bash
cp frontend/.env.example frontend/.env.local
```

`frontend/.env.local` を開き、Firebase の設定値を入力してください。
（Firebase コンソール → プロジェクト設定 → マイアプリ → SDK の設定と構成）

### 2. 依存パッケージのインストール

```bash
cd frontend
npm install
```

### 3. 開発サーバーの起動

```bash
cd frontend
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。

---

## Firestore へのデータ投入

### 1. サービスアカウント鍵の取得

1. Firebase コンソール → プロジェクト設定 → サービスアカウント
2. 「新しい秘密鍵の生成」をクリックして JSON をダウンロード
3. ダウンロードしたファイルを `scripts/serviceAccount.json` として保存

> **注意**: `serviceAccount.json` は `.gitignore` に含まれています。絶対にコミットしないでください。

### 2. Python パッケージのインストール

```bash
pip install firebase-admin
```

### 3. シードスクリプトの実行

プロジェクトルート（`README.md` があるディレクトリ）から実行してください。

```bash
python scripts/seed_firestore.py
```

`word_questions` および `grammar_questions` コレクションにデータが投入されます。

---

## Firebase Hosting へのデプロイ

### 前提条件

```bash
npm install -g firebase-tools
firebase login
```

### 手順

```bash
# 1. フロントエンドをビルド
cd frontend
npm run build
cd ..

# 2. Firestore セキュリティルールをデプロイ
firebase deploy --only firestore:rules

# 3. Hosting にデプロイ
firebase deploy --only hosting

# 4. 両方まとめて行う場合
firebase deploy --only hosting,firestore:rules
```

デプロイ完了後、コンソールに表示された Hosting URL（例: `https://english-learning-app-d1a88.web.app`）でアクセスできます。

### Firestore セキュリティルール概要

| コレクション | 読み取り | 書き込み |
|---|---|---|
| `word_questions` | 認証ユーザー全員 | 不可 |
| `grammar_questions` | 認証ユーザー全員 | 不可 |
| `users/{uid}` | 本人のみ | 本人のみ |
| `users/{uid}/**` | 本人のみ | 本人のみ |

---

## 中継サーバ（AI API）の動作確認

中継サーバは Firebase ID トークンで認証します。静的トークン（`VITE_PROXY_TOKEN`）は不要です。

### ログイン状態で API が通ることを確認する

1. `npm run dev` でアプリを起動してログイン
2. 単語モードの「例文リロード」ボタン、または各画面のチャットボットを使用
3. 正常にレスポンスが返ってくれば OK

### ログアウト状態で 401 が返ることを確認する

1. ブラウザの開発者ツール → コンソールを開く
2. アプリをログアウトする
3. 以下のコマンドをコンソールで実行:
   ```js
   fetch('https://toeic-api-proxy.onrender.com/api/gemini', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid' },
     body: JSON.stringify({ prompt: 'test' }),
   }).then(r => console.log(r.status)); // → 401
   ```
4. `401` が返ることを確認

### トークンの自動更新について

Firebase ID トークンは 1 時間で期限切れになりますが、`getIdToken()` を呼ぶたびに Firebase SDK が自動的に更新します。フロントエンドでのトークン管理は不要です。

---

## フォルダ構成

```
.
├── frontend/           # React アプリ本体
│   ├── src/
│   │   ├── firebase.ts         # Firebase 初期化
│   │   ├── lib/
│   │   │   └── proxyClient.ts  # Gemini 中継サーバクライアント
│   │   ├── contexts/           # AuthContext など
│   │   ├── pages/              # 各画面コンポーネント
│   │   └── components/         # 共通 UI コンポーネント
│   └── public/badges/          # バッジ画像
├── scripts/
│   └── seed_firestore.py       # Firestore データ投入スクリプト
└── TOEIC_Learning_App/
    ├── data/                   # マスターデータ (JSON)
    └── *.png                   # 画面モックアップ
```
