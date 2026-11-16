from __future__ import annotations

import re
from datetime import date, datetime, time

MONTH_DATE = re.compile(r"\b(?P<month>January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(?P<year>20\d{2}))?\b", re.IGNORECASE)
NUMERIC_DATE = re.compile(r"\b(?P<month>\d{1,2})[/-](?P<day>\d{1,2})[/-](?P<year>20\d{2})\b")
ISO_DATE = re.compile(r"\b(?P<year>20\d{2})-(?P<month>\d{2})-(?P<day>\d{2})\b")
EVENT_WORDS = re.compile(r"assignment|homework|project|quiz|exam|midterm|final|test|presentation|paper|lab|deadline|due", re.IGNORECASE)


def _candidate_date(match: re.Match[str], today: date) -> date | None:
    parts = match.groupdict()
    year = int(parts["year"]) if parts.get("year") else today.year
    try:
        if parts["month"].isdigit():
            parsed = date(year, int(parts["month"]), int(parts["day"]))
        else:
            month_name = parts["month"].replace(".", "").title()
            parsed = datetime.strptime(f"{month_name} {parts['day']} {year}", "%B %d %Y").date()
    except ValueError:
        return None
    if not parts.get("year") and parsed < today:
        try:
            parsed = parsed.replace(year=year + 1)
        except ValueError:
            return None
    return parsed


def extract_deadlines(text: str, today: date | None = None) -> list[dict[str, str]]:
    today = today or date.today()
    found: dict[tuple[date, str], dict[str, str]] = {}
    for line in re.split(r"[\r\n]+", text):
        clean_line = re.sub(r"\s+", " ", line).strip(" \t-*#")
        if not clean_line or not EVENT_WORDS.search(clean_line):
            continue
        matches = list(ISO_DATE.finditer(clean_line)) + list(NUMERIC_DATE.finditer(clean_line)) + list(MONTH_DATE.finditer(clean_line))
        if not matches:
            continue
        match = min(matches, key=lambda item: item.start())
        due = _candidate_date(match, today)
        if due is None or due < today:
            continue
        title = clean_line[:match.start()].strip(" :-,.") or clean_line[match.end():].strip(" :-,.")
        title = re.sub(r"\b(due|on|by|date)\b\s*$", "", title, flags=re.IGNORECASE).strip(" :-,.")
        if not title:
            title = clean_line[:180]
        found[(due, title)] = {"title": title[:240], "dueDate": datetime.combine(due, time(hour=23, minute=59)).isoformat()}
    return [found[key] for key in sorted(found)]


def split_topics(texts: list[str]) -> list[str]:
    topics: list[str] = []
    for text in texts:
        for sentence in re.split(r"(?<=[.!?])\s+", text):
            sentence = re.sub(r"\s+", " ", sentence).strip()
            if len(sentence) >= 40 and sentence not in topics:
                topics.append(sentence)
    return topics
