#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build an asc-submit spec.json from the App Store metadata in this repo.

kilde / eyechecker (takezou621/kilde, takezou621/eyechecker
scripts/release/appstore-spec.py) と同じ仕組みのミミトレ版。生成した spec は
`asc-submit run` (takezou621/asc-submit) に渡し、App Store バージョンの作成から
What's New / 説明 / キーワード / サブタイトル / 審査メモの反映、審査提出までを行う。

メタデータの正本:

- docs/appstore/metadata-ja.md   ロケール別 (ja のみ): What's New (必須) と
                                 説明 / キーワード / サブタイトル
- docs/appstore/review-notes.md  審査メモ (English section)

Usage:

    python3 scripts/release/appstore-spec.py --version 1.1 [--build N] [--output PATH]

対象バージョンの What's New は "What's New (<version>)" セクションとして必要 —
無ければこの時点で失敗する (古い文面でリリースが進むのを防ぐ)。

文字数上限の機械検証 (このスクリプトの役割):
- キーワード ≤100 文字 + バイト上限 (ja は 180 バイトの受理実績)
- サブタイトル ≤30 文字
- 説明文 ≤4,000 文字 / What's New ≤4,000 文字 (ASC のフィールド上限)
asc-submit が apply 時に再検証するので二重になるが、spec 生成の時点で止まる方が早い。

スクリーンショットは spec に含めない — ASC が前バージョンから引き継ぐため
(スクショを付け替えるときは ASC 画面か `asc-submit screenshots` で手動反映する)。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
META_DIR = ROOT_DIR / "docs/appstore"
NOTES_FILE = ROOT_DIR / "docs/appstore/review-notes.md"

# locale -> metadata file name. ミミトレは ja のみを配信する。
# The locale string is the one App Store Connect uses for the app record.
LOCALES = {
    "ja": "metadata-ja.md",
}

APP_ID = "6837503600"  # com.takezou.englistening (ミミトレ)

# サポート URL (バージョン情報) とプライバシーポリシー URL (アプリ情報)。
# 文面の正は docs/store/listing-ja-final.md §サポート URL / §プライバシー。
SUPPORT_URLS = {
    "ja": "https://33eigo.win/support",
}
PRIVACY_URLS = {
    "ja": "https://33eigo.win/privacy",
}

# Headings that carry the Description code block.
DESCRIPTION_HEADING = re.compile(r"description|説明", re.IGNORECASE)
# Headings that carry this release's What's New block.
WHATSNEW_HEADING = re.compile(r"what.?s.new|新着情報", re.IGNORECASE)
# Headings for the version-level keywords and the app-level subtitle.
KEYWORDS_HEADING = re.compile(r"keywords|キーワード", re.IGNORECASE)
SUBTITLE_HEADING = re.compile(r"subtitle|サブタイトル", re.IGNORECASE)
# The English section of review-notes.md that gets pasted into ASC.
NOTES_SECTION = re.compile(
    r"## English \(paste into App Review Notes\)\n(.*?)\n---", re.S
)

# ASC field limits, enforced here so a bad value fails before asc-submit runs
# (asc-submit re-validates the character limits on its side — keep in sync).
# バイト上限の運用ルールは eyechecker と同じ: Apple の資料は 100 文字 / 100 バイトで
# 揺れており、ja は 71 文字 / 180 バイトの受理実績があるため 180 バイトまで許容。
KEYWORDS_MAX_CHARS = 100
KEYWORDS_MAX_BYTES = {"ja": 180}
KEYWORDS_DEFAULT_MAX_BYTES = 100
SUBTITLE_MAX_CHARS = 30
DESCRIPTION_MAX_CHARS = 4000
WHATSNEW_MAX_CHARS = 4000


def code_blocks(text: str) -> list[tuple[str, str]]:
    """Return (first heading line, code block content) pairs in document order.

    Only the heading's first line is kept on purpose: the ``##`` heading and
    the fenced block may be separated by prose (the What's New sections carry
    editorial notes), and letting ``.+?`` swallow that prose would make
    version matching below see version strings from the notes.
    """
    return [
        (m.group(1).strip().split("\n", 1)[0], m.group(2))
        for m in re.finditer(r"## (.+?)\n+```text\n(.*?)\n```", text, re.S)
    ]


def section_for_version(headings: list[tuple[str, str]], version: str, locale: str) -> str:
    """Find the What's New code block whose heading names this version."""
    token = f"({version})"
    matches = [
        block
        for heading, block in headings
        if WHATSNEW_HEADING.search(heading) and token in heading
    ]
    if len(matches) == 1:
        return matches[0].strip()
    if not matches:
        raise SystemExit(
            f"{locale}: no \"What's New ({version})\" section in {LOCALES[locale]}. "
            f"Write the release copy into the metadata file before generating the spec."
        )
    raise SystemExit(
        f"{locale}: {len(matches)} What's New sections mention {version!r} in "
        f"{LOCALES[locale]}; keep exactly one"
    )


def optional_single_line(
    headings: list[tuple[str, str]], heading_re: re.Pattern, what: str, locale: str, fname: str
) -> str | None:
    """Return the optional single-line block for a field, or None when absent."""
    matches = [block for heading, block in headings if heading_re.search(heading)]
    if not matches:
        return None
    if len(matches) > 1:
        raise SystemExit(
            f"{locale}: at most one {what} block expected in {fname}, found {len(matches)}"
        )
    text = matches[0].strip()
    if "\n" in text:
        raise SystemExit(f"{locale}: {what} must be a single line in {fname}")
    return text


