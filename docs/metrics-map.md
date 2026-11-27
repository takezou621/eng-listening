# 計測マップ: イベント ↔ 発火箇所 ↔ KPI 対応表

最終更新: 2026-11-28（v1.8: v1.1〜v1.7 の学習ループ計測の棚卸し・突合。アプリの挙動・イベントの追加・削除・改名はしていない）

`docs/metrics.md` がイベント定義の正であり、本書はその **実コードとの突合結果** と **KPI の集計定義** をまとめた参照表です。イベントの定義を変えるときは `docs/metrics.md` を先に更新し、本書の対応表も同じ PR で更新します。

- 突合対象のコード: `main` の `596bce1`（v1.7 = build 14 と同じアプリコード。v1.8 はドキュメントのみの変更）
- 突合方法: `docs/metrics.md` §2・§3 の表と、`src/` 内の全 `logEvent(` 呼び出し (51 箇所)・`logScreenView` (1 箇所)・`setGa4UserProperties` (4 箇所) を突き合わせ、パラメータ名 (GA4 送信時の snake_case) と発火条件を確認した
- 行番号は上記コミット時点のもの。コードが変わったら見直すこと

## 1. 結論サマリ

| 観点 | 結果 |
|---|---|
| 定義のみで未実装のイベント | **0 件**（§2 の全 37 行に発火箇所がある） |
| 実装のみで未定義のイベント | **0 件**（`logEvent` に渡す全イベント名が `AnalyticsEventType` 型と §2 にある） |
| `AnalyticsEventType` 型 (37 種) と §2 の整合 | 一致。`screen_view` は型に含まれない（§5 の D-1） |
| パラメータの過不足 | 定義に無い値が送られているもの 2 件（D-3・D-4）、定義どおりだが集計時に注意が要るもの 3 件（D-5〜D-7） |
| KPI を識別できない点 | 4 件（D-8〜D-10・D-12）。今版ではコードを変えず、次版候補として記録 |

## 2. イベント ↔ 発火箇所 ↔ KPI 対応表

パラメータは GA4 送信時の名前 (snake_case)。コードでは camelCase で書かれたキーも `ga4.ts` の `toSnakeCase` で送信前に変換されるため、GA4 上では同じ名前で揃う。KPI 番号は §4 の集計定義を指す。

### 2.1 起点・診断

| イベント | 発火箇所 | 発火タイミング | パラメータ | KPI |
|---|---|---|---|---|
| `app_first_open` | `src/app/(tabs)/index.tsx:169` | ユーザーデータ読み込み後、端末内ログに同イベントが無いとき (インストールごとに 1 回) | — | K6 コホート起点、K7 Aha 到達率の分母 |
| `onboarding_started` | `src/app/onboarding.tsx:238` | 「診断をはじめる」を押したとき | — | K7 |
| `onboarding_skipped` | `src/app/onboarding.tsx:142` | 診断をスキップしたとき | — | K7 |
| `diagnostic_answered` | `src/app/onboarding.tsx:437` | 診断設問に回答するごと | `question_index` (0 始点), `correct`, `sound_change_type` | K7、タイプ別正答 |
| `onboarding_completed` | `src/app/onboarding.tsx:309` | 初回診断の完了時 | `linking_correct` / `linking_missed` / `reduction_correct` / `reduction_missed` / `flapping_correct` / `flapping_missed`, `score`, `total`, `accuracy_percent`, `mode`, `level` | K7 |
| `rediagnosis_completed` | `src/app/onboarding.tsx:301` | 再診断 (診断履歴がある状態で診断) の完了時 | `mode`, `score`, `total`, `accuracy_percent`, `delta_accuracy` | 再診断での伸長 |
| `screen_view` | `src/features/analytics/ScreenViewTracker.tsx:31` | ルートパスが変わったとき (GA4 のみ。端末内ログには残らない) | `screen_name` 相当 (`home` / `phrases` / `progress` / `settings` / `lesson` / `onboarding` / `paywall` / `legal`) | K6、画面別遷移 |

