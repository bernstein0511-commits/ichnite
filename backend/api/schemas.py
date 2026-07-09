from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ==========================
# Page
# ==========================

class PageCreate(BaseModel):
    url: str
    title: Optional[str] = None


class PageResponse(PageCreate):
    page_id: int
    created_at: datetime

    class Config:
        orm_mode = True


# ==========================
# Marker
# ==========================

class MarkerCreate(BaseModel):
    page_id: int
    selected_text: str
    color: str
    position_start: int
    position_end: int


class MarkerResponse(MarkerCreate):
    marker_id: int
    created_at: datetime
    page_url: Optional[str] = None

    class Config:
        orm_mode = True


# ==========================
# AI Note
# ==========================

class AiNoteCreate(BaseModel):
    marker_id: int
    explanation: str
    similar_words: str
    antonyms: str
    translation: str
    usage_example: str
    user_memo: Optional[str] = None


class AiNoteResponse(AiNoteCreate):
    note_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


# ==========================
# MarkerBook
# ==========================

class MarkerBookCreate(BaseModel):
    marker_id: int
    memo: Optional[str] = None


class MarkerBookResponse(MarkerBookCreate):
    entry_id: int
    created_at: datetime

    class Config:
        orm_mode = True
        
# ==========================
# AI生成リクエスト（拡張機能から使う）
# ==========================

class AiGenerateRequest(BaseModel):
    marker_id: int
    selected_text: str


class AiRegenerateRequest(BaseModel):
    selected_text: str