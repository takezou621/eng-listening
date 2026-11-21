# 法務ドキュメントの残プレースホルダ一覧 (オーナー確定待ち)

> ⚠ **勝手に実在の個人情報で埋めないこと。** 以下はオーナーが確定して差し替える項目です。
> 対象ファイル: docs/legal/privacy-policy.md / docs/legal/terms-of-service.md / docs/legal/tokushoho.md
> アプリ内表示 (src/features/legal/legalContent.ts) も同じプレースホルダを保持しています。

## 一覧 (8 項目)

| # | 項目 | 現状値 (プレースホルダ) | 確定に必要な情報 | 影響ファイル |
|---|---|---|---|---|
| 1 | お問い合わせ先メールアドレス | 〈お問い合わせ先メールアドレス〉 | 公開用メールアドレス (privacy / terms の問い合わせ先。ドメイン付き推奨) | privacy-policy.md, terms-of-service.md, legalContent.ts (privacy/terms), tokushoho.md |
| 2 | 販売者名 (特商法) | 〈販売者名〉 | 特商法上の販売事業主の氏名・屋号 | tokushoho.md |
| 3 | 運営責任者名 (特商法) | 〈運営責任者名〉 | 特商法上の運営責任者の実名 | tokushoho.md |
| 4 | 所在地 (特商法) | 〈所在地〉 | 特商法上の所在地 (住所) | tokushoho.md |
| 5 | お問い合わせメール (特商法) | 〈メールアドレス〉 | 特商法表記用の連絡先メールアドレス | tokushoho.md |
| 6 | 受付時間 (特商法) | 〈平日 10:00〜18:00〉 | 連絡先の受付曜日・時間帯 | tokushoho.md |
| 7 | 電話番号 (特商法) | 〈電話番号〉（請求があった場合は遅滞なく開示します） | 特商法上の電話番号。非公開とする場合は「請求があった場合は遅滞なく開示します」の注記は現状維持 | tokushoho.md |
| 8 | サポート / マーケティング URL (ASC) | 〈オーナー確定待ち〉 | ASC のサポート URL (必須) とマーケティング URL (任意)。ドメイン確定後に設定 | listing-ja-final.md (ASC 入力用) |

## 関連する未確定事項 (プレースホルダ以外)

| 項目 | 現状 | 備考 |
|---|---|---|
| ASC アプリ表示名 | 「ミミトレ - 英語の音が見える」(GM 決定済み 2026-11-21) | ASC アプリレコード作成時に入力 |
| RevenueCat 公開 API キー | 未設定 (EXPO_PUBLIC_REVENUECAT_API_KEY 環境変数) | RevenueCat プロジェクト作成後に設定 |
| ストア商品 ID | プレースホルダ (placeholder_englistening_monthly_680 / _annual_4800) | ASC での商品作成後に RevenueCat 側で紐づけ (コードでは未使用。取得は getOfferings 経由) |
| copyright 表記 (ASC) | © 2026 〈オーナー名〉 | ASC アプリ情報の著作権欄 |

## 確定手順の目安

1. オーナーが上記 1〜7 の情報を確定する
2. docs/legal/ 3 点と src/features/legal/legalContent.ts の該当プレースホルダを置き換える
   (両側を必ず同期すること)
3. ASC のメタデータ (サポート URL・copyright 等) に入力する
4. 最終確認後、ドラフト表示 (「※ この文面はドラフトです…」) を削除する
