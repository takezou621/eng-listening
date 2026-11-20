"""レッスン台本 JSON → 行ごと Cloud TTS 生成 (文字数カウンタ・manifest 付き)。

アニメ日本史ラボの gen_narration_unified.py と同じ仕組み:

- 全行で voice_config.json の単一構成のみを使う (別声・別エンジンへ切り替えない)。
- 出力先 manifest に設定ハッシュを記録し、異なるハッシュの既存音声がある場合は
  生成を中止する (混在防止)。
- 既存の行 WAV はスキップし、欠けている行だけ再生成する (削除 → 再実行で再生成)。

Usage (リポジトリ ルートで):
  uv run --project tools/content python tools/content/generate_lesson.py \
      --lesson cafe-ordering
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(HERE))

import cloud_tts  # noqa: E402


def lesson_path(lesson_id: str) -> Path:
    return HERE / "lessons" / f"{lesson_id}.json"


def load_lesson(lesson_id: str) -> dict:
    path = lesson_path(lesson_id)
    if not path.exists():
        raise SystemExit(f"レッスン台本がありません: {path}")
    lesson = json.loads(path.read_text(encoding="utf-8"))
    if lesson.get("id") != lesson_id:
        raise SystemExit(f"台本の id ({lesson.get('id')}) が --lesson ({lesson_id}) と一致しません")
    return lesson


def lines_dir(lesson_id: str) -> Path:
    return HERE / "build" / lesson_id / "lines"


def assets_dir(lesson_id: str) -> Path:
    return REPO / "assets" / "lessons" / lesson_id


def check_no_config_mixing(chash: str, out_assets: Path) -> None:
    """異なる設定ハッシュの既存音声が同じ出力先にある場合は生成を中止する。"""
    manifest_path = out_assets / "manifest.json"
    if not manifest_path.exists():
        return
    old = json.loads(manifest_path.read_text(encoding="utf-8"))
    old_hash = old.get("configHash") or old.get("config_hash")
    has_audio = old.get("lines") or any(out_assets.glob("audio.*"))
    if old_hash != chash and has_audio:
        raise SystemExit(
            "ABORT: 出力先には異なる voice config (ハッシュ "
            f"{old_hash}) で生成された音声があります。混在を防ぐため中止します。"
            "作り直す場合は assets/lessons/<id>/ と tools/content/build/<id>/ を消してから再実行してください。"
        )


def wav_write(path: Path, audio: bytes, sample_rate: int) -> float:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(audio)
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lesson", required=True, help="レッスン id (lessons/<id>.json)")
    ap.add_argument("--line", type=int, action="append",
                    help="指定した行番号だけ再生成 (既存 WAV があっても無視)")
    args = ap.parse_args()

    cfg = cloud_tts.load_config()
    chash = cloud_tts.config_hash(cfg)
    lesson = load_lesson(args.lesson)
    speakers = cfg["voices"]
    ldir = lines_dir(args.lesson)
    out_assets = assets_dir(args.lesson)
    ldir.mkdir(parents=True, exist_ok=True)
    out_assets.mkdir(parents=True, exist_ok=True)

    check_no_config_mixing(chash, out_assets)

    force_lines = set(args.line or [])

    # --- 事前見積り: この実行で実際に合成する行だけを見積もる。
    # スキップする行は既に月次カウンタへ計上済みなので数え直すと二重計上になる ---
    total_chars = sum(
        len(ln["text"].strip()) for ln in lesson["lines"]
        if not (ldir / f"L{int(ln['index']):02d}_{ln['speaker']}.wav").exists()
        or int(ln["index"]) in force_lines
    )
    cloud_tts.check_monthly_budget(cfg, total_chars)

    manifest: dict = {
        "configHash": chash,
        "engine": cfg["engine"],
        "voices": {k: v["voiceName"] for k, v in speakers.items()},
        "lessonId": args.lesson,
        "lines": {},
    }
    old_manifest = out_assets / "manifest.json"
    if old_manifest.exists():
        manifest = json.loads(old_manifest.read_text(encoding="utf-8"))
        manifest["configHash"] = chash

    sample_rate = int(cfg["audio"]["sampleRateHertz"])
    generated = skipped = 0
    lesson_chars = 0
    for line in lesson["lines"]:
        idx = int(line["index"])
        spk = line["speaker"]
        if spk not in speakers:
            raise SystemExit(
                f"行 {idx}: speaker '{spk}' が voice_config.json の voices にありません "
                f"(定義済み: {', '.join(sorted(speakers))})"
            )
        text = line["text"].strip()
        name = f"L{idx:02d}_{spk}.wav"
        wav_path = ldir / name
        if wav_path.exists() and wav_path.stat().st_size > 1000 and idx not in force_lines:
            dur = wav_duration(wav_path)
            print(f"skip {name} {dur:.2f}s [{spk}] {text[:40]}", flush=True)
            skipped += 1
        else:
            audio = cloud_tts.synthesize(
                cfg, text, speakers[spk]["voiceName"],
                lesson_id=args.lesson, label=name,
            )
            dur = wav_write(wav_path, audio, sample_rate)
            print(f"gen  {name} {dur:.2f}s [{spk}] {text[:40]}", flush=True)
            generated += 1
            lesson_chars += len(text)
            time.sleep(float(cfg.get("requestDelaySec", 1.0)))
        manifest["lines"][name] = {
            "index": idx,
            "speaker": spk,
            "voice": speakers[spk]["voiceName"],
            "text": text,
            "chars": len(text),
            "durationSec": round(dur, 3),
            "configHash": chash,
        }

    usage = cloud_tts.read_usage()
    manifest["totals"] = {
        "lessonChars": lesson_chars,
        "lessonRequests": generated,
        "monthChars": usage["chars"],
        "monthRequests": usage["requests"],
        "monthlyStopChars": cfg["limits"]["monthlyStopChars"],
    }
    (out_assets / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    print(
        f"DONE lines={len(lesson['lines'])} generated={generated} skipped={skipped} "
        f"chars_this_run={lesson_chars} month={usage['chars']}/{cfg['limits']['monthlyStopChars']} "
        f"config={chash}",
        flush=True,
    )
    print("next: uv run --project tools/content python tools/content/"
          "check_voice_consistency.py --lesson " + args.lesson, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
