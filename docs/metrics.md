# ミミトレ 計測設計

最終更新: 2026-11-27（v1.6: レッスン内ミニ聞き分けクイズ `lesson_quiz_*` を追加。計測計画 v2: イベント拡充・ユーザープロパティ・Crashlytics）

事業の最重要目的は「リリース」ではなく、インストールしたユーザーが使い続け、課金につながることです。その判断に使う指標と、アプリが記録するイベントを定義します。本書が計測の正であり、イベント名・意味を変更するときは本書を先に更新します。

## 1. 基盤の現状

- v1.0 の分析は **端末内イベントログのみ**（`src/features/analytics/analyticsStore.ts`）でした。v1.1 からは同じイベントを **GA4（Firebase Analytics）にも送信**します（2026-11-22 ユーザー指示「iOS/Android/Web のすべての分析に GA4 を活用」により、送信基盤の GM 判断は確定）。
- 送信先は Firebase プロジェクト「mimitore」（`mimitore-84015`）。GA4 プロパティは Web と共通の「33eigo」（プロパティ ID `565384874`、Web 測定 ID `G-ZFDHY4K5NS`）。
- **Firebase↔GA4 のリンクは 2026-11-22 に完了**しました。データストリーム: Web `16391164747`（`G-ZFDHY4K5NS`）／ iOS `16391198649` ／ Android `16391286058`。
- GA4 コンソール設定（2026-11-22 実施済み）: データ保持 **14 か月**、Google シグナル **ON**、カスタム定義 **13 件**（後述のパラメータ・ユーザープロパティに対応）、オーディエンス **5 件**（未購入のペイウォール閲覧者／離脱リスク_診断完了_未学習／プレミアム会員／継続学習者／Watch 利用者）、BigQuery への **日次エクスポート** をリンク済み。
- **キーイベントは未設定（保留）**: `purchase_completed` / `onboarding_completed` / `lesson_completed` をキーイベント化する予定ですが、GA4 の仕様上、イベントがプロパティに **初回到達した後** でないとスター付けできません。v1.1 の実データが流れ始めたら管理画面で設定します。
- 記録・送信するイベントには個人を特定する情報を含めません（端末内連番とローカル時刻、レッスン ID 等のみ。GA4 側の集計は Firebase の自動収集識別子と、RevenueCat の匿名 appUserID をユーザー ID に使う方式によります）。
- GA4 へ送るパラメータ名は snake_case に正規化されます（`ga4.ts` が変換。例: `lessonId` → `lesson_id`）。端末内ログの形式は従来どおりです。

## 2. 記録イベント（計測計画 v2）

v1 で実装した 9 イベントに、v2 で 13 イベントを追加しました。パラメータは GA4 送信時の名前（snake_case）で記載します。

