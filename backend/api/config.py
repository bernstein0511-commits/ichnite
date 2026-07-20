# ==========================================================
# config.py — backend/api/.env（あれば）を読み込み、DB保存先パスと
# OpenAI APIキーをアプリ全体で使える定数として公開する。
#
# .envファイルは無くてもそのまま動く：
#   - DB_PATH … 未設定なら backend/ichnite.db（SQLiteの単一ファイル）を使う
#   - OPENAI_API_KEY … 未設定でもコア機能（マーカーの作成・保存・記録帳等）は動く。
#     AI解説機能だけが無効化される（services/ai_service.py 参照）
# ==========================================================

from dotenv import load_dotenv
from pathlib import Path
import os

load_dotenv(Path(__file__).parent / ".env")

# backend/api/config.py から見て backend/ 直下にSQLiteファイルを置く
_DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "ichnite.db"
DB_PATH = os.getenv("DB_PATH", str(_DEFAULT_DB_PATH))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
