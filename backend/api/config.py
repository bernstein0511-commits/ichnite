# ==========================================================
# config.py — backend/api/.env を読み込み、DB接続情報とOpenAI
# APIキーをアプリ全体で使える定数として公開する。
# OPENAI_API_KEYは未設定(空文字)でも動作し、その場合AI解説機能だけが
# 無効化される（services/ai_service.py 参照）。
# ==========================================================

from dotenv import load_dotenv
from pathlib import Path
import os

load_dotenv(Path(__file__).parent / ".env")

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")