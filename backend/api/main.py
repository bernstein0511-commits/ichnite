from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

# テーブル作成
Base.metadata.create_all(bind=engine)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 開発用
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router登録
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