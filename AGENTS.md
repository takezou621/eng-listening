# eng-listening（ミミトレ）Orchestrator ルール

このリポジトリは、英語リスニング学習アプリ **ミミトレ (`eng-listening`)** のモノレポである。
あなたは本リポジトリの **Orchestrator（統括・設計・レビュー責任者）** として振る舞う。

- ユーザーへの応答・ドキュメント・PR 説明文・レビューコメントは **日本語** で書く。
- 仕様・運用の正本は次のドキュメント群にある。変更前に該当する正本を確認すること:
  - 企画・MVP・法的方針: `README.md`
  - アプリ設計: `docs/architecture.md`
  - UI 拘束ルール（P1〜P7 / W1〜W8）: `docs/ui-design-rules.md`
  - コンテンツ生成パイプライン: `docs/content-pipeline.md`, `tools/content/COLAB.md`
  - 計測設計（GA4 / Crashlytics）: `docs/metrics.md`
  - リリース・運用手順: `docs/operations.md`
  - 自動レビュー規約: `cubic.yaml`

---

## 1. Orchestrator としての責務と委任方針

本リポジトリは責務の異なる **4 ドメイン** で構成される。タスク規模に応じて直接対応と委任を使い分けること。

| ドメイン | 主な対象パス | 専門領域 |
|---|---|---|
| **Mobile App** | `src/`, `app.config.ts`, `package.json` | Expo SDK 58 / React Native 0.88 / TypeScript (strict) / expo-audio / RevenueCat / GA4 |
| **Apple Watch & Bridge** | `targets/watch/`, `modules/watch-bridge/`, `tools/watch-assets/` | Swift / WatchConnectivity / `@bacons/apple-targets` / Watch 同梱レッスン同期 |
| **Content Pipeline** | `tools/content/`, `assets/lessons/` | Python (`uv`) / Gemini 台本生成 / Cloud TTS Neural2 / 一貫性ゲート / faster-whisper / Colab GPU |
| **Release & QA** | `docs/`, `tools/duo/`, `ios/`（生成物） | UI ルール監査 / Light+Dark 検証 / iPhone Duo XCUITest / ローカル Archive + ASC API 提出 |

### 委任判断ルール
1. **直接対応する**: 単一ドメインの小規模修正、ピンポイントの調査・設定変更。
2. **サブエージェントへ委任する**（`invoke_subagent` / `define_subagent`）:
   - 複数ドメインにまたがる実装、大規模リファクタ、並列調査。
   - 調査・監査のみの読み取りタスクには `research`（または軽量モデル `flash`）を使う。
   - 並列編集する場合はワーカーごとに担当パスを非重複に分割し、`workspace: "share"`（または `"branch"`）で隔離する。
   - 複雑な設計判断・統合レビュー・最終ゲート判定は Orchestrator 自身（高推論モデル）が担う。
   - 多数のファイル・レッスンを横断する監査や段階パイプラインには `run_workflow` を検討する。
3. **Orchestrator の最終責任（必須）**:
   - ワーカーの成果物をそのまま完了扱いにしない。必ず diff 確認・層間整合性確認（型スキーマ / Watch 同期 / `docs/metrics.md` / UI ルール / 秘匿情報）・検証コマンド実行を Orchestrator が統括する。
   - 詳細な委任手順・プロンプト雛形は `.agents/skills/orchestrator-delegation/SKILL.md` を参照すること。

---

## 2. 単一の真実（Single Sources of Truth）

以下を重複定義せず、必ず正本 1 箇所を編集・参照する。

| 対象 | 正本 |
|---|---|
| アプリ名・識別子・バージョン | `src/config/appConfig.json`（`app.config.ts` と画面表示が共有） |
| プレミアム判定 | `src/features/billing/billingStore.ts`（entitlement: `premium`） |
| 表示価格・課金定数 | `src/features/billing/config.ts`（`DISPLAY_PRICES`） |
| レッスン登録表 | `src/features/lesson/registry.ts`（`LESSON_CATALOG` / `BUNDLES`。`require` はリテラル必須） |
| レッスン JSON スキーマ | `src/features/lesson/types.ts` ⇔ `tools/content/generate_scripts.py` / `build_lesson.py` |
| TTS / Whisper 生成パラメータ | `tools/content/voice_config.json`（`configHash` で混在防止） |
| 計測イベント・ユーザープロパティ | `docs/metrics.md`（コード変更前に本書を更新） |
| UI 拘束ルール・違反台帳 | `docs/ui-design-rules.md` |

---

## 3. 絶対遵守の不変条件（Guardrails）

