from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db

router = APIRouter()


@router.post("/", response_model=schemas.AiNoteResponse)
def create_ai_note(
    note: schemas.AiNoteCreate,
    db: Session = Depends(get_db)
):
    return crud.create_ai_note(db, note)


@router.get("/{marker_id}", response_model=schemas.AiNoteResponse)
def get_ai_note(
    marker_id: int,
    db: Session = Depends(get_db)
):
    return crud.get_ai_note(db, marker_id)