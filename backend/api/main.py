# ==========================================================
# main.py — バックエンド(FastAPI)のエントリーポイント。
# 役割：アプリ初期化、CORS/PNA対応、各routerの登録のみを行う。
# 実際のDB操作はcrud.py、リクエスト/レスポンスの形はschemas.py、
# テーブル定義はmodels.pyに分離してある。
# ==========================================================

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from database import engine
from models import Base

from routers import pages
from routers import markers
from routers import ai_notes
from routers import marker_book

app = FastAPI(
    title="ichnite API",
    version="1.0"
)

# 起動時にmodels.pyで定義したテーブルが無ければ作成する（マイグレーションは使っていない）
Base.metadata.create_all(bind=engine)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Private Network Access 対応ミドルウェア
# ブラウザの拡張機能側（background.js）がlocalhostへfetchする際、
# Chromiumがpreflight(OPTIONS)にこのヘッダーを要求してくることがあるため付与している。
@app.middleware("http")
async def add_private_network_header(request: Request, call_next):
    if request.method == "OPTIONS":
        response = Response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


# Router登録（それぞれ routers/*.py にエンドポイント定義がある）
# /pages        … 閲覧ページの登録・一覧（拡張機能が自動で呼ぶ）
# /markers      … マーカーそのもののCRUD
# /ai_notes     … AI解説の生成・取得
# /marker_book  … 記録帳ページ用に4テーブルを結合した一覧・メモ更新
app.include_router(
    pages.router,
    prefix="/pages",
    tags=["Pages"]
)

app.include_router(
    markers.router,
    prefix="/markers",
    tags=["Markers"]
)

app.include_router(
    ai_notes.router,
    prefix="/ai_notes",
    tags=["AI Notes"]
)

app.include_router(
    marker_book.router,
    prefix="/marker_book",
    tags=["Marker Book"]
)


@app.get("/")
def root():
    return {"message": "ichnite API"}