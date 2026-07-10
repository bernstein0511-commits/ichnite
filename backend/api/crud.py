# ==========================================================
# crud.py — 実際のDB読み書きをまとめた層。
# routers/*.py はHTTPの窓口に徹し、DB操作はすべてここの関数に委譲する。
# ==========================================================

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

import models
import schemas


# ==========================
# Page
# ==========================

def create_page(db: Session, page: schemas.PageCreate):
    # 同じURLがすでにあればそれを返す（重複防止）
    existing = db.query(models.Page).filter(models.Page.url == page.url).first()
    if existing:
        return existing

    db_page = models.Page(
        url=page.url,
        title=page.title
    )
    db.add(db_page)
    db.commit()
    db.refresh(db_page)
    return db_page


def get_pages(db: Session):
    return db.query(models.Page).order_by(models.Page.created_at.desc()).all()


# ==========================
# Marker
# ==========================

def create_marker(db: Session, marker: schemas.MarkerCreate):
    db_marker = models.Marker(
        page_id=marker.page_id,
        selected_text=marker.selected_text,
        color=marker.color,
        position_start=marker.position_start,
        position_end=marker.position_end,
    )
    db.add(db_marker)
    db.commit()
    db.refresh(db_marker)
    return db_marker


def get_markers(db: Session):
    return (
        db.query(models.Marker)
        .options(joinedload(models.Marker.page))
        .order_by(models.Marker.created_at.desc())
        .all()
    )


def delete_marker(db: Session, marker_id: int):
    marker = db.query(models.Marker).filter(models.Marker.marker_id == marker_id).first()
    if not marker:
        raise HTTPException(status_code=404, detail="Marker not found")
    db.delete(marker)
    db.commit()
    return {"message": "deleted"}


# ==========================
# AI Note
# ==========================

def create_ai_note(db: Session, note: schemas.AiNoteCreate):
    existing = db.query(models.AiNote).filter(models.AiNote.marker_id == note.marker_id).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="AI note already exists for this marker. Use PUT /ai_notes/{marker_id} to regenerate."
        )

    db_note = models.AiNote(
        marker_id=note.marker_id,
        explanation=note.explanation,
        similar_words=note.similar_words,
        antonyms=note.antonyms,
        translation=note.translation,
        usage_example=note.usage_example,
        user_memo=note.user_memo,
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note


# marker_idごとに一意（unique制約）のため、既存があれば上書き、無ければ新規作成する。
# マーカー記録帳からの再生成・リトライでも安全に呼べるようにするため。
def upsert_ai_note(db: Session, note: schemas.AiNoteCreate):
    existing = db.query(models.AiNote).filter(models.AiNote.marker_id == note.marker_id).first()

    if existing:
        existing.explanation = note.explanation
        existing.similar_words = note.similar_words
        existing.antonyms = note.antonyms
        existing.translation = note.translation
        existing.usage_example = note.usage_example
        db.commit()
        db.refresh(existing)
        return existing

    return create_ai_note(db, note)


def get_ai_note(db: Session, marker_id: int):
    note = db.query(models.AiNote).filter(models.AiNote.marker_id == marker_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="AI Note not found")
    return note


def update_ai_note(db: Session, marker_id: int, note: schemas.AiNoteCreate):
    existing = db.query(models.AiNote).filter(models.AiNote.marker_id == marker_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="AI Note not found")

    # AI生成項目のみ上書きし、user_memoはユーザー入力のため保持する
    existing.explanation = note.explanation
    existing.similar_words = note.similar_words
    existing.antonyms = note.antonyms
    existing.translation = note.translation
    existing.usage_example = note.usage_example

    db.commit()
    db.refresh(existing)
    return existing


# ==========================
# Marker Book
# ==========================

def create_marker_book(db: Session, book: schemas.MarkerBookCreate):
    db_book = models.MarkerBook(
        marker_id=book.marker_id,
        memo=book.memo,
    )
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    return db_book


def get_marker_books(db: Session):
    return db.query(models.MarkerBook).order_by(models.MarkerBook.created_at.desc()).all()


def upsert_marker_book_memo(db: Session, marker_id: int, memo: str):
    marker = db.query(models.Marker).filter(models.Marker.marker_id == marker_id).first()
    if not marker:
        raise HTTPException(status_code=404, detail="Marker not found")

    entry = db.query(models.MarkerBook).filter(models.MarkerBook.marker_id == marker_id).first()

    if entry:
        entry.memo = memo
        db.commit()
        db.refresh(entry)
        return entry

    db_entry = models.MarkerBook(marker_id=marker_id, memo=memo)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


# ==========================
# 記録帳ページ用（一覧を結合して1件ずつ返す）
# GET /marker_book/full の実体。Marker起点にPage/AiNote/MarkerBookを
# joinedloadでまとめて取得し、フラットな辞書のリストに整形して返す。
# ==========================

def get_marker_book_entries(db: Session):
    markers = (
        db.query(models.Marker)
        .options(
            joinedload(models.Marker.page),
            joinedload(models.Marker.ai_note),
            joinedload(models.Marker.marker_book),
        )
        .order_by(models.Marker.created_at.desc())
        .all()
    )

    entries = []
    for m in markers:
        entries.append({
            "marker_id": m.marker_id,
            "selected_text": m.selected_text,
            "color": m.color,
            "created_at": m.created_at,
            "page_id": m.page_id,
            "page_url": m.page.url if m.page else "",
            "page_title": m.page.title if m.page else None,
            "explanation": m.ai_note.explanation if m.ai_note else None,
            "similar_words": m.ai_note.similar_words if m.ai_note else None,
            "antonyms": m.ai_note.antonyms if m.ai_note else None,
            "usage_example": m.ai_note.usage_example if m.ai_note else None,
            "translation": m.ai_note.translation if m.ai_note else None,
            "memo": m.marker_book.memo if m.marker_book else None,
        })
    return entries