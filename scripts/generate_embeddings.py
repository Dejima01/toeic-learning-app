"""
word_questions / grammar_questions の埋め込みベクトルを生成し、
frontend/public/embeddings.json に書き出す。Firestore のドキュメントは変更しない。

出力形式: [{ "id": "...", "type": "word" | "grammar", "embedding": [...] }]
（問題本文などのテキストは含めない）

Usage:
    py scripts/generate_embeddings.py
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

import firebase_admin
from firebase_admin import auth as admin_auth
from firebase_admin import credentials, firestore

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
SERVICE_ACCOUNT_PATH = SCRIPT_DIR / "serviceAccount.json"
ENV_PATH = PROJECT_ROOT / "frontend" / ".env.local"
OUTPUT_PATH = PROJECT_ROOT / "frontend" / "public" / "embeddings.json"

BATCH_SIZE = 20
DECIMALS = 4


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
        raise RuntimeError(f"HTTP {e.code} {url}\n{detail}") from None


def get_id_token(firebase_api_key: str) -> str:
    # 中継サーバは Firebase ID トークンで認証するため、カスタムトークンを ID トークンに交換する
    custom_token = admin_auth.create_custom_token("batch-embedder")
    if isinstance(custom_token, bytes):
        custom_token = custom_token.decode("utf-8")
    data = post_json(
        "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken"
        f"?key={firebase_api_key}",
        {"token": custom_token, "returnSecureToken": True},
    )
    return data["idToken"]


def word_text(d: dict) -> str:
    return f"単語: {d.get('word', '')} 意味: {d.get('meaning', '')}"


def grammar_text(d: dict) -> str:
    return f"問題: {d.get('question_text', '')} 解説: {d.get('explanation', '')}"


def embed_batch(proxy_url: str, id_token: str, texts: list[str]) -> list[list[float]]:
    data = post_json(
        f"{proxy_url}/api/embed",
        {"texts": texts, "task_type": "RETRIEVAL_DOCUMENT"},
        {"Authorization": f"Bearer {id_token}"},
    )
    embeddings = data["embeddings"]
    if len(embeddings) != len(texts):
        raise RuntimeError(f"埋め込み件数が一致しません: {len(embeddings)} != {len(texts)}")
    return embeddings


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
    id_token = get_id_token(firebase_api_key)

    items: list[tuple[str, str, str]] = []  # (id, type, text)
    for doc in db.collection("word_questions").stream():
        items.append((doc.id, "word", word_text(doc.to_dict())))
    for doc in db.collection("grammar_questions").stream():
        items.append((doc.id, "grammar", grammar_text(doc.to_dict())))
    print(f"対象: {len(items)} 件")

    output: list[dict] = []
    dim = None
    for start in range(0, len(items), BATCH_SIZE):
        chunk = items[start : start + BATCH_SIZE]
        vectors = embed_batch(proxy_url, id_token, [t for _, _, t in chunk])
        for (doc_id, kind, _), vec in zip(chunk, vectors):
            if dim is None:
                dim = len(vec)
            output.append({
                "id": doc_id,
                "type": kind,
                "embedding": [round(v, DECIMALS) for v in vec],
            })
        print(f"  {min(start + BATCH_SIZE, len(items))} / {len(items)}")

    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"\n書き出し完了: {OUTPUT_PATH} ({len(output)} 件, {dim} 次元, {size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
