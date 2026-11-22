---
name: ios-release-gate
description: >-
  Use this skill when preparing an iOS TestFlight build or App Store submission for
  eng-listening (ミミトレ). Covers all mandatory pre-submission gates (final-binary
  NS*UsageDescription audit, Light/Dark screenshots, W8 diagnostic audit, iPhone Duo XCUITest),
  local xcodebuild archive, and App Store Connect API submission.
---

# iOS リリース・審査提出ゲート（ミミトレ）

正本: `docs/operations.md`（EAS クラウドビルドは不使用。Mac mini ローカル Archive + ASC API アップロードが正規経路）。

## 1. 提出前必須ゲート（1 つでも未達なら提出禁止）

1. **コード品質**: `main` がクリーンで `npm run lint && npm run typecheck` が PASS。
2. **Light / Dark 両モード確認（W7）**: 全画面をライト・ダーク両方で実画面撮影し文字視認性を確認。
3. **診断設問の全問目視（W8）**: 設問文に正解が含まれないこと、選択肢位置が固定されていないことを確認。
4. **iPhone Duo セーフエリア検証（§1.1）**: `tools/duo/` の XCUITest が 2 件 PASS し、`DUO-EVIDENCE` で右端 ≤ 366pt。
5. **最終バイナリの用途文字列監査（§1.2・絶対必須）**:
   - `app.config.ts` ではなく **最終成果物（`.xcarchive` 内 `.app/Info.plist` または `.ipa` 展開後の `.app/Info.plist`）** から全 `NS*UsageDescription` を抽出し目視確認する。
   - コマンド例:
     ```bash
     /usr/libexec/PlistBuddy -c "Print" <path/to/app.app/Info.plist> | grep -E "UsageDescription"
     ```
   - `"Allow ... to access your ..."` のようなプラグイン既定文・汎用文が 1 つでも残っていれば **提出禁止**。
   - 「どの機能で・何のために・データをどう扱うか（外部送信の有無）」が具体的に書かれていることを確認し、一覧を提出報告に記録する。

## 2. バージョン・ビルド番号と環境確認

- バージョン正本: `src/config/appConfig.json`。
- ビルド番号実体: `ios/app/Info.plist` のリテラル `CFBundleVersion`（`CURRENT_PROJECT_VERSION` ではない）。提出ごとに PlistBuddy で +1 し、**アーカイブ後は作業ツリーを汚さないよう元に戻す**。
- `.env` に `EXPO_PUBLIC_REVENUECAT_API_KEY` が設定済みであることを確認（**値は絶対に表示・記録しない**）。

## 3. ローカル Archive & ASC アップロードの注意点

- `npx expo prebuild --platform ios` → `ios/` 内で `LANG=en_US.UTF-8 pod install`（ロケール未設定だと日本語アプリ名で Ruby が落ちる）。
- `xcodebuild archive`:
  - `DEVELOPMENT_TEAM=4B873Q67MK` を明示指定（prebuild はチーム未設定で生成するため）。
  - SSH セッションではログインキーチェーンがロックされ `errSecInternalComponent` になるため、GUI セッションへ bootstrap した一時 LaunchAgent 経由で実行する。
  - **署名エラー時は証明書を削除・再発行しない**。エラー全文を記録して停止・報告する。
- ASC API アップロード: `~/.appstoreconnect/AuthKey_8HM846FQ5Z.p8` と `~/.appstoreconnect/eyechecker-local-upload.env` を使用（鍵の中身は出力厳禁）。
- アップロード後、ASC API の `builds` で対象ビルドが `VALID` になったことを確認する。

## 4. ASC 審査提出時の落とし穴

- メタデータ正本: `docs/store/listing-ja-final.md`、スクリーンショット: `docs/store/screenshots/`。
- `reviewSubmissionItems` にはサブスクリプション本体 ID ではなく **`subscriptionVersion`**、グループ本体ではなく **`subscriptionGroupVersion`** を追加する（本体 ID だと 409 unknown relationship になる）。
- 提出後、アプリバージョン・両サブスクリプション・グループの **すべてが `WAITING_FOR_REVIEW`** であることを API で確認する。
