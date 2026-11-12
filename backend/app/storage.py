from __future__ import annotations

import os
from typing import Any

from supabase import Client, create_client

_client: Client | None = None


def configured() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY") and os.getenv("SUPABASE_STORAGE_BUCKET"))


def _storage():
    global _client
    if not configured():
        raise RuntimeError("Supabase Storage is not configured")
    if _client is None:
        _client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    return _client.storage.from_(os.environ["SUPABASE_STORAGE_BUCKET"])


def upload(path: str, data: bytes, content_type: str) -> None:
    _storage().upload(path, data, {"content-type": content_type, "upsert": "true"})


def download(path: str) -> bytes:
    return _storage().download(path)


def remove(path: str) -> None:
    _storage().remove([path])
