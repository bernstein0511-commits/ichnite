# ==========================================================
# database.py — SQLite接続の設定と、各リクエストにDBセッションを
# 渡すための get_db()（routerが Depends(get_db) で使う）を提供する。
# テーブル定義そのものは models.py 側にある。
#
# DBはconfig.DB_PATHの単一ファイル（既定: backend/ichnite.db）。
# サーバープロセスや追加のインストールが不要で、Pythonだけでそのまま動く。
# ==========================================================

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import config

DATABASE_URL = f"sqlite:///{config.DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    echo=True,
    # SQLiteの接続はデフォルトで作成したスレッドでしか使えないが、FastAPIは
    # リクエストごとに別スレッドから同じセッションを使うためこの指定が必要
    connect_args={"check_same_thread": False},
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
