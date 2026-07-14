"""
マスター単語リストから、指定した章の単語だけを抽出するヘルパー。

使い方:
    python scripts/extract_chapter_words.py 600 1
    → 600点台 第1章の50単語をコンソールに出力

抽出結果を Copy して、AIへのフェーズ2プロンプトに貼り付けてください。
"""

import json
import sys

def main():
    if len(sys.argv) != 3:
        print("使い方: python scripts/extract_chapter_words.py <level> <chapter_num>")
        print("例: python scripts/extract_chapter_words.py 600 1")
        sys.exit(1)
    
    level = sys.argv[1]
    chapter_num = int(sys.argv[2])
    
    with open("data/words_master.json", encoding="utf-8") as f:
        all_words = json.load(f)
    
    chapter_words = [
        w for w in all_words
        if w["level"] == level and w["chapter_num"] == chapter_num
    ]
    
    print(f"\n=== {level}点台 第{chapter_num}章 ({len(chapter_words)}単語) ===\n")
    for i, w in enumerate(chapter_words, 1):
        print(f"{i}. {w['word']}")
    print()

if __name__ == "__main__":
    main()