from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import shutil
import io
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

from docx import Document as WordDocument
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pypdf import PdfReader
import fitz
from PIL import Image
import pytesseract
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, create_engine, func, inspect, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker
from . import ai
from . import storage
from .planner import extract_deadlines, split_topics

ROOT = Path(__file__).resolve().parents[1]
UPLOAD_DIR = ROOT / "uploads"
PROFILE_PHOTO_DIR = ROOT / "profile_photos"
ORIGINAL_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{ROOT / 'z_top.db'}")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL.removeprefix("postgres://")
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL.removeprefix("postgresql://")
TOKEN_SECRET = os.getenv("TOKEN_SECRET", "development-only-change-this-secret")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("z_top")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


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


class RegisterInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class CourseInput(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    title: str = Field(min_length=1, max_length=160)
    color: str = "#2e7966"


class StudentProfileInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    father_name: str = Field(default="", max_length=120)
    mother_name: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=40)
    location: str = Field(default="", max_length=160)
    education_level: str = Field(default="", max_length=40)
    school_name: str = Field(default="", max_length=160)
    school_qualification: str = Field(default="", max_length=120)
    school_start_year: int | None = Field(default=None, ge=1900, le=2200)
    school_passout_year: int | None = Field(default=None, ge=1900, le=2200)
    college_name: str = Field(default="", max_length=160)
    college_program: str = Field(default="", max_length=120)
    college_start_year: int | None = Field(default=None, ge=1900, le=2200)
    college_passout_year: int | None = Field(default=None, ge=1900, le=2200)
    institution: str = Field(default="", max_length=160)
    university_department: str = Field(default="", max_length=160)
    field_of_study: str = Field(default="", max_length=120)
    university_start_year: int | None = Field(default=None, ge=1900, le=2200)
    current_year: str = Field(default="", max_length=80)
    expected_graduation_year: int | None = Field(default=None, ge=1900, le=2200)


class TaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    due_date: datetime
    course_id: int | None = None
    status: str = "TODO"
    priority: str = "MEDIUM"


class TaskUpdate(BaseModel):
    status: str | None = None
    title: str | None = None


class ChatInput(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    session_id: int | None = None


class ChatTurnInput(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class GeneralChatInput(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    course_id: int | None = None
    history: list[ChatTurnInput] = Field(default_factory=list, max_length=12)


class StudyInput(BaseModel):
    minutes: int = Field(gt=0, le=1440)
    course_id: int | None = None


class StudySourcesInput(BaseModel):
    document_ids: list[int] | None = None


class QuizSubmission(BaseModel):
    answers: list[int]


class PlanInput(BaseModel):
    course_id: int
    exam_date: date
    hours_per_day: float = Field(gt=0, le=8)


class Model(BaseModel):
    model_config = ConfigDict(from_attributes=True)


app = FastAPI(title="Z-Top API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
security = HTTPBearer(auto_error=False)
Base.metadata.create_all(engine)
with engine.begin() as connection:
    profile_columns = {column["name"] for column in inspect(connection).get_columns("student_profiles")}
    profile_migrations = {
        "father_name": "VARCHAR(120) NOT NULL DEFAULT ''",
        "mother_name": "VARCHAR(120) NOT NULL DEFAULT ''",
        "school_name": "VARCHAR(160) NOT NULL DEFAULT ''",
        "school_qualification": "VARCHAR(120) NOT NULL DEFAULT ''",
        "school_start_year": "INTEGER NULL",
        "school_passout_year": "INTEGER NULL",
        "college_name": "VARCHAR(160) NOT NULL DEFAULT ''",
        "college_program": "VARCHAR(120) NOT NULL DEFAULT ''",
        "college_start_year": "INTEGER NULL",
        "college_passout_year": "INTEGER NULL",
        "university_department": "VARCHAR(160) NOT NULL DEFAULT ''",
        "university_start_year": "INTEGER NULL",
    }
    for column_name, column_type in profile_migrations.items():
        if column_name not in profile_columns:
            connection.exec_driver_sql(
                f"ALTER TABLE student_profiles ADD COLUMN {column_name} {column_type}"
            )


def get_db():
    with SessionLocal() as db:
        yield db


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _token(user_id: int) -> str:
    payload = _b64(json.dumps({"sub": user_id, "exp": int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())}).encode())
    signature = _b64(hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{signature}"


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Sign in to continue")
    try:
        payload, signature = credentials.credentials.split(".")
        expected = _b64(hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).digest())
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if not hmac.compare_digest(signature, expected) or data["exp"] < datetime.now(timezone.utc).timestamp():
            raise ValueError("invalid token")
        user = db.get(User, int(data["sub"]))
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        user = None
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user


def _hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 310_000).hex()
    return salt, digest


def _course(db: Session, course_id: int, user_id: int) -> Course:
    course = db.scalar(select(Course).where(Course.id == course_id, Course.owner_id == user_id))
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def _task_json(task: Task) -> dict[str, Any]:
    return {"id": task.id, "title": task.title, "dueDate": task.due_date.isoformat(), "status": task.status, "priority": task.priority, "courseId": task.course_id}


def _course_json(course: Course) -> dict[str, Any]:
    return {"id": course.id, "code": course.code, "title": course.title, "color": course.color, "documents": [{"id": d.id, "fileName": d.file_name, "uploadedAt": d.uploaded_at.isoformat()} for d in course.documents], "deckCount": len(course.decks), "quizCount": len(course.quizzes)}


def _extract(file_name: str, data: bytes) -> list[tuple[int, str]]:
    suffix = Path(file_name).suffix.lower()
    if suffix in IMAGE_EXTENSIONS:
        return [(1, _ocr_image(data))]
    if suffix == ".pdf":
        reader = PdfReader(__import__("io").BytesIO(data))
        pages: list[tuple[int, str]] = []
        pdf = fitz.open(stream=data, filetype="pdf")
        for index, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if not text.strip():
                rendered = pdf[index].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).tobytes("png")
                text = _ocr_image(rendered)
            pages.append((index + 1, text))
        pdf.close()
        return pages
    if suffix == ".docx":
        document = WordDocument(__import__("io").BytesIO(data))
        return [(1, "\n".join(p.text for p in document.paragraphs))]
    if suffix in {".txt", ".md"}:
        return [(1, data.decode("utf-8", errors="replace"))]
    raise HTTPException(status_code=415, detail="Upload a PDF, DOCX, TXT, or Markdown file")


def _ocr_image(data: bytes) -> str:
    executable = shutil.which("tesseract")
    if executable is None:
        for candidate in (
            Path(os.getenv("PROGRAMFILES", "")) / "Tesseract-OCR" / "tesseract.exe",
            Path(os.getenv("PROGRAMFILES(X86)", "")) / "Tesseract-OCR" / "tesseract.exe",
        ):
            if candidate.exists():
                executable = str(candidate)
                break
    if executable is None:
        raise HTTPException(
            status_code=503,
            detail="OCR is not installed. Install Tesseract OCR, then restart the backend.",
        )
    pytesseract.pytesseract.tesseract_cmd = executable
    try:
        with Image.open(io.BytesIO(data)) as image:
            return pytesseract.image_to_string(image).strip()
    except Exception as error:
        logger.exception("OCR failed")
        raise HTTPException(status_code=422, detail="The image could not be read by OCR") from error


def _chunks(pages: list[tuple[int, str]]) -> list[tuple[int, str]]:
    result: list[tuple[int, str]] = []
    for page, text in pages:
        clean = re.sub(r"\s+", " ", text).strip()
        start = 0
        while start < len(clean):
            end = min(start + 1000, len(clean))
            result.append((page, clean[start:end]))
            if end == len(clean):
                break
            start = max(start + 1, end - 200)
    return result


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "z-top-api", "groqConfigured": ai.groq_ready(), "vectorStore": "qdrant-cloud" if os.getenv("QDRANT_URL") else "qdrant-local"}


