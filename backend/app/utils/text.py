from __future__ import annotations

import html
import re
import unicodedata
from collections.abc import Iterable

_CONTROL_RE = re.compile(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]")
_SPACE_RE = re.compile(r"[ \t\u00a0]+")
_NEWLINE_RE = re.compile(r"\n{3,}")


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    value = html.unescape(value)
    value = unicodedata.normalize("NFC", value)
    value = _CONTROL_RE.sub("", value)
    lines = [
        _SPACE_RE.sub(" ", line).strip()
        for line in value.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    ]
    cleaned = "\n".join(line for line in lines)
    cleaned = _NEWLINE_RE.sub("\n\n", cleaned)
    return cleaned.strip()


def normalize_inline(value: str | None) -> str:
    return " ".join(clean_text(value).split())


def count_words(text: str) -> int:
    """Count words for space-delimited scripts and code-point clusters for others."""
    if not text.strip():
        return 0
    words = re.findall(r"\S+", text)
    if len(words) >= 2 or " " in text.strip():
        return len(words)
    # Kannada and other scripts may use fewer spaces; approximate by grapheme clusters.
    return max(1, len(re.findall(r"[\u0C80-\u0CFF]|[\w']", text)))


def reading_time_minutes(word_count: int) -> int:
    if word_count <= 0:
        return 0
    return max(1, round(word_count / 220))


def dedupe_preserve(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for item in items:
        key = item.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        output.append(key)
    return output


def truncate(value: str, limit: int = 300) -> str:
    value = value.strip()
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def language_from_locale(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip().replace("_", "-")
    if not value:
        return None
    primary = value.split("-")[0].lower()
    return primary or None
