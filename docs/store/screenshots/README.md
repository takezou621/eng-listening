# スクリーンショット撮影手順 (2026-11-21 実施)

提出用スクリーンショットはこのディレクトリに 2 サイズ × 7 画面で保存しています。

| サイズ | デバイス (シミュレータ) | 解像度 | 用途 (ASC) |
|---|---|---|---|
| 6.9 インチ | iPhone 18 Pro Max (iOS 27.0) | 1320×2868 | iPhone 6.9" 用スクリーンショット |
| 6.7 インチ | iPhone 14 Plus (iOS 27.0) | 1284×2778 | iPhone 6.7" 用スクリーンショット |

## 撮影に使用したビルド

```
# main fa78256 以降 (PR #39 マージ済み) の作業ブランチで
npm ci
npx expo prebuild --platform ios
cd ios && pod install && cd ..

# シミュレータ用 Release ビルド (コード署名なしで可)
xcodebuild build \
  -workspace ios/app.xcworkspace \
  -scheme app \
  -configuration Release \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build/sim-derived \
  CODE_SIGNING_ALLOWED=NO
```

生成物: `ios/build/sim-derived/Build/Products/Release-iphonesimulator/app.app`
(ローカル JS バンドル埋め込み済みのため Metro なしで起動します)

## 撮影手順

```
UDID=<シミュレータの UDID>
SIMAPP=ios/build/sim-derived/Build/Products/Release-iphonesimulator/app.app

xcrun simctl boot $UDID
xcrun simctl install $UDID $SIMAPP
xcrun simctl launch $UDID com.takezou.englistening
sleep 12   # JS バンドルの起動完了を待つ
xcrun simctl io $UDID screenshot <出力先>.png
```

画面遷移は deep link (`xcrun simctl openurl <UDID> "englistening://..."`) または
撮影用ビルド (`EXPO_PUBLIC_SHOT_ROUTE="/<route>"` をビルド時に与えると起動直後に
そのルートへ遷移する。docs/legal の撮影では使用していない) で行う。

## 撮影画面とファイル名

| # | 画面 | 遷移方法 | 6.9" ファイル | 6.7" ファイル |
|---|---|---|---|---|
| 1 | オンボーディング診断 (イントロ) | 初回起動で自動表示 | 01-onboarding-intro-69.png | 01-onboarding-intro-67.png |
| 2 | 診断の問題画面 (音声再生 + 選択肢) | 診断をはじめる ボタン | 02-diagnostic-question-69.png | 02-diagnostic-question-67.png |
| 3 | カラオケ表示 + リンキング可視化 (現在文 + 注釈 + IPA) | レッスン再生画面 | 03-karaoke-linking-69.png | 03-karaoke-linking-67.png |
| 4 | チャンク表示 (塊ごとの区切り) | カラオケ/チャンク切替チップ | 04-chunk-69.png | 04-chunk-67.png |
| 5 | シャドーイング (録音 + お手本比較) | 文カードの録音行 | 05-shadowing-69.png | 05-shadowing-67.png |
| 6 | ペイウォール (価格・トライアル・解約方法) | 設定 → プレミアムについて | 06-paywall-69.png | 06-paywall-67.png |
| 7 | ライブラリ (全 12 レッスン + フィルタ) | ホームタブ | 07-library-69.png | 07-library-67.png |

## 注意事項

- 個人情報・API キー・.env の値は画面に表示されない設計のため、目視確認で該当なし
- スクリーンショットは実レッスン (12 本) の実データを使用。ダミー文言・空状態なし
- 6.9 インチ: iPhone 16 Pro Max が iOS 27.1 ランタイムと非互換のため、
  iPhone 18 Pro Max (iOS 27.0 ランタイム) を使用 (画面サイズは同一 1320×2868)
- 6.7 インチ: iPhone 14 Plus (iOS 27.0 ランタイム) を使用 (1284×2778)