@app.post("/api/auth/register")
def register(payload: RegisterInput, db: Session = Depends(get_db)):
    email = str(payload.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    salt, password_hash = _hash_password(payload.password)
    user = User(name=payload.name.strip(), email=email, password_salt=salt, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": _token(user.id), "user": {"id": user.id, "name": user.name, "email": user.email}}


@app.post("/api/auth/login")
def login(payload: LoginInput, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    if not user or not hmac.compare_digest(_hash_password(payload.password, user.password_salt)[1], user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return {"token": _token(user.id), "user": {"id": user.id, "name": user.name, "email": user.email}}


@app.get("/api/auth/me")
def me(user: User = Depends(current_user)):
    return {"id": user.id, "name": user.name, "email": user.email}


def _student_profile_json(user: User, profile: StudentProfile | None) -> dict[str, Any]:
    return {
        "name": user.name,
        "email": user.email,
        "photoAvailable": _student_photo_path(user.id) is not None,
        "fatherName": profile.father_name if profile else "",
        "motherName": profile.mother_name if profile else "",
        "phone": profile.phone if profile else "",
        "location": profile.location if profile else "",
        "educationLevel": profile.education_level if profile else "",
        "schoolName": profile.school_name if profile else "",
        "schoolQualification": profile.school_qualification if profile else "",
        "schoolStartYear": profile.school_start_year if profile else None,
        "schoolPassoutYear": profile.school_passout_year if profile else None,
        "collegeName": profile.college_name if profile else "",
        "collegeProgram": profile.college_program if profile else "",
        "collegeStartYear": profile.college_start_year if profile else None,
        "collegePassoutYear": profile.college_passout_year if profile else None,
        "institution": profile.institution if profile else "",
        "universityDepartment": profile.university_department if profile else "",
        "fieldOfStudy": profile.field_of_study if profile else "",
        "universityStartYear": profile.university_start_year if profile else None,
        "currentYear": profile.current_year if profile else "",
        "expectedGraduationYear": profile.expected_graduation_year if profile else None,
    }


def _student_photo_path(user_id: int) -> Path | None:
    for extension in IMAGE_EXTENSIONS:
        candidate = PROFILE_PHOTO_DIR / f"{user_id}{extension}"
        if candidate.is_file():
            return candidate
    return None


def _storage_path(kind: str, identifier: int, suffix: str) -> str:
    return f"{kind}/{identifier}{suffix}"


@app.get("/api/profile")
def get_student_profile(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _student_profile_json(user, db.get(StudentProfile, user.id))


@app.put("/api/profile")
def update_student_profile(payload: StudentProfileInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be blank")
    if payload.education_level not in {"", "High school", "College", "University", "Other"}:
        raise HTTPException(status_code=422, detail="Choose a valid education level")
    year_ranges = (
        (payload.school_start_year, payload.school_passout_year, "School"),
        (payload.college_start_year, payload.college_passout_year, "College"),
        (payload.university_start_year, payload.expected_graduation_year, "University"),
    )
    for start_year, passout_year, institution_name in year_ranges:
        if start_year is not None and passout_year is not None and passout_year < start_year:
            raise HTTPException(status_code=422, detail=f"{institution_name} pass-out year cannot be before its start year")
    profile = db.get(StudentProfile, user.id)
    if profile is None:
        profile = StudentProfile(user_id=user.id)
    user.name = name
    profile.father_name = payload.father_name.strip()
    profile.mother_name = payload.mother_name.strip()
    profile.phone = payload.phone.strip()
    profile.location = payload.location.strip()
    profile.education_level = payload.education_level
    profile.school_name = payload.school_name.strip()
    profile.school_qualification = payload.school_qualification.strip()
    profile.school_start_year = payload.school_start_year
    profile.school_passout_year = payload.school_passout_year
    profile.college_name = payload.college_name.strip()
    profile.college_program = payload.college_program.strip()
    profile.college_start_year = payload.college_start_year
    profile.college_passout_year = payload.college_passout_year
    profile.institution = payload.institution.strip()
    profile.university_department = payload.university_department.strip()
    profile.field_of_study = payload.field_of_study.strip()
    profile.university_start_year = payload.university_start_year
    profile.current_year = payload.current_year.strip()
    profile.expected_graduation_year = payload.expected_graduation_year
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _student_profile_json(user, profile)


@app.get("/api/profile/photo")
def get_student_profile_photo(user: User = Depends(current_user)):
    if storage.configured():
        for extension in IMAGE_EXTENSIONS:
            path = _storage_path("profile-photos", user.id, extension)
            try:
                data = storage.download(path)
            except Exception:
                continue
            return Response(content=data, media_type=ORIGINAL_CONTENT_TYPES[extension], headers={"Content-Disposition": f'inline; filename="{user.id}{extension}"'})
    photo_path = _student_photo_path(user.id)
    if photo_path is None:
        raise HTTPException(status_code=404, detail="No profile photo has been added")
    return FileResponse(
        photo_path,
        media_type=ORIGINAL_CONTENT_TYPES[photo_path.suffix.lower()],
        filename=photo_path.name,
        content_disposition_type="inline",
    )


@app.post("/api/profile/photo")
async def save_student_profile_photo(file: UploadFile = File(...), user: User = Depends(current_user)):
    extension = Path(file.filename or "").suffix.lower()
    if extension not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Choose a JPG, PNG, GIF, WebP, or BMP image")
    data = await file.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Profile photos must be 5 MB or smaller")
    if storage.configured():
        try:
            storage.upload(_storage_path("profile-photos", user.id, extension), data, file.content_type or ORIGINAL_CONTENT_TYPES[extension])
            for previous_extension in IMAGE_EXTENSIONS - {extension}:
                storage.remove(_storage_path("profile-photos", user.id, previous_extension))
        except Exception as error:
            logger.exception("Could not save profile photo to Supabase for user %s", user.id)
            raise HTTPException(status_code=502, detail="Could not save the profile photo") from error
        return {"photoAvailable": True}
    PROFILE_PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    photo_path = PROFILE_PHOTO_DIR / f"{user.id}{extension}"
    temporary_path = PROFILE_PHOTO_DIR / f"{user.id}.uploading"
    try:
        temporary_path.write_bytes(data)
        temporary_path.replace(photo_path)
    except OSError as error:
        temporary_path.unlink(missing_ok=True)
        logger.exception("Could not save profile photo for user %s", user.id)
        raise HTTPException(status_code=500, detail="Could not save the profile photo") from error
    for previous_extension in IMAGE_EXTENSIONS - {extension}:
        (PROFILE_PHOTO_DIR / f"{user.id}{previous_extension}").unlink(missing_ok=True)
    return {"photoAvailable": True}


@app.delete("/api/profile/photo")
def delete_student_profile_photo(user: User = Depends(current_user)):
    if storage.configured():
        try:
            for extension in IMAGE_EXTENSIONS:
                storage.remove(_storage_path("profile-photos", user.id, extension))
        except Exception as error:
            logger.exception("Could not remove profile photo from Supabase for user %s", user.id)
            raise HTTPException(status_code=502, detail="Could not remove the profile photo") from error
        return {"photoAvailable": False}
    for extension in IMAGE_EXTENSIONS:
        (PROFILE_PHOTO_DIR / f"{user.id}{extension}").unlink(missing_ok=True)
    return {"photoAvailable": False}


@app.get("/api/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    courses = list(db.scalars(select(Course).where(Course.owner_id == user.id).order_by(Course.id.desc())))
    tasks = list(db.scalars(select(Task).where(Task.owner_id == user.id).order_by(Task.due_date)))
    sessions = list(db.scalars(select(StudySession).where(StudySession.owner_id == user.id)))
    week_ago = datetime.now(timezone.utc) - timedelta(days=6)
    week_sessions = [s for s in sessions if s.studied_at.replace(tzinfo=timezone.utc) >= week_ago]
    return {"courses": [_course_json(c) for c in courses], "tasks": [_task_json(t) for t in tasks], "stats": {"courseCount": len(courses), "openTasks": sum(t.status != "COMPLETED" for t in tasks), "studyMinutes": sum(s.minutes for s in week_sessions), "documents": sum(len(c.documents) for c in courses)}}


@app.get("/api/courses")
def list_courses(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [_course_json(c) for c in db.scalars(select(Course).where(Course.owner_id == user.id).order_by(Course.id.desc()))]


@app.post("/api/courses", status_code=201)
def create_course(payload: CourseInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    course = Course(owner_id=user.id, code=payload.code.strip(), title=payload.title.strip(), color=payload.color)
    db.add(course)
    db.commit()
    db.refresh(course)
    return _course_json(course)


@app.get("/api/tasks")
def list_tasks(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [_task_json(task) for task in db.scalars(select(Task).where(Task.owner_id == user.id).order_by(Task.due_date))]


@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if payload.status not in {"TODO", "IN_PROGRESS", "COMPLETED"} or payload.priority not in {"LOW", "MEDIUM", "HIGH"}:
        raise HTTPException(status_code=422, detail="Invalid task status or priority")
    if payload.course_id is not None:
        _course(db, payload.course_id, user.id)
    due_date = payload.due_date.replace(tzinfo=None) if payload.due_date.tzinfo else payload.due_date
    task = Task(owner_id=user.id, course_id=payload.course_id, title=payload.title.strip(), due_date=due_date, status=payload.status, priority=payload.priority)
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_json(task)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    task = db.scalar(select(Task).where(Task.id == task_id, Task.owner_id == user.id))
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if payload.status is not None:
        if payload.status not in {"TODO", "IN_PROGRESS", "COMPLETED"}:
            raise HTTPException(status_code=422, detail="Invalid task status")
        task.status = payload.status
    if payload.title is not None:
        task.title = payload.title.strip()
    db.commit()
    return _task_json(task)


@app.post("/api/courses/{course_id}/documents", status_code=201)
async def upload_document(course_id: int, file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)):
    course = _course(db, course_id, user.id)
    data = await file.read(20 * 1024 * 1024 + 1)
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File must be 20 MB or smaller")
    file_name = Path(file.filename or "upload.txt").name
    suffix = Path(file_name).suffix.lower()
    if suffix not in ORIGINAL_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Upload a PDF, DOCX, TXT, Markdown, or raster image file")
    pages = _extract(file_name, data)
    content = "\n".join(text for _, text in pages).strip()
    if not content and suffix not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=422, detail="No readable text found in this file")
    document = CourseDocument(course_id=course.id, file_name=file_name, content=content, pages_json=json.dumps(pages))
    db.add(document)
    db.flush()
    stored_file = UPLOAD_DIR / f"{document.id}{suffix}"
    try:
        if storage.configured():
            storage.upload(_storage_path("documents", document.id, suffix), data, file.content_type or ORIGINAL_CONTENT_TYPES[suffix])
        else:
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            stored_file.write_bytes(data)
        db.commit()
    except Exception:
        stored_file.unlink(missing_ok=True)
        db.rollback()
        raise
    db.refresh(document)
    indexed_chunks = 0
    if ai.vector_ready() and pages:
        try:
            indexed_chunks = ai.index_chunks(user.id, course.id, document.id, document.file_name, _chunks(pages))
        except Exception:
            logger.exception("Could not index uploaded document %s", document.id)
    return {"id": document.id, "fileName": document.file_name, "uploadedAt": document.uploaded_at.isoformat(), "characters": len(content), "indexedChunks": indexed_chunks}


@app.get("/api/courses/{course_id}/documents")
def list_documents(course_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    course = _course(db, course_id, user.id)
    return [{"id": d.id, "fileName": d.file_name, "uploadedAt": d.uploaded_at.isoformat(), "characters": len(d.content)} for d in course.documents]


@app.get("/api/courses/{course_id}/documents/{document_id}")
def read_document(course_id: int, document_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    course = _course(db, course_id, user.id)
    document = db.scalar(select(CourseDocument).where(CourseDocument.id == document_id, CourseDocument.course_id == course.id))
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    pages = json.loads(document.pages_json)
    return {"id": document.id, "fileName": document.file_name, "pages": [{"number": int(page), "text": text} for page, text in pages]}


@app.get("/api/courses/{course_id}/documents/{document_id}/file")
def read_document_file(course_id: int, document_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    course = _course(db, course_id, user.id)
    document = db.scalar(select(CourseDocument).where(CourseDocument.id == document_id, CourseDocument.course_id == course.id))
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    suffix = Path(document.file_name).suffix.lower()
    stored_file = UPLOAD_DIR / f"{document.id}{suffix}"
    if suffix not in ORIGINAL_CONTENT_TYPES:
        raise HTTPException(status_code=404, detail="Original file is unavailable. Upload the file again to view it.")
    if storage.configured():
        try:
            return Response(content=storage.download(_storage_path("documents", document.id, suffix)), media_type=ORIGINAL_CONTENT_TYPES[suffix], headers={"Content-Disposition": f'inline; filename="{document.file_name}"'})
        except Exception as error:
            raise HTTPException(status_code=404, detail="Original file is unavailable. Upload the file again to view it.") from error
    if not stored_file.is_file():
        raise HTTPException(status_code=404, detail="Original file is unavailable. Upload the file again to view it.")
    return FileResponse(
        stored_file,
        media_type=ORIGINAL_CONTENT_TYPES[suffix],
        filename=document.file_name,
        content_disposition_type="inline",
    )


@app.delete("/api/courses/{course_id}/documents/{document_id}")
def delete_document(course_id: int, document_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    course = _course(db, course_id, user.id)
    document = db.scalar(select(CourseDocument).where(CourseDocument.id == document_id, CourseDocument.course_id == course.id))
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    suffix = Path(document.file_name).suffix.lower()
    stored_file = UPLOAD_DIR / f"{document.id}{suffix}"
    try:
        ai.delete_document_chunks(user.id, course.id, document.id)
    except Exception as error:
        logger.exception("Could not delete indexed chunks for document %s", document.id)
        raise HTTPException(status_code=503, detail="Could not remove this file from study search. Please try again.") from error
    db.delete(document)
    db.commit()
    try:
        if storage.configured():
            storage.remove(_storage_path("documents", document.id, suffix))
        else:
            stored_file.unlink(missing_ok=True)
    except OSError:
        logger.exception("Could not remove original file for document %s", document.id)
    return {"deleted": True}


@app.post("/api/courses/{course_id}/chat")
def grounded_chat(course_id: int, payload: ChatInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    course = _course(db, course_id, user.id)
    history: list[dict[str, str]] = []  # Initialize history as an empty list
    if payload.session_id:
        chat = db.scalar(select(ChatSession).where(ChatSession.id == payload.session_id, ChatSession.user_id == user.id, ChatSession.course_id == course.id))
        if chat is None:
            raise HTTPException(status_code=404, detail="Chat session not found")
        else:
            history_rows = list(db.scalars(select(ChatMessage).where(ChatMessage.session_id == chat.id).order_by(ChatMessage.created_at.desc()).limit(8)))
            history = [{"role": row.role, "content": row.content} for row in reversed(history_rows)]
    sources: list[dict[str, Any]] = []
    if ai.vector_ready():
        try:
            sources = ai.retrieve(user.id, course.id, payload.question)
        except Exception:
            logger.exception("Vector retrieval failed for course %s", course.id)
    if not sources:
        terms = {word.lower() for word in re.findall(r"[a-zA-Z0-9]{3,}", payload.question)}
        matches: list[tuple[int, str, str, int]] = []
        for document in course.documents:
            pages = [(int(page), text) for page, text in json.loads(document.pages_json)]
            for page, chunk in _chunks(pages):
                score = sum(chunk.lower().count(term) for term in terms)
                if score:
                    matches.append((score, document.file_name, chunk, page))
        matches.sort(key=lambda item: item[0], reverse=True)
        sources = [{"fileName": name, "page": page, "snippet": text[:1000]} for _, name, text, page in matches[:4]]

    answer = ai.NO_GROUNDED_ANSWER
    citations: list[dict[str, Any]] = []
    if sources:
        if ai.groq_ready():
            try:
                generated = ai.answer_from_context(payload.question, history, sources)
                answer = generated["answer"]
                citations = [sources[index - 1] for index in generated["sourceIndexes"]]
            except Exception:
                logger.exception("Gemini answer generation failed for course %s", course.id)
                answer = "I found a few passages that may help, but couldn't put together a full answer just now. Here are the relevant excerpts."
                citations = sources
        else:
            answer = "I found a few passages that may help. Here are the relevant excerpts from your notes."
            citations = sources

    return {"sessionId": payload.session_id, "answer": answer, "citations": citations, "grounded": True}


@app.get("/api/courses/{course_id}/chats")
def list_chat_sessions(course_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _course(db, course_id, user.id)
    sessions = db.scalars(select(ChatSession).where(ChatSession.course_id == course_id, ChatSession.user_id == user.id).order_by(ChatSession.created_at.desc()))
    return [{"id": session.id, "title": session.title, "createdAt": session.created_at.isoformat()} for session in sessions]


@app.get("/api/chat-sessions/{session_id}/messages")
def list_chat_messages(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    chat = db.scalar(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id))
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    messages = db.scalars(select(ChatMessage).where(ChatMessage.session_id == chat.id).order_by(ChatMessage.created_at, ChatMessage.id))
    return [{"role": message.role, "content": message.content, "citations": json.loads(message.citations_json)} for message in messages]


@app.post("/api/general-chats")
def general_chat(payload: GeneralChatInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not ai.groq_ready():
        raise HTTPException(status_code=503, detail="General Z-Chat needs a Gemini API key. Add GEMINI_API_KEY to backend/.env and restart the API.")
    course_sources: list[dict[str, Any]] = []
    if payload.course_id is not None:
        course = _course(db, payload.course_id, user.id)
        course_sources = _course_chat_sources(course, payload.question)
    history = [{"role": turn.role, "content": turn.content} for turn in payload.history[-12:]]
    try:
        result = ai.general_answer(payload.question.strip(), history, course_sources)
    except Exception as error:
        logger.exception("Gemini general chat failed for user %s", user.id)
        if getattr(error, "code", None) == 429:
            raise HTTPException(
                status_code=429,
                detail="Gemini API quota or rate limit is exhausted. Check your Google AI Studio usage and billing, or retry after the quota resets.",
            ) from error
        if getattr(error, "code", None) == 503:
            raise HTTPException(
                status_code=503,
                detail="Gemini is temporarily unavailable. Please try again shortly.",
            ) from error
        raise HTTPException(status_code=502, detail="Z-Chat couldn't reach Gemini just now. Please try again.") from error
    return {"answer": result["answer"], "citations": result["citations"], "grounded": bool(course_sources)}


def _selected_study_documents(course: Course, document_ids: list[int] | None) -> list[CourseDocument]:
    if document_ids is None:
        return list(course.documents)
    requested_ids = set(document_ids)
    if not requested_ids:
        raise HTTPException(status_code=422, detail="Select at least one source file")
    documents = [document for document in course.documents if document.id in requested_ids]
    if len(documents) != len(requested_ids):
        raise HTTPException(status_code=422, detail="One or more source files are not in this course")
    return documents


def _sentences(documents: list[CourseDocument]) -> list[str]:
    sentences: list[str] = []
    seen: set[str] = set()
    for document in documents:
        for part in re.split(r"(?<=[.!?])\s+", document.content or ""):
            sentence = re.sub(r"\s+", " ", part).strip()
            identity = sentence.casefold()
            if len(sentence) >= 40 and identity not in seen:
                seen.add(identity)
                sentences.append(sentence)
    return sentences


def _unique_document_text(document: CourseDocument) -> str:
    unique_pages: list[str] = []
    seen_pages: set[str] = set()
    for _, page_text in json.loads(document.pages_json):
        page = re.sub(r"\s+", " ", page_text).strip()
        identity = page.casefold()
        if page and identity not in seen_pages:
            seen_pages.add(identity)
            unique_pages.append(page)
    return "\n\n".join(unique_pages)


def _study_source(documents: list[CourseDocument]) -> str:
    sources: list[str] = []
    for document in documents:
        text = _unique_document_text(document)
        sources.append(f"{document.file_name}:\n{text[:24000]}")
    return "\n\n".join(sources)[:50000]


def _course_chat_sources(course: Course, question: str, limit: int = 6) -> list[dict[str, Any]]:
    terms = {word.lower() for word in re.findall(r"[a-zA-Z0-9]{3,}", question)}
    matches: list[tuple[int, str, int, str]] = []
    for document in course.documents:
        for page, text in json.loads(document.pages_json):
            for chunk_page, chunk in _chunks([(int(page), text)]):
                score = sum(chunk.lower().count(term) for term in terms)
                if score:
                    matches.append((score, document.file_name, chunk_page, chunk[:1800]))
    matches.sort(key=lambda item: item[0], reverse=True)
    return [
        {"fileName": file_name, "page": page, "snippet": snippet}
        for _, file_name, page, snippet in matches[:limit]
    ]


def _valid_cards(value: dict[str, Any]) -> list[dict[str, str]]:
    cards = value.get("cards") or value.get("questions")
    if not isinstance(cards, list):
        return []
    valid: list[dict[str, str]] = []
    seen_questions: set[str] = set()
    for item in cards:
        if not isinstance(item, dict):
            continue
        question = item.get("question")
        answer = item.get("answer")
        if not isinstance(question, str) or not question.strip() or not isinstance(answer, str) or not answer.strip():
            continue
        question = question.strip()
        answer = answer.strip()
        if len(answer) < 20 or len(answer) > 600:
            continue
        if question.lower().startswith(("what is the main idea of this statement?", "what does this passage explain?")):
            continue
        identity = re.sub(r"\W+", " ", question).strip().lower()
        if identity in seen_questions:
            continue
        seen_questions.add(identity)
        valid.append({"question": question, "answer": answer})
    return valid[:20]


def _fallback_flashcards(sentences: list[str]) -> list[dict[str, str]]:
    prompts = (
        "What is the main idea of this statement?",
        "What fact should you remember from this passage?",
        "What process or relationship is described here?",
        "What does this passage tell us about the topic?",
    )
    cards: list[dict[str, str]] = []
    for index, sentence in enumerate(sentences[:20]):
        excerpt = sentence.rstrip(".!?").strip()
        if len(excerpt) > 90:
            excerpt = f"{excerpt[:87].rstrip()}..."
        cards.append({
            "question": f'{prompts[index % len(prompts)]} "{excerpt}"',
            "answer": sentence,
        })
    return cards


def _valid_takeaways(value: dict[str, Any]) -> list[str]:
    takeaways = value.get("takeaways")
    if not isinstance(takeaways, list):
        return []
    valid: list[str] = []
    seen: set[str] = set()
    for item in takeaways:
        if not isinstance(item, str):
            continue
        text = re.sub(r"\s+", " ", item).strip(" -*\t\r\n")
        identity = text.casefold()
        if len(text) < 40 or len(text) > 500 or identity in seen:
            continue
        seen.add(identity)
        valid.append(text)
    return valid[:12]


@app.post("/api/courses/{course_id}/flashcards")
def generate_flashcards(course_id: int, payload: StudySourcesInput | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    course = _course(db, course_id, user.id)
    documents = _selected_study_documents(course, payload.document_ids if payload else None)
    sentences = _sentences(documents)
    if not sentences:
        raise HTTPException(status_code=422, detail="Upload readable notes before creating flashcards")
    topic = "Key ideas"
    cards: list[dict[str, str]] = []
    if ai.groq_ready():
        schema = {"type": "object", "properties": {"topic": {"type": "string"}, "cards": {"type": "array", "items": {"type": "object", "properties": {"question": {"type": "string"}, "answer": {"type": "string"}}, "required": ["question", "answer"]}}}, "required": ["topic", "cards"]}
        try:
            generated = ai.generate_json(f"Create up to 20 high-quality question-and-answer flashcards using only these course notes. Every question must be different and test a different fact, definition, process, or relationship. Write a natural, specific question, not a reference to 'this passage'. Give a concise answer of one to three sentences that directly answers the question. Do not copy the entire notes into a question or answer. Never repeat a generic question such as 'What does this passage explain?'. Preserve formulas and definitions exactly.\n\n{_study_source(documents)}", schema)
            topic = str(generated.get("topic", topic))[:160]
            cards = _valid_cards(generated)
        except Exception:
            logger.exception("Groq flashcard generation failed for course %s", course.id)
        if not cards:
            try:
                generated = ai.generate_json(
                    f"Create exactly 8 study flashcards from the notes below. Return JSON with a cards array. "
                    "Each card must have a specific question and a concise answer of one to three sentences. "
                    "Do not use the document title as a question or answer. Do not repeat questions. "
                    f"Use only facts present in the notes.\n\n{_study_source(documents)[:12000]}",
                    schema,
                )
                cards = _valid_cards(generated)
            except Exception:
                logger.exception("Groq flashcard retry failed for course %s", course.id)
    if not cards:
        cards = _fallback_flashcards(sentences)
    return {"topic": topic, "cards": cards}


@app.post("/api/courses/{course_id}/quizzes")
def generate_quiz(course_id: int, payload: StudySourcesInput | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    course = _course(db, course_id, user.id)
    documents = _selected_study_documents(course, payload.document_ids if payload else None)
    sentences = _sentences(documents)
    if not sentences:
        raise HTTPException(status_code=422, detail="Upload readable notes before creating a quiz")
    title = "Course review"
    questions: list[dict[str, Any]] = []
    if ai.groq_ready():
        schema = {"type": "object", "properties": {"title": {"type": "string"}, "questions": {"type": "array", "items": {"type": "object", "properties": {"question": {"type": "string"}, "options": {"type": "array", "items": {"type": "string"}}, "correctIndex": {"type": "integer"}, "explanation": {"type": "string"}}, "required": ["question", "options", "correctIndex", "explanation"]}}}, "required": ["title", "questions"]}
        try:
            generated = ai.generate_json(f"Create 5 multiple-choice questions that test understanding of these notes. Each must have four distinct answer options, exactly one correct answer, a valid zero-based correctIndex, and a short explanation based only on the notes. Do not make the correct answer obvious by position.\n\n{_study_source(documents)}", schema)
            title = str(generated.get("title", title))[:160]
            candidate_questions = generated.get("questions", [])
            if isinstance(candidate_questions, list):
                questions = [item for item in candidate_questions if isinstance(item, dict) and isinstance(item.get("question"), str) and isinstance(item.get("options"), list) and len(item["options"]) == 4 and all(isinstance(option, str) for option in item["options"]) and isinstance(item.get("correctIndex"), int) and 0 <= item["correctIndex"] < 4 and isinstance(item.get("explanation"), str)][:10]
        except Exception:
            logger.exception("Groq quiz generation failed for course %s", course.id)
    if not questions:
        questions = [{"question": "Which statement is supported by the course notes?", "options": [sentence, "The notes provide no relevant information.", "The opposite of the cited statement is true.", "None of the above."], "correctIndex": 0, "explanation": f"This answer is stated in the uploaded notes: {sentence}"} for sentence in sentences[:10]]
    return {"title": title, "questions": questions}


@app.post("/api/quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: int, payload: QuizSubmission, user: User = Depends(current_user), db: Session = Depends(get_db)):
    quiz = db.scalar(select(Quiz).join(Course).where(Quiz.id == quiz_id, Course.owner_id == user.id))
    if quiz is None:
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions = json.loads(quiz.questions_json)
    if len(payload.answers) != len(questions):
        raise HTTPException(status_code=422, detail="Submit one answer for each question")
    if any(answer < -1 or answer >= len(question["options"]) for answer, question in zip(payload.answers, questions)):
        raise HTTPException(status_code=422, detail="An answer selection is invalid")
    correct = sum(answer == question["correctIndex"] for answer, question in zip(payload.answers, questions))
    quiz.score = correct * 100 / len(questions) if questions else 0
    db.commit()
    results = [{"isCorrect": answer == question["correctIndex"], "correctIndex": question["correctIndex"], "explanation": question["explanation"]} for answer, question in zip(payload.answers, questions)]
    return {"score": quiz.score, "correct": correct, "total": len(questions), "results": results}


@app.post("/api/courses/{course_id}/summary")
def generate_summary(course_id: int, payload: StudySourcesInput | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    course = _course(db, course_id, user.id)
    documents = _selected_study_documents(course, payload.document_ids if payload else None)
    sentences = _sentences(documents)
    if not sentences:
        raise HTTPException(status_code=422, detail="Upload readable notes before creating key takeaways")
    cards: list[dict[str, str]] = []
    if ai.groq_ready():
        schema = {"type": "object", "properties": {"takeaways": {"type": "array", "items": {"type": "string"}}}, "required": ["takeaways"]}
        try:
            generated = ai.generate_json(f"Create up to 10 high-quality key takeaways from these course notes. Each takeaway must express one important concept in your own words, be specific and useful for exam revision, and be one to three sentences. Do not copy slide navigation, document titles, page headings, repeated text, or entire paragraphs. Use only facts supported by the notes. Return concise JSON.\n\n{_study_source(documents)}", schema)
            takeaways = _valid_takeaways(generated)
            cards = [{"question": "Key takeaway", "answer": item} for item in takeaways]
        except Exception:
            logger.exception("Groq summary generation failed for course %s", course.id)
        if not cards:
            try:
                generated = ai.generate_json(
                    f"Create exactly 6 concise key takeaways from these notes. Return JSON with a takeaways array. "
                    "Each item must be a specific concept in one or two sentences, not a title or copied paragraph. "
                    f"Use only the notes below.\n\n{_study_source(documents)[:12000]}",
                    schema,
                )
                cards = [{"question": "Key takeaway", "answer": item} for item in _valid_takeaways(generated)]
            except Exception:
                logger.exception("Groq summary retry failed for course %s", course.id)
    if not cards:
        cards = [{"question": "Key takeaway", "answer": sentence} for sentence in sentences[:12] if len(sentence) >= 80][:12]
    return {"title": f"{course.code} key takeaways", "cards": cards}


def _syllabus_deadlines(text: str) -> list[dict[str, str]]:
    if ai.groq_ready():
        schema = {"type": "object", "properties": {"deadlines": {"type": "array", "items": {"type": "object", "properties": {"title": {"type": "string"}, "dueDate": {"type": "string"}}, "required": ["title", "dueDate"]}}}, "required": ["deadlines"]}
        try:
            result = ai.generate_json(f"Extract only explicit assignment, quiz, project, and exam deadlines from this syllabus. Preserve their stated dates; do not infer or invent any. Return dates as ISO-8601. Today is {date.today().isoformat()}.\n\n{text[:50000]}", schema)
            items = result.get("deadlines", [])
            deadlines = []
            if isinstance(items, list):
                for item in items:
                    if not isinstance(item, dict) or not isinstance(item.get("title"), str) or not isinstance(item.get("dueDate"), str):
                        continue
                    try:
                        due = datetime.fromisoformat(item["dueDate"].replace("Z", "+00:00"))
                    except ValueError:
                        continue
                    if due.date() >= date.today():
                        deadlines.append({"title": item["title"].strip()[:240], "dueDate": due.replace(tzinfo=None).isoformat()})
            return deadlines
        except Exception:
            logger.exception("Groq syllabus extraction failed; using explicit-date parser")
    return extract_deadlines(text)


@app.post("/api/courses/{course_id}/syllabus", status_code=201)
async def upload_syllabus(course_id: int, file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)):
    course = _course(db, course_id, user.id)
    data = await file.read(20 * 1024 * 1024 + 1)
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File must be 20 MB or smaller")
    pages = _extract(file.filename or "syllabus.pdf", data)
    text = "\n".join(page_text for _, page_text in pages).strip()
    if not text:
        raise HTTPException(status_code=422, detail="No readable syllabus text found")
    document = CourseDocument(course_id=course.id, file_name=Path(file.filename or "syllabus.pdf").name, content=text, pages_json=json.dumps(pages))
    db.add(document)
    db.flush()
    if ai.vector_ready():
        try:
            ai.index_chunks(user.id, course.id, document.id, document.file_name, _chunks(pages))
        except Exception:
            logger.exception("Could not index syllabus %s", document.id)

    deadlines = _syllabus_deadlines(text)
    created: list[Task] = []
    for item in deadlines:
        due_date = datetime.fromisoformat(item["dueDate"])
        exists = db.scalar(select(Task.id).where(Task.owner_id == user.id, Task.course_id == course.id, Task.title == item["title"], Task.due_date == due_date))
        if exists is None:
            task = Task(owner_id=user.id, course_id=course.id, title=item["title"], due_date=due_date, status="TODO", priority="HIGH")
            db.add(task)
            created.append(task)
    db.commit()
    return {"documentId": document.id, "fileName": document.file_name, "deadlinesFound": len(deadlines), "tasksCreated": [_task_json(task) for task in created]}


@app.post("/api/plans", status_code=201)
def create_study_plan(payload: PlanInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    course = _course(db, payload.course_id, user.id)
    today = date.today()
    days_until_exam = (payload.exam_date - today).days
    if days_until_exam < 1 or days_until_exam > 180:
        raise HTTPException(status_code=422, detail="Choose an exam date between tomorrow and 180 days from now")
    average_score = db.scalar(select(func.avg(Quiz.score)).where(Quiz.course_id == course.id, Quiz.score.is_not(None)))
    sessions_per_day = max(1, min(6, round(payload.hours_per_day * 2)))
    if average_score is not None and average_score < 65:
        sessions_per_day = min(6, sessions_per_day + 1)
    elif average_score is not None and average_score >= 85:
        sessions_per_day = max(1, sessions_per_day - 1)
    existing_tasks = list(db.scalars(select(Task).where(Task.owner_id == user.id, Task.status != "COMPLETED", Task.due_date <= datetime.combine(payload.exam_date, time.max))))
    topics = split_topics([document.content for document in course.documents]) or [f"{course.code}: {course.title}"]
    plan_tasks: list[Task] = []
    for day_index in range(days_until_exam):
        study_day = today + timedelta(days=day_index)
        due_workload = sum(task.due_date.date() == study_day for task in existing_tasks)
        daily_sessions = max(1, sessions_per_day - min(2, due_workload))
        for session_index in range(daily_sessions):
            topic = topics[(day_index * daily_sessions + session_index) % len(topics)]
            title = f"[Plan] Review: {topic[:180]}"
            if day_index == days_until_exam - 1 and session_index == daily_sessions - 1:
                title = f"[Plan] Final review for {course.code}"
            task = Task(owner_id=user.id, course_id=course.id, title=title[:240], due_date=datetime.combine(study_day, time(hour=17 + session_index)), status="TODO", priority="HIGH" if average_score is not None and average_score < 65 else "MEDIUM")
            db.add(task)
            plan_tasks.append(task)
    db.commit()
    return {"courseId": course.id, "examDate": payload.exam_date.isoformat(), "hoursPerDay": payload.hours_per_day, "baselineQuizScore": round(average_score, 1) if average_score is not None else None, "tasks": [_task_json(task) for task in plan_tasks]}


@app.get("/api/analytics")
def analytics(user: User = Depends(current_user), db: Session = Depends(get_db)):
    courses = list(db.scalars(select(Course).where(Course.owner_id == user.id).order_by(Course.title)))
    sessions = list(db.scalars(select(StudySession).where(StudySession.owner_id == user.id)))
    score_rows = db.execute(select(Quiz.course_id, Quiz.score).join(Course).where(Course.owner_id == user.id, Quiz.score.is_not(None))).all()
    scores_by_course: dict[int, list[float]] = {}
    for course_id, score in score_rows:
        scores_by_course.setdefault(course_id, []).append(float(score))
    course_stats = []
    for course in courses:
        scores = scores_by_course.get(course.id, [])
        minutes = sum(session.minutes for session in sessions if session.course_id == course.id)
        course_stats.append({"id": course.id, "code": course.code, "title": course.title, "averageScore": round(sum(scores) / len(scores), 1) if scores else None, "quizAttempts": len(scores), "studyMinutes": minutes})
    today = date.today()
    studied_days = {session.studied_at.date() for session in sessions}
    streak_anchor = today if today in studied_days else today - timedelta(days=1)
    streak = 0
    while streak_anchor - timedelta(days=streak) in studied_days:
        streak += 1
    daily = []
    for day_offset in range(6, -1, -1):
        day = today - timedelta(days=day_offset)
        daily.append({"date": day.isoformat(), "minutes": sum(session.minutes for session in sessions if session.studied_at.date() == day)})
    return {"courses": course_stats, "streakDays": streak, "studyMinutesTotal": sum(session.minutes for session in sessions), "studyMinutesWeek": sum(item["minutes"] for item in daily), "dailyStudy": daily}


@app.post("/api/study-sessions", status_code=201)
def create_study_session(payload: StudyInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if payload.course_id is not None:
        _course(db, payload.course_id, user.id)
    session = StudySession(owner_id=user.id, course_id=payload.course_id, minutes=payload.minutes)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "minutes": session.minutes, "studiedAt": session.studied_at.isoformat()}
