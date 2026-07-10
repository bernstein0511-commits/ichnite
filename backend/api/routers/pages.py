# ==========================================================
# routers/pages.py — /pages 配下のエンドポイント。
# 拡張機能はマーカーを保存する前に必ずPOST /pages/を呼び、
# 現在見ているページのpage_idを取得してからマーカーを保存する
# （storage.js の getOrCreatePage() 参照）。
# ==========================================================

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db

router = APIRouter()


@router.post("/", response_model=schemas.PageResponse)
def create_page(
    page: schemas.PageCreate,
    db: Session = Depends(get_db)
):
    return crud.create_page(db, page)


@router.get("/", response_model=list[schemas.PageResponse])
def read_pages(
    db: Session = Depends(get_db)
):
    return crud.get_pages(db)