"""レッスン台本 JSON → 行ごと Cloud TTS 生成 (文字数カウンタ・manifest 付き)。

アニメ日本史ラボの gen_narration_unified.py と同じ仕組み:

- 全行で voice_config.json の単一構成のみを使う (別声・別エンジンへ切り替えない)。
- 出力先 manifest に設定ハッシュを記録し、異なるハッシュの既存音声がある場合は
  生成を中止する (混在防止)。最初の TTS 呼び出しの前に設定を
  build/<id>/generation.json へ永続化するため、manifest 書き込み前に中断した
  場合も既存 WAV の設定を確認できる (確認できない場合は停止)。
- 既存の行 WAV は「同一設定・同一テキスト」のときだけスキップし、それ以外は
  再生成する (削除 → 再実行、または --line N で再生成)。

Usage (リポジトリ ルートで):
  uv run --project tools/content python tools/content/generate_lesson.py \
      --lesson cafe-ordering
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import time
import wave
from datetime import datetime, timezone
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


def line_wav_name(line: dict) -> str:
    return f"L{int(line['index']):02d}_{line['speaker']}.wav"


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


def check_generation_sidecar(chash: str, lesson_id: str, ldir: Path) -> None:
    """行 WAV の生成時設定を build/<id>/generation.json で検証する (混在防止)。

    manifest は全行生成後の末尾で書くため、途中停止すると「WAV だけがあり
    manifest がない」状態になり得る。そのため最初の TTS 呼び出しの前に設定を
    sidecar に永続化し、既存 WAV の設定を確認できない場合は停止する
    (同一設定での途中再開は許可する)。
    """
    sidecar = HERE / "build" / lesson_id / "generation.json"
    if sidecar.exists():
        gen_info = json.loads(sidecar.read_text(encoding="utf-8"))
        if gen_info.get("configHash") != chash:
            raise SystemExit(
                f"ABORT: {sidecar} の記録 (ハッシュ {gen_info.get('configHash')}) と現在の "
                f"voice config (ハッシュ {chash}) が一致しません。既存の行 WAV と設定が混在するため中止します。"
                "作り直す場合は tools/content/build/<id>/ と assets/lessons/<id>/ を消してから再実行してください。"
            )
        return
    if any(ldir.glob("*.wav")):
        raise SystemExit(
            f"ABORT: {ldir} に生成時設定を確認できない WAV があります (manifest/sidecar なし)。"
            "混在を防ぐため中止します。作り直す場合は tools/content/build/<id>/ を消してから再実行してください。"
        )
    sidecar.parent.mkdir(parents=True, exist_ok=True)
    sidecar.write_text(
        json.dumps({
            "configHash": chash,
            "lessonId": lesson_id,
            "startedAtUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )


def wav_write(path: Path, audio: bytes, sample_rate: int) -> float:
    """Cloud TTS の LINEAR16 応答 (WAV ヘッダー付き) を検証して PCM だけ保存する。

    応答をフレームとして直接書くと元の WAV ヘッダーが音声サンプルに混入するため、
    ヘッダーを読み捨て、形式 (mono / 16bit / sample_rate) を検証してから書き込む。
    """
    with wave.open(io.BytesIO(audio), "rb") as r:
        if r.getnchannels() != 1 or r.getsampwidth() != 2:
            raise SystemExit(f"unexpected TTS wav (mono/16bit 以外): {path}")
        if r.getframerate() != sample_rate:
            raise SystemExit(
                f"unexpected TTS wav sample rate: {r.getframerate()} != {sample_rate} ({path})"
            )
        frames = r.readframes(r.getnframes())
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(frames)
    return wav_duration(path)


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()


def needs_regeneration(wav_path: Path, idx: int, force_lines: set[int],
                       text: str, old_manifest: dict) -> bool:
    """この行を再生成するかどうか。予算見積りと生成ループで共有する判定。

    - --line で指定された行は常に再生成
    - WAV がない / 壊れている (1,000 バイト以下) ときは再生成
    - manifest の生成時テキストが現在の台本と不一致なら再生成
      (音声と表示テキストの不一致を未然に防ぐ。初回実行など照合できない場合も再生成)
    """
    if idx in force_lines:
        return True
    if not (wav_path.exists() and wav_path.stat().st_size > 1000):
        return True
    old_line = old_manifest.get("lines", {}).get(wav_path.name)
    return old_line is None or old_line.get("text") != text


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
    check_generation_sidecar(chash, args.lesson, ldir)

    old_manifest: dict = {}
    old_manifest_path = out_assets / "manifest.json"
    if old_manifest_path.exists():
        old_manifest = json.loads(old_manifest_path.read_text(encoding="utf-8"))

    force_lines = set(args.line or [])

    # --- 事前見積り: この実行で実際に合成する行だけを見積もる (生成ループと同じ判定) ---
    total_chars = sum(
        len(ln["text"].strip()) for ln in lesson["lines"]
        if needs_regeneration(ldir / line_wav_name(ln), int(ln["index"]),
                              force_lines, ln["text"].strip(), old_manifest)
    )
    cloud_tts.check_monthly_budget(cfg, total_chars)

    manifest: dict = {
        "configHash": chash,
        "engine": cfg["engine"],
        "voices": {k: v["voiceName"] for k, v in speakers.items()},
        "lessonId": args.lesson,
        "lines": {},
    }
    if old_manifest_path.exists():
        manifest = json.loads(old_manifest_path.read_text(encoding="utf-8"))
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
        name = line_wav_name(line)
        wav_path = ldir / name
        if not needs_regeneration(wav_path, idx, force_lines, text, old_manifest):
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
        f"chars_this_run={lesson_chars} month={usage['chars']}+{usage.get('pendingChars', 0)}pending"
        f"/{cfg['limits']['monthlyStopChars']} config={chash}",
        flush=True,
    )
    print("next: uv run --project tools/content python tools/content/"
          "check_voice_consistency.py --lesson " + args.lesson, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
