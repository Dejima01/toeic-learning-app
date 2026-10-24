"""
word_questions / grammar_questions の埋め込みベクトルを生成し、
frontend/public/embeddings.json に書き出す。Firestore のドキュメントは変更しない。

出力形式: [{ "id": "...", "type": "word" | "grammar", "hash": "...", "embedding": [...] }]
（問題本文などのテキストは含めない。hash は埋め込み対象テキストの sha1 先頭 8 文字）

- バッチごとに embeddings.json へ保存するので、途中で止まっても再実行で続きから処理する
- テキストが変わったデータ（hash 不一致）は自動で再ベクトル化する
- 429 を受けたら待って再試行し、それでもだめならその日の上限とみなして正常終了する

Usage:
    py scripts/generate_embeddings.py
"""

import hashlib
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import firebase_admin
from firebase_admin import auth as admin_auth
from firebase_admin import credentials, firestore

# ── 調整用定数 ──
BATCH_SIZE = 20                         # 1 リクエストで送るテキスト数
BATCH_INTERVAL_SEC = 15                 # バッチ間の待機秒数（20件/15秒 ≒ 最大80件/分）
RETRY_WAITS_SEC = [60, 120, 240, 480]   # 429 時の待機秒数（この回数だけ再試行）
TOKEN_REFRESH_SEC = 50 * 60             # ID トークン（有効期限 1 時間）の再取得間隔

DECIMALS = 4
EXPECTED_DIM = 256

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
SERVICE_ACCOUNT_PATH = SCRIPT_DIR / "serviceAccount.json"
ENV_PATH = PROJECT_ROOT / "frontend" / ".env.local"
OUTPUT_PATH = PROJECT_ROOT / "frontend" / "public" / "embeddings.json"


class HttpError(RuntimeError):
    def __init__(self, status: int, url: str, body: str, retry_after: str | None):
        super().__init__(f"HTTP {status} {url}\n{body}")
        self.status = status
        self.body = body
        self.retry_after = retry_after


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def post_json(url: str, body: dict, headers: dict[str, str] | None = None) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise HttpError(e.code, url, detail, e.headers.get("Retry-After")) from None


class TokenProvider:
    # 中継サーバは Firebase ID トークンで認証するため、カスタムトークンを ID トークンに交換する
    def __init__(self, firebase_api_key: str):
        self._api_key = firebase_api_key
        self._token = ""
        self._issued_at = 0.0

    def refresh(self) -> None:
        custom_token = admin_auth.create_custom_token("batch-embedder")
        if isinstance(custom_token, bytes):
            custom_token = custom_token.decode("utf-8")
        data = post_json(
            "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken"
            f"?key={self._api_key}",
            {"token": custom_token, "returnSecureToken": True},
        )
        self._token = data["idToken"]
        self._issued_at = time.monotonic()

    def get(self) -> str:
        if not self._token or time.monotonic() - self._issued_at > TOKEN_REFRESH_SEC:
            self.refresh()
        return self._token


def word_text(d: dict) -> str:
    return f"単語: {d.get('word', '')} 意味: {d.get('meaning', '')}"


def grammar_text(d: dict) -> str:
    return f"問題: {d.get('question_text', '')} 解説: {d.get('explanation', '')}"


def text_hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]


def embed_batch(proxy_url: str, id_token: str, texts: list[str]) -> list[list[float]]:
    data = post_json(
        f"{proxy_url}/api/embed",
        {"texts": texts, "task_type": "RETRIEVAL_DOCUMENT"},
        {"Authorization": f"Bearer {id_token}"},
    )
    embeddings = data["embeddings"]
    if len(embeddings) != len(texts):
        raise RuntimeError(f"埋め込み件数が一致しません: {len(embeddings)} != {len(texts)}")
    for vec in embeddings:
        if len(vec) != EXPECTED_DIM:
            raise RuntimeError(f"次元数が想定と異なります: {len(vec)} (想定 {EXPECTED_DIM})")
    return embeddings


def embed_with_retry(
    proxy_url: str, tokens: TokenProvider, texts: list[str]
) -> list[list[float]] | None:
    """成功したら埋め込みを返す。429 の再試行を使い切ったら None を返す。"""
    attempt = 0
    token_refreshed = False
    while True:
        try:
            return embed_batch(proxy_url, tokens.get(), texts)
        except HttpError as e:
            if e.status == 401 and not token_refreshed:
                print("  HTTP 401: ID トークンを再取得して再送します")
                tokens.refresh()
                token_refreshed = True
                continue
            if e.status != 429:
                raise
            print(f"  HTTP 429: {e.body.strip()}  (Retry-After: {e.retry_after or 'なし'})")
            if attempt >= len(RETRY_WAITS_SEC):
                return None
            wait = RETRY_WAITS_SEC[attempt]
            if e.retry_after and e.retry_after.isdigit():
                wait = max(wait, int(e.retry_after))
            attempt += 1
            print(f"  {wait} 秒待って再試行します ({attempt}/{len(RETRY_WAITS_SEC)})")
            time.sleep(wait)


