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