| イベント | パラメータ | 目的・答える問い |
|---|---|---|
| `app_first_open` | — | 初回起動。すべてのファネルの起点 |
| `onboarding_started` | — | 診断の開始率 |
| `onboarding_skipped` | — | 診断を避ける割合 |
| `diagnostic_answered` | `question_index`, `correct`, `sound_change_type` | どの音変化でつまずくか（問題別の正答率） |
| `onboarding_completed` | 種別ごとの correct/missed、`score`, `total`, `accuracy_percent`, `mode`, `level` | Aha 到達。全 8 種診断スコア分布 |
| `rediagnosis_completed` | `mode`, `score`, `total`, `accuracy_percent`, `delta_accuracy` | 学習後の再診断実施と前回比の伸長計測 |
| `lesson_started` | `lesson_id` | レッスン別の開始数 |
| `lesson_completed` | `lesson_id`, `seconds` | 完了率・North Star の分子 |
| `lesson_abandoned` | `lesson_id`, `progress_bucket`（0-25/25-50/50-75/75-99） | **離脱箇所**: どこまで進めて辞めたか |
| `lesson_mode_changed` | `lesson_id`, `mode`（listen/read/speak/script） | コア機能（3モード）の利用動向 |
| `linking_note_opened` | `lesson_id`, `sound_change_type` | 差別化機能（音変化の解説）が使われているか |
| `playback_control` | `lesson_id`, `action`（speed/jump/replay/ab_repeat） | 再生操作の利用動向 |
| `shadowing_recorded` | `lesson_id` | シャドーイング実施 |
| `shadowing_compared` | `lesson_id` | 聞き比べ（お手本⇔自分の録音）の利用 |
| `weak_phrase_added` / `weak_phrase_removed` | `lesson_id` | 苦手フレーズ帳の利用動向 |
| `paywall_viewed` | `from` | 課金ファネルの入口と流入元 |
| `paywall_plan_selected` | `plan`（monthly/annual） | プラン選好 |
| `purchase_started` | `product_id` | 購入フローの開始 |
| `purchase_completed` | `product_id`, `value`, `currency`（JPY）, `premium_active` | 収益（LTV・ファネル）。復元時も発火するため集計では `restored: true` を除外 |
| `purchase_failed` | `product_id`, `reason`（user_cancelled/network/store_error/unknown） | 購入失敗の内訳（生のエラー文は送らない） |
| `restore_completed` | `result`（restored/nothing） | 復元の成否 |
| `subscription_manage_tapped` | — | 設定のプラン導線タップ = **解約意図のシグナル** |
| `watch_session_synced` | `sessions_count` | Watch 単体学習の取り込み（連携チャネルの利用） |
| `overcoming_step_completed` | `lesson_id`, `sound_change_type`, `step` | 弱点克服パスの 3 ステップ（`listen` / `read` / `speak`）完了の把握 |
| `curriculum_viewed` | `from`（home/result） | 診断から提案された個別カリキュラムの閲覧 |
| `curriculum_customized` | `action`（select_type/clear_type/set_level/reset_all。`clear_type` はタイプ全解除も含む）、`sound_change_type`（select_type 時に選択したタイプ名、clear_type の個別解除時に解除したタイプ名。全解除時は省略）、`level`（set_level 時に all/beginner/intermediate） | カリキュラムの手動カスタマイズ（重点タイプ・難易度）の利用状況。重点タイプ別の選択分布から学習継続の納得感を検証する |
| `key_phrase_opened` | `lesson_id`, `sound_change_type` | レッスン冒頭の「今日のキーフレーズ」の利用動向 |
| `weak_phrase_reviewed` | `lesson_id`, `remembered`, `stage` | 復習キューでの自己想起チェックと正答動向 |
| `weak_phrase_graduated` | `lesson_id`, `review_count` | 苦手フレーズの定着・卒業到達数 |
| `weak_phrase_playlist_started` | `item_count`, `sound_change_type`（タイプ別フィルタ中はそのタイプ名、すべてのときは省略） | 連続復習プレイリストの開始数・利用規模 |
| `weak_phrase_playlist_finished` | `item_count`, `played_count`, `completed` | 連続復習の完走率と中断位置の把握 |
| `lesson_quiz_shown` | `lesson_id`, `question_count` | レッスン完了直後に差し込むミニ聞き分けクイズ (#103) の提示数。設問を作れないレッスンでは発火しない |
| `lesson_quiz_answered` | `lesson_id`, `question_index`, `correct`, `sound_change_type`, `was_weak` | 検索練習 (空欄選択) の正答動向。`was_weak` は出題文が事前に苦手フレーズ登録済みだったか |
| `lesson_quiz_skipped` | `lesson_id`, `answered_count` | クイズを中断して完了画面へ進めた割合 (導線の負担になりすぎていないか) |
| `screen_view` | `screen_name`（home/phrases/progress/settings/lesson/onboarding/paywall/legal） | 画面遷移・滞在の把握（自動収集と併用） |

クイズ (`lesson_quiz_*`) はレッスン最終文の再生完了後・完了画面の前に最大 2 問を出す。正誤は苦手フレーズの復習スケジュール (`weak_phrase_reviewed` と同じ間隔反復) と音変化タイプ別習熟度にも反映されるため、クイズ経由で苦手フレーズが追加・昇段した場合は `weak_phrase_added` / `weak_phrase_graduated` も併発する。`sound_change_type` は出題した空欄の音変化タイプ。

`weak_phrase_playlist_finished` の `played_count` は、モデル音声を文末まで聞いた、または録音を完了したフレーズの件数（「次へ」で読み飛ばした分は含まない）。`completed` は最後のフレーズまで到達したときに `true`、途中で閉じたときに `false`。

## 3. ユーザープロパティ

| プロパティ | 値 | 設定タイミング |
|---|---|---|
| `premium_status` | free / premium | 課金状態の再計算時（値が変わったときのみ） |
| `plan_type` | 商品 ID / null | 同上（有効なエンタイトルメントの商品 ID） |
| `diagnostic_level` | beginner / intermediate / advanced | 診断完了時（スコア 0–1 / 2 / 3） |
| `lessons_completed_bucket` | 0 / 1-3 / 4-8 / 9-12 | 進捗の読み込み・更新時（値が変わったときのみ） |
| `watch_user` | true | Watch セッションが初めて取り込まれたとき |

## 4. クラッシュ・パフォーマンス

- **Crashlytics**（`src/features/analytics/crash.ts`）: 収集を有効化し、JS のグローバルエラーハンドラから致命的エラーを記録（従来のハンドラにも引き継ぐ）。端末内ログの保存・読み込み失敗、Watch セッション取り込み失敗も非致命エラーとして記録する。コンソールへの反映は **初回クラッシュのアップロード後**（Firebase の仕様）。
- **Performance Monitoring**: 収集を有効化（自動トレースのみ。カスタムトレースは未実装）。

## 5. 離脱理由・退会理由についての正直な境界

- 計測で分かるのは「**どこで・何をした後に**離れたか」（`lesson_abandoned` の進捗バケット、画面遷移、診断の離脱）と「解約導線を開いた」という **意図のシグナル**（`subscription_manage_tapped`）までです。**理由そのもの（文章）は計測では取得できません**。
- 解約の実行自体は iOS の設定側で行われるためアプリからは観測できず、解約件数の正は RevenueCat / App Store Connect です。
- 理由を集めるには **アプリ内アンケート**（例: プラン画面での任意の解約理由フォーム）が別途必要です。これは将来提案として残し、v2 の範囲には含めていません。

## 6. KPI 定義（ローンチ期）

| 指標 | 定義 | 目標（仮説） |
|---|---|---|
| North Star | 週に3回以上レッスンを完了した学習者数（GA4 の `lesson_completed` とユーザー識別で算出。リンク完了済みのため、実データが流れれば算出可能） | 継続成長 |
| Aha 到達率 | `onboarding_completed` ÷ 初回起動 | 60%以上 |
| 継続率 D7 | 初回起動から7日後に再訪した割合（GA4 の自動収集セッション・再訪と組み合わせて算出） | 30%以上（クローズドテスト期の目安） |
| 利用頻度 | 1ユーザーあたり週のセッション数 | 3回以上 |
| 課金ファネル | `paywall_viewed` → `paywall_plan_selected` → `purchase_started` → `purchase_completed` の転換率（`purchase_completed` は復元時にも発火するため `restored: true` を除外）。トライアル開始率は `trial_started` イベントが未実装のため現状は計測不可 | 初期は実測して基準を作る |

## 7. 判断の cadence

- ローンチ直後: TestFlight／初期ユーザーのイベントと定性フィードバックで、Aha 体験（60秒診断→聞き取れなかった理由の可視化）が刺さっているかを最優先で確認する。
- GA4 の自動収集（ユーザー識別・セッション）と本書のイベントを組み合わせて KPI をダッシュボード化する。実データの到達確認（DebugView）とキーイベント設定は、v1.1 の TestFlight 実行時に行う。
