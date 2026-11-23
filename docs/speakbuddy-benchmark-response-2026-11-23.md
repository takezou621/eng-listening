# スピークバディベンチマーク対応・Phase 1/2 統合総括レポート（2026-11-23）

- **作成日**: 2026-11-23
- **起点ベースライン**: `origin/main` (`c3f8c39`)
- **関連監査レポート**: [`docs/learning-mechanism-audit-2026-11-23.md`](learning-mechanism-audit-2026-11-23.md)（PR #98）
- **記述ルール**: コード・実機確認・公開資料で確認済みの事項は **`[事実]`**、設計判断・期待効果の見込みは **`[推測]`**、外部アプリ内部実装や未実測指標は **`[未確認]`** として区別する。

---

## 0. エグゼクティブサマリ

`[事実]` `.agy-learn/brief-priority.md`・`brief.md`（Phase 1: 弱点把握・段階的克服）および `brief-phase2-speakbuddy.md`（Phase 2: スピークバディ基本路線 6 項目への整合・弱み W1〜W7 対策）に基づき、**単一データモデル（二重実装なし）・独立レビュー可能な 6 本の未マージ PR（#98〜#102 + 本 PR）・将来対応 Issue 4 件（#103〜#106）** として全体対応を完了した。

`[事実]` 全実装 PR において、月額/年額価格、無料／プレミアムの課金境界（`src/features/billing/`）、OS 権限文言、既存レッスン音声アセット（`assets/lessons/`・`targets/watch/Lessons/`）、法務情報、`release/1.0.1` ブランチは一切変更せず、`npm run typecheck`・`npm run lint`（エラー 0 / 警告 0）・Xcode Release ビルド・実機シミュレータ（`Mimitore-67`）Light/Dark スクリーンショット確認を通過している。

---

## 1. スピークバディ基本路線 6 項目へのミミトレ対応表

