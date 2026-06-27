def create_marker_book(db: Session, book: schemas.MarkerBookCreate):

    db_book = models.MarkerBook(

        marker_id=book.marker_id,

        memo=book.memo

    )

    db.add(db_book)

    db.commit()

    db.refresh(db_book)

    return db_book


def get_marker_books(db: Session):

    return db.query(models.MarkerBook).all()