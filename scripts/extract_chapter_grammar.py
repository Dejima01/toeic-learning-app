"""
マスター文法問題リストから、指定した章の問題だけを抽出するヘルパー。

使い方:
    py scripts/extract_chapter_grammar.py 600 1
    → 600点台 第1章の10問をコンソールに出力

抽出結果を Copy して、AIへのフェーズ2プロンプトに貼り付けてください。
"""

import json
import sys

def main():
    if len(sys.argv) != 3:
        print("使い方: py scripts/extract_chapter_grammar.py <level> <chapter_num>")
        print("例: py scripts/extract_chapter_grammar.py 600 1")
        sys.exit(1)
    
    level = sys.argv[1]
    chapter_num = int(sys.argv[2])
    
    master_file = f"data/grammar/grammar_master_{level}.json"
    with open(master_file, encoding="utf-8") as f:
        all_problems = json.load(f)
    
    chapter_problems = [
        p for p in all_problems
        if p["level"] == level and p["chapter_num"] == chapter_num
    ]
    
    print(f"\n=== {level}点台 第{chapter_num}章 ({len(chapter_problems)}問) ===\n")
    for p in chapter_problems:
        print(f"[id: {p['id']}] category: {p['category']} ({p['category_ja']})")
        print(f"  question: {p['question_text']}")
        print(f"  choices: {p['choices']}")
        print(f"  correct_index: {p['correct_index']}")
        print()

if __name__ == "__main__":
    main()