def optional_block(
    headings: list[tuple[str, str]], heading_re: re.Pattern, what: str, locale: str, fname: str
) -> str | None:
    """Return the optional multi-line block for a field, or None when absent."""
    matches = [block for heading, block in headings if heading_re.search(heading)]
    if not matches:
        return None
    if len(matches) > 1:
        raise SystemExit(
            f"{locale}: at most one {what} block expected in {fname}, found {len(matches)}"
        )
    return matches[0].strip()


def build_spec(version: str, build: str | None) -> dict:
    whats_new: dict[str, str] = {}
    descriptions: dict[str, str] = {}
    keywords: dict[str, str] = {}
    subtitles: dict[str, str] = {}
    for locale, fname in LOCALES.items():
        path = META_DIR / fname
        if not path.is_file():
            raise SystemExit(f"metadata file not found: {path}")
        headings = code_blocks(path.read_text(encoding="utf-8"))

        wn = section_for_version(headings, version, locale)
        if len(wn) > WHATSNEW_MAX_CHARS:
            raise SystemExit(
                f"{locale}: What's New is {len(wn)} characters (limit {WHATSNEW_MAX_CHARS}) in {fname}"
            )
        whats_new[locale] = wn

        desc = optional_block(headings, DESCRIPTION_HEADING, "Description", locale, fname)
        if desc is not None:
            if len(desc) > DESCRIPTION_MAX_CHARS:
                raise SystemExit(
                    f"{locale}: description is {len(desc)} characters (limit {DESCRIPTION_MAX_CHARS}) in {fname}"
                )
            descriptions[locale] = desc

        kw = optional_single_line(headings, KEYWORDS_HEADING, "Keywords", locale, fname)
        if kw is not None:
            if len(kw) > KEYWORDS_MAX_CHARS:
                raise SystemExit(
                    f"{locale}: keywords are {len(kw)} characters (limit {KEYWORDS_MAX_CHARS}) in {fname}"
                )
            max_bytes = KEYWORDS_MAX_BYTES.get(locale, KEYWORDS_DEFAULT_MAX_BYTES)
            kw_bytes = len(kw.encode("utf-8"))
            if kw_bytes > max_bytes:
                raise SystemExit(
                    f"{locale}: keywords are {kw_bytes} bytes (limit {max_bytes}) in {fname}"
                )
            keywords[locale] = kw

        sub = optional_single_line(headings, SUBTITLE_HEADING, "Subtitle", locale, fname)
        if sub is not None:
            if len(sub) > SUBTITLE_MAX_CHARS:
                raise SystemExit(
                    f"{locale}: subtitle is {len(sub)} characters (limit {SUBTITLE_MAX_CHARS}) in {fname}"
                )
            subtitles[locale] = sub

    if not NOTES_FILE.is_file():
        raise SystemExit(f"review notes not found: {NOTES_FILE}")
    notes_match = NOTES_SECTION.search(NOTES_FILE.read_text(encoding="utf-8"))
    if not notes_match:
        raise SystemExit(
            f"could not find the English section in {NOTES_FILE} "
            "(expected a '## English (paste into App Review Notes)' heading followed by '---')"
        )

    # Deliberately no "submit" key: submitting is controlled by the
    # `asc-submit run --submit` flag alone, so a stale spec can never submit
    # on its own.
    # スクリーンショット系のキーも意図的に持たない (ASC が前バージョンから引き継ぐ)。
    spec: dict = {
        "version": version,
        "platform": "IOS",
        # AFTER_APPROVAL = 審査通過後に自動公開 (eyechecker と同じ運用)。
        # MANUAL に戻すときは ASC 側で直接 PATCH する。
        "releaseType": "AFTER_APPROVAL",
        "phasedRelease": False,
        "whatsNew": whats_new,
        "reviewNotes": notes_match.group(1).strip(),
        # サポート URL はバージョン情報、プライバシー URL はアプリ情報 (asc-submit が
        # それぞれ appStoreVersionLocalizations / appInfoLocalizations へ反映)
        "supportUrls": dict(SUPPORT_URLS),
        "privacyUrls": dict(PRIVACY_URLS),
    }
    if descriptions:
        spec["descriptions"] = descriptions
    if keywords:
        spec["keywords"] = keywords
    if subtitles:
        spec["subtitles"] = subtitles
    if build:
        spec["build"] = build
    return spec


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate an asc-submit spec.json from docs/appstore metadata."
    )
    parser.add_argument("--version", required=True, help="release version, e.g. 1.1")
    parser.add_argument("--build", help="build number already uploaded to App Store Connect")
    parser.add_argument(
        "--output",
        help="output path (default: dist/appstore/release-<version>.json)",
    )
    args = parser.parse_args()

    output = Path(args.output) if args.output else ROOT_DIR / f"dist/appstore/release-{args.version}.json"
    spec = build_spec(args.version, args.build)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"spec written: {output}")
    print(f"  whatsNew locales : {', '.join(sorted(spec['whatsNew']))}")
    if "descriptions" in spec:
        print(f"  description chars: { {k: len(v) for k, v in spec['descriptions'].items()} }")
    if "keywords" in spec:
        print(
            f"  keywords chars   : { {k: (len(v), len(v.encode('utf-8'))) for k, v in spec['keywords'].items()} } (chars, bytes)"
        )
    if "subtitles" in spec:
        print(f"  subtitle chars   : { {k: len(v) for k, v in spec['subtitles'].items()} }")
    print(f"  review notes     : {len(spec['reviewNotes'])} chars")
    print(f"  support URLs     : {len(spec['supportUrls'])} locales -> {SUPPORT_URLS['ja']}")
    print(f"  privacy URLs     : {len(spec['privacyUrls'])} locales -> {PRIVACY_URLS['ja']}")
    print("  screenshots      : none in spec (App Store Connect carries the previous set over)")
    print("next: asc-submit run " + APP_ID + " --spec " + str(output) + " [--submit]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
