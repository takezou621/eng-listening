"""一貫性ゲート (voice consistency gate)。

アニメ日本史ラボの check_voice_consistency.py を英語レッスン向けに移植。
行 WAV ごとに測定し、話者ごとの中央値から大きく外れた行を弾く:

- 基本周波数 (F0) 中央値 (自己相関法) からの偏差 > 15%
- 発話速度 (単語数 / 秒, words/sec) からの偏差 > 25%

検出された行は削除して generate_lesson.py で再生成する (ゲートは exit 1)。

Usage (リポジトリ ルートで):
  uv run --python 3.12 --with numpy python tools/content/check_voice_consistency.py \
      --lesson cafe-ordering
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(HERE))

import cloud_tts  # noqa: E402
from generate_lesson import assets_dir, lines_dir, load_lesson  # noqa: E402


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    import wave

    with wave.open(str(path), "rb") as w:
        sr = w.getframerate()
        raw = w.readframes(w.getnframes())
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    return x, sr


def median_f0(x: np.ndarray, sr: int) -> float:
    """自己相関による F0 中央値 (本家と同じ実装・英語帯域は同じ 60–400 Hz)。"""
    frame = int(sr * 0.04)
    hop = int(sr * 0.02)
    f0s: list[float] = []
    lo = int(sr / 400)
    hi = int(sr / 60)
    for start in range(0, max(1, len(x) - frame), hop):
        seg = x[start:start + frame]
        if len(seg) < frame or np.sqrt(np.mean(seg ** 2)) < 0.02:
            continue
        seg = seg - seg.mean()
        ac = np.correlate(seg, seg, mode="full")[len(seg) - 1:]
        if ac[0] <= 0:
            continue
        window = ac[lo:hi]
        if len(window) == 0:
            continue
        peak = int(np.argmax(window)) + lo
        if ac[peak] / ac[0] > 0.35:
            f0s.append(sr / peak)
    return float(np.median(f0s)) if f0s else 0.0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lesson", required=True)
    args = ap.parse_args()

    cfg = cloud_tts.load_config()
    gate = cfg["consistencyGate"]
    f0_max = float(gate["f0DeviationMax"])
    rate_max = float(gate["rateDeviationMax"])

    lesson = load_lesson(args.lesson)
    ldir = lines_dir(args.lesson)
    beats = {f"L{int(ln['index']):02d}_{ln['speaker']}.wav": ln for ln in lesson["lines"]}

    rows = []
    for wav_path in sorted(ldir.glob("*.wav")):
        line = beats.get(wav_path.name)
        if line is None:
            continue
        x, sr = read_wav(wav_path)
        dur = len(x) / sr
        f0 = median_f0(x, sr)
        # 英語なので発話速度は words/sec (本家は chars/sec)
        words = len(line["text"].split())
        rate = words / dur if dur > 0 else 0.0
        rows.append({
            "file": wav_path.name,
            "speaker": line["speaker"],
            "voice": cfg["voices"][line["speaker"]]["voiceName"],
            "f0Hz": round(f0, 1),
            "rateWps": round(rate, 2),
            "durationSec": round(dur, 2),
        })

    flagged = []
    for spk in sorted({r["speaker"] for r in rows}):
        sub = [r for r in rows if r["speaker"] == spk and r["f0Hz"] > 0]
        if not sub:
            continue
        med_f0 = float(np.median([r["f0Hz"] for r in sub]))
        med_rate = float(np.median([r["rateWps"] for r in sub]))
        for r in sub:
            reasons = []
            if abs(r["f0Hz"] - med_f0) / med_f0 > f0_max:
                reasons.append(f"F0 {r['f0Hz']}Hz vs median {med_f0:.1f}Hz")
            if med_rate > 0 and abs(r["rateWps"] - med_rate) / med_rate > rate_max:
                reasons.append(f"rate {r['rateWps']} wps vs median {med_rate:.2f} wps")
            r["flag"] = "; ".join(reasons)
            if reasons:
                flagged.append(r)
        print(f"{spk}: lines={len(sub)} median F0={med_f0:.1f} Hz median rate={med_rate:.2f} w/s",
              flush=True)

    report = {
        "lesson": args.lesson,
        "config_hash": cloud_tts.config_hash(cfg),
        "thresholds": {"f0DeviationMax": f0_max, "rateDeviationMax": rate_max,
                       "rateUnit": "words/sec"},
        "rows": rows,
        "flagged": flagged,
    }
    out = assets_dir(args.lesson) / "voice_consistency_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")

    if flagged:
        print(f"GATE FAIL: {len(flagged)} line(s) flagged:", flush=True)
        for r in flagged:
            print(f"  {r['file']} [{r['speaker']}] {r['flag']}")
        print("再生成: tools/content/build/<lesson>/lines/ の対象 WAV を削除して "
              "generate_lesson.py を再実行し、その後もう一度このゲートを実行してください。", flush=True)
        return 1
    print(f"GATE PASS: {len(rows)} lines consistent", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
