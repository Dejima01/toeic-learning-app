"""
お試しモード用の見本データ（600点台 第1章）を frontend/public/trial.json に書き出す。

Firestore は読むだけで書き込まない。第1章の問題を修正したら再実行してコミットする。

Usage:
    py scripts/export_trial_data.py
"""

import json
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

SCRIPT_DIR = Path(__file__).resolve().parent
SERVICE_ACCOUNT_PATH = SCRIPT_DIR / "serviceAccount.json"
OUTPUT_PATH = SCRIPT_DIR.parent / "frontend" / "public" / "trial.json"

LEVEL = "600"
CHAPTER = 1
EXPECTED_WORDS = 50
EXPECTED_GRAMMAR = 10

# ログインなしで公開されるデータなので、画面で使う項目だけを書き出す
WORD_FIELDS = (
    "word",
    "meaning",
    "part_of_speech",
    "level",
    "chapter_num",
    "example_sentences",
    "derivatives",
    "similar_words",
)
GRAMMAR_FIELDS = (
    "question_text",
    "choices",
    "correct_index",
    "explanation",
    "translation",
    "level",
    "chapter_num",
)


def fetch(db, collection: str, fields: tuple[str, ...]) -> list[dict]:
    query = (
        db.collection(collection)
        .where(filter=firestore.FieldFilter("level", "==", LEVEL))
        .where(filter=firestore.FieldFilter("chapter_num", "==", CHAPTER))
    )
    items = []
    for snap in query.stream():
        data = snap.to_dict()
        items.append({"id": snap.id, **{k: data[k] for k in fields if k in data}})
    return sorted(items, key=lambda item: item["id"])


def main() -> None:
    if not SERVICE_ACCOUNT_PATH.exists():
        sys.exit(f"サービスアカウント鍵が見つかりません: {SERVICE_ACCOUNT_PATH}")

    firebase_admin.initialize_app(credentials.Certificate(str(SERVICE_ACCOUNT_PATH)))
    db = firestore.client()

    words = fetch(db, "word_questions", WORD_FIELDS)
    grammar = fetch(db, "grammar_questions", GRAMMAR_FIELDS)

    if len(words) != EXPECTED_WORDS or len(grammar) != EXPECTED_GRAMMAR:
        sys.exit(
            f"件数が想定と異なるため書き出しません: 単語 {len(words)} 件（想定 {EXPECTED_WORDS}）、"
            f"文法 {len(grammar)} 件（想定 {EXPECTED_GRAMMAR}）"
        )

    OUTPUT_PATH.write_text(
        json.dumps({"words": words, "grammar": grammar}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"書き出し完了: {OUTPUT_PATH}（単語 {len(words)} 件、文法 {len(grammar)} 件、{size_kb:.0f} KB）")


if __name__ == "__main__":
    main()
