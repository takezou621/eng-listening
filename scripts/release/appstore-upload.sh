#!/usr/bin/env bash

set -euo pipefail

# ミミトレ (iOS / Expo CNG) の App Store Connect 配布ビルドをアーカイブし、
# App Store 用に署名・アップロードする (eyechecker scripts/release/appstore-upload.sh
# と同じ流儀。アップロードだけでは審査は始まらない — メタデータ反映と提出は
# appstore.yml ワークフローの apply / submit モード)。
#
# eyechecker との違い (Expo 前提):
#   - ネイティブプロジェクトは xcodegen ではなく `npx expo prebuild` で生成する (CNG。
#     /ios は gitignore 済みの生成物で、常に作り直す)
#   - ビルド番号はビルド設定ではなく生成された ios/app/Info.plist のリテラル
#     CFBundleVersion に PlistBuddy で差し込む (docs/operations.md §1 の実運用と同じ。
#     バージョンは src/config/appConfig.json → prebuild が CFBundleShortVersionString に焼く)
#   - 用途文字列ゲート: 生成直後の Info.plist の全 NS*UsageDescription を検査し、
#     プラグインのデフォルト文 (プレースホルダ) が 1 つでも残っていればアーカイブ前に
#     失敗する (docs/operations.md §1.2 の恒久ゲート。v1.0 で実審査リジェクトされた経緯)
#
# Usage: scripts/release/appstore-upload.sh --version 1.1 --build 2 [--upload]
# (実行例・環境変数は usage を参照)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKSPACE="ios/app.xcworkspace"
SCHEME="app"
INFO_PLIST="ios/app/Info.plist"

# App Store Connect API キー (CI では必須。ローカルでは省略可 — その場合は Xcode の
# Apple ID セッションで証明書・プロファイルを作る)。
# **変数名は EYECHECKER_ASC_API_* とわざと同じ固有名**にしてある (eyechecker と同じ
# env 名・同じ鍵ファイルを使い回す運用のため。asc-submit 本体の ASC_KEY_* とは混線しない)。
# クラウド署名 (配布証明書の自動作成) には **Admin ロール** のキーが要る。
KEY_PATH="${EYECHECKER_ASC_API_KEY:-}"
KEY_ID="${EYECHECKER_ASC_API_KEY_ID:-}"
ISSUER="${EYECHECKER_ASC_API_ISSUER:-}"
TEAM_ID="${EYECHECKER_TEAM_ID:-4B873Q67MK}"
OUTPUT_DIR="${EYECHECKER_OUTPUT_DIR:-$ROOT_DIR/dist/appstore}"
STAMP_VERSION=""
STAMP_BUILD=""
UPLOAD=false

# 用途文字列ゲートの確定文 (docs/operations.md §1.2 / app.config.ts の文面と一致させる)。
# マイク用途文はこの接頭辞で始まっていることを要求する
EXPECTED_MIC_PREFIX="シャドーイング練習であなたの発音を録音し"
# プラグイン初期文 (プレースホルダ) の検出パターン。Expo のデフォルト文は
# "Allow $(PRODUCT_NAME) to access your microphone" 形
PLACEHOLDER_RE='allow .* to access|access your (microphone|camera|photo)|app needs|\$\(|\$\{'

