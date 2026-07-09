from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db
from services.ai_service import generate_ai_note

router = APIRouter()


@router.post("/generate", response_model=schemas.AiNoteResponse)
def generate_and_save_ai_note(
    request: schemas.AiGenerateRequest,
    db: Session = Depends(get_db)
):
    # AIに解説を生成させる
    ai_result = generate_ai_note(request.selected_text)

    # DBに保存
    note_data = schemas.AiNoteCreate(
        marker_id=request.marker_id,
        explanation=ai_result["explanation"],
        similar_words=ai_result["similar_words"],
        antonyms=ai_result["antonyms"],
        translation="",          # 必要であれば後でプロンプトに追加
        usage_example=ai_result["usage_example"],
        user_memo=None,
    )
    return crud.create_ai_note(db, note_data)


@router.get("/{marker_id}", response_model=schemas.AiNoteResponse)
def get_ai_note(
    marker_id: int,
    db: Session = Depends(get_db)
):
    return crud.get_ai_note(db, marker_id)