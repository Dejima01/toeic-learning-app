"""
指定した grammar_master_*.json からカテゴリ一覧を抽出する。

使い方:
    py scripts/extract_categories.py data/grammar/grammar_master_600.json
    py scripts/extract_categories.py data/grammar/grammar_master_600.json data/grammar/grammar_master_750.json
    (複数指定すると全部まとめて出力)
"""

import json
import sys

def main():
    if len(sys.argv) < 2:
        print("使い方: py scripts/extract_categories.py <json_file> [<json_file2> ...]")
        sys.exit(1)
    
    all_categories = []
    for filepath in sys.argv[1:]:
        with open(filepath, encoding="utf-8") as f:
            data = json.load(f)
        for item in data:
            all_categories.append({
                "category": item["category"],
                "category_ja": item["category_ja"],
                "level": item["level"]
            })
    
    print("=" * 60)
    print(f"既出カテゴリ一覧 ({len(all_categories)}個)")
    print("=" * 60)
    for c in all_categories:
        print(f"- {c['category']} ({c['category_ja']}) [{c['level']}点台]")

if __name__ == "__main__":
    main()