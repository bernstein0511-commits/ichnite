# ==========================================================
# database.py — MySQL接続の設定と、各リクエストにDBセッションを
# 渡すための get_db()（routerが Depends(get_db) で使う）を提供する。
# テーブル定義そのものは models.py 側にある。
# ==========================================================

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import config

DATABASE_URL = (
    f"mysql+pymysql://{config.DB_USER}:{config.DB_PASSWORD}"
    f"@{config.DB_HOST}:{config.DB_PORT}/{config.DB_NAME}?charset=utf8mb4"
)

engine = create_engine(
    DATABASE_URL,
    echo=True,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


# FastAPIの Depends(get_db) から呼ばれる。リクエスト処理中だけDBセッションを開き、
# 処理が終わったら（例外が出ても）必ず閉じる。
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()