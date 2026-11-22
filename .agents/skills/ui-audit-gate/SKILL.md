---
name: ui-audit-gate
description: >-
  Use this skill whenever implementing, modifying, reviewing, or auditing UI screens and
  components in eng-listening. Enforces docs/ui-design-rules.md (P1-P7, W1-W8), Light/Dark
  screenshot verification, PR numeric checklist generation, and iPhone Duo safe-area XCUITest.
---

# UI 実装・監査ゲート（ミミトレ）

正本: `docs/ui-design-rules.md`（違反のある UI 変更はマージ禁止）。

## 1. 実装・レビュー時の数値基準（P1〜P7）

コードと実画面スクリーンショットの両方で以下を数えて検証する:

- **P1（1画面1タスク）**: プライマリボタン（青フィル）は 1 画面に **1 つだけ**。ファーストビュー操作要素は主要 1 + 補助 **最大 4**。
- **P2（段階開示）**: 初期表示の情報ブロックは **5 つ以下**。設定・速度・区間リピート・凡例・解説はボトムシート等の奥に置く。
- **P3（固定枠最小）**: 上部固定は「戻る + タイトル 1 行 + 進捗表示」まで、下部常時操作列は **1 段** まで。
- **P4（可視化 > 文章）**: 説明文は 1 ブロック **最大 2 行**。内部仕様の説明は学習画面に出さない。1 カード = 1 指標。
- **P5（内部情報ゼロ・最優先）**: パイプライン名・モデル名・config ハッシュ・内部 ID・内部カウンタ・生秒数（`[12.34s]` 等）・enum 生値（`beginner` 等）が **0 件** であること。
- **P6（モード排他）**: 聞く / 読む / 話す / スクリプトは排他切替で縦積みしない。セクション見出しは 1 画面に **2 つ以上並べない**。
- **P7（統一）**: ボタンは 3 種のみ（プライマリ / セカンダリ / テキスト）、文字階層は 3 段（見出し / 本文 / 補助）、8pt グリッド。
- **文言統一**: 「カラオケ風表示」を使用し、「カラオケ」単独表記を避ける。

## 2. 運用ルール（W1〜W8）チェック

- **W1**: UI 作業を委任する場合、プロンプトに `docs/ui-design-rules.md` 準拠を必須条件として明記したか。
- **W2 / W3 / W4**: PR 本文に「変更した全画面のスクリーンショット」と下記 §3 チェックリスト（実測数値付き）を含めたか。
- **W5 / W6**: 既存違反（`docs/ui-design-rules.md` §5）より悪化させていないか。新規例外はオーナー承認なしに認めない。
- **W7（リリース前必須）**: 変更画面（リリース時は全画面）を **Light / Dark 両モード** で実画面撮影し、文字コントラストと視認性を確認したか。証跡は `docs/ui/<feature>/` または `docs/evidence/` に保存する。
- **W8（設問変更・リリース前必須）**: 診断・クイズ設問の設問文に正解が含まれていないか、選択肢順がデータ順固定（先頭固定など）になっていないか全問目視確認したか。

## 3. PR 本文用チェックリスト雛形

```markdown
### UI デザインルール §3 点検結果
- [ ] P1: プライマリボタン = X 個（上限 1）、操作要素 = 主要 1 + 補助 Y 個（上限 4）
- [ ] P2: 初期表示情報ブロック = Z 個（上限 5）
- [ ] P3: 固定枠は上部（戻る+タイトル+進捗）・下部 1 段以内
- [ ] P4: 2 行超の説明文ブロック = 0 件
- [ ] P5: 内部文字列（パイプライン名 / モデル名 / ID / 内部カウンタ）= 0 件
- [ ] P6: セクション見出し = N 個（上限 1）
- [ ] P7: 新規カスタムボタン・ラベルの無断追加なし
- [ ] W7: Light / Dark 両モードで視認性確認済み
```

## 4. iPhone Duo セーフエリア検証（リリース前・レイアウト大変更時）

外側ディスプレイ右端のセンサーバー（右セーフエリア 84pt）でのレイアウト崩れを XCUITest で検証する（詳細は `docs/operations.md` §1.1）:

```bash
export GEM_PATH=/opt/homebrew/Cellar/cocoapods/1.17.0_1/libexec:/opt/homebrew/lib/ruby/gems/4.0.0:/opt/homebrew/Cellar/ruby/4.0.10/lib/ruby/gems/4.0.0:$HOME/.local/share/gem/ruby/4.0.0
ruby tools/duo/inject_uitest.rb
cp tools/duo/DuoSmokeTests.swift ios/appUITests/DuoSmokeTests.swift
xcodebuild test -workspace ios/app.xcworkspace -scheme duo-smoke -configuration Release \
  -destination "platform=iOS Simulator,id=355C05F4-08AE-45D9-9D72-FB45403D0F7C" \
  -derivedDataPath /tmp/el-fixdd
```

合格条件:
- 2 テスト PASS
- ログの `DUO-EVIDENCE` でカードおよび再生バー右端が **366pt**（466 − 84 − 16）以内。
