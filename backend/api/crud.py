from sqlalchemy.orm import Session
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
    return db.query(models.Marker).order_by(models.Marker.created_at.desc()).all()


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


def get_ai_note(db: Session, marker_id: int):
    note = db.query(models.AiNote).filter(models.AiNote.marker_id == marker_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="AI Note not found")
    return note


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