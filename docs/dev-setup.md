# 開発環境セットアップ (eng-listening)

Expo (React Native + TypeScript) アプリの開発手順。**CI は GitHub ホステッドランナーを使わない方針**のため、検証はすべてローカルで実施する (後述「ローカル検証」)。

## 1. 技術スタック

- React Native (Expo SDK 58, managed workflow) + TypeScript (strict)
- ルーティング: expo-router (ファイルベース)
- オーディオ: expo-audio (再生・シーク・速度変更・ロック画面コントロール)
- 識別子: iOS Bundle ID `com.takezou.englistening` / Android package `com.takezou.englistening` (**仮**)
  - 変更は **`src/config/appConfig.json` 1 箇所だけ編集**すれば `app.config.ts` と画面表示に自動反映される
  - `src/config/appConfig.ts` は型と派生定数 (速度リストなど) の再公開のみ。識別子の値を直接編集しないこと
- ビルド: EAS (development / preview / production の 3 プロファイル)

## 2. 必要ツール

| ツール | 用途 | メモ |
| --- | --- | --- |
| Node.js 24.x | npm scripts / Expo CLI | |
| Xcode (最新安定版) | iOS シミュレータ・ビルド | `pod install` 用に CocoaPods (`brew install cocoapods`) も必要 |
| Android Studio | Android エミュレータ (任意) | |
| EAS CLI (`npm i -g eas-cli`) | ビルド申請 | `eas init` の project ID は **手動で** `app.config.ts` の `extra.eas.projectId` に設定する (手順は下記 §5) |
| ffmpeg / say (macOS 標準) | サンプル音声の再生成 (任意) | `assets/audio/spike-sample.m4a` の作り方は下記 |

## 3. セットアップ

```bash
npm install
npx expo start          # expo-env.d.ts / .expo/types が自動生成される
```

iOS をローカルビルドして開発用クライアント (dev client) を作る:

```bash
npm run ios             # = expo run:ios (シミュレータ向けに Pod インストール & ビルド)
```

Android: `npm run android` (Android Studio のエミュレータが必要)。

## 4. ローカル検証 (CI の代わり)

**GitHub Actions のワークフローは作らない。** takezou621 個人アカウントのホステッドランナー分数が枯渇しているため。PR 前に以下を必ず実行する:

```bash
npm run lint            # eslint (eslint-config-expo)
npm run typecheck       # tsc --noEmit
```

両方通ればマージ可とする。実機/シミュレータでの動作確認は `npm run ios` → シミュレータで手動確認する。

### オーディオスパイクの確認手順

1. アプリを起動 → タブ「プレイヤー」→「オーディオスパイクを開く」(または設定タブからも開ける)
2. 「▶ 再生」で音声が流れることを確認
3. 「速度変更」チップ (0.7 / 0.85 / 1.0 / 1.2) を押して、声の高さが変わらないこと (ピッチ補正) を確認
4. 文カードをタップ → その文の冒頭へシークすることを確認。長押しで文リピート
5. 「ロック画面コントロールを有効化」→ 再生中にシミュレータ/実機をロック → ロック画面にタイトルと再生・±5秒シークのコントロールが出ることを確認

過去の実証結果とエビデンスは `docs/audio-spike.md` に記録している。

### 自動デモ (開発専用)

開発時のみ、`EXPO_PUBLIC_SPIKE_AUTO_DEMO=1` を付けて Metro を起動すると、アプリ起動直後にスパイク画面を開き `?demo=1` の自動デモ (再生 → 速度変更 → 文シーク → ロック画面有効化 → 停止) を実行する。シミュレータの自動検証用で、本番ビルドでは `__DEV__` ガードにより一切動作しない:

```bash
EXPO_PUBLIC_SPIKE_AUTO_DEMO=1 npx expo start --dev-client
```

## 5. EAS ビルド

```bash
eas init                                   # 初回のみ
eas build -p ios --profile development     # dev client (内部配布)
eas build -p ios --profile preview         # シミュレータ用ビルド (eas.json の preview が ios.simulator: true)
eas build -p android --profile preview     # APK
eas build -p ios --profile production      # ストア提出用 (要 Apple Developer 結合)
```

### EAS project ID の設定 (手動)

`app.config.ts` はオブジェクトを返す形式のため、`eas init` による `extra.eas.projectId` の自動書き換えが**行われない**。初回に次の手順で手動設定する:

1. `eas init` を実行 → 出力 (または https://expo.dev のダッシュボード) で project ID (UUID) を確認
2. `app.config.ts` の `extra.eas.projectId` にその UUID を書き込む
3. `npx expo config --type public` で `extra.eas.projectId` に反映されていることを確認

project ID が未設定のままでもローカル開発 (Metro / `expo run:ios`) は可能。EAS ビルド時のみ必須。

認証情報 (credentials) は `.gitignore` 済み。**CI ワークフローは作らない**こと (EAS CLI のローカル実行でビルドする)。

## 6. サンプル音声の再生成 (任意)

`assets/audio/spike-sample.m4a` は macOS の `say` + `ffmpeg` で生成した 14.24 秒・3 文の音読。
再生成する場合、文の区切りに 0.5 秒の無音を挟み、`src/features/spike/sample.ts` のタイムスタンプを実測値 (ffprobe の duration) に合わせて更新する。

## 7. 既知の制限・次フェーズへの引き継ぎ

- 音声はバンドル内サンプル 1 本のみ。実コンテンツ配信 (#4: R2+CDN) に接続する際はリモート URL を `AudioSource` に渡す形に差し替える
- タブアイコンは絵文字の仮置き。SF Symbols / Material Icons へ差し替え予定
- 設定画面は表示のみ。永続化は AsyncStorage 導入時 (#12/#19 関連) に実装
- CarPlay / Apple Watch は **v1.1 以降の必須要件** (entitlement 申請は v1.0 リリース後)。v1.0 のコードには含めない
