#!/usr/bin/env python3
"""PreToolUse safety guard for eng-listening (ミミトレ).

Enforces core repository invariants without blocking legitimate operations:
1. Prevents accidental direct `git push` to `main` (PR workflow required).
2. Prevents creating `.github/workflows/*` (hosted runner quota exhausted).
3. Guards against directly editing generated lesson assets (`assets/lessons/`,
   `targets/watch/Lessons/`) instead of regenerating via `tools/content/` and
   `tools/watch-assets/sync_watch_assets.sh`.
4. Guards against leaking secrets (GEMINI_API_KEY, EXPO_PUBLIC_REVENUECAT_API_KEY,
   ASC .p8 keys, or raw gcloud access tokens) to stdout/logs.
"""

from __future__ import annotations

import json
import re
import sys


def emit(decision: str, reason: str | None = None) -> None:
    payload: dict[str, str] = {"decision": decision}
    if reason:
        payload["reason"] = reason
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")


def check_run_command(cmd: str) -> tuple[str, str | None]:
    # 1. Direct push to main
    if re.search(r"\bgit\s+push\b", cmd):
        if re.search(r"\bgit\s+push\b[^\n;|&]*(?:\bmain\b|HEAD:main|:refs/heads/main)", cmd):
            return (
                "force_ask",
                "main ブランチへの直接 push はプロジェクト規約で禁止されています（PR 経由でマージしてください）。本当に実行しますか？",
            )

    # 2. Secret leakage patterns (printing keys or reading private .p8 keys)
    secret_print_patterns = [
        r"(?:echo|printf|printenv|cat|head|tail|less|more)\b[^\n;|&]*(?:GEMINI_API_KEY|EXPO_PUBLIC_REVENUECAT_API_KEY|\.appstoreconnect/[^\s]*\.p8)",
        r"(?:cat|head|tail|less|more)\s+[^\n;|&]*\.env\b",
        r"gcloud\s+auth\s+print-access-token\s*(?:$|[;&|])",
    ]
    for pat in secret_print_patterns:
        if re.search(pat, cmd):
            return (
                "force_ask",
                "シークレット（API キー / .env / .p8 / gcloud トークン）がログに出力される恐れがあります。本当に実行しますか？",
            )

    # 3. GitHub Actions workflow creation via shell
    if re.search(r"\.github/workflows/", cmd):
        return (
            "force_ask",
            "GitHub Actions ワークフローの作成は禁止方針です（ホステッドランナー枠制約のためローカル検証を使用）。本当に実行しますか？",
        )

    return ("allow", None)


def check_file_write(path: str) -> tuple[str, str | None]:
    normalized = path.replace("\\", "/")

    if "/.github/workflows/" in normalized or normalized.startswith(".github/workflows/"):
        return (
            "force_ask",
            "GitHub Actions ワークフローの作成は禁止方針です（docs/operations.md §5）。本当に変更しますか？",
        )

    if re.search(r"(?:^|/)assets/lessons/", normalized):
        return (
            "force_ask",
            "assets/lessons/** は tools/content/ パイプラインの生成物です。生成元を修正して再生成してください。直接編集を続行しますか？",
        )

    if re.search(r"(?:^|/)targets/watch/Lessons/", normalized):
        return (
            "force_ask",
            "targets/watch/Lessons/** は sync_watch_assets.sh の同期生成物です。zsh tools/watch-assets/sync_watch_assets.sh を使用してください。直接編集を続行しますか？",
        )

    return ("allow", None)


def main() -> int:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            emit("allow")
            return 0
        data = json.loads(raw)
    except Exception:
        emit("allow")
        return 0

    tool_call = data.get("toolCall") or {}
    name = str(tool_call.get("name") or "")
    args = tool_call.get("args") or {}

    if name == "run_command":
        decision, reason = check_run_command(str(args.get("CommandLine") or ""))
        emit(decision, reason)
        return 0

    if name in ("write_file", "edit_file"):
        decision, reason = check_file_write(str(args.get("Path") or ""))
        emit(decision, reason)
        return 0

    emit("allow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