### 2.2 レッスン

| イベント | 発火箇所 | 発火タイミング | パラメータ | KPI |
|---|---|---|---|---|
| `lesson_started` | `src/app/lesson.tsx:405` | レッスン画面のマウントごと (再開・続きからも含む。入口の区別なし → D-8) | `lesson_id` | K1 補助 |
| `lesson_completed` | `src/app/lesson.tsx:980` | 最終文の再生完了時 (セッションごとに 1 回) | `lesson_id`, `seconds` (今回のセッションの累計再生秒を四捨五入) | **K1**、North Star |
| `lesson_abandoned` | `src/app/lesson.tsx:1216` | 未完了のままレッスン画面をアンマウントしたとき | `lesson_id`, `progress_bucket` (`0-25` / `25-50` / `50-75` / `75-99`) | **K1**、離脱箇所 |
| `lesson_resume_offered` | `src/features/player/lessonResumeStore.ts:196` | 保存された再開位置があるレッスンをホームから開き、ダイアログを表示したとき | `lesson_id`, `sentence_index` (1 始点) | **K2** 分母 |
| `lesson_resume_chosen` | `src/features/player/lessonResumeStore.ts:198` | ダイアログで「文 N から再開」/「先頭から」を選んだとき | `lesson_id`, `sentence_index`, `choice` (`resume` / `restart`) | **K2** 分子 |
| `lesson_mode_changed` | `src/app/lesson.tsx:848` | モードを切り替えたとき (同じモードへの再タップは除く) | `lesson_id`, `mode` (`listen` / `read` / `speak` / `script`) | 機能利用 |
| `playback_control` | `src/app/lesson.tsx:621` (speed), `:632` (replay), `:800` `:815` `:827` (jump = 文送り・文戻し), `:862` `:878` (ab_repeat) | 各再生操作ごと | `lesson_id`, `action` | 機能利用 |
| `linking_note_opened` | `src/app/lesson.tsx:1399`, `:1675`, `:1873` | 音変化解説 (リンキングノート) を開いたとき | `lesson_id`, `sound_change_type` | 差別化機能の利用 |
| `key_phrase_opened` | `src/app/lesson.tsx:1545` | レッスン冒頭の「今日のキーフレーズ」を開いたとき | `lesson_id`, `sound_change_type` | 差別化機能の利用 |
| `overcoming_step_completed` | `src/app/lesson.tsx:430` | 弱点克服パスの各ステップを、セッション内で初めて完了したとき | `lesson_id`, `sound_change_type`, `step` (`listen` / `read` / `speak`) | 克服パスの進捗 |
| `shadowing_recorded` | `src/app/lesson.tsx:692`, `src/features/learning/components/PhrasePlaylistSheet.tsx:501` | 録音を完了したとき (レッスン内・復習プレイリスト内の両方) | `lesson_id` | 機能利用 |
| `shadowing_compared` | `src/app/lesson.tsx:767` | お手本と自分の録音を聞き比べたとき | `lesson_id` | 機能利用 |

### 2.3 苦手フレーズ・復習・クイズ

