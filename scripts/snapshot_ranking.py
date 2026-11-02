"""
連続記録ランキングの順位を1日1回記録する（1週間前との比較用）。

GitHub Actions から毎日 JST 0:05 に実行する。
leaderboard を全件読み、アプリと同じ条件で順位を付けて
leaderboard_snapshots/{YYYY-MM-DD}（JST の日付）に保存する。14日より古い記録は削除する。

認証:
    本番: 環境変数 FIREBASE_SERVICE_ACCOUNT にサービスアカウントの JSON を入れる
         （ファイルには書き出さず、内容をログにも出さない）
    ローカル検証: FIRESTORE_EMULATOR_HOST と GCLOUD_PROJECT を指定するとエミュレータに接続する
"""

import json
import os
import sys
from datetime import date, datetime, timedelta, timezone

from google.cloud import firestore
from google.oauth2 import service_account

JST = timezone(timedelta(hours=9))
KEEP_DAYS = 14
EPOCH = date(1970, 1, 1)


def make_client() -> firestore.Client:
    if os.environ.get("FIRESTORE_EMULATOR_HOST"):
        return firestore.Client(project=os.environ.get("GCLOUD_PROJECT", "demo-ranking"))

    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if not raw:
        sys.exit("FIREBASE_SERVICE_ACCOUNT が設定されていません")
    try:
        info = json.loads(raw)
    except json.JSONDecodeError:
        # 内容は出さない
        sys.exit("FIREBASE_SERVICE_ACCOUNT が JSON として読めません")
    creds = service_account.Credentials.from_service_account_info(info)
    return firestore.Client(project=info["project_id"], credentials=creds)


def assign_ranks(values: list[int]) -> list[int]:
    """記録の多い順に並んだ値へ順位を付ける。同じ値は同順位（1, 2, 2, 4）"""
    ranks: list[int] = []
    for i, v in enumerate(values):
        ranks.append(ranks[i - 1] if i > 0 and v == values[i - 1] else i + 1)
    return ranks


def main() -> None:
    client = make_client()
    today = datetime.now(JST).date()
    t = (today - EPOCH).days

    entries = []
    for snap in client.collection("leaderboard").stream():
        d = snap.to_dict() or {}
        streak = d.get("streak")
        last_active = d.get("lastActiveDay")
        if d.get("hidden") is True:
            continue
        if not isinstance(streak, int) or streak <= 0:
            continue
        # アプリと同じく、昨日・今日に活動していない人は連続が切れている
        if not isinstance(last_active, int) or not (t - 1 <= last_active <= t + 1):
            continue
        reached = d.get("streakReachedAt")
        reached_key = reached.timestamp() if hasattr(reached, "timestamp") else float("inf")
        entries.append((streak, reached_key, snap.id))

    entries.sort(key=lambda e: (-e[0], e[1], e[2]))
    ranks = assign_ranks([e[0] for e in entries])
    rank_map = {e[2]: r for e, r in zip(entries, ranks)}

    client.collection("leaderboard_snapshots").document(today.isoformat()).set(
        {"ranks": rank_map, "count": len(rank_map), "createdAt": firestore.SERVER_TIMESTAMP}
    )

    cutoff = (today - timedelta(days=KEEP_DAYS)).isoformat()
    deleted = 0
    for snap in client.collection("leaderboard_snapshots").stream():
        if snap.id < cutoff:
            snap.reference.delete()
            deleted += 1

    print(f"{today.isoformat()}: {len(rank_map)} 人の順位を記録しました（古い記録を {deleted} 件削除）")


if __name__ == "__main__":
    main()
