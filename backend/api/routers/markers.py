def create_marker(db: Session, marker: schemas.MarkerCreate):

    db_marker = models.Marker(

        page_id=marker.page_id,

        selected_text=marker.selected_text,

        color=marker.color,

        position_start=marker.position_start,

        position_end=marker.position_end

    )

    db.add(db_marker)
    db.commit()
    db.refresh(db_marker)

    return db_marker


def get_markers(db: Session):

    return db.query(models.Marker).all()


def get_marker(db: Session, marker_id: int):

    return db.query(models.Marker).filter(

        models.Marker.marker_id == marker_id

    ).first()