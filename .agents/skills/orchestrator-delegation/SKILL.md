---
name: orchestrator-delegation
description: >-
  Use this skill when the Orchestrator needs to decompose a multi-domain or complex task
  in eng-listening (Mobile App / Apple Watch / Content Pipeline / Release QA), spawn or
  coordinate subagents or workflows, assign appropriate models and workspaces, and execute
  the final cross-layer integration and verification gate.
---

# Orchestrator 委任・統括プレイブック（eng-listening）

高推論モデル（Orchestrator）が判断・設計・最終監査に集中し、実装や調査を適切なサブエージェント／ワークフローへ安全に委任するための運用手順。

## 1. タスク分類と実行モード選定

| パターン | 推奨手段 | モデル配分 | Workspace |
|---|---|---|---|
| 単一ファイルの小修正・即答できる調査 | Orchestrator が直接実行 | 自身 | — |
| 広範囲のコード・ドキュメント調査、UI/スキーマ監査 | `invoke_subagent` (`TypeName: "research"`) | `flash` または `inherit` | `inherit` |
| 1〜数ドメインにまたがる並列実装（非重複ファイル） | `define_subagent` → `invoke_subagent` | 複雑ロジックは `inherit`、定型作業は `flash` | 編集ワーカーは `share`（または `branch`） |
| 全 12 レッスン横断検証・多観点レビュー・段階パイプライン | `run_workflow`（`run-workflow` スキル参照） | ステージに応じて使い分け | スクリプト制御 |

> [!IMPORTANT]
> 同じファイルを複数の編集ワーカーに同時編集させない。ファイル所有権（編集可能パス）を各ワーカーのブリーフに明記する。

## 2. ドメイン別ワーカー定義テンプレート

必要に応じて `define_subagent` で以下を定義して使い回す:

- **`app-engineer`** (`EnableWriteTools: true`)
  - 担当: `src/`, `app.config.ts`
  - 必須制約: Component+Store（Redux/Zustand 禁止）、`src/config/appConfig.json` 単一ソース、`billingStore` フォールバック維持、`docs/ui-design-rules.md` (P1〜P7, W1〜W8) 準拠、計測変更時は `docs/metrics.md` 整合、`npm run lint && npm run typecheck` 通過。
- **`watch-engineer`** (`EnableWriteTools: true`)
  - 担当: `targets/watch/`, `modules/watch-bridge/`, `src/features/watch/`
  - 必須制約: WatchConnectivity（`applicationContext` による状態・未適用セッション同期 + ID 重複排除 + 適用済み ack、`sendMessage` 補助）、`targets/watch/Lessons/` は直接編集せず `tools/watch-assets/sync_watch_assets.sh` 経由で同期。
- **`content-engineer`** (`EnableWriteTools: true`)
  - 担当: `tools/content/`
  - 必須制約: Neural2 のみ・月間 90 万文字ストップ・`cafe-ordering` 変更禁止・`voice_config.json` 単一構成・`check_voice_consistency.py` ゲート通過・`src/features/lesson/types.ts` とのスキーマ一致・シークレット非出力。
- **`qa-auditor`** (`EnableWriteTools: false`, または `research` を利用)
  - 担当: 読み取り専用の横断監査（UI ルール §3 数値チェック、スキーマ整合、P5 内部文字列検出、用途文字列チェック、`docs/metrics.md` 整合）。

## 3. ワーカーへの指示（ブリーフ）必須項目

W1（`docs/ui-design-rules.md`）およびプロジェクト規約に基づき、委任プロンプトには必ず次を含める:
1. **目的と完了条件（Definition of Done）**
2. **編集対象ファイル／禁止ファイル**（`assets/lessons/**` や `targets/watch/Lessons/**` の直接編集禁止など）
3. **該当する拘束ルール**（UI 変更なら `docs/ui-design-rules.md` P1〜P7・W1〜W8、計測変更なら `docs/metrics.md` 等）
4. **期待する検証と返却形式**（変更ファイル一覧、実行したコマンド結果、残課題・リスク）

## 4. Orchestrator 最終統合ゲート（完了前の必須確認）

ワーカーから結果を受け取ったら、Orchestrator 自身が以下を点検する:

1. **差分とスコープ確認**: 意図しないファイル（生成物・ロックファイル・`.env`・`ios/` 等）が混入していないか `git status` / `git diff` で確認。
2. **層間整合性チェック**:
   - `tools/content/` を変更した場合 → `src/features/lesson/types.ts` (`ALLOWED_LINKING_TYPES` 等) および `registry.ts` と一致しているか。
   - `assets/lessons/` が更新された場合 → `zsh tools/watch-assets/sync_watch_assets.sh` で `targets/watch/Lessons/` が再同期されているか。
   - 計測イベント・プロパティを変更した場合 → `docs/metrics.md` と `src/features/analytics/ga4.ts` が一致しているか。
   - 権限を追加した場合 → `app.config.ts` の `NS*UsageDescription` に具体的な日本語用途説明が入っているか。
   - UI を変更した場合 → P5 違反文字列が 0 か、§3 チェックリストを満たすか。
3. **ローカル検証実行**:
   - `npm run lint`
   - `npm run typecheck`
   - 対象に応じた追加検証（`audit_word_timings.py`, `tools/duo/` XCUITest 等）
4. **Git 運用確認**: `main` への直接コミット・push を行わず、1 論点 = 1 ブランチ = 1 PR で整理する。
