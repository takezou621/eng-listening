#!/bin/zsh
# Watch アプリ同梱レッスンの同期。
# assets/lessons/<id>/{lesson.json,audio.m4a} を targets/watch/Lessons/<id>.{json,m4a} へコピーする。
# (Watch ターゲットはフォルダ同期でバンドルに取り込まれるが、ファイル名が全レッスン共通のため
#  レッスンIDを付けたフラットな名前に変換する。)
# コンテンツパイプラインでレッスンを再生成したら再実行し、結果をコミットすること。
set -e
cd "$(dirname "$0")/../.."
rm -rf targets/watch/Lessons
mkdir -p targets/watch/Lessons
for d in assets/lessons/*/; do
  id=$(basename "$d")
  cp "$d/lesson.json" "targets/watch/Lessons/$id.json"
  cp "$d/audio.m4a" "targets/watch/Lessons/$id.m4a"
done
echo "synced: $(ls targets/watch/Lessons | wc -l | tr -d ' ') files"
