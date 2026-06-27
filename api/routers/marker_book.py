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