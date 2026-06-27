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
# pages
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
# markers
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
# ai_notes
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
# marker_book
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