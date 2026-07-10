# ==========================================================
# routers/ai_notes.py — /ai_notes 配下のエンドポイント。
# 実際にOpenAIを呼ぶのは services/ai_service.py。ここではその結果を
# schemas.AiNoteCreate に詰め替えてDBへ保存するだけ。
# POST /generate はマーカー新規作成時（marker.js）と、記録帳/詳細ページの
# 「生成・再生成」ボタン（marker_book.js・marker_detail.js）の両方から呼ばれる。
# ==========================================================

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
    # AIに解説を生成させる（キー未設定・API失敗時はここで例外が飛ぶ）
    ai_result = generate_ai_note(request.selected_text)

    # DBに保存
    note_data = schemas.AiNoteCreate(
        marker_id=request.marker_id,
        explanation=ai_result["explanation"],
        similar_words=ai_result["similar_words"],
        antonyms=ai_result["antonyms"],
        translation=ai_result["translation"],
        usage_example=ai_result["usage_example"],
        user_memo=None,
    )
    return crud.upsert_ai_note(db, note_data)


@router.get("/{marker_id}", response_model=schemas.AiNoteResponse)
def get_ai_note(
    marker_id: int,
    db: Session = Depends(get_db)
):
    return crud.get_ai_note(db, marker_id)


@router.put("/{marker_id}", response_model=schemas.AiNoteResponse)
def regenerate_ai_note(
    marker_id: int,
    request: schemas.AiRegenerateRequest,
    db: Session = Depends(get_db)
):
    # AIに解説を再生成させる
    ai_result = generate_ai_note(request.selected_text)

    note_data = schemas.AiNoteCreate(
        marker_id=marker_id,
        explanation=ai_result["explanation"],
        similar_words=ai_result["similar_words"],
        antonyms=ai_result["antonyms"],
        translation=ai_result["translation"],
        usage_example=ai_result["usage_example"],
        user_memo=None,
    )
    return crud.update_ai_note(db, marker_id, note_data)