usage() {
    cat <<'EOF'
Usage: scripts/release/appstore-upload.sh --version VERSION --build NUMBER [--upload]

ミミトレ (Expo) をアーカイブして App Store Connect 用 .ipa を書き出します
(--upload でアップロードまで実行)。

Options:
  --version VERSION     CFBundleShortVersionString に要求する値 (例 1.1)。
                        src/config/appConfig.json の version と一致している必要がある
  --build NUMBER        CFBundleVersion に差し込む (前回の提出より大きい値)
  --upload              書き出したビルドを App Store Connect へアップロードする
                        (アップロードだけでは審査は始まらない。メタデータ反映と提出は
                        appstore.yml ワークフローの apply / submit モード)
  --output-dir DIR      成果物の出力先 (既定: dist/appstore)
  --team-id ID          Developer Team ID (既定: 4B873Q67MK)

Environment:
  EYECHECKER_ASC_API_KEY       App Store Connect API キー (.p8) のパス。
                               --upload では必須。省略時は Xcode の Apple ID セッションで
                               プロビジョニングする (クラウド署名には Admin ロールのキーが必要)
  EYECHECKER_ASC_API_KEY_ID    キー ID (EYECHECKER_ASC_API_KEY とセットで指定)
  EYECHECKER_ASC_API_ISSUER    issuer ID (同上)
  EYECHECKER_TEAM_ID           Developer Team ID
  EYECHECKER_OUTPUT_DIR        成果物の出力先
  EXPO_PUBLIC_REVENUECAT_API_KEY
                               RevenueCat の公開キー。この環境変数か .env の
                               EXPO_PUBLIC_REVENUECAT_API_KEY= 行が必要 (JS バンドルに焼かれる。
                               値はログに表示しない)

例:
  # ASC API キーでアーカイブ〜アップロードまで (CI と同じ経路)
  EYECHECKER_ASC_API_KEY=~/.appstoreconnect/AuthKey_XXX.p8 \
  EYECHECKER_ASC_API_KEY_ID=XXX EYECHECKER_ASC_API_ISSUER=00000000-... \
      scripts/release/appstore-upload.sh --version 1.1 --build 2 --upload

  # この Mac で完結 — Xcode の Apple ID セッションで証明書・プロファイルを作る
  # (アップロードはしない。.ipa の検証用)
  scripts/release/appstore-upload.sh --version 1.1 --build 2
EOF
}

log() { echo "appstore: $*"; }
die() { echo "appstore: エラー: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --upload) UPLOAD=true ;;
        --version) STAMP_VERSION="${2:?}"; shift ;;
        --build) STAMP_BUILD="${2:?}"; shift ;;
        --output-dir) OUTPUT_DIR="${2:?}"; shift ;;
        --team-id) TEAM_ID="${2:?}"; shift ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; die "不明なオプション: $1" ;;
    esac
    shift
done

# バージョンは 1〜3 個の整数をドット区切り。ビルド番号は整数。不正値は
# アーカイブ開始前に弾く
if [ -n "$STAMP_VERSION" ] && ! [[ "$STAMP_VERSION" =~ ^[0-9]+([.][0-9]+){0,2}$ ]]; then
    die "--version は 1〜3 個の整数をドット区切りで指定してください (例 1.1): $STAMP_VERSION"
fi
if [ -z "$STAMP_BUILD" ]; then
    die "--build は必須です (前回の提出より大きい整数。生成した Info.plist の CFBundleVersion に差し込む)"
fi
if ! [[ "$STAMP_BUILD" =~ ^[0-9]+$ ]]; then
    die "--build は整数で指定してください (前回の提出より大きい値): $STAMP_BUILD"
fi
# --upload は「そのまま App Store Connect に載る」経路。バージョンを指定せずに
# 走らせると古い値でアーカイブしてビルド番号の重複で拒否されるまで高コストな
# ビルドを費やす
if [ "$UPLOAD" = true ] && [ -z "$STAMP_VERSION" ]; then
    die "--upload には --version と --build が必要です"
fi

# ASC API キーは 3 変数をすべて指定するかすべて省略する。片方だけの指定は設定漏れ
if [ -n "$KEY_PATH" ] || [ -n "$KEY_ID" ] || [ -n "$ISSUER" ]; then
    { [ -n "$KEY_PATH" ] && [ -n "$KEY_ID" ] && [ -n "$ISSUER" ]; } \
        || die "EYECHECKER_ASC_API_KEY / _KEY_ID / _ISSUER は 3 つとも指定するか、すべて省略してください"
    [ -f "$KEY_PATH" ] || die "API キーが見つかりません: $KEY_PATH"
    # 相対パスのままだと、この後の cd "$ROOT_DIR" を挟んだ xcodebuild 呼び出しで
    # 解決できなくなるため絶対化する
    KEY_PATH="$(cd "$(dirname "$KEY_PATH")" && pwd)/$(basename "$KEY_PATH")"
fi
if [ "$UPLOAD" = true ] && [ -z "$KEY_PATH" ]; then
    die "--upload には ASC API キー (EYECHECKER_ASC_API_KEY / _KEY_ID / _ISSUER) が必要です。" \
        "キーは ASC の「ユーザとアクセス → 統合」で発行した Admin ロールの .p8 を使ってください" \
        "(クラウド署名は Admin 限定。Xcode の Apple ID セッションでは altool のアップロードが行えません)"
