#!/bin/bash
# Ichnite バックエンド起動スクリプト（macOS/Linux用）
# 実行するだけで、仮想環境の作成・依存関係のインストール・サーバー起動までを自動で行う。

cd "$(dirname "$0")/backend/api" || exit 1

if [ ! -d ".venv" ]; then
    echo "[1/2] 初回セットアップ中（仮想環境を作成しています）..."
    python3 -m venv .venv
fi

source .venv/bin/activate

echo "[2/2] 必要なパッケージを確認しています..."
pip install -q -r requirements.txt

echo ""
echo "Ichnite バックエンドを起動します（終了するには Ctrl+C）"
echo "http://localhost:8000/docs が開けば起動成功です"
echo ""

uvicorn main:app --reload
