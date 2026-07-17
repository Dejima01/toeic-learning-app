"""
data/grammar/grammar_<level>_ch<chapter>.json のファイルを
Firestore の grammar_questions コレクションに投入する。
既存のドキュメントは上書きする。

使い方:
    py scripts/seed_grammar_from_json.py
"""

import json
import os
import firebase_admin
from firebase_admin import credentials, firestore

# サービスアカウントで認証
cred = credentials.Certificate("scripts/serviceAccount.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

json_dir = "data/grammar"
total = 0

for filename in sorted(os.listdir(json_dir)):
    # マスターファイルは投入対象外
    if filename.startswith("grammar_master_"):
        continue
    # 章別ファイルのみ対象
    if not filename.startswith("grammar_") or not filename.endswith(".json"):
        continue
    
    with open(os.path.join(json_dir, filename), encoding="utf-8") as f:
        problems = json.load(f)
    
    for problem in problems:
        db.collection("grammar_questions").document(problem["id"]).set(problem)
    
    print(f"OK {filename}: {len(problems)}問登録")
    total += len(problems)

print(f"\n完了: 合計 {total}問登録")