fi

# 相対パスの --output-dir は cd の前に絶対化する
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"

if [ -n "$KEY_PATH" ]; then
    AUTH_ARGS=(
        -authenticationKeyPath "$KEY_PATH"
        -authenticationKeyID "$KEY_ID"
        -authenticationKeyIssuerID "$ISSUER"
    )
    log "ASC API キーを使用: $KEY_PATH"
else
    # 認証キーを渡さなければ -allowProvisioningUpdates が Xcode の Apple ID
    # セッションを使う — 配布証明書・プロファイルの自動作成はこのフラグで有効になる
    AUTH_ARGS=()
    log "ASC API キー未指定 — Xcode の Apple ID セッションでプロビジョニング"
fi

cd "$ROOT_DIR"

# ランナー前提 (docs/appstore/README.md「初回セットアップ」)。欠けている場合は
# npm ci の前に落とす (途中で止まっても無駄な時間と部分状態を作らない)
for TOOL in node npx pod xcodebuild; do
    command -v "$TOOL" >/dev/null 2>&1 \
        || die "$TOOL が見つかりません (ランナーの PATH を確認してください — Node.js と CocoaPods が要る。docs/appstore/README.md「初回セットアップ」)"
done

# ---- 1/7 依存関係 ----------------------------------------------------------
log "[1/7] npm ci (依存関係をロックファイルどおりにインストール)"
npm ci --no-audit --no-fund

# RevenueCat の公開キーは JS バンドルに焼かれる (EXPO_PUBLIC_* は Expo が .env からも
# 読む)。無いまま prebuild すると、課金が動かないバイナリをアーカイブしてしまう。
# 値は絶対に表示しない
if [ -z "${EXPO_PUBLIC_REVENUECAT_API_KEY:-}" ] \
    && ! grep -Eq '^EXPO_PUBLIC_REVENUECAT_API_KEY=.+$' "$ROOT_DIR/.env" 2>/dev/null; then
    die "EXPO_PUBLIC_REVENUECAT_API_KEY がありません (環境変数または .env の" \
        "EXPO_PUBLIC_REVENUECAT_API_KEY= 行)。値をログに出さないこと — 設定はオペレータが行う"
fi
log "EXPO_PUBLIC_REVENUECAT_API_KEY: 設定を確認 (値は非表示)"

# ---- 2/7 ネイティブプロジェクト生成 ----------------------------------------
# /ios は gitignore 済みの生成物 (CNG)。--clean で既存の ios/ を消してから常に
# 作り直す (self-hosted ランナーやローカルはジョブ間で /ios を残すため、--clean
# なしでは古いプロジェクトに sync が走る。--no-install と併用可 — pod install は
# 5/7 で自分で行う)
log "[2/7] expo prebuild で ios プロジェクトを生成"
CI=1 npx expo prebuild --platform ios --clean --no-install

# ---- 3/7 バージョン・ビルド番号の確認と差し込み -----------------------------
log "[3/7] Info.plist のバージョン確認と CFBundleVersion 差し込み"
[ -f "$INFO_PLIST" ] || die "prebuild 後に $INFO_PLIST がありません"
PLIST_BUDDY=/usr/libexec/PlistBuddy
if [ -n "$STAMP_VERSION" ]; then
    GOT_VERSION="$($PLIST_BUDDY -c 'Print :CFBundleShortVersionString' "$INFO_PLIST")"
    [ "$GOT_VERSION" = "$STAMP_VERSION" ] \
        || die "Info.plist の CFBundleShortVersionString が $GOT_VERSION です (要求: $STAMP_VERSION)。" \
               "src/config/appConfig.json の version を --version に合わせてから再実行してください"
fi
$PLIST_BUDDY -c 'Set :CFBundleVersion '"$STAMP_BUILD" "$INFO_PLIST"
log "CFBundleVersion = $STAMP_BUILD ($(plutil -extract CFBundleShortVersionString raw "$INFO_PLIST"))"

