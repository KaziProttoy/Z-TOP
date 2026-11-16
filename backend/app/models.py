from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_salt: Mapped[str] = mapped_column(String(64))
    password_hash: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    courses: Mapped[list[Course]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    tasks: Mapped[list[Task]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class StudentProfile(Base):
    __tablename__ = "student_profiles"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    father_name: Mapped[str] = mapped_column(String(120), default="")
    mother_name: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    location: Mapped[str] = mapped_column(String(160), default="")
    education_level: Mapped[str] = mapped_column(String(40), default="")
    school_name: Mapped[str] = mapped_column(String(160), default="")
    school_qualification: Mapped[str] = mapped_column(String(120), default="")
    school_start_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    school_passout_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    college_name: Mapped[str] = mapped_column(String(160), default="")
    college_program: Mapped[str] = mapped_column(String(120), default="")
    college_start_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    college_passout_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    institution: Mapped[str] = mapped_column(String(160), default="")
    university_department: Mapped[str] = mapped_column(String(160), default="")
    field_of_study: Mapped[str] = mapped_column(String(120), default="")
    university_start_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_year: Mapped[str] = mapped_column(String(80), default="")
    expected_graduation_year: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(160))
    color: Mapped[str] = mapped_column(String(24), default="#2e7966")
    owner: Mapped[User] = relationship(back_populates="courses")
    documents: Mapped[list[CourseDocument]] = relationship(back_populates="course", cascade="all, delete-orphan")
    decks: Mapped[list[FlashcardDeck]] = relationship(back_populates="course", cascade="all, delete-orphan")
    quizzes: Mapped[list[Quiz]] = relationship(back_populates="course", cascade="all, delete-orphan")


class CourseDocument(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    pages_json: Mapped[str] = mapped_column(Text)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    course: Mapped[Course] = relationship(back_populates="documents")


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(240))
    due_date: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(20), default="TODO")
    priority: Mapped[str] = mapped_column(String(10), default="MEDIUM")
    owner: Mapped[User] = relationship(back_populates="tasks")


class FlashcardDeck(Base):
    __tablename__ = "flashcard_decks"
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    topic: Mapped[str] = mapped_column(String(160))
    cards_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    course: Mapped[Course] = relationship(back_populates="decks")


class Quiz(Base):
    __tablename__ = "quizzes"
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    questions_json: Mapped[str] = mapped_column(Text)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    course: Mapped[Course] = relationship(back_populates="quizzes")


class StudySession(Base):
    __tablename__ = "study_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    minutes: Mapped[int] = mapped_column(Integer)
    studied_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    messages: Mapped[list[ChatMessage]] = relationship(back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(12))
    content: Mapped[str] = mapped_column(Text)
    citations_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    session: Mapped[ChatSession] = relationship(back_populates="messages")


