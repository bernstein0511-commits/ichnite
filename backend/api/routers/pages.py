def create_page(db: Session, page: schemas.PageCreate):

    db_page = models.Page(
        url=page.url,
        title=page.title
    )

    db.add(db_page)
    db.commit()
    db.refresh(db_page)

    return db_page


def get_pages(db: Session):

    return db.query(models.Page).all()


def get_page(db: Session, page_id: int):

    return db.query(models.Page).filter(
        models.Page.page_id == page_id
    ).first()