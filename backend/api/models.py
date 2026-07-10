# ==========================================================
# models.py — SQLAlchemyのテーブル定義（4テーブル構成）。
#
#   Page (閲覧ページ) 1 ── N Marker (ハイライトした語句)
#                              │ 1
#                    ┌─────────┴─────────┐
#                    │ 1                 │ 1
#              AiNote (AI解説)      MarkerBook (ユーザーのメモ)
#
# Marker 1件に対して AiNote・MarkerBook はそれぞれ最大1件（unique制約）。
# 実際のクエリ・更新ロジックはすべて crud.py に集約している。
# ==========================================================

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey
)

from sqlalchemy.orm import relationship

from database import Base

from datetime import datetime


# ------------------------
# pages: マーカーを付けたWebページ（URL単位）
# ------------------------
class Page(Base):

    __tablename__ = "pages"

    page_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    url = Column(
        String(767),
        nullable=False,
        unique=True
    )

    title = Column(
        String(200)
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    markers = relationship(
        "Marker",
        back_populates="page",
        cascade="all, delete"
    )


# ------------------------
# markers: 実際にハイライトした語句・フレーズ1件ごとの記録
# ------------------------
class Marker(Base):

    __tablename__ = "markers"

    marker_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    page_id = Column(
        Integer,
        ForeignKey("pages.page_id"),
        nullable=False
    )

    selected_text = Column(
        Text,
        nullable=False
    )

    color = Column(
        String(20),
        default="yellow"
    )

    # 注意：カラム名は「位置」だが、実際に入っているのは
    # 「ページ内で同じ文字列の何番目の出現か」（occurrenceIndex, 0始まり）。
    # 同じ単語がページ内に複数あってもマーカーの位置を一意に復元するための値で、
    # position_start / position_end に同じ値を入れて使っている
    # （拡張機能側 modules/textLocator.js・modules/restore.js 参照）。
    position_start = Column(
        Integer,
        nullable=False
    )

    position_end = Column(
        Integer,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    page = relationship(
        "Page",
        back_populates="markers"
    )

    ai_note = relationship(
        "AiNote",
        back_populates="marker",
        uselist=False,
        cascade="all, delete"
    )

    marker_book = relationship(
        "MarkerBook",
        back_populates="marker",
        uselist=False,
        cascade="all, delete"
    )


# ------------------------
# ai_notes: OpenAIが生成した語句の解説（マーカー1件につき最大1件）
# services/ai_service.py が生成し、crud.upsert_ai_note() が保存/上書きする。
# ------------------------
class AiNote(Base):

    __tablename__ = "ai_notes"

    note_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    marker_id = Column(
        Integer,
        ForeignKey("markers.marker_id"),
        unique=True,
        nullable=False
    )

    explanation = Column(Text)

    similar_words = Column(Text)

    antonyms = Column(Text)


    translation = Column(Text)

    usage_example = Column(Text)

    # 未使用（常にNULL）。ユーザーが書き込むメモはMarkerBook.memoの方を使っている。
    user_memo = Column(Text)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    marker = relationship(
        "Marker",
        back_populates="ai_note"
    )


# ------------------------
# marker_book: ユーザーが書き込んだメモ（マーカー1件につき最大1件）
# 拡張機能のサイドパネル／ページ上のホバーポップアップ／記録帳ページの
# 「メモを追加・編集」はすべてこのテーブルを PUT /marker_book/{marker_id} 経由で更新する。
# ------------------------
class MarkerBook(Base):

    __tablename__ = "marker_book"

    entry_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    marker_id = Column(
        Integer,
        ForeignKey("markers.marker_id"),
        nullable=False
    )

    memo = Column(Text)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    marker = relationship(
        "Marker",
        back_populates="marker_book"
    )