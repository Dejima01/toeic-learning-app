"""
Firestore データ投入スクリプト
============================

このスクリプトは data/ フォルダ内の JSON ファイルを読み取り、
Firestore の word_questions / grammar_questions コレクションに登録します。

【使い方】
1. Firebase コンソール → プロジェクト設定 → サービスアカウント
   → 「新しい秘密鍵の生成」で JSON ファイルをダウンロード
2. ダウンロードした JSON を scripts/serviceAccount.json として保存
   (※絶対に Git にコミットしないこと。.gitignore に追加すること)
3. Python パッケージをインストール
       pip install firebase-admin
4. 実行（プロジェクトルートから）
       python scripts/seed_firestore.py

【再実行について】
同じ ID のドキュメントは上書きされます (set を使っているため)。
データを差し替えたい時はそのまま再実行してOKです。
"""

import json
import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

# === 設定 ===
# このファイルは scripts/seed_firestore.py に置かれる想定
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

SERVICE_ACCOUNT_PATH = SCRIPT_DIR / "serviceAccount.json"   # scripts/ 直下に置く
DATA_DIR = PROJECT_ROOT / "data"
WORDS_FILE = DATA_DIR / "words_sample.json"
GRAMMAR_FILE = DATA_DIR / "grammar_sample.json"


def init_firebase() -> firestore.Client:
    """Firebase Admin SDK を初期化して Firestore クライアントを返す。"""
    if not SERVICE_ACCOUNT_PATH.exists():
        raise FileNotFoundError(
            f"サービスアカウント鍵が見つかりません: {SERVICE_ACCOUNT_PATH}\n"
            "Firebase コンソールからダウンロードして scripts/ 直下に置いてください。"
        )
    cred = credentials.Certificate(str(SERVICE_ACCOUNT_PATH))
    firebase_admin.initialize_app(cred)
    return firestore.client()


def seed_collection(db: firestore.Client, collection_name: str, json_path: Path) -> int:
    """JSON ファイルを読み込んで指定コレクションに一括登録。登録件数を返す。"""
    if not json_path.exists():
        print(f"  [skip] {json_path} が存在しません")
        return 0

    with open(json_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    batch = db.batch()
    count = 0
    for item in items:
        doc_id = item.pop("id")          # id フィールドはドキュメントIDに使う
        ref = db.collection(collection_name).document(doc_id)
        batch.set(ref, item)
        count += 1

        # Firestore のバッチ書き込み上限は 500 件なので 400 件ごとにコミット
        if count % 400 == 0:
            batch.commit()
            batch = db.batch()

    batch.commit()
    return count


def main() -> None:
    print("Firestore にデータを投入します...")
    db = init_firebase()

    print(f"\n[1/2] word_questions コレクションを投入中: {WORDS_FILE.name}")
    word_count = seed_collection(db, "word_questions", WORDS_FILE)
    print(f"  → {word_count} 件登録しました")

    print(f"\n[2/2] grammar_questions コレクションを投入中: {GRAMMAR_FILE.name}")
    grammar_count = seed_collection(db, "grammar_questions", GRAMMAR_FILE)
    print(f"  → {grammar_count} 件登録しました")

    print("\n完了しました!")


if __name__ == "__main__":
    main()
