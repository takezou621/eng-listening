# App Store 申請の自動化 (asc-submit)

eyechecker / kilde (takezou621/kilde, takezou621/eyechecker) と同じ仕組み: メタデータの
正本をこのリポジトリに置き、[asc-submit](https://github.com/takezou621/asc-submit)
(自作ツール・コミット SHA 固定) が App Store Connect API でバージョン作成からメタデータ
反映・ビルド割当て・審査提出までを行う。ブラウザ操作と fastlane を排除し、提出内容を
すべて git で追跡する。正規経路は `docs/operations.md` §1 のとおり
**GitHub Actions (m1 ランナー) + asc-submit**。

## 構成 (どこに何があるか)

| 要素 | 場所 | 役割 |
|---|---|---|
| ストア文面の正 | `docs/store/listing-ja-final.md` | 説明文・キーワード・サブタイトル・プロモーションテキスト・価格表記の確定文面。ここを編集してからメタデータへ転記する |
| メタデータ正本 | `docs/appstore/metadata-ja.md` | ロケール別 (ja のみ) の説明 / What's New / キーワード / サブタイトル。**変更はまずここで行い、asc-submit で転記する** (What's New の `<バージョン>` セクションが無いと spec 生成が失敗する) |
| 審査メモ | `docs/appstore/review-notes.md` | App Review Notes に貼る英文 (`## English (paste into App Review Notes)` 〜 `---` を spec が抽出) |
| spec 生成 | `scripts/release/appstore-spec.py` | メタデータ + サポート / プライバシー URL (33eigo.win) から asc-submit の spec.json を生成。文字数上限 (キーワード 100 文字・ja 180 バイト、サブタイトル 30 文字、説明・What's New 4,000 文字) を機械検証する |
| アップロード | `scripts/release/appstore-upload.sh` | npm ci → expo prebuild → 用途文字列ゲート (§1.2) → pod install → アーカイブ → App Store 署名 → ASC へアップロード (クラウド署名) |
| 提出ライン | `.github/workflows/appstore.yml` | plan / status / apply / submit / upload の 5 モード (workflow_dispatch・self-hosted 専用) |

実行ジャーナル (asc-submit run のステップ状況・ログ) は eyechecker と同じ
`~/asc-submit-runs/` に置かれる (`ASC_SUBMIT_RUNS_DIR`)。

## リリースの流れ (upload → VALID 確認 → apply → submit)

前提: 実機での動作確認と提出前ゲート (`docs/operations.md` §1 の Light/Dark・W8 設問
確認、§1.2 の用途文字列監査 — upload スクリプトがアーカイブ前に機械検査する) を
済ませること。サポート URL・プライバシーポリシー URL は **33eigo.win** に用意済み —
spec 生成が `supportUrls` / `privacyUrls` を自動で埋める。

1. **メタデータを更新** — `docs/appstore/metadata-ja.md` に
   `## What's New (x.y)` セクションを書く (無ければ spec 生成が失敗する)。
   説明・キーワード・サブタイトルの変更があれば `docs/store/listing-ja-final.md` を
   正にしてメタデータへ反映する。`src/config/appConfig.json` の version と
   CHANGELOG も忘れずに
2. **upload** — workflow `App Store` を `mode=upload`, `version=1.1`, `build=N` で実行。
   prebuild → 用途文字列ゲート → アーカイブ → クラウド署名 → ASC アップロード。
   **審査は始まらない** (build は前回の提出より大きい値)
3. ビルドが ASC で VALID になるのを待つ (数分)
4. **apply** — `mode=apply`, `version=1.1`, `build=N`。バージョン作成 → What's New /
   説明 / キーワード / サブタイトル / 審査メモ → ビルド割当て。**審査への提出は
   しない**。反映結果は `mode=status` か ASC の画面で裏取り
5. **submit** — 問題なければ `mode=submit` で提出。dispatch を手で押すことが提出の
   ゲート。**提出後はバージョン・両サブスクリプション・グループのすべてが
   `WAITING_FOR_REVIEW` になっていることを API で確認する** (サブスクリプションの
   提出アイテムの扱いは下の「メモ」参照)
6. リジェクト・承認の確認は ASC の画面で行う (v1.1 時点で watch ワークフローは未導入)

初回・変更直後は `mode=plan` で計画だけ表示できる (API キー不要・副作用なし)。
`mode=status` は読み取りのみ。

## 初回セットアップ (監督者によるランナー登録時に実施)

1. **ASC API キー (CI 専用・Admin ロール)** — App Store Connect「ユーザとアクセス」→
   「統合」で Team キーを発行し、次の 3 secrets を登録:
   - `ASC_CI_KEY_B64` … `.p8` を base64 したもの (`base64 -i AuthKey_XXX.p8`)
   - `ASC_CI_KEY_ID` … キー ID
   - `ASC_CI_ISSUER` … issuer ID

   ロールは **Admin** を推奨 (upload モードのクラウド署名は Admin 限定 — kilde 実測。
   メタデータ反映と提出だけなら App Manager で可)。eyechecker と同じ方針として
   **CI 専用鍵を作り、開発用鍵を流用しない**こと。発行後 `mode=plan` → `mode=status`
   で経路を検証する
2. **RevenueCat の公開キー** (upload モードのみ) — secret
   `EXPO_PUBLIC_REVENUECAT_API_KEY` を登録する。未登録の場合はランナー側の環境変数か
   リポジトリ直下の `.env` で代用でき、どちらも無ければ upload スクリプトが
   アーカイブ前に失敗する (値はログに表示されない)
3. **self-hosted ランナーの登録** — `appstore.yml` は `[self-hosted, macOS, ARM64]` で
   動く。eyechecker の m1 ランナーは eyechecker リポジトリスコープのため、この
   リポジトリにも別途登録が必要 (GitHub → Settings → Actions → Runners →
   New self-hosted runner。同じ m1 マシンに `~/actions-runner-eng-listening` 等で
   別フォルダで入れる。最初の step が `runner.environment` を見て、ホステッド実行は
   即座に失敗する)
4. **ランナーの前提** (eyechecker の m1 と同じ環境):
   - Xcode (最新安定版。`xcodebuild -version` で確認) とライセンス受諾
   - **CocoaPods** (`pod` が PATH にあること。Homebrew の ruby を使う場合は
     `docs/operations.md` §1.1 の `GEM_PATH` 設定を参照)
   - Node.js (`npm ci` / `npx expo prebuild` 用。nvm を使う場合はランナーの PATH に
     `node` / `npx` が出ることを確認する)
   - ASC API キー (.p8) のクラウド署名に Admin ロールを使うため、ランナーの
     Xcode Apple ID セッションは不要

## 手元の Mac から実行する場合 (フォールバック)

```sh
# spec 生成 → 検証 (キー不要。asc-submit の validate はオフラインで lint する)
python3 scripts/release/appstore-spec.py --version 1.1 --build 2
PYTHONPATH=~/dev/asc-submit python3 -m asc_submit validate --spec dist/appstore/release-1.1.json

# 反映・提出 (ASC API キー)
export ASC_KEY_PATH=… ASC_KEY_ID=… ASC_ISSUER=…
PYTHONPATH=~/dev/asc-submit python3 -m asc_submit run 6837503600 --spec dist/appstore/release-1.1.json [--submit]

# ビルドのアーカイブとアップロード (eyechecker と同じ env 名・同じ鍵ファイル)
EYECHECKER_ASC_API_KEY=~/.appstoreconnect/AuthKey_XXX.p8 \
EYECHECKER_ASC_API_KEY_ID=XXX EYECHECKER_ASC_API_ISSUER=00000000-… \
    scripts/release/appstore-upload.sh --version 1.1 --build 2 --upload
```

## メモ

- **スクリーンショット**: spec に含めない (ASC が前バージョンから引き継ぐ)。
  付け替えるときは ASC の画面か `asc-submit screenshots` で手動反映する
  (素材は `docs/store/screenshots/`)
- **リリース方式**: spec は `releaseType: AFTER_APPROVAL` (審査通過後に自動公開)。
  MANUAL に戻すときは ASC 側で直接 PATCH する
- **アプリ名・プロモーションテキスト**: spec に含めないため asc-submit は触らない。
  変更時は ASC 画面で手動反映する (現行名「ミミトレ - 英語の音が見える」)
- **提出時のサブスクリプション提出アイテム (v1.0 実測)**: 審査提出アイテムには
  サブスクリプション本体ではなく **subscriptionVersion**、グループは
  **subscriptionGroupVersion** を含める (本体 ID で POST すると 409 unknown
  relationship)。バージョンだけ提出された状態にしないこと — 提出後に API で
  `WAITING_FOR_REVIEW` をバージョン・両サブスクリプション・グループのすべてで
  確認し、抜けている場合は ASC 画面 / API で追加する (eyechecker と異なり
  サブスク課金アプリなので、submit モード実行後の確認を省略しない)
- **アップロード経路**: `xcrun altool --upload-app`（API キー認証）を使う。altool は
  非推奨になっており、将来の Xcode で廃止された場合は exportOptions の
  `destination` を `upload` に変えて `xcodebuild -exportArchive` にアップロードを
  任せれば同じ経路になる（その場合スクリプト内の `~/private_keys` への鍵複製も不要）
- **用途文字列**: upload スクリプトが生成直後の Info.plist とアーカイブ済み
  .app の Info.plist の両方で `NS*UsageDescription` を検査し、プラグインの
  デフォルト文 (プレースホルダ) が 1 つでも残っていれば失敗する
  (`docs/operations.md` §1.2 の恒久ゲートの自動化)
- **成果物の置き場所**: spec / アーカイブ / .ipa は `dist/appstore/` に出る
  (gitignore 済み)。アーカイブが 10 分以上進まないときは `dist/appstore/derived` と
  `dist/appstore/app.xcarchive` を削除して再試行する (eyechecker の実測と同じ)
