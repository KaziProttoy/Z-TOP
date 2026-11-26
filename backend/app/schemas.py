from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

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
    document_ids: list[int] | None = None
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


