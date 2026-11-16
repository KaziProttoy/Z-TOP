from __future__ import annotations

import io
import logging
import os
import re
import shutil
from pathlib import Path

import fitz
import pytesseract
from PIL import Image
from docx import Document as WordDocument
from fastapi import HTTPException
from pypdf import PdfReader

logger = logging.getLogger("z_top.documents")
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}


def _extract(file_name: str, data: bytes) -> list[tuple[int, str]]:
    suffix = Path(file_name).suffix.lower()
    if suffix in IMAGE_EXTENSIONS:
        return [(1, _ocr_image(data))]
    if suffix == ".pdf":
        reader = PdfReader(io.BytesIO(data))
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
        document = WordDocument(io.BytesIO(data))
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


