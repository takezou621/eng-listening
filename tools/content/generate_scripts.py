"""lesson-plan.json → Gemini (Structured Outputs) → 台本 JSON 生成 (Issue #1)。

- tools/content/lesson-plan.json の各レッスンについて、tools/content/lessons/<id>.json
  を LLM で生成する。台本スキーマは cafe-ordering.json が正 (変更しない)。
- 認証は mini 上のアニメ日本史ラボのツール群と同じ GEMINI_API_KEY
  (~/.zshrc の export を環境変数として使用) を google-genai SDK に渡す。
  キーの値をログ・PR・コミットに出力してはならない。
- 生成後、validate_script() で JSON スキーマ / chunks 連結一致 / linking span の
  部分文字列性 / IPA 形式 / 行数とレベルを検証する。失敗したレッスンは
  再生成し (上限 3 回)、上限を超えたらここで停止して報告する。

Usage (リポジトリ ルートで):
  uv run --project tools/content python tools/content/generate_scripts.py --all
  uv run --project tools/content python tools/content/generate_scripts.py --lesson hotel-checkin
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
PLAN_PATH = HERE / "lesson-plan.json"
LESSONS_DIR = HERE / "lessons"
VOICE_CONFIG_PATH = HERE / "voice_config.json"

DEFAULT_MODEL = "gemini-3.8-flash"
MAX_ATTEMPTS = 3
# linking.type として許容する音の変化の種類
ALLOWED_LINKING_TYPES = {
    "linking", "reduction", "flapping", "assimilation", "palatalization",
    "elision", "intrusion", "weak-form",
}
# IPA 本文に使ってよい記号 (ASCII 句読点) — 文字そのものは is_ipa_body で判定する
IPA_PUNCT = set(" .-‿|‖'():,ː")


GENERATION_CONVENTION = """\
台本の書き方のルール:
- type / level / title / titleJa はレッスン情報で指定された値をそのまま入れる。
- text: TOEIC 400〜750 の学習者が「知っている単語なのに聞き取れない」音の変化 \
(linking / reduction / flapping / assimilation / palatalization など) が自然に多い英文にする。\
難語彙・専門用語は使わない。1 文は 6〜18 語程度。
- chunks: 文を意味のかたまり (スラッシュ表示の単位) に区切った配列。\
すべての chunks を " " (半角スペース 1 個) で連結すると text と完全に一致すること \
(text は chunks を連結したものから余計な空白を入れない)。
- linking: 1 レッスンに 6 箇所以上。span は text の部分文字列を一字一句コピーしたもの \
(大文字小文字・アポストロフィ・句読点を含めて完全一致)。1 行の linking は 1〜2 箇所まで。\
ipa は / で囲んだ IPA 記号で書く (例: "/wʊdʒə/", "/ðə/", "/aɪd laɪk‿ə/", "/ɪɾɪz/")。\
noteJa は日本語で「どう聞こえるか」を 1〜2 文で説明する。type は \
linking / reduction / flapping / assimilation / palatalization / elision / intrusion / weak-form から選ぶ。
- translationJa: チャンク単位の直訳ではなく、文単位の自然な日本語訳。
- speakerNames: 役割ごとの登場人物名 (例: {"female": "Barista", "male": "Customer"})。\
使用する各役割に必ず名前を付ける。
- conversation は female / male の 2 役が交互に近い形で話す。monologue はすべて narrator。\
lines の index は 1 から始まる連番。
"""


def is_ipa_body(body: str) -> bool:
    """/.../ の中身が IPA として妥当な文字だけで構成されているか。

    - 文字として有効: IPA_PUNCT の記号、何らかの言語の英字 (ð æ などの Latin-1 系
      IPA 記号を含む)、Unicode 音声記号ブロック
    - 空白で区切った各トークンについて「非 ASCII の英字 (音声記号) を含む」か
      「2 文字以内の純 ASCII (/aɪ/ など)」を要求する。英単語 (would, you など) は
      拒否される。絵文字など記号以外の文字も拒否。
    """
    for token in body.split(" "):
        if not token:
            continue
        valid_chars = all(ch in IPA_PUNCT or ch.isalpha() or 0x0250 <= ord(ch) <= 0x2AFF
                          for ch in token)
        has_phonetic = any(ch.isalpha() and ord(ch) > 127 for ch in token)
        if has_phonetic and valid_chars:
            continue
        # 純 ASCII トークンは短いものだけ許容 (aɪ / ɔɪ / ju など)
        if len(token) <= 2 and all(ch in IPA_PUNCT or ch.isalpha() for ch in token):
            continue
        return False
    return True


def response_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "titleJa": {"type": "string"},
            "type": {"type": "string", "enum": ["conversation", "monologue"]},
            "level": {"type": "string", "enum": ["beginner", "intermediate"]},
            "speakerNames": {
                "type": "object",
                "properties": {
                    "female": {"type": "string"},
                    "male": {"type": "string"},
                    "narrator": {"type": "string"},
                },
                "required": [],
            },
            "lines": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "index": {"type": "integer"},
                        "speaker": {"type": "string", "enum": ["female", "male", "narrator"]},
                        "text": {"type": "string"},
                        "chunks": {"type": "array", "items": {"type": "string"}},
                        "translationJa": {"type": "string"},
                        "linking": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "span": {"type": "string"},
                                    "type": {"type": "string",
                                             "enum": sorted(ALLOWED_LINKING_TYPES)},
                                    "ipa": {"type": "string"},
                                    "noteJa": {"type": "string"},
                                },
                                "required": ["span", "type", "ipa", "noteJa"],
                            },
                        },
                    },
                    "required": ["index", "speaker", "text", "chunks", "translationJa", "linking"],
                },
            },
        },
        "required": ["title", "titleJa", "type", "level", "speakerNames", "lines"],
    }


def build_prompt(entry: dict) -> str:
    line_min, line_max = (8, 12) if entry["type"] == "conversation" else (10, 14)
    return (
        "You are writing an English listening lesson script for Japanese learners "
        "(TOEIC 400-750). Follow the rules below exactly.\n\n"
        + GENERATION_CONVENTION
        + f"\nレッスン情報:\n"
        + f"- id: {entry['id']}\n"
        + f"- type: {entry['type']} (行数は {line_min}〜{line_max} 行)\n"
        + f"- level: {entry['level']} (beginner = より平易な語彙と短めの文, "
        + "intermediate = やや長い文と自然な口語表現)\n"
        + f"- category: {entry['category']}\n"
        + f"- situation: {entry['situation']}\n"
        + f"- speakers (使ってよい役割): {', '.join(entry['speakers'])}\n"
        + f"- title/titleJa は次のものをそのまま使う: title=\"{entry['title']}\", "
        + f"titleJa=\"{entry['titleJa']}\"\n"
        + "\nOutput JSON only, following the schema."
    )


# ---------------------------------------------------------------------------
# 認証 (アニメ日本史ラボと同じ GEMINI_API_KEY。値は一切出力しない)
# ---------------------------------------------------------------------------

def load_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        return key
    # mini のアニメ日本史ラボと同じ場所 (~/.zshrc の export) から読む (値は出力しない)
    zshrc = Path.home() / ".zshrc"
    if zshrc.exists():
        for line in zshrc.read_text(encoding="utf-8", errors="ignore").splitlines():
            m = re.match(r"^export GEMINI_API_KEY=(.+)$", line.strip())
            if m:
                value = m.group(1).strip().strip("'\"")
                if value:
                    print("GEMINI_API_KEY: loaded from ~/.zshrc (value not shown)", flush=True)
                    return value
    raise SystemExit(
        "GEMINI_API_KEY が見つかりません (環境変数または ~/.zshrc の export)。"
        "アニメ日本史ラボと同じ認証が使えないため、ここで停止します。"
    )


def generate_with_llm(api_key: str, model: str, prompt: str) -> dict:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    resp = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema(),
            temperature=0.7,
        ),
    )
    return json.loads(resp.text)


# ---------------------------------------------------------------------------
# バリデーション
# ---------------------------------------------------------------------------

def norm_ws(s: str) -> str:
    return " ".join(s.split())


def validate_script(script: dict, entry: dict, voice_roles: set[str]) -> list[str]:
    errors: list[str] = []
    lesson_id = entry["id"]
    line_min, line_max = (8, 12) if entry["type"] == "conversation" else (10, 14)

    for field in ("title", "titleJa", "speakerNames", "lines"):
        if field not in script:
            errors.append(f"必須フィールド欠落: {field}")
    if errors:
        return errors

    if script.get("title") != entry["title"]:
        errors.append(f"title 不一致: {script.get('title')!r}")
    if script.get("titleJa") != entry["titleJa"]:
        errors.append(f"titleJa 不一致: {script.get('titleJa')!r}")
    if script.get("id") != lesson_id:
        errors.append(f"id 不一致: {script.get('id')!r}")
    if script.get("category") != entry["category"]:
        errors.append(f"category 不一致: {script.get('category')!r}")
    if script.get("type") != entry["type"]:
        errors.append(f"type 不一致: {script.get('type')!r}")
    if script.get("level") != entry["level"]:
        errors.append(f"level 不一致: {script.get('level')!r}")

    lines = script["lines"]
    if not (line_min <= len(lines) <= line_max):
        errors.append(f"行数が範囲外: {len(lines)} (許容 {line_min}〜{line_max})")

    speaker_names = script.get("speakerNames") or {}
    used_roles = sorted({ln.get("speaker", "") for ln in lines})
    for role in used_roles:
        if role not in voice_roles:
            errors.append(f"話者ロールが voice_config にない: {role!r}")
        elif role not in speaker_names or not str(speaker_names[role]).strip():
            errors.append(f"speakerNames に {role} の名前がない")

    total_linking = 0
    for i, ln in enumerate(lines, start=1):
        if ln.get("index") != i:
            errors.append(f"行 {i}: index 不正 ({ln.get('index')})")
        text = str(ln.get("text", "")).strip()
        if not text:
            errors.append(f"行 {i}: text が空")
            continue
        if ln.get("speaker") not in voice_roles:
            errors.append(f"行 {i}: speaker 不正 ({ln.get('speaker')!r})")
        if not str(ln.get("translationJa", "")).strip():
            errors.append(f"行 {i}: translationJa が空")

        chunks = ln.get("chunks") or []
        chunks = [str(c).strip() for c in chunks if str(c).strip()]
        if not chunks:
            errors.append(f"行 {i}: chunks が空")
        elif norm_ws(" ".join(chunks)) != norm_ws(text):
            # 連結ルール: chunks を半角スペース 1 個で連結したもの (空白正規化後) が
            # text と完全一致すること
            errors.append(
                f"行 {i}: chunks 連結が text と不一致 "
                f"(joined={norm_ws(' '.join(chunks))[:60]!r})"
            )

        line_links = ln.get("linking") or []
        if len(line_links) > 2:
            errors.append(f"行 {i}: linking が多すぎる ({len(line_links)} > 2)")
        for lk in line_links:
            total_linking += 1
            span = str(lk.get("span", ""))
            if span not in text:
                errors.append(f"行 {i}: linking span が text の部分文字列でない: {span!r}")
            if lk.get("type") not in ALLOWED_LINKING_TYPES:
                errors.append(f"行 {i}: linking type 不正: {lk.get('type')!r}")
            ipa = str(lk.get("ipa", ""))
            if not (ipa.startswith("/") and ipa.endswith("/") and len(ipa) >= 3):
                errors.append(f"行 {i}: IPA が /.../ 形式でない: {ipa!r}")
            elif not is_ipa_body(ipa[1:-1]):
                errors.append(f"行 {i}: IPA に使えない文字がある: {ipa!r}")
            if not str(lk.get("noteJa", "")).strip():
                errors.append(f"行 {i}: linking noteJa が空")

    if total_linking < 6:
        errors.append(f"linking 注釈が不足: {total_linking} < 6")

    return errors


def normalize_indexes(script: dict, entry: dict) -> None:
    """計画から決まる機械的なフィールド (id / category / index) をここで揃える。"""
    script["id"] = entry["id"]
    script["category"] = entry["category"]
    for i, ln in enumerate(script.get("lines", []), start=1):
        ln["index"] = i


# ---------------------------------------------------------------------------


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="計画の全レッスンを対象にする")
    ap.add_argument("--lesson", action="append", help="指定 id だけ生成 (複数回可)")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--force", action="store_true",
                    help="既存の台本があっても上書きする (cafe-ordering は常にスキップ)")
    args = ap.parse_args()
    if not args.all and not args.lesson:
        ap.error("--all または --lesson を指定してください")

    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    voice_cfg = json.loads(VOICE_CONFIG_PATH.read_text(encoding="utf-8"))
    voice_roles = set(voice_cfg["voices"].keys())

    targets = []
    for entry in plan["lessons"]:
        lid = entry["id"]
        if args.lesson and lid not in args.lesson:
            continue
        if args.all or args.lesson:
            # cafe-ordering は既存ファイルが正。--force でも再生成しない
            if lid == "cafe-ordering":
                continue
            existing = LESSONS_DIR / f"{lid}.json"
            if existing.exists() and not args.force and not args.lesson:
                print(f"skip {lid} (既存)", flush=True)
                continue
            targets.append(entry)

    if args.lesson:
        missing = set(args.lesson) - {e["id"] for e in targets} - {"cafe-ordering"}
        if missing:
            raise SystemExit(f"lesson-plan.json にない id: {', '.join(sorted(missing))}")

    api_key = load_api_key()
    results = []
    for entry in targets:
        lid = entry["id"]
        last_errors: list[str] = []
        for attempt in range(1, MAX_ATTEMPTS + 1):
            print(f"[{lid}] attempt {attempt}/{MAX_ATTEMPTS} model={args.model}", flush=True)
            try:
                script = generate_with_llm(api_key, args.model, build_prompt(entry))
            except (json.JSONDecodeError, ValueError) as exc:
                last_errors = [f"LLM 応答が JSON として解析できない: {type(exc).__name__}"]
                print(f"  parse error: {last_errors[0]}", flush=True)
                continue
            except Exception as exc:  # noqa: BLE001 - API エラーも 1 回の失敗として数える
                status = getattr(exc, "code", None)
                last_errors = [f"LLM API エラー: {type(exc).__name__} (status={status})"]
                print(f"  api error: {last_errors[0]}", flush=True)
                continue
            normalize_indexes(script, entry)
            errors = validate_script(script, entry, voice_roles)
            if not errors:
                out_path = LESSONS_DIR / f"{lid}.json"
                out_path.write_text(
                    json.dumps(script, ensure_ascii=False, indent=1) + "\n",
                    encoding="utf-8",
                )
                n_links = sum(len(ln.get("linking", [])) for ln in script["lines"])
                print(f"  OK -> {out_path} lines={len(script['lines'])} linking={n_links}",
                      flush=True)
                results.append((lid, True, attempt, []))
                break
            last_errors = errors
            for e in errors[:8]:
                print(f"  invalid: {e}", flush=True)
            if len(errors) > 8:
                print(f"  ... and {len(errors) - 8} more", flush=True)
        else:
            # 3 回とも失敗: ここで停止して報告する (GM 指示)
            print(f"STOP: {lid} が {MAX_ATTEMPTS} 回の生成でバリデーションを通過しませんでした。",
                  flush=True)
            for e in last_errors:
                print(f"  last error: {e}", flush=True)
            return 2

    print("--- summary ---", flush=True)
    for lid, ok, attempt, errs in results:
        print(f"{lid}: {'PASS' if ok else 'FAIL'} (attempts={attempt})", flush=True)
    print(f"DONE {len(results)} lesson(s)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