def load_existing(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        sys.exit(f"{path} を読み込めません（{e}）。上書きを避けるため停止します。内容を確認してください。")
    if not isinstance(data, list):
        sys.exit(f"{path} の形式が想定と異なります（配列ではありません）。停止します。")
    return {e["id"]: e for e in data if isinstance(e, dict) and "id" in e}


def save_atomic(path: Path, entries: list[dict]) -> None:
    # 一時ファイルに書いてから置き換えるので、途中で強制終了しても元のファイルが壊れない
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(json.dumps(entries, ensure_ascii=False, separators=(",", ":")))
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def format_eta(seconds: float) -> str:
    if seconds < 60:
        return "1 分未満"
    return f"約 {math.ceil(seconds / 60)} 分"


def main() -> None:
    if not SERVICE_ACCOUNT_PATH.exists():
        sys.exit(f"サービスアカウント鍵が見つかりません: {SERVICE_ACCOUNT_PATH}")
    if not ENV_PATH.exists():
        sys.exit(f".env.local が見つかりません: {ENV_PATH}")

    env = load_env(ENV_PATH)
    proxy_url = env.get("VITE_PROXY_URL", "").rstrip("/")
    firebase_api_key = env.get("VITE_FIREBASE_API_KEY", "")
    if not proxy_url or not firebase_api_key:
        sys.exit(".env.local に VITE_PROXY_URL と VITE_FIREBASE_API_KEY が必要です")

    firebase_admin.initialize_app(credentials.Certificate(str(SERVICE_ACCOUNT_PATH)))
    db = firestore.client()
    tokens = TokenProvider(firebase_api_key)

    items: list[tuple[str, str, str, str]] = []  # (id, type, text, hash)
    for doc in db.collection("word_questions").stream():
        text = word_text(doc.to_dict())
        items.append((doc.id, "word", text, text_hash(text)))
    for doc in db.collection("grammar_questions").stream():
        text = grammar_text(doc.to_dict())
        items.append((doc.id, "grammar", text, text_hash(text)))

    current_ids = {item[0] for item in items}
    existing = load_existing(OUTPUT_PATH)
    stale = [doc_id for doc_id in existing if doc_id not in current_ids]
    results = {doc_id: e for doc_id, e in existing.items() if doc_id in current_ids}

    pending = [
        item for item in items
        if not (item[0] in results and results[item[0]].get("hash") == item[3])
    ]
    changed = sum(1 for item in pending if item[0] in results)

    def ordered_results() -> list[dict]:
        return [results[item[0]] for item in items if item[0] in results]

    print(f"対象: {len(items)} 件")
    print(f"  処理済み（スキップ）: {len(items) - len(pending)} 件")
    print(f"  今回処理: {len(pending)} 件（うち内容変更による再ベクトル化 {changed} 件）")
    if stale:
        print(f"  Firestore に存在しないため除外: {len(stale)} 件")
        save_atomic(OUTPUT_PATH, ordered_results())

    if not pending:
        print("\nすべて処理済みです。")
        return

    start_time = time.monotonic()
    done_now = 0
    batch_count = math.ceil(len(pending) / BATCH_SIZE)
    for batch_index in range(batch_count):
        if batch_index > 0:
            time.sleep(BATCH_INTERVAL_SEC)
        chunk = pending[batch_index * BATCH_SIZE : (batch_index + 1) * BATCH_SIZE]
        vectors = embed_with_retry(proxy_url, tokens, [item[2] for item in chunk])
        if vectors is None:
            remaining = len(pending) - done_now
            print(f"\n本日の上限の可能性があります。明日再実行してください。")
            print(f"  完了 {len(items) - remaining} / {len(items)} 件、残り {remaining} 件（保存済み）")
            sys.exit(0)

        for (doc_id, kind, _, h), vec in zip(chunk, vectors):
            results[doc_id] = {
                "id": doc_id,
                "type": kind,
                "hash": h,
                "embedding": [round(v, DECIMALS) for v in vec],
            }
        save_atomic(OUTPUT_PATH, ordered_results())

        done_now += len(chunk)
        remaining = len(pending) - done_now
        avg_batch_sec = (time.monotonic() - start_time) / (batch_index + 1)
        eta = avg_batch_sec * math.ceil(remaining / BATCH_SIZE)
        print(
            f"[完了 {len(items) - remaining} / {len(items)}] 残り {remaining} 件  "
            f"推定残り時間 {format_eta(eta) if remaining else '0 分'}"
        )

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"\n書き出し完了: {OUTPUT_PATH} ({len(results)} 件, {size_kb:.0f} KB)")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n中断しました。再実行で続きから処理します（成功したバッチまで保存済み）。")
        sys.exit(130)
