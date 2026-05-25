# 作業手順書（VS Code + Claude Code 用）

このドキュメントは「VS Code 上の Claude Code でTOEIC学習アプリを作る」ための**実作業マニュアル**です。
ファイルや画像をどのタイミングでどうやって渡すかを順番に説明します。

---

## 重要：Claude Code の基本動作

VS Code に統合された Claude Code は、**現在開いているフォルダ内のファイルを自由に読めます**。
そのため、いちいち画像やドキュメントをチャットに貼り付ける必要はありません。

> ✅ あなたがすること: **VS Code でこのフォルダ全体を開く**
> ✅ Claude Code がすること: 必要なファイルを自分で `Read` で開いて参照する
> ✅ あなたの指示の渡し方: **チャット欄にメッセージを打つだけ**

---

## ステップ 0: 事前準備（完了済み）

- Firebase プロジェクトの作成 ✅
- Firestore / Authentication の有効化 ✅
- Web 設定値の取得 ✅
- サービスアカウント鍵のダウンロード ✅
- Gemini API キー → 不要（中継サーバ経由のため）

---

## ステップ 1: VS Code でフォルダを開く

1. VS Code を起動
2. メニュー **File → Open Folder…**
3. `C:\Users\由基\Downloads\TOEIC_Learning_App` を選択
4. 左サイドバー（エクスプローラー）に以下が表示されることを確認:
   - `00_workflow_guide.md`（このファイル）
   - `01_app_overview.md`
   - `02_implementation_request.md`
   - `01_entry.png` 〜 `18_rank_test_result.png`
   - `data/` フォルダ

---

## ステップ 2: Claude Code パネルを開く

VS Code の右上 or 左サイドバーの Claude アイコンをクリック。
（拡張機能の表示位置は環境による）

---

## ステップ 3: 最初のメッセージ（プロジェクトの全体像を読み込ませる）

Claude Code のチャット欄に**そのまま貼り付けてください**:

```
このフォルダはTOEIC学習アプリのプロジェクトです。

これから一緒にこのアプリを作っていきたいです。
まずは以下のファイルを読んで全体像を把握してください。

- 01_app_overview.md … アプリ全体の仕様書
- 02_implementation_request.md … フェーズごとの実装依頼書

参考用に、画面のモックアップ画像が 01_entry.png 〜 18_rank_test_result.png として
このフォルダ直下に18枚入っています。実装するフェーズに応じて必要な画像を見てください。

読み込みが終わったら、不明点があれば聞いてください。
不明点がなければ「準備OK」と返してください。
```

Claude Code が `Read` ツールでファイルを読み、不明点や準備OKの返事をします。

---

## ステップ 4: フェーズ1（環境セットアップ）を依頼

Claude Code に次のメッセージを送ります:

```
では `02_implementation_request.md` のフェーズ1（環境セットアップ）をお願いします。
このフォルダ直下に frontend/ と scripts/ を作って、Vite + React + Firebase の雛形を作ってください。

中継サーバの設定も含めて、`data/seed_firestore.py` を `scripts/` に配置してください。
```

Claude Code がフォルダ作成・パッケージインストール・ファイル生成を行います。
ターミナルでコマンドを実行する場合は **承認を求められる** ので、内容を確認して許可してください。

### フェーズ1 完了後にあなたがやる作業

1. **`frontend/.env.local` を作って Firebase の設定値を書く**
   - Claude Code が `.env.example` を作っているはずなので、それをコピーして `.env.local` にリネーム
   - Firebase コンソールで取得した値を埋める
   ```
   VITE_FIREBASE_API_KEY=xxxxxxxx
   VITE_FIREBASE_AUTH_DOMAIN=xxxxxxxx
   VITE_FIREBASE_PROJECT_ID=xxxxxxxx
   VITE_FIREBASE_STORAGE_BUCKET=xxxxxxxx
   VITE_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxx
   VITE_FIREBASE_APP_ID=xxxxxxxx
   VITE_PROXY_URL=https://toeic-api-proxy.onrender.com
   VITE_PROXY_TOKEN=2442-dev-toeic
   ```
2. **サービスアカウント鍵を配置**
   - ダウンロード済みの JSON を `scripts/serviceAccount.json` という名前で置く
3. **動作確認**: ターミナルで以下を実行
   ```
   cd frontend
   npm run dev
   ```
   → ブラウザで `http://localhost:5173` を開いて画面が出ればOK

---

## ステップ 5: フェーズ2（認証機能）を依頼

Claude Code に送るメッセージ:

```
動作確認できました。次に `02_implementation_request.md` のフェーズ2（認証機能）をお願いします。

参照画像:
- 01_entry.png
- 02_login.png
- 03_signup.png
- 04_password_forgot.png
- 05_password_reset.png

フォルダ直下にあります。
```

