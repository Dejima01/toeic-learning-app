# セットアップガイド

このドキュメントは、リポジトリを clone した後にローカルで開発環境を立ち上げるまでの手順です。

---

## 必要なもの（事前にインストール）

| ツール | 推奨バージョン | 確認コマンド |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18 以上 | `node -v` |
| Git | 任意 | `git --version` |

---

## 手順

### 1. リポジトリを clone する

```bash
git clone <リポジトリのURL>
cd <クローンしたフォルダ名>
```

---

### 2. 環境変数ファイルを作成する

`.env.local` は Git 管理対象外のため、手動で作成する必要があります。

```bash
cp frontend/.env.example frontend/.env.local
```

次に `frontend/.env.local` をテキストエディタで開き、`xxxxxxxx` の部分をプロジェクトオーナーから受け取った値に書き換えてください。

```env
# Firebase Web 設定（プロジェクトオーナーから受け取った値を入力）
VITE_FIREBASE_API_KEY=xxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=xxxxxxxx
VITE_FIREBASE_PROJECT_ID=xxxxxxxx
VITE_FIREBASE_STORAGE_BUCKET=xxxxxxxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxx
VITE_FIREBASE_APP_ID=xxxxxxxx

# 中継サーバ（この値はそのままでOK）
VITE_PROXY_URL=https://toeic-api-proxy.onrender.com
```

> **Firebase の設定値の確認方法（管理者向け）**
> Firebase コンソール → プロジェクトの設定 → マイアプリ → SDK の設定と構成

---

### 3. npm パッケージをインストールする

```bash
cd frontend
npm install
```

インターネット接続が必要です。数分かかる場合があります。

---

### 4. 開発サーバーを起動する

```bash
npm run dev
```

起動後、ブラウザで以下の URL を開いてください。

```
http://localhost:5173
```

`Ctrl + C` でサーバーを停止できます。

---

## デプロイする場合（任意）

アプリを Firebase Hosting に公開したい場合のみ実施してください。

### 前提

Firebase CLI をインストールしてログインします。

```bash
npm install -g firebase-tools
firebase login
```

### ビルド＆デプロイ

プロジェクトのルートフォルダ（`firebase.json` があるフォルダ）で実行してください。

```bash
# ビルド
cd frontend
npm run build
cd ..

# デプロイ（Hosting + Firestore セキュリティルール）
firebase deploy --only hosting,firestore:rules
```

デプロイ完了後、コンソールに表示された URL でアクセスできます。

---

## よくあるトラブル

### `npm install` でエラーが出る

Node.js のバージョンが古い可能性があります。`node -v` で確認し、18 以上でなければ更新してください。

### 画面が真っ白になる / ログインできない

`frontend/.env.local` の Firebase 設定値が間違っている可能性があります。ブラウザの開発者ツール（F12）→ コンソール を開いて、エラーメッセージを確認してください。

### 例文リロードやチャットボットが動かない

Firebase にログインした状態でのみ AI 機能が使えます。ログアウト状態では動作しません。
