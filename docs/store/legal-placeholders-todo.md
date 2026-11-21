# 法務プレースホルダ確定記録

2026-11-21 に全項目が確定し、docs/legal/ と src/features/legal/legalContent.ts へ反映済み。

| 項目 | 確定値 |
|---|---|
| お問い合わせ先メール | support@33eigo.win |
| 販売者名 | 川合 毅 |
| 運営責任者名 | 川合 毅 |
| 所在地 | 非公開（請求があった場合は遅滞なく開示します） |
| 電話番号 | 非公開（請求があった場合は遅滞なく開示します） |
| 受付時間 | 平日 10:00〜19:00 |
| サポート URL | https://33eigo.win/support |
| プライバシーポリシー URL | https://33eigo.win/privacy |
| 著作権表記 (ASC) | © 2026 川合 毅 |

RevenueCat 公開 API キーは Mac mini の ~/dev/eng-listening/.env（EXPO_PUBLIC_REVENUECAT_API_KEY、リポジトリ外）に設定済み。ASC のサブスクリプション商品は 2026-11-21 に API で作成済み（annual ¥4,800 / monthly ¥680、JPN 提供、年額に 7 日間無料トライアル）。アプリの購入処理は RevenueCat の getOfferings() から商品 ID を取得する（config.ts の PRODUCT_IDS は参照用定数）。EAS チェックリストのキー登録項目は、EAS を使わないローカルビルド方式のため対象外。
