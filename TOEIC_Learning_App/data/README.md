# データフォルダの説明

このフォルダにはアプリで使う「問題のマスターデータ」を入れます。
Firestoreへ登録するもとになるファイルです。

---

## 推奨フォルダ構成（最終的にプロジェクトに置く形）

```
TOEIC_Learning_App/
├── 01_app_overview.md
├── 02_implementation_request.md
├── screen_flow.png
├── 01_entry.png 〜 18_rank_test_result.png
│
├── frontend/                       # ← フェーズ1でClaude Codeが作る
│   ├── public/
│   │   └── badges/                 # ← バッジ画像をここに置く
│   │       ├── bronze.png
│   │       ├── silver.png
│   │       └── gold.png
│   └── src/
│       ├── firebase.ts             # Firebase 初期化
│       └── lib/
│           └── proxyClient.ts      # 中継サーバ呼び出しラッパー
│
├── scripts/                        # ← フェーズ1でClaude Codeが作る
│   ├── seed_firestore.py           # シードスクリプト
│   └── serviceAccount.json         # ← あなたが Firebase から落として置く（.gitignore必須）
│
└── data/                           # このフォルダ（マスターデータ）
    ├── README.md                   # このファイル
    ├── words_sample.json           # 単語データ
    └── grammar_sample.json         # 文法問題データ
```

※ 独自バックエンド（Flask等）は使わず、フロントから直接 Firebase と中継サーバを呼びます。

---

## 1. データ形式について

形式は **JSON** を採用します。理由は以下です。

- Firebase Admin SDK で直接 Firestore に書き込みやすい
- VS Code でそのまま編集できる
- Claude や ChatGPT に「このフォーマットに沿って単語を追加して」と頼みやすい

---

## 2. データの登録方法（手順）

1. このフォルダの `words_sample.json` / `grammar_sample.json` にデータを追加する
2. Firebase コンソールから **サービスアカウント鍵**（JSON）をダウンロードして `scripts/serviceAccount.json` として置く（`.gitignore` 必須）
3. プロジェクトルートで `python scripts/seed_firestore.py` を実行する
4. Firestore コンソールでデータが入っていることを確認する

`seed_firestore.py` はフェーズ1で Claude Code が `scripts/` 配下に配置します。

---

## 3. いつデータを Claude Code に渡すか

| タイミング | 何をする |
|---|---|
| **フェーズ1（環境セットアップ）** | seed_firestore.py を `backend/scripts/` に配置 |
| **フェーズ4（単語モード）の前** | `words_sample.json` を渡し、シードを実行して Firestore に投入 |
| **フェーズ5（文法モード）の前** | `grammar_sample.json` を渡し、シードを実行して Firestore に投入 |

> ポイント: **画面実装の前にデータが Firestore に入っている状態にする**と、Claude Code が動作確認しながら作れます。

---

## 4. データを増やす方法（おすすめ）

MVPでは各レベル300単語 / 75文法問題が目標です。
本サンプルだけでは足りないので、以下のいずれかで増やしてください。

- **A: Claude / ChatGPT に依頼**
  「`words_sample.json` と同じフォーマットで、TOEIC 750点台レベルの単語を50個追加して」と頼む
- **B: 市販の単語帳をベースに自分で追加**
- **C: 既存のオープンソースの単語リストを使う**

データを増やしたら、再度 `seed_firestore.py` を実行すれば反映されます（同じIDは上書きされます）。

---

## 5. バッジ画像について

`frontend/public/badges/` に以下3枚を置いてください。

- `bronze.png` … 600〜749点
- `silver.png` … 750〜899点
- `gold.png` … 900点以上

無料素材サイト（Iconfinder, Flaticon, いらすとや など）からダウンロードして使えます。
透過PNG 200×200px くらいが扱いやすいです。

---

## 6. Firestore セキュリティルール（参考）

問題のマスターデータは「全ログインユーザーが読み取り可」「書き込みは管理者のみ」にします。
フェーズ10のデプロイ時に Claude Code に下記を伝えてください。

```
- /word_questions/{id}, /grammar_questions/{id}:
    read: authenticated users
    write: false （管理者だけがスクリプト経由で書く）
- /users/{uid} とそのサブコレクション:
    read/write: その uid 本人のみ
```
