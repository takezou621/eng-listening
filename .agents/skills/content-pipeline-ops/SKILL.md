---
name: content-pipeline-ops
description: >-
  Use this skill when generating, regenerating, realigning, or auditing English listening
  lesson scripts and audio via tools/content/ (Gemini scripts, Google Cloud TTS Neural2,
  voice consistency gate, faster-whisper alignment, Colab GPU workflow) and syncing outputs
  to the app registry and Apple Watch bundle.
---

# コンテンツ生成パイプライン運用ランブック

正本: `docs/content-pipeline.md`, `tools/content/COLAB.md`, `tools/content/voice_config.json`。

## 1. 実行前チェック（ゼロコスト & 冪等性ガード）

1. **コスト上限確認**: `tools/content/usage/monthly-YYYY-MM.json` を確認し、当月累計（確定 + `pendingChars`）が `monthlyStopChars`（900,000 文字）に近づいていないか確認する。超過・到達時は即停止して報告。
2. **共有台帳同期（Colab 併用時）**: Google Drive `eng-listening-content/` の `usage/` と `build/` を同期せずに Mac mini と Colab で並行生成しない。
3. **絶対禁止事項**:
   - Neural2 以外の声（Studio / Chirp 等）への変更禁止。
   - `cafe-ordering` の再生成禁止（既存が正）。
   - 障害時の別エンジン・別声フォールバック禁止。
   - `GEMINI_API_KEY` や `gcloud auth print-access-token` の値をログ・PR・コミットに出さない。
   - `assets/lessons/**` や `targets/watch/Lessons/**` を手で直接編集しない。

## 2. ローカル実行手順（リポジトリルート）

### ⓪ 台本生成（必要な場合のみ）
```bash
# 未生成分のみ（既存スキップ）
uv run --project tools/content python tools/content/generate_scripts.py --all
# 1 本指定（cafe-ordering 以外）
uv run --project tools/content python tools/content/generate_scripts.py --lesson <id>
```

### ① 行ごと Cloud TTS 生成
```bash
uv run --project tools/content python tools/content/generate_lesson.py --lesson <id>
# 特定行のみ再生成する場合:
# uv run --project tools/content python tools/content/generate_lesson.py --lesson <id> --line <N>
```
- 異なる `configHash` の既存成果物が `assets/lessons/<id>/` にある場合は中止される。`voice_config.json` 変更に伴う作り直し時のみ `assets/lessons/<id>/` と `tools/content/build/<id>/` を削除して再実行する。

### ② 音声一貫性ゲート（必須）
```bash
uv run --project tools/content python tools/content/check_voice_consistency.py --lesson <id>
```
- 基準: F0 偏差 ≤ 15%、話速偏差 ≤ 25%（words/sec）。
- FAIL した場合: Cloud TTS は決定論的なため単純再生成では収束しない。該当行の文長を軽微に調整（音変化注釈と意味を壊さない）→ 該当 WAV (`tools/content/build/<id>/lines/LXX_<speaker>.wav`) を削除 → ①② を再実行。

### ③ 連結・m4a 化・faster-whisper 単語アライメント
```bash
uv run --project tools/content python tools/content/build_lesson.py --lesson <id>
```
- GPU で高速に回す場合（新規量産や再アライメント）は `tools/content/COLAB.md` に従い `tools/content/colab/eng-listening-content-pipeline.ipynb` を使用する（`EL_TTS_AUTH_FALLBACK=adc`, `EL_WHISPER_DEVICE=cuda`, `EL_WHISPER_COMPUTE_TYPE=float16`）。

## 3. 生成後の必須検証・同期（忘れやすい重要手順）

1. **単語タイミングスリバー監査**:
   ```bash
   uv run --project tools/content python tools/content/audit_word_timings.py
   ```
   `TOTAL: 0` であることを確認する。
2. **Apple Watch 同梱レッスンの再同期**:
   ```bash
   zsh tools/watch-assets/sync_watch_assets.sh
   ```
   `targets/watch/Lessons/` の更新差分も必ず同じ PR に含める。
3. **新規レッスンの場合**:
   - `src/features/lesson/registry.ts` の `LESSON_CATALOG` と `BUNDLES` に追加（Metro のため `require` パスはリテラルで書く）。
   - `src/features/lesson/types.ts` の `assertValidLesson` と `ALLOWED_LINKING_TYPES` に乖離がないか確認。
4. **アプリ側チェック**:
   ```bash
   npm run lint && npm run typecheck
   ```
