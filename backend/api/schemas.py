# ==========================================================
# schemas.py — APIのリクエスト/レスポンスの形（Pydanticモデル）。
# models.pyのテーブル定義とは別物：ここではAPIの入出力の型・必須/任意だけを定義する。
# 命名規則：〜Create = POST時の入力、〜Response = 返却値。
# ==========================================================

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


class MarkerBookMemoUpdate(BaseModel):
    memo: str


# ==========================
# 記録帳ページ用（Page + Marker + AiNote + MarkerBook を結合した1件分）
# GET /marker_book/full のレスポンス形。記録帳ページだけでなく、
# 拡張機能のサイドパネルの一覧・単語詳細ページもこれを使っている。
# ==========================

class MarkerBookEntryResponse(BaseModel):
    marker_id: int
    selected_text: str
    color: str
    created_at: datetime

    page_id: int
    page_url: str
    page_title: Optional[str] = None

    explanation: Optional[str] = None
    similar_words: Optional[str] = None
    antonyms: Optional[str] = None
    usage_example: Optional[str] = None
    translation: Optional[str] = None

    memo: Optional[str] = None


# ==========================
# AI生成リクエスト（拡張機能から使う）
# ==========================

class AiGenerateRequest(BaseModel):
    marker_id: int
    selected_text: str


class AiRegenerateRequest(BaseModel):
    selected_text: str