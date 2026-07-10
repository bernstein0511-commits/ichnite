# ==========================================================
# routers/markers.py — /markers 配下のエンドポイント（マーカー本体のCRUD）。
# GET /markers/ はページ絞り込みをせず全件返す。ページ単位の絞り込みは
# 拡張機能側（storage.js の fetchMarkersForPage）でpage_idを見て行っている。
# ==========================================================

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db

router = APIRouter()


@router.post("/", response_model=schemas.MarkerResponse)
def create_marker(
    marker: schemas.MarkerCreate,
    db: Session = Depends(get_db)
):
    return crud.create_marker(db, marker)


@router.get("/", response_model=list[schemas.MarkerResponse])
def read_markers(
    db: Session = Depends(get_db)
):
    return crud.get_markers(db)


@router.delete("/{marker_id}")
def delete_marker(
    marker_id: int,
    db: Session = Depends(get_db)
):
    return crud.delete_marker(db, marker_id)