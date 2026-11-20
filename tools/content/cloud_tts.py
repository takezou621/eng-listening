"""Google Cloud TTS クライアント (コンテンツパイプライン共有モジュール)。

アニメ日本史ラボの gen_narration_unified.py の仕組みを Google Cloud Text-to-Speech
向けに移植したもの。設計は本家と同一:

- 音声設定は voice_config.json 一元管理 (単一構成固定)。
- 設定ハッシュ (config_hash) による既存音声の混在防止。
- TTS 呼び出しにタイムアウト (ウォッチドッグ) と上限付きリトライ。
- ゼロコスト制約: Neural2 系のみ・月間文字数カウンタが上限に達したら停止。

認証はこの PC の既存 gcloud ユーザー認証を使い、アクセストークンの値は
決してログ・標準出力に出さない。ユーザー認証トークンで呼ぶ際は
X-Goog-User-Project ヘッダ (クォータプロジェクト) が必須 (無いと 403)。
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG_PATH = HERE / "voice_config.json"
USAGE_DIR = HERE / "usage"


class TTSError(RuntimeError):
    """TTS 呼び出しがリトライ上限に達するなどして失敗した。"""


class UsageLimitExceeded(TTSError):
    """月間文字数カウンタが停止上限 (monthlyStopChars) に達した。"""


def load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def config_hash(cfg: dict) -> str:
    """voice_config.json の SHA-256 (先頭16文字)。

    本家 (anime_japanese_history) と同じ方式。生成物の manifest に記録し、
    異なるハッシュの既存音声と混在しないようにする。
    """
    blob = json.dumps(cfg, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()[:16]


# ---------------------------------------------------------------------------
# 月間文字数カウンタ (ゼロコスト制約)
# ---------------------------------------------------------------------------

def current_month() -> str:
    """当月 (YYYY-MM)。カウンタは暦月でリセットする。"""
    return datetime.now().strftime("%Y-%m")


def usage_path(month: str | None = None) -> Path:
    return USAGE_DIR / f"monthly-{month or current_month()}.json"


def read_usage(month: str | None = None) -> dict:
    path = usage_path(month)
    if not path.exists():
        return {"month": month or current_month(), "chars": 0, "requests": 0, "lessons": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_usage_atomic(usage: dict) -> None:
    USAGE_DIR.mkdir(parents=True, exist_ok=True)
    path = usage_path(usage["month"])
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(usage, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, path)


def check_monthly_budget(cfg: dict, additional_chars: int) -> dict:
    """追加分を足しても停止上限以内か確認する。超過なら UsageLimitExceeded。

    停止上限 monthlyStopChars (90万) < 無料枠 (月100万文字) なので、
    上限到達 = 生成停止 = 無料枠超過による課金の未然防止。
    """
    usage = read_usage()
    stop = int(cfg["limits"]["monthlyStopChars"])
    projected = usage["chars"] + additional_chars
    if projected > stop:
        raise UsageLimitExceeded(
            f"月間文字数カウンタが停止上限に達します: 使用 {usage['chars']} + "
            f"追加分 {additional_chars} > 上限 {stop} 文字。生成を停止します。"
            "無料枠 (月1,000,000文字) 超過による課金を防ぐため、当月はこれ以上生成しないこと。"
        )
    return usage


def record_usage(chars: int, lesson_id: str) -> dict:
    """成功したリクエスト分の文字数を当月カウンタに加算する (原子的更新)。"""
    usage = read_usage()
    usage["chars"] += chars
    usage["requests"] += 1
    per = usage.setdefault("lessons", {}).setdefault(lesson_id, {"chars": 0, "requests": 0})
    per["chars"] += chars
    per["requests"] += 1
    _write_usage_atomic(usage)
    return usage


# ---------------------------------------------------------------------------
# 認証 (gcloud ユーザー認証)
# ---------------------------------------------------------------------------

def get_access_token(account: str) -> str:
    """gcloud の既存ユーザー認証からアクセストークンを取得する。

    トークンの値を一切出力しないこと (秘密情報はログ・PR・コミット禁止)。
    """
    result = subprocess.run(
        ["gcloud", "auth", "print-access-token", f"--account={account}"],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    token = result.stdout.strip()
    if result.returncode != 0 or not token:
        raise TTSError(
            "gcloud アクセストークンの取得に失敗しました "
            f"(account={account}, rc={result.returncode})。"
            "`gcloud auth list` で認証状態を確認してください。"
        )
    return token


# ---------------------------------------------------------------------------
# TTS 呼び出し (ウォッチドッグ付き)
# ---------------------------------------------------------------------------

def synthesize(cfg: dict, text: str, voice_name: str, *, lesson_id: str, label: str) -> bytes:
    """1 行分の音声を合成して audio bytes (LINEAR16 WAV) を返す。

    - タイムアウト (voice_config.watchdog.timeoutSec, 目安 180 秒) でハングを自動切断。
    - 失敗時は上限付きリトライ (maxRetries / backoffSec)。
    - 成功したリクエストのみ月間文字数カウンタに加算する。
    - 別エンジン・別声へのフォールバックは意図的に実装しない (単一構成固定)。
    """
    text = text.strip()
    if not text:
        raise TTSError(f"空のテキストで TTS を呼ぼうとしました: {label}")
    if not voice_name.startswith("en-US-Neural2"):
        # ゼロコスト制約: Neural2 以外 (Studio / Chirp など有料単価の高い声) を
        # 設定ファイルへの誤記込みで使わないようにここで弾く。
        raise TTSError(
            f"Neural2 以外の声は使えません (ゼロコスト制約): {voice_name}"
        )

    wd = cfg["watchdog"]
    body = {
        "input": {"text": text},
        "voice": {"languageCode": cfg["languageCode"], "name": voice_name},
        "audioConfig": dict(cfg["audio"]),
    }
    url = cfg["apiEndpoint"]
    token = get_access_token(cfg["gcloudAccount"])
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Goog-User-Project": cfg["quotaProject"],
        "Content-Type": "application/json",
    }

    last_error: Exception | None = None
    for attempt in range(int(wd["maxRetries"]) + 1):
        if attempt > 0:
            delay = float(wd["backoffSec"][min(attempt - 1, len(wd["backoffSec"]) - 1)])
            print(f"  retry {attempt}/{wd['maxRetries']} after {delay:.0f}s ({last_error})",
                  flush=True)
            time.sleep(delay)
        try:
            req = urllib.request.Request(
                url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST"
            )
            with urllib.request.build_opener().open(req, timeout=float(wd["timeoutSec"])) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            audio = base64.b64decode(data["audioContent"])
            usage = record_usage(len(text), lesson_id)
            print(
                f"  tts ok: {label} chars={len(text)} "
                f"(month total {usage['chars']}/{cfg['limits']['monthlyStopChars']})",
                flush=True,
            )
            return audio
        except UsageLimitExceeded:
            raise
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError,
                KeyError, ValueError) as exc:
            # HTTPError のレスポンスボディにはプロジェクト ID 以外の秘密情報は含まれないため、
            # ステータスコードのみを表示する (詳細は不要、トークン等は出さない)。
            code = getattr(exc, "code", None)
            last_error = exc
            if code is not None:
                print(f"  tts error: HTTP {code}", flush=True)
            else:
                print(f"  tts error: {type(exc).__name__}", flush=True)

    raise TTSError(f"TTS failed after {wd['maxRetries']} retries: {label} ({last_error})")
