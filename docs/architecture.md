# ミミトレ アーキテクチャ設計

最終更新: 2026-11-21（v1.0.0 時点の実コードに基づく）

このドキュメントは、アプリ本体の設計思想と構成を1か所に集約したものです。企画・仕様は `README.md`、コンテンツ生成パイプラインの設計は `docs/content-pipeline.md` を参照してください。

## 1. 技術スタック

- React Native 0.88 / Expo SDK 58 / React 19 / TypeScript
- 画面遷移: expo-router（ファイルベースルーティング）
- 音声再生・録音: expo-audio
- 課金: RevenueCat（react-native-purchases）
- 永続化: expo-file-system（端末内 JSON ファイル）
- 状態管理ライブラリ（Redux / Zustand 等）: **使わない**（§2 参照）

## 2. 設計思想

### 2.1 MVC は採用しない — コンポーネント＋ストア型

古典的な MVC（Model-View-Controller）は採用していません。React の一方向データフローに合わせ、以下の3層で構成します。

- **View**: React コンポーネント（`src/app/` の画面、`src/components/` と各 feature の画面部品）。表示と、再生制御のような表示に密着した操作を担う（例: プレイヤー画面 `src/app/lesson.tsx` は AB リピートや録音の制御を持つ）。一方、状態の保持・永続化・課金判定といった業務ロジックはストア側に寄せている。
- **Store**: 機能ごとの小さな TypeScript モジュール（`src/features/` 配下の `*Store.ts` 等）が状態と処理を持ち、React フック経由で View に渡す。Controller に相当する層は置かない。
- **Model**: 型定義とコンテンツデータ（`src/data/`、`src/features/lesson/`）。レッスン本文・音声・リンキング情報は静的アセットとして同梱する。

強いて分類すれば MVVM に近い形ですが、ViewModel のような定型層も作らず、「画面 → ストア → データ」の単純な流れを守ることを優先しています。

### 2.2 状態管理は「機能別ストア＋フック」で完結させる

- 状態はアプリ全体で1つの巨大ストアに集約せず、機能（feature）ごとに独立したストアモジュールへ分割する。
- 永続化するストア（progressStore、userStore 等）は「モジュール内のキャッシュ＋読み書き関数＋購読用フック」という同じ型で実装する。変更時は必ず新しい参照を作る（イミュータブル更新）ことで React の再描画検知に乗せる。
- 例外: 永続化しない軽量な状態（`playerPrefs` の表示設定、`shadowingStore` のセッション内カウント）は、購読用フックを持たないモジュール変数で管理している。
- 画面をまたぐ共有が最小限のものだけ React Context を使う（例: `src/state/SelectionContext.tsx` の選択中レッスン）。
- 理由: v1.0 の規模では専用ライブラリの学習・配線コストが利点を上回ること、ストアが素の TS なので単体でテスト・差し替えが容易なこと。

### 2.3 ローカルファースト（v1.0 はサーバーを持たない）

- アカウント登録・クラウド同期は v1.0 スコープ外。全データ（進捗、お気に入り、苦手フレーズ、分析ログ）は端末内 JSON に保存する。
- 分析イベントも端末内ログのみで、外部送信は一切しない（`src/features/analytics/analyticsStore.ts`）。送信基盤の要否は利用データを見て別途判断する。

### 2.4 「単一の真実」を各所に1つだけ置く

- アプリ識別子・名前・バージョン: `src/config/appConfig.json`（`app.config.ts` と画面表示の両方が同じ JSON を読む）
- プレミアム判定: `billingStore` が唯一の判定箇所。画面側は `isPremium` 相当の結果だけを見る
- レッスンの登録状態: `src/features/lesson/registry.ts` の LESSON_CATALOG / BUNDLES が唯一の登録表

### 2.5 失敗してもアプリが落ちない設計（フォールバック）

- 課金: RevenueCat のネイティブモジュールが無い環境、API キー未設定、初期化失敗のいずれでも `isAvailable = false` となり、課金 UI を無効化して無料扱いで動作継続する。実キーはコードに埋め込まず環境変数 `EXPO_PUBLIC_REVENUECAT_API_KEY` から読む。
- コンテンツ: 音声が未生成のレッスンは「準備中」表示にし、クラッシュさせない。コンテンツデータは読み込み時に検証する（`assertValidContents`）。
- 進捗記録: 読み込み完了前に発生した記録もメモリに蓄積し、読み込み後にマージして永続化する（記録の取りこぼし防止）。

### 2.6 学習進行を止めない設計方針（W2 / W3 対応）

- **シャドーイングの非ブロック設計**: シャドーイング機能（`src/features/lesson/components/ShadowingStage.tsx`）は「端末内マイク録音＋お手本と自分の声の聞き比べ」を採用しており、音声認識（STT）や外部発音採点 API を用いた合格判定で次の文・次ステップへの進行をブロックしない（音声認識 SDK は導入しない）。
- **1 日の進行上限なし**: 全同梱レッスンの再生・復習・シャドーイング録音には日次の回数制限を設けない。学習者が自分のペースで反復できることを仕様とする。

