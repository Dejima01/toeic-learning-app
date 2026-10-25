"""
各単語について「関連する単語」上位3件を算出し、data/words/*.json に書き戻す。

frontend/public/embeddings.json のベクトル（単語名＋意味をまとめて埋め込んだもの）の
コサイン類似度で求める。結果を単語データに持たせておくことで、アプリ側は
embeddings.json（2.3MB）を読み込まずに表示できる。

単語名と意味を一緒に保存するのは、ID だけだと表示のたびに関連語の
ドキュメントを引く必要があり、1章あたり150回の追加読み取りになるため。

使い方:
    py scripts/generate_similar_words.py            # 書き込む
    py scripts/generate_similar_words.py --dry-run  # 結果を確認するだけ

このあと Firestore へ反映するには、続けて以下を実行する:
    py scripts/seed_words_from_json.py
"""

import json
import math
import os
import sys

EMBEDDINGS_PATH = "frontend/public/embeddings.json"
WORDS_DIR = "data/words"
TOP_K = 3


def load_embeddings() -> dict[str, list[float]]:
    with open(EMBEDDINGS_PATH, encoding="utf-8") as f:
        entries = json.load(f)
    return {e["id"]: e["embedding"] for e in entries if e.get("type") == "word"}


def word_files() -> list[str]:
    """章ごとの単語ファイル（words_master.json は投入対象外なので除く）"""
    return sorted(
        name
        for name in os.listdir(WORDS_DIR)
        if name.startswith("words_")
        and name.endswith(".json")
        and name != "words_master.json"
    )


def dump_words(items: list[dict]) -> str:
    """既存ファイルと同じ整形で書き出す（要素オブジェクトは1行に収める）。

    標準の json.dump(indent=2) だと example_sentences などが行展開され、
    中身が変わっていないのに差分が全行に及んでしまうため。
    """
    blocks = []
    for item in items:
        lines = []
        for key, value in item.items():
            if isinstance(value, list) and value and isinstance(value[0], dict):
                inner = ",\n".join(
                    "      " + json.dumps(v, ensure_ascii=False) for v in value
                )
                lines.append('    "' + key + '": [\n' + inner + "\n    ]")
            else:
                lines.append('    "' + key + '": ' + json.dumps(value, ensure_ascii=False))
        blocks.append("  {\n" + ",\n".join(lines) + "\n  }")
    return "[\n" + ",\n".join(blocks) + "\n]\n"


def normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec))
    return [x / norm for x in vec] if norm else vec


def main() -> None:
    dry_run = "--dry-run" in sys.argv

    embeddings = load_embeddings()
    print("ベクトル: " + str(len(embeddings)) + " 件")

    # 単語データを読み込む（ファイルごとに保持して、あとで同じ形で書き戻す）
    files: dict[str, list[dict]] = {}
    words: dict[str, dict] = {}
    for name in word_files():
        with open(os.path.join(WORDS_DIR, name), encoding="utf-8") as f:
            items = json.load(f)
        files[name] = items
        for item in items:
            words[item["id"]] = item
    print("単語データ: " + str(len(words)) + " 件（" + str(len(files)) + " ファイル）")

    # ベクトルと単語データの両方が揃っているものだけを対象にする
    ids = [wid for wid in embeddings if wid in words]
    missing = len(words) - len(ids)
    if missing:
        print("  ※ ベクトルが無い単語が " + str(missing) + " 件あります（スキップします）")

    vectors = [normalize(embeddings[wid]) for wid in ids]

    print("類似度を計算しています...")
    similar: dict[str, list[dict]] = {}
    for a, wid in enumerate(ids):
        va = vectors[a]
        scored = []
        for b, other in enumerate(ids):
            if b == a:
                continue
            vb = vectors[b]
            scored.append((sum(x * y for x, y in zip(va, vb)), other))
        scored.sort(reverse=True)
        similar[wid] = [
            {"word": words[other]["word"], "meaning": words[other]["meaning"]}
            for _, other in scored[:TOP_K]
        ]
        if (a + 1) % 200 == 0:
            print("  " + str(a + 1) + " / " + str(len(ids)))

    # 確認用に数件だけ表示する
    print("")
    print("--- サンプル ---")
    for wid in ids[:3]:
        print(words[wid]["word"] + "（" + words[wid]["meaning"] + "）")
        for s in similar[wid]:
            print("    " + s["word"] + "  " + s["meaning"])

    if dry_run:
        print("")
        print("--dry-run のため書き込みません")
        return

    for name, items in files.items():
        for item in items:
            if item["id"] in similar:
                item["similar_words"] = similar[item["id"]]
        path = os.path.join(WORDS_DIR, name)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(dump_words(items))
    print("")
    print(str(len(files)) + " ファイルに similar_words を書き込みました")
    print("Firestore へ反映するには py scripts/seed_words_from_json.py を実行してください")


if __name__ == "__main__":
    main()
