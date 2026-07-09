from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db

router = APIRouter()


@router.post("/", response_model=schemas.MarkerBookResponse)
def create_marker_book(
    book: schemas.MarkerBookCreate,
    db: Session = Depends(get_db)
):
    return crud.create_marker_book(db, book)


@router.get("/", response_model=list[schemas.MarkerBookResponse])
def read_marker_book(
    db: Session = Depends(get_db)
):
    return crud.get_marker_books(db)


# 記録帳ページ用：Page / Marker / AiNote / MarkerBook を結合した一覧
# ※ "/{marker_id}" などパス変数を含むルートより先に定義する必要がある
@router.get("/full", response_model=list[schemas.MarkerBookEntryResponse])
def read_marker_book_full(
    db: Session = Depends(get_db)
):
    return crud.get_marker_book_entries(db)


# 記録帳ページ用：メモの更新（未登録なら新規作成、登録済みなら上書き）
@router.put("/{marker_id}", response_model=schemas.MarkerBookResponse)
def update_marker_book_memo(
    marker_id: int,
    payload: schemas.MarkerBookMemoUpdate,
    db: Session = Depends(get_db)
):
    return crud.upsert_marker_book_memo(db, marker_id, payload.memo)