| イベント | 発火箇所 | 発火タイミング | パラメータ | KPI |
|---|---|---|---|---|
| `weak_phrase_added` / `weak_phrase_removed` | `src/features/library/userStore.ts:434` | 苦手フレーズの登録・解除のたび (手動もクイズ経由も同じ関数 → 区別不可 D-9) | `lesson_id` | 復習導入 |
| `weak_phrase_reviewed` | `src/features/library/userStore.ts:455` | 復習キュー (またはクイズ) で自己想起の正誤を記録したとき | `lesson_id`, `remembered`, `stage` (判定を反映した **後** の段) | K3 正答 |
| `weak_phrase_graduated` | `src/features/library/userStore.ts:461` | 復習の結果、未卒業から卒業に達したとき | `lesson_id`, `review_count` | K3 定着 |
| `weak_phrase_playlist_started` | `src/features/learning/components/PhrasePlaylistSheet.tsx:537` | 連続復習プレイリストを開始したとき (対象 0 件では発火しない) | `item_count`, `sound_change_type` (タイプ別フィルタ時のみ) | **K3** |
| `weak_phrase_playlist_finished` | `src/features/learning/components/PhrasePlaylistSheet.tsx:322` | プレイリストを閉じたとき (完走・途中の両方) | `item_count`, `played_count`, `completed` | **K3** |
| `lesson_quiz_shown` | `src/app/lesson.tsx:994` | レッスン完了直後にクイズを表示したとき (設問 0 件やデモでは発火しない) | `lesson_id`, `question_count` | **K4** 分母 |
| `lesson_quiz_answered` | `src/app/lesson.tsx:1075` | クイズに回答するごと | `lesson_id`, `question_index` (0 始点), `correct`, `sound_change_type`, `was_weak` | **K4** |
| `lesson_quiz_skipped` | `src/app/lesson.tsx:1926` | クイズを中断して完了画面へ進めたとき | `lesson_id`, `answered_count` | K4 負担 |

### 2.4 カリキュラム

| イベント | 発火箇所 | 発火タイミング | パラメータ | KPI |
|---|---|---|---|---|
| `curriculum_viewed` | `src/app/(tabs)/index.tsx:381` (home), `src/app/onboarding.tsx:687` (result) | カリキュラムシートを開いたとき | `from` (`home` / `result`) | v1.3 テーマ |
| `curriculum_customized` | `src/app/(tabs)/index.tsx:567` (select_type / clear_type), `:580` (clear_type = 全解除), `:589` (set_level), `:593` (reset_all) | 重点タイプ・難易度を変更したとき (状態が変わらない再タップは発火しない) | `action`, `sound_change_type` (タイプ個別の選択・解除時のみ), `level` (set_level 時のみ) | v1.3 テーマ |

### 2.5 課金

| イベント | 発火箇所 | 発火タイミング | パラメータ | KPI |
|---|---|---|---|---|
| `paywall_viewed` | `src/app/paywall.tsx:69` | ペイウォール画面の表示時 | `from` (`settings` 既定 / `progress`) | **K5** 分母 |
| `paywall_plan_selected` | `src/app/paywall.tsx:95` | プランを選んだとき | `plan` (`monthly` / `annual`) | **K5** |
| `purchase_started` | `src/app/paywall.tsx:124` | 購入ボタンを押したとき | `product_id` | **K5** |
| `purchase_completed` | `src/app/paywall.tsx:130` (購入), `:169` (復元でプレミアムが有効になったとき) | 購入完了時。復元時は `product_id = "restored"`, `restored: true` | `product_id`, `value` (復元時は省略), `currency` (復元時は省略), `premium_active`, `restored` (復元時のみ) | **K5**、収益 |
| `purchase_failed` | `src/app/paywall.tsx:146` | 購入が完了しなかったとき | `product_id`, `reason` (`user_cancelled` / `network` / `store_error` / `unknown`) | K5 内訳 |
| `restore_completed` | `src/app/paywall.tsx:165`, `src/app/(tabs)/settings.tsx:119` | 復元処理が成功したとき (購入が見つからない場合も含む) | `result` (`restored` / `nothing`) | サポート状況 |
| `subscription_manage_tapped` | `src/app/(tabs)/settings.tsx:143` | 設定のプラン導線を押したとき | — | 解約意図シグナル |

### 2.6 Watch

| イベント | 発火箇所 | 発火タイミング | パラメータ | KPI |
|---|---|---|---|---|
| `watch_session_synced` | `src/features/progress/progressStore.ts:364` | iPhone が Watch の学習セッションを取り込んだとき | `sessions_count` | 連携利用 |

### 2.7 ユーザープロパティ