# ---- 4/7 用途文字列ゲート (docs/operations.md §1.2 恒久ゲート) ---------------
# プラグインのデフォルト文が 1 つでも残っていればアーカイブ前に落とす
# (v1.0 で NSMicrophoneUsageDescription のデフォルト文が実審査でリジェクトされた経緯)
log "[4/7] 用途文字列ゲート: $INFO_PLIST の全 NS*UsageDescription を検査"
USAGE_KEYS="$($PLIST_BUDDY -c 'Print' "$INFO_PLIST" | grep -oE '^    NS[A-Za-z]+UsageDescription' | tr -d ' ' | sort -u || true)"
if [ -z "$USAGE_KEYS" ]; then
    log "  NS*UsageDescription なし (権限を要求しないビルド)"
fi
for KEY in $USAGE_KEYS; do
    VALUE="$($PLIST_BUDDY -c "Print :$KEY" "$INFO_PLIST")"
    log "  $KEY = $VALUE"
    if grep -Eqi "$PLACEHOLDER_RE" <<<"$VALUE"; then
        die "$KEY がプレースホルダ文のままです: \"$VALUE\"。" \
            "app.config.ts (infoPlist / プラグイン設定) の用途文を具体化してから再実行してください" \
            "(docs/operations.md §1.2 — プレースホルダ文のままの提出は禁止)"
    fi
    if [ "$KEY" = "NSMicrophoneUsageDescription" ]; then
        case "$VALUE" in
            "$EXPECTED_MIC_PREFIX"*)
                # 確定文。レコード用の監査ログは上の log で出済み
                ;;
            *)
                die "NSMicrophoneUsageDescription が確定文ではありません。" \
                    "「${EXPECTED_MIC_PREFIX}…」で始まる app.config.ts の確定文である必要があります (docs/operations.md §1.2)" \
                    "実際の値: \"$VALUE\""
                ;;
        esac
    fi
done

# ---- 5/7 CocoaPods ----------------------------------------------------------
log "[5/7] pod install (ロケールを UTF-8 に固定 — Ruby が日本語アプリ名で落ちるため)"
(cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install)

# ---- 6/7 アーカイブ ----------------------------------------------------------
ARCHIVE_PATH="$OUTPUT_DIR/app.xcarchive"
log "[6/7] xcodebuild archive (scheme=$SCHEME, generic/platform=iOS)"
# "${AUTH_ARGS[@]+...}" は配列が空のときの set -u 対策 (macOS 標準の bash 3.2 は
# 空配列展開でエラーになる)。AUTH_ARGS が空でも -allowProvisioningUpdates は
# 常に渡す — Apple ID セッションのプロビジョニングはこのフラグで有効になる
xcodebuild archive \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -derivedDataPath "$OUTPUT_DIR/derived" \
    -archivePath "$ARCHIVE_PATH" \
    CODE_SIGN_STYLE=Automatic \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    -allowProvisioningUpdates \
    ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"}

# アーカイブの中身を検証する — バージョン・ビルドが要求どおり入っているか
# (アップロード後の ASC での拒否をアーカイブ時点で弾く)。用途文字列ゲートも
# **最終バイナリ**の Info.plist で再検査する (operations.md §1.2: 判定は常に
# 最終成果物で行う — 設定ファイルの正しさは提出可否の判定に使わない)
APP_IN_ARCHIVE="$(find "$ARCHIVE_PATH/Products/Applications" -maxdepth 1 -name '*.app' -print -quit 2>/dev/null || true)"
[ -n "$APP_IN_ARCHIVE" ] || die "アーカイブに .app がありません: $ARCHIVE_PATH/Products/Applications"
APP_PLIST="$APP_IN_ARCHIVE/Info.plist"
if [ -n "$STAMP_VERSION" ]; then
    GOT_VERSION="$(plutil -extract CFBundleShortVersionString raw "$APP_PLIST")"
    [ "$GOT_VERSION" = "$STAMP_VERSION" ] \
        || die "アーカイブのバージョンが $GOT_VERSION です (要求: $STAMP_VERSION)"
fi
GOT_BUILD="$(plutil -extract CFBundleVersion raw "$APP_PLIST")"
[ "$GOT_BUILD" = "$STAMP_BUILD" ] \
    || die "アーカイブのビルド番号が $GOT_BUILD です (要求: $STAMP_BUILD)"
