"""行 WAV → アプリ用レッスン JSON + 音声ファイル (faster-whisper 単語タイムスタンプ付き)。

流れ (アニメ日本史ラボの timing_unified 相当を英語・アプリ向けに移植):

1. 一貫性ゲート (check_voice_consistency.py) のレポートが PASS であることを確認。
2. 行 WAV を固定ギャップで連結して 1 本のトラックにし、ffmpeg で AAC (m4a) へ。
3. faster-whisper (Issue #3) で行ごとの単語レベルタイムスタンプを取得し、
   トラック全体の秒にオフセット。チャンク (スラッシュ区切り) にも範囲を付与。
4. アプリが読む assets/lessons/<id>/lesson.json を出力する。

Usage (リポジトリ ルートで):
  uv run --python 3.12 --with faster-whisper --with numpy \
      python tools/content/build_lesson.py --lesson cafe-ordering
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import subprocess
import sys
import wave
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(HERE))

import cloud_tts  # noqa: E402
from generate_lesson import assets_dir, lines_dir, load_lesson  # noqa: E402


def read_wav_frames(path: Path) -> tuple[bytes, int]:
    with wave.open(str(path), "rb") as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2, f"unexpected wav: {path}"
        return w.readframes(w.getnframes()), w.getframerate()


def concat_lines(ldir: Path, master_path: Path, gap_sec: float) -> list[dict]:
    """行 WAV を固定ギャップで連結し、各行のトラック上の区間を返す。"""
    sr = None
    frames: list[bytes] = []
    spans: list[dict] = []
    pos = 0.0
    for wav_path in sorted(ldir.glob("*.wav")):
        data, rate = read_wav_frames(wav_path)
        if sr is None:
            sr = rate
        elif sr != rate:
            raise SystemExit(f"サンプルレートが混在しています: {wav_path} ({rate} != {sr})")
        dur = len(data) / (2 * sr)
        spans.append({"file": wav_path.name, "startSec": round(pos, 3),
                      "endSec": round(pos + dur, 3)})
        frames.append(data)
        gap = b"\x00\x00" * int(gap_sec * sr)
        frames.append(gap)
        pos += dur + gap_sec
    if sr is None:
        raise SystemExit("行 WAV がありません。先に generate_lesson.py を実行してください。")
    with wave.open(str(master_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        for chunk in frames:
            w.writeframes(chunk)
    return spans


def whisper_words(cfg: dict, wav_path: Path) -> list[dict]:
    """1 行 WAV を faster-whisper で転写し、単語タイムスタンプ (行内相対秒) を返す。"""
    from faster_whisper import WhisperModel  # uv 環境でのみ利用可能

    wcfg = cfg["whisper"]
    model = WhisperModel(wcfg["model"], device=wcfg["device"], compute_type=wcfg["computeType"])
    segments, _info = model.transcribe(str(wav_path), language=wcfg["language"],
                                       word_timestamps=True)
    words = []
    for seg in segments:
        for word in seg.words:
            text = word.word.strip()
            if text:
                words.append({"text": text, "startSec": round(word.start, 3),
                              "endSec": round(word.end, 3)})
    return words


_TOKEN_NORM_RE = re.compile(r"[^a-z0-9']+")


def norm(token: str) -> str:
    return _TOKEN_NORM_RE.sub("", token.lower())


def align_words(line_text: str, wwords: list[dict]) -> list[dict]:
    """台本の単語列を whisper の単語スパンに対応させる。

    whisper は表記ゆれ (nine fifty → "950.") や幻トークン ("//") を出すため、
    単語の「文字面」は台本を正とし、whisper はタイムスタンプのみ使う。
    正規化トークン列を difflib でアラインし、置換区間は文字数比例で分配、
    台本側にしか無い語は前後のタイミングで幅 0 に補間する。
    """
    script_tokens = line_text.split()
    matched = [w for w in wwords if norm(w["text"])]
    script_norm = [norm(t) for t in script_tokens]
    whisper_norm = [norm(w["text"]) for w in matched]
    sm = difflib.SequenceMatcher(a=script_norm, b=whisper_norm, autojunk=False)
    if sm.ratio() < 0.5:
        # アライン失敗: 全体を文字数比例で分配 (データは壊さない、ゲートではない)
        total = sum(max(len(t), 1) for t in script_tokens) or 1
        t0 = matched[0]["startSec"] if matched else 0.0
        t1 = matched[-1]["endSec"] if matched else t0
        pos, out = t0, []
        for tok in script_tokens:
            dur = (t1 - t0) * max(len(tok), 1) / total
            out.append({"text": tok, "startSec": round(pos, 3), "endSec": round(pos + dur, 3)})
            pos += dur
        return out

    out: list[dict | None] = [None] * len(script_tokens)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                out[i1 + k] = dict(script=script_tokens[i1 + k],
                                   startSec=matched[j1 + k]["startSec"],
                                   endSec=matched[j1 + k]["endSec"])
            continue
        script_slice = script_tokens[i1:i2]
        span = matched[j1:j2]
        if span:
            t0, t1 = span[0]["startSec"], span[-1]["endSec"]
        elif i1 > 0 and out[i1 - 1] is not None:
            t0 = t1 = out[i1 - 1]["endSec"]
        else:
            t0 = t1 = span[0]["startSec"] if span else 0.0
        weights = [max(len(t), 1) for t in script_slice]
        total = sum(weights) or 1
        pos = t0
        for k, tok in enumerate(script_slice):
            dur = (t1 - t0) * weights[k] / total
            out[i1 + k] = {"script": tok, "startSec": round(pos, 3), "endSec": round(pos + dur, 3)}
            pos += dur
    return [{"text": w["script"], "startSec": w["startSec"], "endSec": w["endSec"]}
            for w in out if w is not None]


def chunks_from_words(chunk_texts: list[str], words: list[dict]) -> list[dict]:
    """台本チャンクごとに整約済み単語を消費し、スラッシュ表示用の区間を作る。"""
    out: list[dict] = []
    ptr = 0
    for chunk_text in chunk_texts:
        n = len([t for t in chunk_text.split() if norm(t)])
        part = words[ptr:ptr + n]
        ptr += n
        if part:
            out.append({"text": chunk_text, "startSec": part[0]["startSec"],
                        "endSec": part[-1]["endSec"]})
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lesson", required=True)
    args = ap.parse_args()

    cfg = cloud_tts.load_config()
    chash = cloud_tts.config_hash(cfg)
    lesson = load_lesson(args.lesson)
    ldir = lines_dir(args.lesson)
    out_assets = assets_dir(args.lesson)
    out_assets.mkdir(parents=True, exist_ok=True)

    manifest_path = out_assets / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit("manifest.json がありません。先に generate_lesson.py を実行してください。")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("config_hash") != chash:
        raise SystemExit("manifest の設定ハッシュが現在の voice config と一致しません。混在防止のため中止します。")

    report_path = out_assets / "voice_consistency_report.json"
    if not report_path.exists():
        raise SystemExit("一貫性ゲートのレポートがありません。先に check_voice_consistency.py を実行してください。")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if report.get("config_hash") != chash:
        raise SystemExit("一貫性レポートの設定ハッシュが古いため中止します。ゲートを再実行してください。")
    if report.get("flagged"):
        raise SystemExit(
            f"一貫性ゲートが FAIL です ({len(report['flagged'])} 行)。"
            "該当行の WAV を削除して再生成してから再実行してください。"
        )

    gap = float(cfg.get("gapSecBetweenLines", 0.5))
    master_path = HERE / "build" / args.lesson / "master.wav"
    spans = concat_lines(ldir, master_path, gap)
    span_by_file = {s["file"]: s for s in spans}

    # --- ffmpeg: 24kHz WAV → AAC m4a (アプリ同梱用) ---
    m4a_path = out_assets / "audio.m4a"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(master_path),
         "-c:a", "aac", "-b:a", "64k", "-ar", "24000", "-ac", "1", str(m4a_path)],
        check=True,
    )

    # --- faster-whisper で単語タイムスタンプ (Issue #3) ---
    sentences: list[dict] = []
    for line in lesson["lines"]:
        name = f"L{int(line['index']):02d}_{line['speaker']}.wav"
        span = span_by_file[name]
        raw = whisper_words(cfg, ldir / name)
        for w in raw:
            # 行内相対秒 → トラック全体の絶対秒へオフセットし、行区間にクリップ
            w["startSec"] = round(span["startSec"] + w["startSec"], 3)
            w["endSec"] = round(min(span["startSec"] + w["endSec"], span["endSec"]), 3)
        words = align_words(line["text"], raw)
        sentences.append({
            "index": int(line["index"]) - 1,
            "speaker": line["speaker"],
            "startSec": span["startSec"],
            "endSec": round(span["endSec"], 3),
            "text": line["text"],
            "translationJa": line["translationJa"],
            "chunks": chunks_from_words(line["chunks"], words),
            "words": words,
            "linking": line.get("linking", []),
        })

    total_dur = spans[-1]["endSec"] if spans else 0.0
    out = {
        "id": lesson["id"],
        "title": lesson["title"],
        "titleJa": lesson["titleJa"],
        "type": lesson["type"],
        "level": lesson["level"],
        "category": lesson["category"],
        "audio": "audio.m4a",
        "durationSec": round(total_dur, 3),
        "speakerNames": lesson.get("speakerNames", {}),
        "configHash": chash,
        "engine": cfg["engine"],
        "voices": {k: v["voiceName"] for k, v in cfg["voices"].items()},
        "generatedAtUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sentences": sentences,
    }
    out_path = out_assets / "lesson.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"DONE lesson.json + audio.m4a lines={len(sentences)} duration={total_dur:.2f}s "
          f"config={chash}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