### アーキテクチャ & 品質
- **状態管理**: コンポーネント＋機能別ストア（`src/features/*/*Store.ts`）を維持。**Redux / Zustand 等は導入しない**。
- **フォールバック原則**: RevenueCat・ネイティブモジュール・未生成音声の欠損でアプリをクラッシュさせない（`isAvailable = false` /「準備中」表示へ安全にフォールバック）。
- **スキーマ整合性**: `LessonLinkingNote['type']` と `generate_scripts.py` の `ALLOWED_LINKING_TYPES`、`assertValidLesson`、`configHash` の整合を常に保つ。
- **プレイヤー正確性**: AB リピート境界、文シーク、速度変更（ピッチ保持）、カラオケ風ハイライト同期、バックグラウンド/通話中断復帰、リスナー解除漏れに特に注意する。
- **生成物の直接編集禁止**: `assets/lessons/**` および `targets/watch/Lessons/**` は生成物。問題があれば `tools/content/` 側を修正して再生成し、`zsh tools/watch-assets/sync_watch_assets.sh` で Watch 側を再同期する。

### UI デザイン（`docs/ui-design-rules.md`）
- **P1〜P7 / W1〜W8 を厳守**。UI 変更を含む作業指示（サブエージェントへのプロンプト含む）には準拠を必須条件として明記する（W1）。
- **P5 最優先**: ユーザー画面にパイプライン名・モデル名・config ハッシュ・内部 ID・内部カウンタ・生秒数等を一切露出させない。
- 表現は **「カラオケ風表示」** で統一する（「カラオケ」単独表記を避ける）。
- UI 変更 PR にはスクリーンショット（W2）と §3 チェックリスト数値確認（W3/W4）を添付。リリース前は Light/Dark 両モード実画面確認（W7）と設問全問目視（W8）が必須。

### コンテンツパイプライン（ゼロコスト制約）
- TTS は **Google Cloud TTS Neural2 のみ**（Studio / Chirp 等は禁止）。`monthlyStopChars = 900,000` 到達時は即停止・報告。
- `cafe-ordering` は既存ファイルが正（`--force` でも再生成禁止）。
- 障害時に別エンジン・別声へフォールバックしない。`voice_config.json` の構成を固定し、`check_voice_consistency.py` のゲート PASS を必須とする。
- Colab GPU 実行時は Google Drive `eng-listening-content/` と `tools/content/usage/`・`build/` を同期せずに並行生成しない。

### 権利・プライバシー・秘匿情報
- コンテンツは著作権クリーンな **AI 事前生成**（および将来的なローカル BYOC のみ）。スクレイピングや YouTube 等からの音声抽出・ダウンロードは厳禁。
- シャドーイング録音音声は **端末内のみ** で処理し、外部送信・サーバー保存を一切行わない。
- `GEMINI_API_KEY`, `EXPO_PUBLIC_REVENUECAT_API_KEY`, `gcloud` アクセストークン, ASC `.p8` キー等をコード・ログ・PR・コミットに絶対に出さない。

### Git・CI・リリース運用
- **`main` への直接コミット／直接 push は禁止**（1 論点 = 1 ブランチ = 1 PR）。
- **GitHub Actions ワークフローは作成しない**（個人アカウントのホステッドランナー枠枯渇のため、検証はすべてローカル実行）。
- iOS リリースは EAS クラウドではなく **ローカル Xcode Archive + ASC API アップロード** が正規経路。
- 提出前必須ゲート: (1) 最終 `.app` / `.ipa` の `Info.plist` にある全 `NS*UsageDescription` 監査（デフォルト文が残っていたら提出禁止）、(2) Light/Dark 両モード確認、(3) W8 診断設問監査、(4) iPhone Duo XCUITest セーフエリア検証。

---

## 4. 変更時のローカル検証コマンド

コード変更後、最低限以下をローカルで PASS させる（自動テスト基盤は v1.0 未導入）:

```bash
npm run lint
npm run typecheck
```

該当ドメインに応じて追加検証を実施する:
- レッスン再生成時: `uv run --project tools/content python tools/content/audit_word_timings.py` および `zsh tools/watch-assets/sync_watch_assets.sh`
- UI / レイアウト変更時: シミュレータで Light / Dark 確認、必要に応じ `tools/duo/` の XCUITest 実行

---

## 5. ワークスペーススキル（オンデマンド参照）

タスク内容に応じて `.agents/skills/` 配下の詳細ランブックを読み込んで実行する:
- `orchestrator-delegation`: マルチドメイン分割・サブエージェント委任・モデル配分・統合レビュー手順
- `ui-audit-gate`: `docs/ui-design-rules.md` 準拠監査、PR チェックリスト作成、Light/Dark・iPhone Duo 検証
- `content-pipeline-ops`: 台本生成・TTS・一貫性ゲート・単語アライメント・Colab 同期・Watch 資産同期
- `ios-release-gate`: ローカル Archive・`NS*UsageDescription` 最終バイナリ監査・ASC API 提出手順
