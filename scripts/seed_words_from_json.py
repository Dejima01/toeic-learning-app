"""
data/words/*.json の全ファイルを Firestore の word_questions コレクションに投入する。
既存のドキュメントは上書きする。

使い方:
    py scripts/seed_words_from_json.py
"""

import json
import os
import firebase_admin
from firebase_admin import credentials, firestore

# サービスアカウントで認証
cred = credentials.Certificate("scripts/serviceAccount.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

json_dir = "data/words"
total = 0

for filename in sorted(os.listdir(json_dir)):
    if not filename.startswith("words_") or not filename.endswith(".json"):
        continue
    if filename == "words_master.json":
        continue
    
    with open(os.path.join(json_dir, filename), encoding="utf-8") as f:
        words = json.load(f)
    
    for word in words:
        db.collection("word_questions").document(word["id"]).set(word)
    
    print(f"OK {filename}: {len(words)}件登録")
    total += len(words)

print(f"\n完了: 合計 {total}件登録")