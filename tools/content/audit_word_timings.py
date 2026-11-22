"""assets/lessons/*/lesson.json の単語タイミングを走査し、スリバー潰れを検出する。

build_lesson.py の fill_alignment_gaps と同じ条件 (単語の長さ < 0.08 秒 かつ
直前のギャップ > 0.15 秒) で、faster-whisper の DTW が単語を実際の発話スパンの
末尾に潰した箇所を全レッスン分報告する。読み取り専用 (ファイルは変更しない)。

Usage (リポジトリ ルートで):
  uv run --project tools/content python tools/content/audit_word_timings.py
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent

# build_lesson.fill_alignment_gaps の閾値と必ず一致させること
MIN_DUR_SEC = 0.08
MIN_GAP_SEC = 0.15


def audit_lesson(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    hits: list[str] = []
    for sentence in data["sentences"]:
        words = sentence["words"]
        for i in range(1, len(words)):
            prev, word = words[i - 1], words[i]
            gap = word["startSec"] - prev["endSec"]
            dur = word["endSec"] - word["startSec"]
            if dur < MIN_DUR_SEC and gap > MIN_GAP_SEC:
                hits.append(
                    f"  sentence {sentence['index']}: {word['text']!r} "
                    f"{word['startSec']:.3f}-{word['endSec']:.3f} "
                    f"dur {dur:.3f}s gap {gap:.3f}s "
                    f"(prev {prev['text']!r} ends {prev['endSec']:.3f})"
                )
    return hits


def main() -> int:
    lessons_dir = REPO / "assets" / "lessons"
    total = 0
    for path in sorted(lessons_dir.glob("*/lesson.json")):
        hits = audit_lesson(path)
        total += len(hits)
        print(f"{path.parent.name}: {len(hits)}")
        for hit in hits:
            print(hit)
    print(f"TOTAL: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