| # | スピークバディ基本路線 | ミミトレ対応状況 (`[事実]`) | 該当 PR / 主なファイル |
|---|---|---|---|
| 1 | **入口のレベルチェック → 個別カリキュラム提案** | 初回/再診断を全 8 音変化タイプ 100% カバー（標準 8 問 / くわしく 16 問・`diagnostic.ts`）へ拡充し、診断結果から 3 ステップの「あなた向けカリキュラム」（`curriculum.ts`, `CurriculumSheet.tsx`, `onboarding.tsx`）とホーム「今日の1本」（`index.tsx`, `registry.ts`）を接続した（関連: #93）。 | PR [#100](https://github.com/takezou621/eng-listening/pull/100) / PR [#101](https://github.com/takezou621/eng-listening/pull/101) |
| 2 | **レッスン多ステップ構成＋毎回「キーフレーズ」設定** | 全 12 レッスンから注目音変化を含む「今日のキーフレーズ」（`getLessonKeyPhrase`）を自動抽出し、`lesson.tsx` 冒頭に統一表示。さらに `?focus=<type>` 指定時は「① 聞き分け → ② 文で確認 → ③ 話す」3 ステップ克服バー（`OvercomingGuideBar.tsx`）を提示し、カラオケ風表示やシャドーイングと連動させた。 | PR [#100](https://github.com/takezou621/eng-listening/pull/100) / PR [#102](https://github.com/takezou621/eng-listening/pull/102) |
| 3 | **弱点分析に基づく復習提案** | 診断の誤答自動登録（`weakSentences`）と 8 タイプ習熟度算出（`masteryStore.ts`）を連携させ、ホームの 1 タップ「今日の復習」カードおよび進捗タブの最弱タイプ 3 ステップ克服リンク・再診断リンク（`progress.tsx`）から直行できるようにした（関連: #93, #95）。 | PR [#100](https://github.com/takezou621/eng-listening/pull/100) / PR [#102](https://github.com/takezou621/eng-listening/pull/102) |
| 4 | **忘却曲線に沿った復習と習熟度管理** | Phase 2 と Phase 1-D のデータモデルを `spacedRepetition.ts`（1 日 → 3 日 → 7 日 → 卒業=3 回連続成功、再挑戦でリセット・`userStore.ts` 後方互換拡張）と `masteryStore.ts`（8 種 0〜100 スコア / `未測定`・`要強化`・`練習中`・`定着`）に一本化し、二重実装を排除した。 | PR [#100](https://github.com/takezou621/eng-listening/pull/100) / PR [#102](https://github.com/takezou621/eng-listening/pull/102) |
| 5 | **改善点の可視化** | 診断結果に全 8 タイプ別正答率バーと前回比差分（例: `前回比 +13pt ↑`、`diagnosticHistoryStore.ts`）を追加し、ホーム・苦手フレーズタブに卒業数・復習ステージ表示を、進捗タブのプレミアム詳細分析に 8 タイプ習熟度・練習回数を実装した。 | PR [#100](https://github.com/takezou621/eng-listening/pull/100) / PR [#101](https://github.com/takezou621/eng-listening/pull/101) / PR [#102](https://github.com/takezou621/eng-listening/pull/102) |
| 6 | **短時間・低ハードル・励ましによる継続設計** | 1 レッスン約 30〜55 秒・週 1 自動フリーズ付きストリーク・日次目標の既存基盤を維持し、`ReviewQueueSheet` での 1 タップ連続復習や卒業完了バッジ、3 ステップ完了ガイドで挫折要因を低減した。 | PR [#100](https://github.com/takezou621/eng-listening/pull/100) / PR [#102](https://github.com/takezou621/eng-listening/pull/102) |

`[推測]` 上記 6 軸の一貫接続（診断 → カリキュラム → 3 ステップ克服 → 間隔反復復習 → 再診断比較）により、単発再生中心だった学習体験が「弱点の自覚と上達実感のループ」へ移行することが期待される。

`[未確認]` 実運用下での D7 継続率・再診断実施率・`overcoming_step_completed` 完了率の定量改善幅は、リリース後の GA4 計測蓄積前は未確認。

---

## 2. スピークバディの弱み W1〜W7 に対するミミトレの対策状況

| ID | スピークバディの弱み (`[事実]`) | ミミトレでの対策・差別化状況 (`[事実]`) | 該当 PR / ドキュメント |
|---|---|---|---|
| **W1** | 課金の不透明さ（解約導線・自動更新・条件の見落としリスク） | 既存価格・無料体験・課金境界を一切変更せず、`paywall.tsx` で `<Screen hasHeader>` による二重余白を解消し、年額カードおよび購入 CTA 直下に初回無料トライアル適用条件・自動更新（年額 ¥4,800）・Apple ID 設定での解約手順を明瞭に表示した。`listing-ja-final.md` も同様に明確化（1,092 文字 / 2,845 バイト）（関連: #94）。 | PR [#99](https://github.com/takezou621/eng-listening/pull/99) |
| **W2** | 音声認識が発音を拾わず進行が止まる | ミミトレは音声認識 SDK による判定ゲートを使わず、端末内録音＋お手本/自分の声の自己聞き比べで常に非ブロッキング進行する設計である点を `docs/architecture.md` §2.6 と `docs/store/listing-ja-final.md` に公式仕様・差別化として明記した。 | PR [#99](https://github.com/takezou621/eng-listening/pull/99) |
| **W3** | 1 日 1 レッスン上限が進行の枷になる | 全 12 本を解放・1 日のレッスン受講上限を設けない仕様である点を `docs/architecture.md` §2.6 と `docs/store/listing-ja-final.md` に明記し、自由反復できる強みとして整理した。 | PR [#99](https://github.com/takezou621/eng-listening/pull/99) |
| **W4** | 忘却曲線を掲げる一方で復習しづらい | ホーム画面の「今日の復習（期限到達件数・卒業件数表示）」から `ReviewQueueSheet` を 1 タップで起動し、連続で聞き直し→「できた／もう一度」判定できる専用復習導線を実装した。苦手フレーズ画面でもフィルタと `?review=1` 自動オープンに対応（関連: #95）。 | PR [#100](https://github.com/takezou621/eng-listening/pull/100) |
| **W5** | 高価格帯に対する負担感 | 月額 ¥680 / 年額 ¥4,800 の既存適正価格を維持し、値上げ・課金仕様変更なし（価格変更禁止ルール遵守）。 | 既存維持（変更なし） |
| **W6** | リスニング特化診断・音変化別克服訓練の不足 | 既存の 3/8 種（37.5%）診断を全 8/8 種（100%・8 問標準 / 16 問くわしく）へ拡充し、全 16 問の W8 機械監査をパス。さらに同タイプ別の基礎→応用レッスン転移（`pickNextOvercomingLesson`）と再診断比較（前回スコア比較）を実装した。 | PR [#101](https://github.com/takezou621/eng-listening/pull/101) / PR [#102](https://github.com/takezou621/eng-listening/pull/102) |
| **W7** | UI・ゲーム的演出の煩雑さ | `docs/ui-design-rules.md`（P1〜P7 / W1〜W8）に基づき、過剰なキャラクター・報酬アニメ・1 画面複数プライマリ CTA を排した静穏 UI を全追加画面（ペイウォール、カリキュラム、復習キュー、診断比較、克服ガイドバー、進捗）で厳守。 | PR [#99](https://github.com/takezou621/eng-listening/pull/99) 〜 [#102](https://github.com/takezou621/eng-listening/pull/102) |

---

## 3. 未実装・将来対応項目の GitHub Issue 整理

`[事実]` 既存の UI/UX 改善 Issue（`#92`〜`#97`）との重複を避けた上で、本フェーズの制約（アセット不変・TTS 再生成禁止・課金境界不変・P1/P6 維持）により実装を見送った 4 項目を正式に Issue 登録した。

| 種別 | Issue | 概要・見送り理由・次のアクション |
|---|---|---|
| 新規 (本対応) | [#103](https://github.com/takezou621/eng-listening/issues/103) | **`[Learning]` レッスン内ミニ聞き分けクイズ（検索練習）の導入検討** — P1/P6 のシンプル操作との両立設計および `#93`/`#95` 合流後の UI 検証を分離するため見送り。受け入れ条件に W8 準拠と `masteryStore`/`spacedRepetition` 連動を明記。 |
| 新規 (本対応) | [#104](https://github.com/takezou621/eng-listening/issues/104) | **`[Content]` 希少音変化タイプ（同化・侵入・弱形）のレッスン拡充計画（v1.2 以降）** — 同梱アセットで `assimilation`(2件)/`intrusion`(2件)/`weak-form`(3件) の母数が少ないが、現行資産不変・TTS 枠温存方針のため見送り。 |
| 新規 (本対応) | [#105](https://github.com/takezou621/eng-listening/issues/105) | **`[Monetization]` 習熟度モデル・再診断の無料／プレミアム線引き見直し検討（GA4 実測後）** — 現行審査・課金境界厳守のため実装は据え置き。リリース後 GA4 実測（`rediagnosis_completed`, `paywall_viewed`, `purchase_completed`）後に検証・判断する。 |
| 新規 (本対応) | [#106](https://github.com/takezou621/eng-listening/issues/106) | **`[Learning]` あなた向けカリキュラムの手動カスタマイズ（重点タイプ・難易度調整）** — 初期オンボーディング離脱防止と認知負荷抑制のため自動提案（PR #100）を優先し、手動編集 UI を将来拡張へ分離。 |
| 既存連携 | `#92`〜`#97` | `#93`（診断推薦→ホーム接続）は PR #100 で主要部分を実装済み、`#94`（ペイウォール）は PR #99 で課金明示・二重余白解消を実施済み、`#95`（復習キュー＆タイプ別フィルタ）は PR #100 で実装済み。`#92`（リマインダー）・`#96`（違反台帳棚卸し）・`#97`（ハンズフリー連続再生）は継続バックログとして管理。 |

---

## 4. 全 6 PR 一覧・推奨マージ順序・統合ガイド

`[事実]` 6 本の PR はすべて独立してレビューできるよう `origin/main`（`c3f8c39`）を起点に作成し、未マージの状態で提出している。

| 順序 | PR | ブランチ | 主な対象範囲 |
|---|---|---|---|
| 1 | PR [#98](https://github.com/takezou621/eng-listening/pull/98) | `docs/learning-mechanism-audit-2026-11-23` | `docs/learning-mechanism-audit-2026-11-23.md`（監査・理論根拠・線引き案） |
| 2 | PR [#99](https://github.com/takezou621/eng-listening/pull/99) | `feat/phase2-paywall-and-policy-docs` | `paywall.tsx`, `listing-ja-final.md`, `architecture.md`（W1/W2/W3） |
| 3 | PR [#100](https://github.com/takezou621/eng-listening/pull/100) | `feat/phase2-curriculum-keyphrase-review` | `spacedRepetition.ts`, `curriculum.ts`, `userStore.ts`, `CurriculumSheet`, `ReviewQueueSheet`, `index.tsx`, `phrases.tsx`, `onboarding.tsx`, `lesson.tsx`, `metrics.md` |
| 4 | PR [#101](https://github.com/takezou621/eng-listening/pull/101) | `feat/phase1-diagnostic-expansion-rediagnosis` | `diagnostic.ts`（8/16 問）, `diagnosticHistoryStore.ts`, `onboarding.tsx`, `settings.tsx`, `metrics.md` |
| 5 | PR [#102](https://github.com/takezou621/eng-listening/pull/102) | `feat/phase1-mastery-and-overcoming-path` | `masteryStore.ts`, `overcomingPath.ts`, `OvercomingGuideBar.tsx`, `lesson.tsx`, `LessonSheets.tsx`, `progress.tsx`, `metrics.md` |
| 6 | 本 PR (#6) | `docs/speakbuddy-benchmark-response-2026-11-23` | `docs/speakbuddy-benchmark-response-2026-11-23.md` |

### マージ時の共有ファイル統合ポイント

1. **`docs/metrics.md` および `src/features/analytics/analyticsStore.ts`**（PR #100 / #101 / #102 が追記）:
   - 各 PR は既存の末尾にイベント行および `AnalyticsEventName` union を追加しているため、マージ時は全追加イベント（PR #100 のカリキュラム・復習系 4 イベント + PR #101 の `rediagnosis_completed` + PR #102 の `overcoming_step_completed`）をそのまま和集合で結合する。
2. **`src/app/onboarding.tsx`**（PR #100 と #101 が拡張）:
   - PR #101 の `OnboardingRoute` キー分割・8/16 問出題・8 タイプ正答率＋前回比較・`recordDiagnosticAttempt` を土台とし、`ResultScreen` 内へ PR #100 の `CurriculumSheet`／「あなた向け 3 ステップ・カリキュラム」提示および `SavedDiagnosticProfile` 保存を合流させる。さらに PR #102 をマージする際、`onFinish` 内で `recordMasteryDiagnostic(results)` を呼び出すと、初回／再診断の結果が即座に 8 タイプ習熟度へ反映される。
3. **`src/app/lesson.tsx`**（PR #100 と #102 が拡張）:
   - レッスン冒頭の「今日のキーフレーズ」バナー（PR #100）と `?focus=<type>` 時の `OvercomingGuideBar`（PR #102）は異なる UI ブロックとして同居可能（同時表示時の縦占有を抑える場合は `focusType` 優先または 2 ブロックを簡潔に並置）。`nextLesson` 選定は `focusType` ありで PR #102 の `pickNextOvercomingLesson`、なしで PR #100 / 通常順を採用する。
4. **`src/features/learning/masteryStore.ts`**（PR #102）と **`userStore.ts`**（PR #100）:
   - `masteryStore.ts` の `computeTypeMasteryList` は `WeakSentenceLike`（`graduatedAtMs?: number | null`, `reviewCount?: number`）で設計済みのため、PR #100 のマージ後は型変換なしで間隔反復の卒業状態が習熟度スコアに自動反映される。

---

## 5. 参照ドキュメント・証跡一覧

- 監査レポート: [`docs/learning-mechanism-audit-2026-11-23.md`](learning-mechanism-audit-2026-11-23.md)（PR #98）
- アプリ設計・UI ルール・計測・ストア文面:
  - [`docs/architecture.md`](architecture.md)
  - [`docs/ui-design-rules.md`](ui-design-rules.md)
  - [`docs/metrics.md`](metrics.md)
  - [`docs/store/listing-ja-final.md`](store/listing-ja-final.md)
- 実画面スクリーンショット証跡（Light / Dark）:
  - Phase 2 ペイウォール: `docs/ui/phase2-paywall/`（PR #99）
  - Phase 2 カリキュラム＆復習: `docs/ui/phase2-curriculum-review/`（PR #100）
  - Phase 1 全 8 種診断＆再診断比較: `docs/ui/phase1-diagnostic/`（PR #101）
  - Phase 1 習熟度＆3 ステップ克服: `docs/ui/phase1-mastery/`（PR #102）
