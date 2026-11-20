/**
 * 法務ドキュメントの文面 (プライバシーポリシー / 利用規約 / 特商法表記)。
 *
 * ※ この文面はドラフトです。最終確定は GM／オーナーが行います。
 * ※ docs/legal/ 配下の Markdown にも同じ内容を保存しています。
 *
 * プレースホルダ〈…〉は GM が差し替える項目です。
 */

import { DISPLAY_PRICES } from '@/features/billing/config';

export type LegalDocId = 'privacy' | 'terms' | 'tokushoho';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDoc {
  titleJa: string;
  titleEn: string;
  draftNoticeJa: string;
  draftNoticeEn: string;
  sectionsJa: LegalSection[];
  sectionsEn: LegalSection[];
}

const DRAFT_JA = '※ この文面はドラフトです。最終確定は GM／オーナーが行います。';
const DRAFT_EN = 'Note: This document is a draft. Final version will be approved by the GM / app owner.';

const CONTACT_JA = '〈お問い合わせ先メールアドレス〉';
const CONTACT_EN = '<contact email address>';

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  privacy: {
    titleJa: 'プライバシーポリシー',
    titleEn: 'Privacy Policy',
    draftNoticeJa: DRAFT_JA,
    draftNoticeEn: DRAFT_EN,
    sectionsJa: [
      {
        heading: '1. 収集する情報',
        paragraphs: [
          '本アプリは、学習記録（再生履歴・学習時間・シャドーイングの回数・お気に入り・苦手フレーズ）および初回診断の結果を、お使いの端末内にのみ保存します。',
          '録音したシャドーイング音声も端末内に保存され、アプリ外へ送信されることはありません（レッスンを離れると破棄されます）。',
          'アカウント登録は不要で、氏名・メールアドレス等の個人を特定する情報を収集しません。',
        ],
      },
      {
        heading: '2. 分析イベントについて',
        paragraphs: [
          'アプリの改善のため、起動・レッスン開始・完了・シャドーイング実施などの利用状況をイベントとして記録しています。',
          'これらのイベントは端末内のログとして保存されるのみで、v1.0 時点では外部へ送信されません。イベントには端末内の連番・ローカル時刻・イベント種別、および種別ごとの付随情報 (レッスン ID・学習秒数・診断の種類別正誤など) が含まれますが、個人を特定する情報は含まれません。',
          '外部送信を開始する場合は、事前に本ポリシーを改定してお知らせします。',
        ],
      },
      {
        heading: '3. 課金について',
        paragraphs: [
          'サブスクリプションの購入・復元は、Apple (App Store) および RevenueCat 経由で処理されます。決済情報は本アプリが保持せず、Apple のプライバシーポリシーに従います。',
        ],
      },
      {
        heading: '4. お問い合わせ',
        paragraphs: [`本ポリシーに関するお問い合わせは、${CONTACT_JA} までお願いします。`],
      },
      {
        heading: '5. ポリシーの改定',
        paragraphs: ['本ポリシーは予告なく改定されることがあります。改定後の内容は本画面に掲載した時点で効力を生じます。'],
      },
    ],
    sectionsEn: [
      {
        heading: '1. Information We Collect',
        paragraphs: [
          'This app stores your learning records (playback history, study time, shadowing counts, favorites, weak phrases) and first-run diagnostic results only on your device.',
          'Recorded shadowing audio is also stored on-device and is never sent outside the app (it is discarded when you leave a lesson).',
          'No account registration is required, and we do not collect personally identifiable information such as your name or email address.',
        ],
      },
      {
        heading: '2. Analytics Events',
        paragraphs: [
          'To improve the app, usage events (app launch, lesson start/completion, shadowing) are recorded.',
          'These events are stored in a local on-device log only and are NOT sent to any external service as of v1.0. Events contain a device-local sequence number, local timestamp, event type, and type-specific details (lesson ID, study seconds, diagnostic per-type results) — no personally identifiable information.',
          'If external collection is introduced in the future, this policy will be updated in advance.',
        ],
      },
      {
        heading: '3. Subscriptions',
        paragraphs: [
          'Subscription purchases and restoration are processed through Apple (App Store) and RevenueCat. Payment information is not retained by this app and is subject to Apple\u2019s privacy policy.',
        ],
      },
      {
        heading: '4. Contact',
        paragraphs: [`For questions about this policy, contact ${CONTACT_EN}.`],
      },
      {
        heading: '5. Changes to This Policy',
        paragraphs: ['This policy may be updated without notice. Changes take effect when posted on this screen.'],
      },
    ],
  },
  terms: {
    titleJa: '利用規約',
    titleEn: 'Terms of Service',
    draftNoticeJa: DRAFT_JA,
    draftNoticeEn: DRAFT_EN,
    sectionsJa: [
      {
        heading: '1. サービス内容',
        paragraphs: [
          '本アプリは、AI 生成コンテンツによる英語リスニング学習を提供します。レッスン音声・台本・リンキング注釈はすべて本アプリのパイプラインで生成したオリジナルコンテンツです。',
        ],
      },
      {
        heading: '2. サブスクリプション',
        paragraphs: [
          `${DISPLAY_PRICES.monthlyJa} / ${DISPLAY_PRICES.annualJa}。`,
          'サブスクリプションは自動更新されます。次回更新日の 24 時間前までに解約しない限り、契約は自動的に更新されます。',
          '解約は、端末の App Store アカウント設定からいつでも行えます。解約後も現在の契約期間の終了までは機能を利用できます。',
          '課金は Apple ID 決済（RevenueCat 経由）で処理されます。',
        ],
      },
      {
        heading: '3. 禁止事項',
        paragraphs: [
          '本アプリのコンテンツ（音声・台本・注釈）の無断複製・再配布・商用利用を禁止します。',
          'リバースエンジニアリング、アプリの改変、その他サービスの運営を妨害する行為を禁止します。',
        ],
      },
      {
        heading: '4. 免責事項',
        paragraphs: [
          '本アプリは「現状有姿」で提供され、学習効果の保証は行いません。',
          'アプリの利用により生じた損害について、運営者は一切の責任を負いません。',
          '予告なく機能の変更・提供終了を行うことがあります。',
        ],
      },
      {
        heading: '5. お問い合わせ',
        paragraphs: [`本規約に関するお問い合わせは、${CONTACT_JA} までお願いします。`],
      },
    ],
    sectionsEn: [
      {
        heading: '1. Service Description',
        paragraphs: [
          'This app provides English listening practice using AI-generated content. All lesson audio, scripts, and pronunciation notes are original content produced by the app\u2019s pipeline.',
        ],
      },
      {
        heading: '2. Subscription',
        paragraphs: [
          `${DISPLAY_PRICES.monthlyEn}; ${DISPLAY_PRICES.annualEn}.`,
          'Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period.',
          'You can cancel anytime from your App Store account settings. Access continues until the end of the current period.',
          'Payments are processed through your Apple ID (via RevenueCat).',
        ],
      },
      {
        heading: '3. Prohibited Acts',
        paragraphs: [
          'Unauthorized copying, redistribution, or commercial use of the app\u2019s content (audio, scripts, notes) is prohibited.',
          'Reverse engineering, modification of the app, or any act that interferes with the service is prohibited.',
        ],
      },
      {
        heading: '4. Disclaimer',
        paragraphs: [
          'The app is provided “as is”, without any guarantee of learning outcomes.',
          'The operator is not liable for any damages arising from use of the app.',
          'Features may change or the service may be discontinued without notice.',
        ],
      },
      {
        heading: '5. Contact',
        paragraphs: [`For questions about these terms, contact ${CONTACT_EN}.`],
      },
    ],
  },
  tokushoho: {
    titleJa: '特定商取引法に基づく表記',
    titleEn: 'Information Based on the Act on Specified Commercial Transactions',
    draftNoticeJa: DRAFT_JA,
    draftNoticeEn: DRAFT_EN,
    sectionsJa: [
      { heading: '販売者', paragraphs: ['〈販売者名〉'] },
      { heading: '運営責任者', paragraphs: ['〈運営責任者名〉'] },
      { heading: '所在地', paragraphs: ['〈所在地〉'] },
      { heading: 'お問い合わせ', paragraphs: ['〈メールアドレス〉（受付時間: 〈平日 10:00〜18:00〉）'] },
      { heading: '電話番号', paragraphs: ['〈電話番号〉（請求があった場合は遅滞なく開示します）'] },
      { heading: '販売価格', paragraphs: [`${DISPLAY_PRICES.monthlyJa} / ${DISPLAY_PRICES.annualJa}。Apple App Store を通じて課金されます。`] },
      { heading: '支払方法', paragraphs: ['Apple ID 決済（RevenueCat 経由）'] },
      { heading: 'サービスの提供時期', paragraphs: ['購入後、アプリ内で即時に利用可能'] },
      { heading: 'キャンセル・解約について', paragraphs: ['サブスクリプションは自動更新です。解約は App Store のアカウント設定から次回更新日の 24 時間前までに行えます。'] },
      { heading: '返金について', paragraphs: ['返金は Apple のポリシーに従います。詳細は Apple サポートにお問い合わせください。'] },
    ],
    sectionsEn: [
      { heading: 'Seller', paragraphs: ['<seller name>'] },
      { heading: 'Operator', paragraphs: ['<operator name>'] },
      { heading: 'Location', paragraphs: ['<address>'] },
      { heading: 'Contact', paragraphs: ['<email address> (hours: <weekdays 10:00-18:00>)'] },
      { heading: 'Phone Number', paragraphs: ['<phone number> (disclosed upon request without delay)'] },
      { heading: 'Price', paragraphs: [`${DISPLAY_PRICES.monthlyEn}; ${DISPLAY_PRICES.annualEn}. Billed through the Apple App Store.`] },
      { heading: 'Payment Method', paragraphs: ['Apple ID payment (via RevenueCat)'] },
      { heading: 'Timing of Service', paragraphs: ['Available in-app immediately after purchase'] },
      { heading: 'Cancellation', paragraphs: ['Subscriptions auto-renew. Cancel from your App Store account settings at least 24 hours before the next renewal date.'] },
      { heading: 'Refunds', paragraphs: ['Refunds follow Apple\u2019s policy. Contact Apple Support for details.'] },
    ],
  },
};

export function getLegalDoc(id: LegalDocId): LegalDoc {
  return LEGAL_DOCS[id];
}