log "アーカイブ検証 OK: version=$STAMP_VERSION build=$STAMP_BUILD ($APP_IN_ARCHIVE)"
for KEY in $(plutil -convert xml1 -o - "$APP_PLIST" | grep -oE 'NS[A-Za-z]+UsageDescription' | sort -u || true); do
    VALUE="$(plutil -extract "$KEY" raw "$APP_PLIST")"
    log "  アーカイブ $KEY = $VALUE"
    if grep -Eqi "$PLACEHOLDER_RE" <<<"$VALUE"; then
        die "アーカイブの $KEY がプレースホルダ文のままです (最終バイナリ監査 — docs/operations.md §1.2): \"$VALUE\""
    fi
done

# ---- 7/7 エクスポートとアップロード ------------------------------------------
# exportOptions は App Store 配布。signingStyle automatic により、プロファイルが
# 無ければ -allowProvisioningUpdates が (API キー経由で) 作成する
EXPORT_OPTIONS="$OUTPUT_DIR/exportOptions.plist"
cat > "$EXPORT_OPTIONS" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>destination</key>
    <string>export</string>
    <key>teamID</key>
    <string>$TEAM_ID</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>uploadSymbols</key>
    <true/>
</dict>
</plist>
EOF

log "[7/7] .ipa を書き出し (App Store Connect 配布)"
if ! xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$OUTPUT_DIR" \
    -exportOptionsPlist "$EXPORT_OPTIONS" \
    -allowProvisioningUpdates \
    ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"}; then
    if [ -n "$KEY_PATH" ]; then
        die "エクスポートに失敗しました (エラー文は上のとおり)。\"Cloud signing permission error\" なら、" \
            "EYECHECKER_ASC_API_KEY のキーにクラウド署名の権限がありません (Admin が必要)。" \
            "発行済みキーの権限は後から変更できないため、Admin ロールの新しいチーム API キーを作って" \
            " EYECHECKER_ASC_API_KEY* を差し替えてください"
    fi
    die "エクスポートに失敗しました (エラー文は上のとおり)。\"Cloud signing permission error\" /" \
        "\"No signing certificate\" なら、Xcode の Settings > Accounts でチームにサインインしているか" \
        "(セッション切れでないか) を確認してください"
fi

IPA_PATH="$(find "$OUTPUT_DIR" -maxdepth 1 -name '*.ipa' -print -quit 2>/dev/null || true)"
[ -n "$IPA_PATH" ] || die "エクスポート後に .ipa が見つかりません: $OUTPUT_DIR"
log ".ipa を書き出し: $IPA_PATH"

if [ "$UPLOAD" = true ]; then
    # altool は -authenticationKeyPath を受け取らないため、キーを
    # ~/private_keys/AuthKey_<ID>.p8 (既定の探索ディレクトリ) に置いてから
    # --apiKey / --apiIssuer で参照する。値は表示しない。
    # 複製した鍵は **EXIT trap で必ず消す** (altool 失敗時は set -e で抜けるため。
    # Admin ロールの鍵を self-hosted ランナーに残さない — workflow の cleanup が
    # RUNNER_TEMP/asc しか消さないため、こちらの面倒はこのスクリプトが見る)
    mkdir -p "$HOME/private_keys"
    COPIED_KEY="$HOME/private_keys/AuthKey_${KEY_ID}.p8"
    # 鍵が既に探索先そのものにある場合はコピーしない (コピー元と先が同じだと
    # cp が自滅し、EXIT trap の rm で原本まで消してしまうため)
    KEY_IS_TEMP_COPY=false
    if [ "$KEY_PATH" != "$COPIED_KEY" ]; then
        cp -f "$KEY_PATH" "$COPIED_KEY"
        chmod 600 "$COPIED_KEY"
        KEY_IS_TEMP_COPY=true
        trap 'rm -f "$COPIED_KEY"' EXIT
    fi
    log "App Store Connect へアップロード (altool, API キー認証)"
    xcrun altool --upload-app -f "$IPA_PATH" -t ios --apiKey "$KEY_ID" --apiIssuer "$ISSUER"
    if [ "$KEY_IS_TEMP_COPY" = true ]; then
        rm -f "$COPIED_KEY"
        trap - EXIT
    fi
    log "アップロード完了 ($IPA_PATH)。ASC でビルドが VALID になるのを待ってから" \
        "appstore.yml ワークフローの apply (build 指定) → submit を実行してください"
else
    log "完了: $IPA_PATH (--upload を付けると ASC へアップロードします)"
fi
