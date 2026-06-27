def create_ai_note(db: Session, note: schemas.AiNoteCreate):

    db_note = models.AiNote(

        marker_id=note.marker_id,

        explanation=note.explanation,

        translation=note.translation,

        usage_example=note.usage_example,

        user_memo=note.user_memo

    )

    db.add(db_note)

    db.commit()

    db.refresh(db_note)

    return db_note


def get_ai_note(db: Session, marker_id: int):

    return db.query(models.AiNote).filter(

        models.AiNote.marker_id == marker_id

    ).first()