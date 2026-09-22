"""
バッジ画像の白背景を透過する。
縁からの BFS flood-fill で背景色を特定し、バッジ本体には触れない。

Usage:
    py scripts/make_badges_transparent.py [--threshold 40]
"""

import argparse
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

BADGES_DIR = Path(__file__).parent.parent / "frontend" / "public" / "badges"
BADGE_FILES = ["bronze.png", "silver.png", "gold.png"]
DEFAULT_THRESHOLD = 40


def color_distance(a: np.ndarray, b: np.ndarray) -> float:
    """RGB ユークリッド距離"""
    return float(np.sqrt(np.sum((a.astype(float) - b.astype(float)) ** 2)))


def remove_background(img_path: Path, threshold: int) -> dict:
    img = Image.open(img_path).convert("RGBA")
    data = np.array(img)  # shape: (H, W, 4)
    h, w = data.shape[:2]

    # ── 四隅の RGB 平均を背景色とみなす ──
    corners = [
        data[0, 0, :3],
        data[0, w - 1, :3],
        data[h - 1, 0, :3],
        data[h - 1, w - 1, :3],
    ]
    bg_color = np.mean(corners, axis=0)

    # ── 縁の全ピクセルをキューへ ──
    visited = np.zeros((h, w), dtype=bool)
    queue = deque()

    for x in range(w):
        queue.append((0, x))
        queue.append((h - 1, x))
        visited[0, x] = True
        visited[h - 1, x] = True
    for y in range(1, h - 1):
        queue.append((y, 0))
        queue.append((y, w - 1))
        visited[y, 0] = True
        visited[y, w - 1] = True

    # ── BFS ──
    transparent_count = 0
    while queue:
        y, x = queue.popleft()
        pixel_rgb = data[y, x, :3]
        if color_distance(pixel_rgb, bg_color) <= threshold:
            data[y, x, 3] = 0  # alpha = 0
            transparent_count += 1
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((ny, nx))

    result = Image.fromarray(data, "RGBA")
    result.save(img_path, "PNG")

    total_pixels = h * w
    return {
        "size": (w, h),
        "total_pixels": total_pixels,
        "transparent_pixels": transparent_count,
        "transparent_ratio": transparent_count / total_pixels * 100,
        "has_alpha": True,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD,
                        help=f"背景とみなす色距離の閾値 (default: {DEFAULT_THRESHOLD})")
    args = parser.parse_args()

    print(f"閾値: {args.threshold}\n")
    all_ok = True

    for name in BADGE_FILES:
        path = BADGES_DIR / name
        if not path.exists():
            print(f"[SKIP] {name} が見つかりません")
            continue

        stats = remove_background(path, args.threshold)
        ratio = stats["transparent_ratio"]
        w, h = stats["size"]

        status = "OK"
        if ratio < 5:
            status = "WARNING: 透過率が低すぎます → --threshold を上げて再実行してください"
            all_ok = False
        elif ratio > 90:
            status = "WARNING: 透過率が高すぎます → --threshold を下げて再実行してください"
            all_ok = False

        print(f"[{name}]")
        print(f"  サイズ       : {w} x {h} px")
        print(f"  総ピクセル   : {stats['total_pixels']:,}")
        print(f"  透過ピクセル : {stats['transparent_pixels']:,} ({ratio:.1f}%)")
        print(f"  アルファ     : {'あり (RGBA)' if stats['has_alpha'] else 'なし'}")
        print(f"  判定         : {status}")
        print()

    if all_ok:
        print("すべての画像の変換が正常に完了しました。")
    else:
        print("警告があります。閾値を調整して再実行してください。")
        sys.exit(1)


if __name__ == "__main__":
    main()