| プロパティ | 設定箇所 | 値 |
|---|---|---|
| `premium_status` / `plan_type` | `src/features/billing/billingStore.ts:221` | `premium` / `free`、商品 ID または削除 (null) |
| `diagnostic_level` | `src/app/onboarding.tsx:323` | `beginner` / `intermediate` / `advanced` |
| `lessons_completed_bucket` | `src/features/progress/progressStore.ts:123` | `0` / `1-3` / `4-8` / `9-12` (累計完了数が変わったときのみ) |
| `watch_user` | `src/features/progress/progressStore.ts:365` | `true` (初回の Watch 取り込み時) |
| ユーザー ID | `src/features/billing/billingStore.ts:178` | RevenueCat の匿名 appUserID |

## 3. 版別テーマ ↔ イベント ↔ KPI

| 版 | テーマ (Issue / PR) | 追加されたイベント | 見るべき指標 |
|---|---|---|---|
| v1.1 | 診断拡張 (8 種 16 問)・習熟度モデル・間隔反復・克服パス・Watch 同期・GA4 導入 (#75 #76 #100 #101 #102) | §2 のうち `curriculum_customized` (v1.3) と v1.5〜v1.7 の 7 イベントを除く 30 種 (v1 の 9 種 + 計測計画 v2 で追加した分) とユーザープロパティ 5 件 | K7 Aha 到達率、North Star、タイプ別正答、卒業数 |
| v1.2 | 希少音変化レッスン (同化・挿入・弱読) の追加 | なし | `lesson_completed` の `lesson_id` 別分布、`diagnostic_answered` の `sound_change_type` 別正答 |
| v1.3 | カリキュラムの手動カスタマイズ (#106) | `curriculum_customized` | `curriculum_viewed` → `curriculum_customized` の転換、`action` 別・重点タイプ別の分布 |
| v1.4 | 診断結果の推薦レッスンを「今日の1本」・復習キューへ接続 (#93 / #119) | なし (推薦経由を識別するパラメータも無い → D-8) | 推薦レッスンの `lesson_completed` 数 (レッスン ID で照合。経由は識別不可) |
| v1.5 | 苦手フレーズの連続復習プレイリストと音変化タイプ別フィルタ (#95 / #121) | `weak_phrase_playlist_started` / `weak_phrase_playlist_finished` | **K3 復習完走率**、`played_count ÷ item_count` |
| v1.6 | レッスン完了直後のミニ聞き分けクイズ (#103 / #123) | `lesson_quiz_shown` / `lesson_quiz_answered` / `lesson_quiz_skipped` | **K4 クイズ正答率**、スキップ率、`was_weak` 別の差 |
| v1.7 | レッスン中断位置の永続化と「続きから再開」導線 (#97 前半 / #125) | `lesson_resume_offered` / `lesson_resume_chosen` | **K2 再開利用率** |
| v1.8 | 計測定義と実装の棚卸し・突合 (本書。挙動変更なし) | なし | — |

**#97 は前半のみ完了**。後半の「聞くだけ／ハンズフリー連続再生モード」は未実装 (#97 は OPEN のまま)。後半を実装する際はバックグラウンド再生の実機確認と、連続再生の開始・終了を計るイベントの新規定義 (`docs/metrics.md` を先に更新) が必要。

## 4. KPI 集計定義 (GA4)

12月以降の GA4 実測判断で使う集計を確定する。 GA4 上で真偽値は文字列 `true` / `false` に変換されて送られるため、条件は文字列で指定すること。

| # | KPI | 集計式 (GA4 イベントとパラメータ) | 補足 |
|---|---|---|---|
| K1 | レッスン完走率 | `lesson_completed` ÷ (`lesson_completed` + `lesson_abandoned`) | 正常に閉じたセッションのみが分母。`lesson_id` 別、`progress_bucket` 別で離脱箇所を見る。`lesson_started` − (完了 + 離脱) はアプリ強制終了などで閉じられなかった分の目安 |
| K2 | 再開利用率 | `lesson_resume_chosen` (`choice` = `resume`) ÷ `lesson_resume_offered` | 「先頭から」率は `choice` = `restart`。再開提案の出現率 = `lesson_resume_offered` ÷ `lesson_started` |
| K3 | 復習完走率 | `weak_phrase_playlist_finished` (`completed` = `true`) ÷ `weak_phrase_playlist_finished` (全体) | 到達度の補助に `played_count ÷ item_count`。定着は `weak_phrase_graduated` 件数、自己想起正答は `weak_phrase_reviewed` (`remembered` = `true`) ÷ 全体 |
| K4 | クイズ正答率 | `lesson_quiz_answered` (`correct` = `true`) ÷ `lesson_quiz_answered` (全体) | `sound_change_type` 別、`was_weak` 別に分ける。スキップ率 = `lesson_quiz_skipped` ÷ `lesson_quiz_shown` |
| K5 | ペイウォール CVR | `purchase_completed` (`product_id` ≠ `restored`) ÷ `paywall_viewed`。単位は **ユーザー単位** (期間内にペイウォールを見たユーザー数を分母に、そのうち購入完了イベントを持つユーザー数を分子にする GA4 のユーザー数指標)。イベント数の比は同じユーザーの複数回閲覧で過小評価になる | プランは `product_id` で判定する (`com.takezou.englistening.premium.monthly` = 月額、`…premium.annual` = 年額)。中間に `paywall_plan_selected`、`purchase_started`。**`from` 別はユーザー単位では分離できない** (`purchase_completed` に `from` が無いため。D-12)。`from` 別は `paywall_viewed` → `purchase_started` の **セッション単位** の比較に留める。`paywall_plan_selected` はユーザーがタップしたときだけ発火し、既定の年額のまま購入した場合は出ない。収益は `purchase_completed` の `value` 合計。トライアル開始と有料購入は区別できない (`trial_started` 未実装) |
| K6 | D1 / D7 継続 | GA4 の継続レポート (初回起動日 `first_open` を起点に 1 日後・7 日後にイベントのあるユーザーの割合) | アプリ独自イベントは使わない (GA4 の自動収集が正)。`diagnostic_level`・`lessons_completed_bucket`・`premium_status` で分割する |
| K7 | Aha 到達率 | **初回起動ユーザーのコホート** (初回起動日ごと) のうち、`onboarding_completed` を持つユーザーの割合。GA4 では探索で `app_first_open` を持つユーザーを軸に `onboarding_completed` の有無で分ける | `docs/metrics.md` §6 の目標 60%。スキップ率も同じコホート基準 (`onboarding_skipped` を持つユーザー ÷ コホート)。同じ期間のイベント数の比は、期間前に初回起動したユーザーが分子だけに入り 100% を超え得るため使わない |
| — | North Star | 週に 3 回以上 `lesson_completed` したユーザー数 | `docs/metrics.md` §6 の定義どおり |

## 5. 乖離・留意点一覧 (次版候補)

今版 (v1.8) はコードを変更していない。以下は `docs/metrics.md` を先に更新したうえで、今後の版で対応する候補。

| # | 種別 | 内容 | 影響 |
|---|---|---|---|
| D-1 | 定義と実装の違い | `screen_view` は GA4 にだけ送られ、端末内ログ (`analytics-log.json`) には残らない (`logEvent` を通さず `logScreenView` を直接呼ぶ)。`AnalyticsEventType` 型にも含まれない | GA4 の集計には影響なし。端末内ログで画面遷移を確認できない。Firebase 自動収集の `screen_view` と同じイベント名で混ざるため、GA4 では `firebase_screen` パラメータも併記される |
| D-2 | 文書の古さ | `docs/metrics.md` §2 冒頭の「v1 で 9 イベントに v2 で 13 イベントを追加」は現在の 37 行と合わない | v1.8 で修正済み |
| D-3 | 定義に無い値 | `purchase_completed` の復元時に `restored: true` が送られるが、`docs/metrics.md` §2 のパラメータ欄に `restored` が無かった | **v1.8 で解消** (パラメータ欄に追記。コード変更なし) |
| D-4 | 定義に無い値 | `onboarding_completed` の種別別 correct/missed は `linking` / `reduction` / `flapping` の 3 種のみ。診断は 8 種に拡張されたが、残り 5 種 (同化・挿入・弱読など) の内訳は入っていない | 8 種別の内訳は `diagnostic_answered` の `sound_change_type` で代用できる |
| D-5 | 値の意味 | `diagnostic_answered` / `lesson_quiz_answered` の `question_index` は 0 始点 | 1 問目を「0」として集計すること |
| D-6 | 値の意味 | `weak_phrase_reviewed` の `stage` は判定を反映した **後** の段。`remembered: true` では回答前の段は `stage − 1`。`remembered: false` では `applyReviewOutcome` が段を 0 に戻すため、どの段で不正解だったかは分からない | 段別の正答率は **成功イベントだけで**見る (`remembered: true` の `stage − 1` = 昇段できた段)。不正解は段別に分離できないため、「段 N の正答率」ではなく「段 N からの昇段件数」と「不正解の総件数」を併記する |
| D-7 | 値の意味 | `lesson_abandoned` は最終文の再生中に離脱した場合も `75-99` に入る (`ratio` が 1 でも同じ括くり)。`lesson_completed.seconds` は再開をまたがない今回のセッション分のみ | 完走率には影響しない |
| D-8 | 識別不能 | `lesson_started` に入口 (今日の1本 / 推薦 / 復習キュー / ライブラリ / 診断結果) を表すパラメータが無い (レッスンルートに `from` を渡していない) | v1.4 (#93) の推薦接続の効果を GA4 だけで直接測れない |
| D-9 | 識別不能 | `weak_phrase_added` は手動登録とクイズ不正解による自動登録が同じ関数から発火し、区別できない | v1.6 の「クイズ → 苦手フレーズ登録」の数を単独で数えられない (近似値: `lesson_quiz_answered` (`correct` = `false`, `was_weak` = `false`) の件数) |
| D-10 | 識別不能 | `shadowing_recorded` はレッスン内と復習プレイリスト内の両方から発火し、同じ `lesson_id` のみ | 復習プレイリストでのシャドーイング実施数を単独で数えられない |
| D-11 | コメントの古さ | `analyticsStore.ts` の `logEvent` にある JSDoc に「課金関連イベントの呼び出し箇所は現状存在しない」とあるが、`paywall.tsx` で発火している | 挙動への影響なし。次にコードに触れる版でコメントを直す |
| D-12 | 識別不能 | `purchase_completed` / `purchase_started` に `from` (ペイウォールの流入元) と `plan` が無い。`from` は `paywall_viewed` にだけある | K5 を流入元別に分離できない (§4 K5)。`paywall_viewed` 時点の `from` を購入完了まで持ち回すパラメータの追加が次版候補 |

## 6. GA4 側の確認事項 (オーナー作業)

アプリ外の設定で済む項目。12月の実測判断の前に確認する。

1. **キーイベント**: `purchase_completed` / `onboarding_completed` / `lesson_completed` をキーイベントに設定する (`docs/metrics.md` §1 の保留事項。各イベントが一度でもプロパティに到達している必要がある)。
2. **カスタム定義 (イベント スコープのディメンション)**: 2026-11-22 時点で 13 件のみ登録。v1.4〜v1.7 で増えたパラメータのうち、**レポートや探索で分割して使うもの** は登録が要る可能性がある (未登録のパラメータは BigQuery エクスポートにしか出ない)。対象: `choice`, `sentence_index`, `question_count`, `question_index`, `was_weak`, `answered_count`, `played_count`, `completed`, `item_count`, `delta_accuracy`, `progress_bucket`, `from`, `plan`, `reason`, `action`, `level`。登録状況は GA4 コンソールで確認する。
3. **真偽値の文字列化**: `correct` / `completed` / `remembered` / `was_weak` / `premium_active` は GA4 上で文字列 `true` / `false`。探索の条件式は文字列で指定する。
4. **トライアル**: `trial_started` は未実装のため、K5 の `purchase_completed` にはトライアル開始が含まれる。純粋な有料転換は RevenueCat / App Store Connect の数値を正とする。