## 3. ディレクトリ構成

| パス | 役割 |
|---|---|
| `src/app/` | 画面（expo-router）。タブ画面は `(tabs)/` 配下、その他は `lesson.tsx`、`paywall.tsx`、`onboarding.tsx`、`legal.tsx` 等 |
| `src/components/` | 画面共通の部品（Screen、ThemedText、Chip） |
| `src/features/` | 機能単位のまとまり（下記） |
| `src/features/player/` | 再生まわり（表示設定 `playerPrefs`、シャドーイング記録 `shadowingStore`、共有 UI） |
| `src/features/lesson/` | レッスンの型、登録表 `registry`、リンキング可視化ロジック |
| `src/features/library/` | お気に入り・苦手フレーズのストア `userStore` |
| `src/features/progress/` | 学習進捗ストア `progressStore` |
| `src/features/billing/` | RevenueCat ラッパー `billingStore` と設定 `config.ts` |
| `src/features/onboarding/` | 初回診断（60秒 Aha 体験）のロジック |
| `src/features/analytics/` | 端末内イベントログ |
| `src/features/legal/` | 法務ページの文面データ |
| `src/data/` | 同梱コンテンツ（モック／カタログ）と型、読み込み時検証 |
| `src/config/` | アプリ定数の単一ソース（`appConfig.json` / `appConfig.ts`） |
| `src/state/` | React Context による最小限の画面間共有 |
| `src/theme/` | テーマ（色定義とプロバイダ） |
| `tools/content/` | コンテンツ生成パイプライン（スクリプト→TTS→音声）。設計は `docs/content-pipeline.md` |
| `docs/` | 設計・手順・法務・ストア資料 |

## 4. ストア一覧

| ストア | 責務 | 永続化 |
|---|---|---|
| `progressStore` | 日別の再生秒数・完了レッスン・シャドーイング回数（ローカル日単位、水増ししない実再生のみ計上） | `progress-data.json` |
| `userStore` | お気に入り、苦手フレーズ、オンボーディング完了フラグ | `user-data.json` |
| `billingStore` | RevenueCat 初期化、プレミアム判定（entitlement `premium`）、購入・復元 | なし（RevenueCat 側が真実） |
| `analyticsStore` | イベントの端末内ログ（連番＋ローカル時刻のみ、個人特定情報なし） | `analytics-log.json` |
| `shadowingStore` | 文ごとの録音回数（セッション内カウント。日次集計は progressStore 側） | なし（in-memory） |
| `playerPrefs` | 表示モード（カラオケ／チャンク）、直訳トグル（既定 OFF）、再生速度 | なし（in-memory、再起動でリセット） |

## 5. データフロー（再生の例）

1. ライブラリ画面が `registry` のカタログからレッスンを表示し、選択は `SelectionContext` に保持される。
2. プレイヤー画面がレッスンの文データと音声を読み、expo-audio で再生。再生位置に応じてカラオケハイライト／リンキング可視化／チャンク表示を切り替える（表示設定は `playerPrefs`）。
3. 実際に再生が進行した時間だけを `progressStore` が日別記録に加算し、JSON へ永続化する。
4. プレミアム限定の操作は `billingStore` の判定結果でゲートする。課金が利用不可の環境では無料扱いにフォールバックする。

## 6. 課金まわりの構成

- 商品は App Store Connect のサブスクリプション（年額・月額）を RevenueCat の商品にひも付け、entitlement は `premium`、Offering は `default`（`$rc_monthly` / `$rc_annual`）。
- アプリ側は RevenueCat の Offering から商品を引くため、実際に課金される価格と商品構成はストア／RevenueCat 側の設定で変更できる。ただし、ペイウォールと法務文面に表示する価格文字列は `src/features/billing/config.ts` の `DISPLAY_PRICES` に定数として持っているため、表示価格を変える場合はコード変更と再提出が必要。
- 設定値の置き場: `src/features/billing/config.ts`（entitlement ID 等）と環境変数（公開 API キー）。

## 7. 採用していないもの（v1.0）

- サーバー／アカウント同期（Issue #14 で将来検討）
- Redux・Zustand 等の状態管理ライブラリ（§2.2 の理由による）
- CarPlay / Apple Watch（v1.1、Issue #23 / #24）
- 広告 SDK（Issue #20 で将来検討）
- EAS クラウドビルド（ローカルアーカイブ＋App Store Connect API アップロードで配信する）

## 8. 変更時のルール

- 新しい状態は、まず置くべき feature のストアがないか探し、無ければその feature 内に小さなストアを新設する。`src/state/` への安易な追加はしない。
- 識別子・名前・バージョンを変えるときは `src/config/appConfig.json` だけを編集する。
- レッスンを追加するときは `tools/content/` で生成し、`registry.ts` の LESSON_CATALOG / BUNDLES に登録する（require パスは Metro の静的解決のためリテラルで書く）。
- フォールバック方針（§2.5）を崩す変更は、理由を PR 本文に明記する。
