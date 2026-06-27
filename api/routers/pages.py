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