> 💡 **コツ**: 画像名を都度書いてあげると Claude Code が確実に該当画像を見てくれます

### フェーズ2 完了後の動作確認
- 新規登録 → ログイン → ログアウトが動くこと
- Firebase コンソールの Authentication タブにユーザーが登録されること

---

## ステップ 6: フェーズ3（ホーム・ナビゲーション）

```
フェーズ3（ホーム画面と固定ヘッダー/フッター）をお願いします。

参照画像: 06_home.png
```

完了後、ホーム画面が表示されてボタンから空ページに遷移できることを確認。

---

## ステップ 7: 単語データを Firestore に投入（あなたの作業）

フェーズ4を依頼する前に、ターミナルで:

```
pip install firebase-admin
python scripts/seed_firestore.py
```

実行すると `word_questions` と `grammar_questions` の両方が Firestore に登録されます。
Firebase コンソールの Firestore タブで確認できます。

---

## ステップ 8: フェーズ4（単語モード）を依頼

```
フェーズ4（単語モード）をお願いします。

データはすでに `python scripts/seed_firestore.py` で Firestore に投入済みです。

参照画像:
- 08_word_chapter_list_750.png
- 09_word_chapter_list_900.png
- 10_word_mode_chapter.png

機能を一気にではなく、段階的に作ってください:
1. チャプター一覧
2. 単語カード表示（50単語の縦スクロール）
3. 暗記シート機能（青カバー）
4. 復習マーカー機能（黄色ハイライト + Firestore保存）
5. 例文リロード機能（中継サーバ /api/gemini 使用）

各段階でいったん動作確認できる状態にしてください。
```

> 💡 「段階的に」と明示すると、Claude Code が一気に全部書かずに区切って進めてくれます

---

## ステップ 9: 以降のフェーズ（同じパターン）

フェーズ5以降も同じ流れで依頼します。

### フェーズ5（文法モード）
```
フェーズ5（文法モード）をお願いします。
参照画像: 11_grammar_chapter_list_750.png, 12_grammar_mode_chapter.png
```

### フェーズ6（復習問題一覧）
```
フェーズ6（復習問題一覧）をお願いします。文法の復習一覧は不要、単語のみです。
参照画像: 13_review_list.png, 14_review_list_detail.png
```

### フェーズ7（ランク認定テスト）
```
フェーズ7（ランク認定テスト）をお願いします。
参照画像: 16_rank_test_questions.png, 17_rank_test_explanation.png, 18_rank_test_result.png

バッジ画像（bronze.png, silver.png, gold.png）は frontend/public/badges/ に
別途置きます（私が用意します）。
```

→ このタイミングで `frontend/public/badges/` に自分でバッジPNGを配置

### フェーズ8（AIチャットボット）
```
フェーズ8（AIチャットボット）をお願いします。

中継サーバの仕様:
- POST /api/gemini
- リクエスト: { "prompt": "..." }
- レスポンス: { "response": "..." }
- ヘッダー: Authorization: Bearer 2442-dev-toeic
- ストリーミング非対応

参照画像: 15_review_list_chatbot.png
```

### フェーズ9（設定画面）
```
フェーズ9（設定画面の枠だけ）をお願いします。中身は空でOKです。
参照画像: 07_settings.png（中のトグル/スライダーは実装不要）
```

### フェーズ10（デプロイ）
```
フェーズ10のデプロイ準備をお願いします。
Firebase Hosting にデプロイできる状態にしてください。

セキュリティルールも設定してください:
- /word_questions, /grammar_questions: 認証ユーザーは読み取り可、書き込み不可
- /users/{uid}: 本人のみ読み書き可
```

---

## ステップ 10: トラブルシューティング

### Claude Code がファイルを見つけられない時
- 「フォルダ直下に〇〇.png があります」のように具体的なファイル名を伝える
- 「Read ツールでこのファイルを開いてください」と直接指示

### コードに不具合がある時
- 「〇〇したときに□□というエラーが出ました」のように具体的に伝える
- エラー画面のスクショを Claude Code にドラッグ&ドロップで貼り付ける

### Claude Code がフェーズを横断して書いてしまう時
- 「いま依頼したフェーズの範囲だけ作ってください。他のフェーズの機能は触らないでください」と伝える

### Firestore のデータが反映されない時
- ブラウザの開発者ツール → ネットワークタブで Firebase へのリクエストを確認
- セキュリティルールが厳しすぎる可能性 → Firebase コンソールで確認

---

## まとめ：依頼の基本パターン

```
フェーズ〇〇（◯◯）をお願いします。
参照画像: △△.png, □□.png
[必要なら追加の指示]
```

これだけで OK です。

各フェーズ完了後は **動作確認 → 次のフェーズへ** の流れを守ってください。
途中で問題が出たら早めに Claude Code に伝えると、後でまとめて直すより楽です。
