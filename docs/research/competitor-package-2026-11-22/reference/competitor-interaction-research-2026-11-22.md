# 競合アプリ インタラクションUX調査（操作・遷移 編）— 2026-11-22

前回の静止画ベースの画面比較（`competitor-ui-comparison-2026-11-21.md`）に続き、本調査は「操作と遷移のUX」に焦点を当てた。対象は Duolingo / ELSA Speak / Speak（スピーク）/ スピークバディ / abceed の5アプリ。情報源は各社の公式ヘルプ・公式ブログ、App Store 掲載ページ、公開UX分析・実機レビュー記事。公開情報で確認できなかった観点は「未確認」と明記した。タブ構成・価格・トライアル条件などはバージョンで変遷するため、時期差がある場合はその旨を併記した。

ミミトレの前提（比較の土台）: 60秒診断（聞き取り3問）→ライブラリ（レッスン一覧）→カラオケ風プレイヤー（ハイライト追従＋音変化の色分け表示、ABリピート、速度変更、シャドーイング録音→お手本再生→自動録音開始）→苦手フレーズ帳（手動保存が中心）。診断結果に基づくおすすめレッスン提示あり。

---

# 1. アプリ別セクション

## 1-1. Duolingo

### 1. オンボーディング
- iOS版は約12画面構成：Get Started→学習理由→1日の目標→流入経路→レベル自己申告→配置クイズ→「コース作成中」演出→初回レッスン予告→初回レッスン→1日ストリーク表示→アカウント作成、の順序と分析されている https://gummble.com/blog/duolingo-onboarding-flow-analysis
- 1日の目標は Casual 5分〜Insane 20分の段階から選ばせ、「後から変更できる」とマスコットが案内する https://www.useronboarding.ai/companies/duolingo
- 診断は任意のプレイスメントテストで、通常レッスンと同じ演習形式・進捗バー・ハート表示を使うため独立した試験画面に見えにくい設計 https://www.useronboarding.ai/companies/duolingo
- プレイスメントテストは適応型：易しい問題から始まり正解が続くと難化し、既知と判断されたスキルをアンロックする。公式ブログは「長い試験に感じさせない」ことを意図と明記 https://blog.duolingo.com/partial-credit-improvements-to-duolingos-placement-test/
- アカウント登録は初回レッスン完了＋1日ストリーク獲得の後に「Save your progress!」として提示される後置型。公式ガイドもプロフィール作成の目的を「進捗保存と他デバイスでの継続」と位置づける https://gummble.com/blog/duolingo-onboarding-flow-analysis / https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/
- オンボーディング内の課金訴求の正確なタイミングは、確認したフロー分析には含まれず未確認

### 2. ナビゲーション構造
- ホームはスキルツリーではなく縦スクロールの「学習パス」そのもので、円形ノードを順に進む一本道がデフォルト導線。パスには復習セッション・Stories・ガイドブックも組み込まれ、別タブへ探しに行く必要を減らしている https://blog.duolingo.com/new-duolingo-home-screen-design/?lang=en
- 下部タブは Learn／Leaderboard／Quests／Shop／Profile の5タブ構成（バージョン・アカウントにより Practice や Feed が加わる）https://github.com/lintendo/axhub-make/blob/HEAD/client/src/themes/duolingo-mobile/DESIGN.md
- レッスン到達はホームで現在地のノードをタップ→ポップアップでトピック確認→開始の実質1〜2タップ https://blog.duolingo.com/new-duolingo-home-screen-design/?lang=en
- ホーム上部に言語フラッグ・ストリーク・ジェム・ハート／エネルギーの常時表示HUDがある https://github.com/lintendo/axhub-make/blob/HEAD/client/src/themes/duolingo-mobile/DESIGN.md
- パスを現在地から離れてスクロールした場合は、右下のフローティング矢印ボタンで現在地へジャンプバックできる https://blog.duolingo.com/new-duolingo-home-screen-design/?lang=en
- レッスン離脱は左上の X。進捗バーとハート残量が同じ上部バーに表示される https://www.alicenmatthews.com/work/duolingo

### 3. レッスン内インタラクション
- 入力方式は単語タイル並べ替え・タイピング翻訳・穴埋め・ペアマッチング・画像選択・聞き取り書き取り・マイク音読が1レッスン内に混在 https://duolingo.fandom.com/wiki/Exercise
- 進行は自動送りではなく「回答→下部固定の Check→フィードバック→同じ位置の Continue／Got It→次の問題」の手動進行が徹底されている https://github.com/angel225588/vox-langauge-app/blob/HEAD/docs/research/DUOLINGO_UI_PATTERNS.md
- Check ボタンは未回答時はグレーで無効、回答可能になると明るい緑に変わり、押下時は影が消えて沈む触覚的表現を使う https://github.com/angel225588/vox-langauge-app/blob/HEAD/docs/research/DUOLINGO_UI_PATTERNS.md
- 正誤フィードバックは即時：正解は緑の面＋チェック＋称賛文＋効果音＋進捗バーの前進、不正解は赤の面＋×＋正解提示＋誤り箇所のハイライト https://github.com/angel225588/vox-langauge-app/blob/HEAD/docs/research/DUOLINGO_UI_PATTERNS.md
- キャラクターが正解時は拍手・ジャンプ、不正解時は落胆するが怒らない表情で反応する（Riveアニメーション）https://github.com/angel225588/vox-langauge-app/blob/HEAD/docs/research/DUOLINGO_UI_PATTERNS.md
- 不正解の問題はレッスン末尾に再出題され、先へスキップできない https://github.com/angel225588/vox-langauge-app/blob/HEAD/docs/research/DUOLINGO_UI_PATTERNS.md
- 従来のハート制では誤答1回でハート1つ喪失、5回誤答すると練習・ジェム購入・有料無制限が必要だった。2025年以降モバイルの多くではエネルギー制（開始時約25、演習ごとに消費、連続正解で一部回復、約1日で全回復）へ置換が報告されている https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/ / https://duolingoguides.com/duolingo-energy-system/
- 誤答理由を説明する Explain My Answer がレッスン内フィードバック機能として全学習者に無料開放された（2026年2月時点）https://blog.duolingo.com/guide-to-duolingo-practice-hub/

### 4. 音声プレイヤー操作
- リスニング演習は青いスピーカーボタンのタップで回数制限なく再再生できる https://blog.duolingo.com/learning-with-hearing-aids/
- 速度変更は連続スライダーではなく亀ボタンによるスロー再生の二択で、単語間にポーズを入れてゆっくり再生する https://blog.duolingo.com/learning-with-hearing-aids/
- リスニング形式には「Tap what you hear」「Type what you hear」、波形だけを見て答える「Listen and respond」などがある https://blog.duolingo.com/guide-to-duolingo-practice-hub/
- 聞き取りができない環境向けに「Can't listen now」でリスニング演習を一時スキップでき、設定でリスニング演習自体をオフにもできる https://blog.duolingo.com/learning-with-hearing-aids/
- シークバーによる任意位置移動、文単位の前後スキップ、多段階速度指定は確認した資料では未確認

### 5. 継続の仕掛け
- ストリークは炎アイコンで画面上部に常時表示、1日1レッスン完了で加算。ジェムで買う Streak Freeze が喪失防止の保険として機能する https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/
- XP はレッスン・Stories・練習等で獲得し、週次 Leaderboard／リーグで競い上位者は昇格。リーグは活動量が近い相手同士でマッチングされ「勝てる感覚」を保つよう調整されていると分析されている https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/ / https://trophy.so/blog/duolingo-gamification-case-study
- レッスン完了時は全画面の祝福演出＋獲得XP・正答率・所要時間をカードで数え上げて表示するサマリ https://duolingo.deconstructoroffun.com/mechanics/lesson-path
- 完了後フローは XP・ストリーク・クエスト進捗・リーグ・広告／アップセルが連続する「報酬セレモニー」として分析されており、タップ数が多い点は批判もある https://aachmanshukla.com/case-studies/duolingo/
- リマインドはプロフィール→設定→通知設定で希望時刻の手動指定か Smart Scheduling の自動調整を選べる https://play.google.com/store/apps/editorial?id=mc_apps_editorial_user_edu_duolingo_tips_and_tricks_fcp&hl=en_IN
- ホーム画面ウィジェットでもストリーク状態と練習の促しが表示され、時間経過で Duo の表情が悲しげに変わる演出が報告されている https://www.alicenmatthews.com/work/duolingo

### 6. 弱点/復習ループ
- 各ユニット内にパーソナライズド練習が組み込まれ、復習すべきタイミングの内容と自分が実際に犯したミスに焦点を当てた演習が自動生成される https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/
- パスの並び自体が間隔反復に基づいており、新規概念と復習概念を混ぜて提示することで「戻って復習する操作」自体を不要にしている https://blog.duolingo.com/new-duolingo-home-screen-design/?lang=en
- Practice タブでは Mistakes／Words／Speak／Listen をオンデマンドで選べ、Mistakes は過去のミスをまとめて再提示する専用セッション。開始時に「10件のミスを復習する」のように件数が明示される https://blog.duolingo.com/guide-to-duolingo-practice-hub/
- Practice タブのスキル練習は2026年2月に全学習者へ無料開放された https://blog.duolingo.com/guide-to-duolingo-practice-hub/

### 7. ペイウォール
- 無料版の主要な課金接点はハート切れ／エネルギー切れによる学習中断。有料会員はハート無制限と公式ガイドが明記 https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/
- Super の訴求は広告除去・ハート無制限・追加のストリークフリーズ・Practice Hub の追加練習選択肢。レッスン後のアップグレード訴求が多くのレッスンの後に表示されると報告されている https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/ / https://productivity-apps.com/apps/duolingo
- プランは Super、Super Family（最大6アカウント）、上位の Max https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/
- Super には1週間の無料トライアルがあり、終了前にリマインドされ、解約は終了の24時間前までと案内（販促・地域により14日の事例もあり一様でない）https://www.lilachbullock.com/is-duolingo-free/ / https://www.dealnews.com/features/duolingo/free/
- 購入復元は Profile→Settings→Restore Purchases の導線 https://duolingoguides.com/duolingo-restore-purchase/

### 8. 遷移とモーション
- レッスン内遷移はスライド／フェード中心で空間的一貫性を保つ。主要CTAは常に画面下部固定で Check と Continue が同一位置に置かれ、筋肉記憶で進められる https://github.com/angel225588/vox-langauge-app/blob/HEAD/docs/research/DUOLINGO_UI_PATTERNS.md
- 使い分け例：ノードタップ時はポップアップでレッスンテーマ表示、言語切替はボトムシート、実績解除は全画面／モーダルの祝福 https://github.com/lintendo/axhub-make/blob/HEAD/client/src/themes/duolingo-mobile/DESIGN.md
- ローディングは演出型：オンボーディングで「あなたの目標→レベル→コース」を流しながら約3秒の進捗バーを見せる https://gummble.com/blog/duolingo-onboarding-flow-analysis
- 空状態・通信エラー時の専用画面の扱いは、確認した公式・分析資料では未確認

### 9. アクセシビリティ
- 主要ボタンは大きなタッチターゲットで下部の親指ゾーンに固定され、閉じる X は 44pt のヒットエリアを持つと設計分析に記録 https://github.com/lintendo/axhub-make/blob/HEAD/client/src/themes/duolingo-mobile/DESIGN.md
- VoiceOver ではコンテンツ自体は概ね利用可能とのユーザー報告がある一方、完了後画面や次レッスン開始ボタンの到達が難しいという報告、最近の更新後に多くのボタンが VoiceOver に反応しないという退行報告もある https://WWW.Applevis.com/comment/156682 / https://productivity-apps.com/apps/duolingo
- 視覚面では文字が小さい・コントラストが低い・ラベル付けされていない要素があるとの指摘がまとめられている https://medium.com/@wndyli/reimagining-duolingo-a-non-visual-approach-to-language-learning-728e4e8733f9
- 色は緑＝正解／赤＝不正解が中心だが、チェック／×アイコンと正解文の提示が併用され色だけに依存しない冗長化が一部なされている https://github.com/angel225588/vox-langauge-app/blob/HEAD/docs/research/DUOLINGO_UI_PATTERNS.md
- 聴覚配慮として無制限リピート、亀ボタンのスロー再生、Can't listen now、設定での演習オフが公式に用意されている https://blog.duolingo.com/learning-with-hearing-aids/
- 公式の文字サイズ変更・ダイナミックタイプ対応・コントラスト比の数値仕様は未確認

### 特に特徴的なインタラクション設計
1. アカウント登録を初回レッスンとストリーク獲得の後まで遅らせる価値先行型オンボーディング
2. Check→即時フィードバック→Continue を同一位置の下部固定ボタンで繰り返し、不正解をレッスン末尾に再出題する手動進行の学習ループ
3. パスへの間隔反復・ミス復習の埋め込み＋Practice タブ Mistakes の二重の復習ループ

---

## 1-2. ELSA Speak

※タブ構成等はバージョンで変わる。現行の公式ヘルプは「v9.1.5以降」の5タブ構成を案内している https://help.elsaspeak.com/en/articles/877247-general-navigation-guide-for-elsa

### 1. オンボーディング
- 登録〜開始は7ステップ：Step1 サインイン/登録（Google/Facebook/Email/SSO）→ Step2 母語選択 → Step3 学習プロフィール（レベル・学習理由）→ Step4 業界・職種・興味 → Step5 注力スキル選択と1日の目標時間（10/15/20分）→ Step6 リマインダー通知設定（または「後で」）→ Step7 パーソナライズされた学習パスの表示・「Confirm」で学習開始。課金（トライアル）訴求はセットアップ完了後に置かれる https://elsaspeak.com/en/news-events/is-elsa-speak-app-free
- 旧来FAQの登録フロー（Android）は「Discover→母語選択→発音レベル選択→リマインダー設定→通知許可→Email/Facebookで登録」と登録が最後に来る順序で、時期により順序が異なる https://www.elsa.emergentconcept.com/faqs.html
- 発音診断（Assessment Test）は開始時に提示され、マイクをタップしてテスト文を読み上げる形式。静かな場所・ヘッドホン・安定した通信が事前に推奨される https://www.elsa.emergentconcept.com/faqs.html
- 診断結果は Pronunciation / Intonation / Fluency の3スキルでスコア化され、その結果に基づきカスタマイズされたレッスンプランが自動生成される https://www.elsa.emergentconcept.com/faqs.html
- Web版の無料アセスメントは「マイクをクリックして文を読む、2分未満でレベルが分かる」短時間診断として提示 https://elsaspeak.com/en/web-assessment-test
- 診断後に Learning Path と Today's Task が生成され、日次目標は5〜40分で設定できる https://elsaspeak.com/en/news-events/elsa-speak-review
- 無料版でも Welcome planet と全トピックの最初の2レッスンが体験可能。無料ティアはクレジットカード登録なしで開始でき、支払い情報が必要なのは7日間Premiumトライアルに明示的にオプトインした場合のみと公式ガイドが明記 https://www.elsa.emergentconcept.com/faqs.html / https://elsaspeak.com/en/news-events/is-elsa-speak-app-free

### 2. ナビゲーション構造
- 現行版は上部メニューアイコン方式を廃し、画面下部に5タブ（Today / Learn / Coach / Discover / Progress）を配置 https://help.elsaspeak.com/en/articles/877247-general-navigation-guide-for-elsa
- Todayタブが新しいホームで、「どこから始めるか選ばせる」のではなく短い学習プランが既に用意されている状態で開く設計 https://help.elsaspeak.com/en/articles/877247-general-navigation-guide-for-elsa
- Learnタブは構造化学習の拠点（Learning Path）、Coachタブは Pronunciation Coach が最上部にピン留めされフィルタで絞り込み可能、Discoverタブは探索用コンテンツ、Progressタブ内は Profile / Achievements / Leaderboard のサブナビ https://help.elsaspeak.com/en/articles/877247-general-navigation-guide-for-elsa
- Today's Task ではタスクをタップすると対応レッスンへ直接遷移し、タスクごとに最適なAI Coachが自動で対応付けられるためツール選択のステップが省略されている https://elsaspeak.com/en/news-events/today-s-task
- Todayタブには Speech Analyzer / Dictionary / AI Coaches 等の主要ツールも集約され1タップで開ける https://elsaspeak.com/en/news-events/today-s-task
- 「戻る導線」専用の公式説明は未確認

### 3. レッスン内インタラクション
- 中核の入力方式は録音中心：提示された単語・短文を読み上げるとAIが即座に処理して視覚的な正確さスコアを返すループが基本形 https://thelearningstandard.org/apps/elsa-speak
- レッスンタイプは listening / syllable stress / word pronunciation / dialogue の4種で、音素単位ドリルが21の発音スキルに整理されている https://www.alllanguageresources.com/elsa-speak/
- フィードバックは録音直後に即時表示され、間違えた音素・音節が色分けハイライトされる（緑=正確、黄/オレンジ=やや外れている、赤=大きな誤り）https://blog.elsaspeak.com/en/advantage-of-elsa-feedback/
- スコアはパーセンテージで「ネイティブ話者にどれだけ近いか」を単語・文単位で返す https://blog.elsaspeak.com/en/advantage-of-elsa-feedback/
- 誤った音についてはIPAと口・舌の位置を示すアニメーション等の視覚ガイドが提示され、イントネーションとストレスも「どこを強調すべきか」を案内する https://blog.elsaspeak.com/en/advantage-of-elsa-feedback/
- 音によるフィードバックも併用：正解時はベル音、不正解時はブザー音 https://blog.elsaspeak.com/en/advantage-of-elsa-feedback/
- 再練習の組み込み：Advanced Mode で発話後、赤/オレンジにハイライトされた単語をタップ→詳細ブレークダウン→画面下部の「Practice this word」→単語専用の練習画面へ遷移して録音し直す、という分岐が公式ヘルプに手順化されている https://help.elsaspeak.com/en/articles/877410-pronunciation-conversation-single-word-practice
- Regular Mode（対象音素のみ）と Advanced Mode（単語/フレーズ全体の全音をスコア付け）の切替がある https://www.alllanguageresources.com/elsa-speak/
- レッスン完了後には Advanced Mode のレポートが生成され、発音の正確さと改善方法が示される https://www.elsa.emergentconcept.com/faqs.html
- Speech Analyzer では録音ごとに国際テスト換算スコアとELSA総合スコアの2種が返り、Pronunciation / Intonation / Fluency / Grammar / Vocabulary のタブで詳細を見る構造 https://business-help.elsaspeak.com/en/articles/877194-feedback

### 4. 音声プレイヤー操作
- お手本再生と比較再生：詳細レポートで再生アイコンをタップすると自分の録音、スピーカーアイコンでネイティブ話者のお手本を再生でき並べて比較できる https://www.alllanguageresources.com/elsa-speak/
- 速度変更：ネイティブ音声は通常速度とスロー速度の2種で聴けることがレビューで確認されている https://www.alllanguageresources.com/elsa-speak/
- Dictionary の操作フローは「単語をタイプ→お手本の発音を聴く→自分を録音して即時スコアを受ける」順序が公式ガイドの推奨手順 https://elsaspeak.com/en/news-events/is-elsa-speak-app-free
- シャドーイング：Pronunciation Coach は Shadowing practice と組み合わせて使えるものとして位置付けられ、v9.1.5では全プラン共通のコアツールに Shadowing Practice が含まれる https://elsaspeak.com/en/news-events/is-elsa-speak-app-free
- AIロールプレイではマイクボタン1タップで録音開始 https://ai-best-search.com/en/products/elsa-speak
- 公式ブログはフィードバックの伝達手段として「波形表示（waveform displays）」を視覚キューの1つに挙げている https://blog.elsaspeak.com/en/advantage-of-elsa-feedback/
- ABリピート（区間ループ再生）専用機能の有無は未確認（公開情報源に明記なし）

### 5. 継続の仕掛け
- ストリークは連続学習日数のカウントで、維持条件は「毎日少なくとも1レッスンを完了すること」、1日空けると0にリセットされ復元不可と公式ヘルプが明記 https://business-help.elsaspeak.com/en/articles/877181-progress-leaderboard-streaks
- Today's Task は毎日3つのパーソナライズされた小タスクを提示し、全完了で Goal Complete の祝福画面が表示され、目標完了の記録・ストリーク更新・報酬付与・翌日の継続促進が同時に行われる https://elsaspeak.com/en/news-events/today-s-task
- Todayタブ直下の Your Journey は視覚的な進捗トラッカーで、現在のレベル、次のレベル、進捗率（％）、推奨学習時間、次の目標までの推定期間を表示 https://elsaspeak.com/en/news-events/today-s-task
- Progress の Profile には Points / Rank / Gems / Streaks が集約され、Points は Leaderboard の順位に連動。Lesson History で完了したセッションを後から追える https://intercom-help.eu/elsa-eu/en/articles/877409
- リマインドは Profile > Settings > Learning & Sound Settings > Notification > Daily reminder で時刻指定のプッシュ通知を設定でき、反映には最大24時間かかる旨の注意書きがある https://help.elsaspeak.com/en/articles/877270-daily-learning-reminder
- オンボーディング時にもリマインダー時刻の設定と通知許可が組み込まれている https://www.elsa.emergentconcept.com/faqs.html

### 6. 弱点/復習ループ
- 診断結果に基づき学習素材が再編成され、最も弱いスキルが優先的に出題される https://www.alllanguageresources.com/elsa-speak/
- Word Bank には学習した全単語・フレーズが蓄積され、高スコアのものと要復習のもの（スコア80以下）が自動で振り分けられる。苦手な単語の手動追加も可能 https://www.alllanguageresources.com/elsa-speak/
- Study Sets は自分専用の単語・フレーズリストを作って発音練習できる仕組みで、レッスン内や Dictionary からその場で追加できる導線がある https://help.elsaspeak.com/en/articles/877402-discover-study-sets / https://business-help.elsaspeak.com/en/articles/877173-dictionary
- Today's Task の日次タスク自体が「習熟度・学習進捗・最も改善が必要なスキル」に基づいて毎日生成されるため、弱点の再提示が日次プランに組み込まれている https://elsaspeak.com/en/news-events/today-s-task

### 7. ペイウォール
- トライアル訴求：新規アカウント作成直後に7日間無料トライアルのオファーポップアップが表示されるが、このポップアップは1回のみで、閉じる/スキップするとそのアカウントでは再表示されないと公式ヘルプが明記 https://help.elsaspeak.com/en/articles/877250-how-to-start-your-7-day-free-trial
- トライアル開始時に1年または3か月のプランを選ばせ、7日終了後は選んだプランへ自動で有料移行する https://help.elsaspeak.com/en/articles/877250-how-to-start-your-7-day-free-trial
- プラン提示は Free / Pro / Premium の機能比較表形式で、Daily core lesson の上限、Pronunciation Coach の範囲、Speech Analyzer の可否、広告有無等を並べて差分を示す https://elsaspeak.com/en/news-events/is-elsa-speak-app-free
- 無料版の制限は「Welcome＋各トピック最初の2レッスン」のほか Pronunciation Coach の日次上限など機能ごとの上限で設計 https://www.elsa.emergentconcept.com/faqs.html
- 課金導線はアプリ内が正規ルートとされ、メイン画面の「Upgrade」ボタンから現在のオファーを確認・購入するよう公式ヘルプが案内 https://help.elsaspeak.com/en/articles/877150-where-to-subscribe-to-elsa-premium-subscribe-in-the-app-not-in-device-settings
- 復元導線（Apple課金）：Profile タブ > Upgrade > 「Restore purchase」ボタン https://intercom-help.eu/elsa-eu/en/articles/877415
- 購入したのに無料表示になる主因として「購入時と異なるログイン方法で入っている」ケースが公式に挙げられ、現在のログイン手段を確認する手順が用意されている https://intercom-help.eu/elsa-eu/en/articles/877415

### 8. 遷移とモーション
- 従来の上部メニューアイコンから下部5タブへ統一し、「開いたら何を練習すべきか提示する」を新UIの基本思想として公式が説明 https://help.elsaspeak.com/en/articles/877247-general-navigation-guide-for-elsa
- 詳細情報はその場のポップアップ/専用画面で展開する（Study Set 練習中の赤単語タップで開く高度なフィードバックのポップアップ、単語タップの詳細ブレークダウン）https://help.elsaspeak.com/en/articles/877402-discover-study-sets
- トライアルオファーのように「1回だけ出すポップアップ」という出し分けも行われている https://help.elsaspeak.com/en/articles/877250-how-to-start-your-7-day-free-trial
- 完了時の表現として Today's Task 全完了時の Goal Complete 祝福画面があり、公式プロモ動画では Listen & repeat 演習の完了時に紙吹雪と達成メッセージが紹介されている https://elsaspeak.com/en/news-events/today-s-task / https://www.facebook.com/reel/1661647892422743/
- ローディング/エラー状態：公式ヘルプは「読み込めない・固まる・処理中で止まる」問題の主因を不安定な通信と旧バージョンとし、Wi-Fi⇔モバイル切替、更新、再起動、再インストール（サインイン中なら進捗保持）を対処フローとして提示 https://help.elsaspeak.com/en/articles/877272-elsa-won-t-load-is-stuck-or-a-feature-won-t-open-try-these-steps-first
- UX改善要望として「録音を自動開始してほしい、良いスコアを取ったら次の演習へ自動で進んでほしい」という声がレビューにあり、現状は各ステップが手動トリガーであることがうかがえる https://www.g2.com/products/elsa-speak/reviews?locale=fr&page=3
- 空状態の表示仕様、画面遷移アニメーションの具体的なモーション仕様は未確認

### 9. アクセシビリティ
- タップ領域サイズ、文字サイズ（Dynamic Type対応等）、VoiceOver対応の有無は公式・App Store・レビューのいずれでも明記がなく未確認 http://apps.apple.com/app/id1083804886
- 色覚配慮の観点：中核フィードバックが緑/黄/赤の色分けに依存する一方、ベル音/ブザー音という音のキューと％スコア・波形・口形アニメーションという色以外の手がかりも併用されている https://blog.elsaspeak.com/en/advantage-of-elsa-feedback/
- 登録時に母語を選択でき、AIの音声認識精度向上とナビゲーションのしやすさのために使われると公式ガイドが説明 https://elsaspeak.com/en/news-events/is-elsa-speak-app-free
- 発音評価には安定したインターネット接続が必須でオフラインでは動作しない点がレビューで繰り返し制約として挙げられている https://www.g2.com/products/elsa-speak/reviews?filters%5Bnps%5D%5B0%5D=1&page=6#reviews

### 特に特徴的なインタラクション設計
1. 「選ばせないホーム」：Todayタブが毎日3つのタスクと対応するAI Coachまで自動で決めて提示し、タスクのタップ1回でレッスンに直行させる
2. 色分け→タップ→単語ドリルへの分岐：赤/オレンジの単語をタップすると詳細から「Practice this word」で単語専用練習へ潜れる、フィードバックと再練習が1ジェスチャでつながったループ
3. 弱点の自動収集と日次再提示の二重ループ：Word Bank のスコア80以下自動振り分け＋翌日の Today's Task が最も改善が必要なスキルから生成される

---

## 1-3. Speak（スピーク）

※バージョン差への注意：タブ名・配置は時期で変わっている。2026年6月時点の記事では下部タブは「ホーム／フリートーク／復習」、2026年11月確認の記事では「復習」タブはなく「練習」タブ内に復習欄があるとされ、単一の現行仕様として断定できない https://etaroenglish.com/speakapp/

### 1. オンボーディング
- 初回は文法テストや選択式テストからではなく、学習目的等の質問に選択肢をタップして答える初期設定＋1回発話する質問があり、回答後に目標達成見込み時期が計算・提示される https://study-space4english.com/speak-ai-english-app-level-check/
- レベル測定は2層：(a)初期設定型の診断、(b)初期設定完了後に受けられる本格的なレベル診断で、3つの質問に各60秒で自分の言葉で答え、話し方・語彙・文法に分けた分析と強み／改善点が表示される https://study-space4english.com/speak-ai-english-app-level-check/
- 診断は強制振り分けではなく、診断後も判定レベル以外（上位レベル含む）のレッスンを自分で選べ、順番通りに進める義務もない https://study-space4english.com/speak-ai-english-app-level-check/
- アカウント登録の位置：2023年時点の実機レビューでは、起動直後に「ログイン→今すぐ登録→メールで続行→名前／メール／パスワード入力→会員登録」を済ませてからホームに進む順序だった https://gigazine.net/gsc_news/en/20230206-speak/
- 課金訴求のタイミング：購読なしでは最初の1レッスンのみ試せ、その後に7日間無料トライアル開始を求められ、トライアル開始には支払い方法の事前登録が必要と報告されている https://productivity-apps.com/apps/speak-language-learning
- 未確認：現行版オンボーディングの正確な総ステップ数と、現行版でアカウント登録が質問群の前か後かは公開記事間で時期差があり特定できなかった

### 2. ナビゲーション構造
- ホームタブが主学習の入口で、初級（A1）／基礎（A2）／中級（B1）／中上級（B2）／上級（C1）／トピック別コースからレベルを選び、テーマ単位で「レッスン→ロールプレイ→Q&Aセッション」を進め、区切りで「Let's review／スキルチェック」が入る https://etaroenglish.com/speakapp/
- コース切替はホーム画面左上の「コース」から https://www.miyamanavi.net/app/speak/
- スピークチューターへの入口はホーム画面下部または練習タブ下部のチャット入口（日本語解説ではホーム画面右下／レッスン中のキャラクターアイコン）と複数用意されている https://help.speak.com/en/articles/11396739-what-is-speak-tutor
- レッスンへの到達は短い：2023年版ではホームで「Start here」をタップすると即マイク許可ダイアログが出て通話形式レッスンが始まった https://gigazine.net/gsc_news/en/20230206-speak/
- 再訪導線：受講済みレッスンはプロフィールのアクティビティ履歴から選び直して再受講でき、保存表現からは「…→レッスンを見る」で元のレッスン動画に戻れる https://englishglowlab.com/speak-review-howto/
- 未確認：レッスン途中の離脱時の確認モーダルの有無や戻る操作の細部は公開情報では確認できなかった

### 3. レッスン内インタラクション
- 基本構造は全レベル共通の3ステップ「インプット（講師解説を聞く）→アウトプット（発話）→会話で実践」で、タップ式の単語タイルではなく口頭で文を産出させる設計 https://study-space4english.com/speak-ai-english-app-level-check/
- レッスン形式は複合型：実写ビデオレッスン（約5分、途中に発話課題、日本語字幕あり）、スピーキングドリル（手本に続いて発話）、Q&Aチャット、ロールプレイ、語彙／文法強化、オリジナルレッスン https://www.miyamanavi.net/app/speak/
- AI会話はターン制が基本で、フリートーク／ロールプレイでは発話がリアルタイムで文字起こしされ、その場でフィードバックが行われる https://www.miyamanavi.net/app/speak/
- 新しい没入型ロールプレイにはリアルタイムストリーミングでAIを割り込める音声優先モードと従来のターン制チャットモードの2形態がある https://iaintfluent.com/blog/speak-app-review
- 会話中のフィードバック：文法・発音のミスと「より自然な表現」がリアルタイムに提示され、日本語で答えても自然な英語に変換して拾い、カタカナ英語でも文脈を汲んで文字起こしする寛容な認識 https://etaroenglish.com/speakapp/
- ロールプレイ画面はチャットスレッド形式で、詰まったときの提案（suggestion）ボタンがあり、各訂正の下に短い文法ノートが付く https://productivity-apps.com/apps/speak-language-learning
- つまずき支援：ロールプレイ開始前にその章のフレーズブックを確認でき、会話中もヒントを表示でき、Q&Aセッションでもヒントが用意され「詰まったまま終わらない」配慮がある https://etaroenglish.com/speakapp/
- 会話後のフィードバック：ロールプレイ／Q&A終了後にレビューが行われ、うまく言えなかった表現・詰まった箇所をその場で声に出して反復練習でき、学んだフレーズを別の表現に置き換える応用練習もできる https://etaroenglish.com/speakapp/
- 間違いの復習組み込み：レッスン内で間違えた内容からAIが自分専用の復習レッスン（オリジナルレッスン）を自動作成する https://www.miyamanavi.net/app/speak/
- 発音の扱いは二層：通常レッスンでは「伝わること」優先で細かい発音指摘は控えめだが、単語タップで起動する発音コーチでは「どう聞こえたか」の判定と正確に発音するアドバイスが得られる https://www.miyamanavi.net/app/speak/

### 4. 音声プレイヤー操作
- お手本再生：練習カードには「お話しください」の合図とお手本英文・訳が表示され、カード下部の「もう一度聞く」ボタンでお手本を再再生できるのが基本形 https://miralab.co.jp/media/speak_app_free_paid/
- ビデオレッスンは一時停止・巻き戻し・早送りが可能と解説されている https://study-space4english.com/speak-ai-english-app-level-check/
- 自分の発話の再生：音声認識が拾った単語がハイライト表示され、自分の録音を再生してお手本と比較できる https://productivity-apps.com/apps/speak-language-learning
- 単語単位の再生：文中の単語をタップすると意味表示と正しい発音の読み上げが行われる https://productivity-apps.com/apps/speak-language-learning
- 速度変更については情報が割れている：日本語ランキング記事は講師音声の速度変更が可能とする一方、英語レビューは「スローダウン／スキップ不可」を弱点に挙げており、現行仕様は未確認 https://study-space4english.com/ai-english-app-ranking-2025/ / https://productivity-apps.com/apps/speak-language-learning
- 録音開始までの手順の簡略化：現在のコースレッスンは基本ハンズフリー（自動録音）で、最初の話し始めから自動進行し画面に触れる必要がほぼなく、フリートークでは右上設定から自動録音のオン／オフができ、話し終わりにだけタップする方式も選べる https://jibun-update.com/speak-04/
- ハンズフリーの裏面：自動聴取マイクが勝手に録音を始め文の途中で切れることがあり、恒常的にオフにする設定がなく一時停止で対処する、という指摘もある https://productivity-apps.com/apps/speak-language-learning
- 復習時のオート再生をオンにするとスマホ操作不要で学習でき「ながら学習」に使える https://etaroenglish.com/speakapp/
- 話せない環境向け代替：「今は話せない」をオンにするとリスニングモードになりスピーキング部分を省略でき、キーボードマーク表示時はタイピングで回答できる https://www.miyamanavi.net/app/speak/

### 5. 継続の仕掛け
- ストリーク（連続学習記録）：毎日最低1レッスン完了で伸び、ホーム画面・プロフィールのカレンダー・その日最初のレッスン完了時に表示される進捗画面で確認できる https://help.speak.com/ja/articles/11645358-%E9%80%A3%E7%B6%9A%E5%AD%A6%E7%BF%92-%E4%BB%95%E7%B5%84%E3%81%BF-%E7%B6%AD%E6%8C%81%E3%81%99%E3%82%8B%E6%96%B9%E6%B3%95
- ストリーク救済（ストリーク2.0・ベータ）：1日空けても自動適用される「連続記録フリーズ」（最大2個ストック、有効期限なし）、条件時のみ出現する「連続記録セーブチャレンジ」と「自動復活」があり、複数セーフティの同時適用はできない https://help.speak.com/ja/articles/11645358-%E9%80%A3%E7%B6%9A%E5%AD%A6%E7%BF%92-%E4%BB%95%E7%B5%84%E3%81%BF-%E7%B6%AD%E6%8C%81%E3%81%99%E3%82%8B%E6%96%B9%E6%B3%95
- 進捗の見せ方：進捗画面は「今日話した文数・ストリーク・累計文数」を1枚のカードに集約。リーグ（週間ランキング）も併設 https://productivity-apps.com/apps/speak-language-learning
- XPとランキング：レッスン終了ごとに経験値を獲得し、リーグは週単位でXP上位者が昇格 https://etaroenglish.com/speakapp/
- 月別チャレンジ：月ごとに課題が設定されクリアでバッジを集められ、例として正確に発音できた単語数で金・銀・銅バッジが付く「ネイティブ発音チャレンジ」がある https://www.miyamanavi.net/app/speak/
- 完了時フィードバック：その日の最初のレッスン完了後に更新されたストリーク画面が表示されることが公式に明記 https://help.speak.com/ja/articles/11645358-%E9%80%A3%E7%B6%9A%E5%AD%A6%E7%BF%92-%E4%BB%95%E7%B5%84%E3%81%BF-%E7%B6%AD%E6%8C%81%E3%81%99%E3%82%8B%E6%96%B9%E6%B3%95
- 未確認：レッスン完了直後の専用サマリ／フィードバックレポート画面の具体構成と、プッシュ通知の文面・頻度設定画面は公開情報では確認できなかった

### 6. 弱点/復習ループ
- スマートレビュー：AIが過去のレッスンから間違った箇所を自動でピックアップし復習メニューを作成する機能で、両プラン共通で使える https://www.miyamanavi.net/app/speak/
- 復習単位は「コンセプト」：通常レッスンで学んだ重要表現・フレーズはコンセプトとして保存・集約され、スマートレビューではコンセプト単位でAIが判断した最適タイミングで再提示され、各レッスンの習熟度も確認できる https://www.miyamanavi.net/app/speak/
- 再提示のバリエーション：復習では同じコンセプトでも表現パターンを変えた別文脈の問題が出され、丸暗記にならない設計 https://etaroenglish.com/speakapp/
- 手動保存ループ：レッスン中にカード右上のブックマークをタップ→「練習→保存した表現」で一覧→「復習スタート」で発話練習、という能動的な保存・復習導線もある https://englishglowlab.com/speak-review-howto/
- 弱点特化はプランで差別化：Premium Plusのみ「頻出ミスを狙う練習（Target your frequent mistakes）」とパーソナライズ学習プランが使え、カスタムレッスン（Made For You）はPremiumが1日3件まで／Plusが無制限 https://help.speak.com/en/articles/5358417-what-s-the-difference-between-premium-and-premium-plus
- 選定のズレという指摘：自動復習は「各セクションで間違えたもの」基準でAIが選ぶため、本人が本当に覚えたい表現とずれることがあるとレビューされている https://etaroenglish.com/speakapp/

### 7. ペイウォール
- 出現タイミング：恒常的な無料プランはなく無料アカウントで使えるのはプレビュー機能のみで、約1レッスン体験した時点でペイウォールに当たる構造が低評価の主因になっていると分析されている https://productivity-apps.com/apps/speak-language-learning
- トライアルは2種：7日間無料体験（選んだプランの全機能）と、初回のみ・公式サイト限定の1ヶ月180円体験（プレミアムプラス全機能）があり、どちらも終了後は自動で有料購読が始まる https://miralab.co.jp/media/speak_app_free_paid/
- 解約期限の明示：両体験とも終了24時間前までにキャンセルしないと課金が始まり、Web申込の体験では終了2日前にリマインダーが届く https://miralab.co.jp/media/speak_app_free_paid/
- プラン提示：Premium（年額19,800円／月額3,800円）とPremium Plus（年額29,800円／月額5,800円）の2プラン（2026年10月時点・日本価格）https://miralab.co.jp/media/speak_app_free_paid/
- 復元導線に相当する案内：支払ったのに「無料」と表示される主因は購入時と別のログイン方法で入っていることとされ、購入時と同じ方法でログインし直すよう公式ヘルプ経由で案内 https://miralab.co.jp/media/speak_app_free_paid/
- 未確認：アプリ内に明示的な「購入を復元」ボタンが存在するか、その配置は確認できなかった

### 8. 遷移とモーション
- レッスン画面は余白の多いスパースな設計で、白いカードに1文だけを表示し、訳を下に、再再生ボタンと「話すタイミングの合図」を置き、認識した単語をその場でハイライトする型が全レッスンで統一 https://productivity-apps.com/apps/speak-language-learning
- 会話画面の型：ロールプレイはチャットスレッド形式に統一 https://productivity-apps.com/apps/speak-language-learning
- ローディング／エラー状態の弱さ：AIチューターやアプリのフリーズ・クラッシュ、起動画面で固まる、フリートークでAIが無応答、進捗リセット、Bluetoothヘッドホンの切断が断続的に報告されている https://productivity-apps.com/apps/speak-language-learning
- 空状態：保存表現はブックマークしない限り一覧が空であり、その場合はレッスン中のブックマークから保存するよう案内される（空画面での次アクション提示に相当）https://englishglowlab.com/speak-review-howto/
- 未確認：モーダルとボトムシートの使い分け基準、画面遷移アニメーションの種類・一貫性、スケルトン等のローディング表現は公開UX分析では確認できなかった

### 9. アクセシビリティ
- 未確認：VoiceOver／TalkBack対応、タップ領域サイズ、文字サイズ追従、コントラスト比について、Speak固有の公式・レビュー情報は確認できなかった
- 代替入力という配慮：発話できない状況向けに「今は話せない」によるリスニングモード（スピーキング省略）とタイピング回答が用意されている https://www.miyamanavi.net/app/speak/
- 聴覚面の補助に相当する要素：ビデオレッスンには日本語字幕があり、フリートークも発話がリアルタイムで文字起こしされる https://study-space4english.com/speak-ai-english-app-level-check/
- 操作負荷の低減：ハンズフリー（自動録音）により画面タッチなしでレッスンが進行し、復習のオート再生でも操作不要で進められる https://jibun-update.com/speak-04/

### 特に特徴的なインタラクション設計
1. 「押さずに話す」ハンズフリー既定化：コースレッスンは自動録音で自動進行し、タップ操作ではなく発話そのものに集中させる設計
2. 会話を切らない二段フィードバック：会話中は文字起こし＋自然な表現への即時訂正でターンを止めず、終了後に「言えなかった表現」をその場で発話し直すレビューを挟み、間違いをコンセプト化してスマートレビューで後日再提示する三層ループ
3. ストリークを「守る」設計：フリーズ（最大2個・自動適用）／セーブチャレンジ／自動復活の多重救済で途切れの損失感を緩和

---

## 1-4. スピークバディ

### 1. オンボーディング
- 公式FAQが案内する初回導線は3ステップ：①レベルチェックテストを受ける→AIが目的・レベルに合ったコースでカリキュラムを提案、②そのカリキュラムを1日1レッスン（10分程度）使う、③さらに学びたい場合は別コースでカリキュラムを作るか「コンテンツ」ページから選ぶ https://qa.speakbuddy.jp/speakbuddy_faq/7
- レベルチェックは利用開始時に受けられ、所要時間は約10分、学習目的や興味のある話題を選んだうえでAIバディと話すスピーキング形式 https://qa.speakbuddy.jp/speakbuddy_faq/15
- 中身は、目的・現在のレベルへの回答の後、英文を声に出して読む課題と、質問への自由回答で構成。判定はCEFR-J準拠で、発音・流暢さ・正確性・表現の幅・文章構成の5観点から総合評価され、結果に基づきAIが最適なカリキュラムを提案 https://qa.speakbuddy.jp/blog/other/19
- 体験レビューでは初回フローが4ステップとして記録されており、①学習に関する質問、②レベルチェック（合計10問、英文朗読・指定フレーズでの英訳・自由意見）、③課金登録、④コンテンツ選択の順で、結果は10段階で表示 https://english-with.com/speakbuddy-review/
- 上記レビュー時点では課金訴求はレベルチェック後・本格利用前に挟まれ「課金登録を済ませないとサービスが利用できない」形だったとされるが、現行公式案内とはトライアル仕様が異なる（観点7参照）https://english-with.com/speakbuddy-review/
- アカウント登録（SpeakBuddy ID）は必須ではなく任意で、登録すると機種変更・再インストール時にログインだけで学習データを引き継げる https://qa.speakbuddy.jp/speakbuddy_faq/25
- 1レッスンの目安は公式サイトで「1回5分」、App Store説明では「1日の目安学習時間は5〜15分」とされ、短時間で最初の学習体験まで到達させる設計 https://app.speakbuddy.me/ / https://apps.apple.com/jp/app/ai%E8%8B%B1%E4%BC%9A%E8%A9%B1%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AF%E3%83%90%E3%83%87%E3%82%A3-%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AD%E3%83%B3%E3%82%B0-%E3%83%AA%E3%82%B9%E3%83%8B%E3%83%B3%E3%82%B0-%E8%8B%B1%E8%AA%9E%E5%AD%A6%E7%BF%92/id1129621266

### 2. ナビゲーション構造
- 起動直後のトップは「バディページ」で、従来の「起動直後にカリキュラム表示」から変更され、AIバディがユーザーごとに最適化された学習コンテンツをレコメンド・フィードバックする役割を持つ https://prtimes.jp/main/html/rd/p/000000063.000017082.html
- バディページには公式キャラクター「プロティ」がトップ画面に登場し、アプリを開くたびにランダム性のあるコミュニケーションを行うことで「毎日開きたくなる」インターフェースを狙っている https://prtimes.jp/main/html/rd/p/000000063.000017082.html
- レッスンの自由選択は画面下のメニュータブ「コンテンツ」から行え、目的・シチュエーション別のコース一覧から選ぶ構造 https://english-with.com/speakbuddy-review/
- 設定や各種変更は「メニュー」タブ側に集約 https://english-with.com/speakbuddy-review/
- カリキュラムの編集導線は、カリキュラム画面右側の「編集」（ペンのマーク）→「新規作成」で、難易度は入門・初級・中級・上級から選ぶ https://qa.speakbuddy.jp/speakbuddy_faq/21
- レッスンへの到達は、原則としてAI提案カリキュラムを順に進めるのが主導線で、補助導線として「コンテンツ」ページから直接選ぶことも公式FAQが案内 https://qa.speakbuddy.jp/speakbuddy_faq/7
- タブの完全な構成（タブ数・各タブ名の一覧）や、レッスン途中からの戻る導線・中断時の復帰導線の詳細は公開情報源では未確認

### 3. レッスン内インタラクション
- 1レッスンは5つの学習モードの固定シーケンスで構成され、標準構成は「単語学習→リスニング→会話→英作文→応用練習」。2026年3月9日以降に新規作成したカリキュラムでは「単語学習→リスニング→会話→キーフレーズ練習→フリートーク（BuddyChat）」の順 https://qa.speakbuddy.jp/blog/other/19 / https://miralab.co.jp/media/speak_speakbuddy/
- 入力方式の中心は音声入力で、AIキャラクターが登場する会話に自分も主人公として参加し、声に出して答えるロールプレイ形式 https://qa.speakbuddy.jp/blog/other/19
- リスニングモードは、会話ストーリーを聞いた後に内容確認クイズに答える形式で、ワンタップで日本語訳を表示して理解を補助できる https://qa.speakbuddy.jp/blog/other/19
- 応用練習モードではシチュエーションを変えて同じキーフレーズを繰り返し練習させ、インプットした表現を別文脈で再出題する構造 https://qa.speakbuddy.jp/blog/other/19
- 発話すると、自分の発話が相手にどう聞こえるかという音声認識結果がテキストで表示され、言いたかった文と認識された文をその場で比較できる https://qa.speakbuddy.jp/speakbuddy_faq/9
- フィードバックのタイミングは即時で、App Store説明では「発音／文法をAIがリアルタイムでチェック」と明記 https://apps.apple.com/jp/app/ai%E8%8B%B1%E4%BC%9A%E8%A9%B1%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AF%E3%83%90%E3%83%87%E3%82%A3-%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AD%E3%83%B3%E3%82%B0-%E3%83%AA%E3%82%B9%E3%83%8B%E3%83%B3%E3%82%B0-%E8%8B%B1%E8%AA%9E%E5%AD%A6%E7%BF%92/id1129621266
- 発音フィードバックは発音記号（音素）レベルまで解析して返されるのが特徴 https://english-with.com/speakbuddy-review/
- レッスンの出来はスコアで可視化され、発音・流暢さ・正確性など5項目を1,000点満点でスコア化し、AIが弱点を特定して代替表現や改善コメントを即座に提示するとレビュー記事が整理 https://column.osakagas.co.jp/english/english-reputation/speakbuddy-review/
- BuddyChat（フリートーク）では自由発話の後にまとめてフィードバックが返る形式で、「良かった点」と「改善可能な点」が会話終了後に提示される https://qa.speakbuddy.jp/speakbuddy_faq/11
- BuddyChatには会話中に達成すべき「ミッション」が課され、詰まったときは「ヒント」機能で回答例を確認でき、マイク左側のミッションカードボタンでミッションを再確認できる https://qa.speakbuddy.jp/speakbuddy_faq/11
- 音声入力の操作はマイクボタンを押して発声し、再度ボタンを押す方式でハンズフリーではないため操作回数が多く感じた、という長期利用レビューの指摘がある https://betop20percent.com/about-speakbuddy-aieikaiwa/
- 正誤表現の色分けや効果音による正誤通知の具体仕様は未確認（設定に「レッスン効果音再生」のON/OFF項目があることのみ確認できる）

### 4. 音声プレイヤー操作
- リスニングの再生速度は調整可能で、App Store説明でも「リスニングの再生速度を調整できる」ことが挙げられている https://apps.apple.com/jp/app/ai%E8%8B%B1%E4%BC%9A%E8%A9%B1%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AF%E3%83%90%E3%83%87%E3%82%A3-%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AD%E3%83%B3%E3%82%B0-%E3%83%AA%E3%82%B9%E3%83%8B%E3%83%B3%E3%82%B0-%E8%8B%B1%E8%AA%9E%E5%AD%A6%E7%BF%92/id1129621266
- 速度変更の場所は「メニュー」タブの「設定」画面で、「音声再生速度」のほか「音声認識打ち切り速度」「音声入力復唱」「音声入力自動スタート」「相手字幕を常に表示」「レッスンBGM再生」「レッスン効果音再生」をまとめてカスタマイズできる https://english-with.com/speakbuddy-review/
- 自分の録音の再生導線はBuddyChatにあり、会話終了後のフィードバック確認時に録音された自分の音声を聞き返せる https://qa.speakbuddy.jp/speakbuddy_faq/11
- 「コピーキャット」はお手本に合わせる練習の専用エクササイズで、発話内容に基づくイントネーション（抑揚）をカラオケ採点風に可視化して修正をサポート https://japan.zdnet.com/release/31106648/
- 専用のシャドーイングモードの有無は未確認。ABリピートや区間ループ再生の専用ボタンの有無も未確認

### 5. 継続の仕掛け
- 学習頻度や量に応じて「ユーザーランキング」と「記録メダル」が用意され、毎日の継続を後押しする仕組みとして公式FAQが紹介 https://qa.speakbuddy.jp/speakbuddy_faq/9
- リマインドは「毎日決まった時間にレッスンをリマインドし、学習を習慣化」という設計がApp Store説明に明記 https://apps.apple.com/jp/app/ai%E8%8B%B1%E4%BC%9A%E8%A9%B1%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AF%E3%83%90%E3%83%87%E3%82%A3-%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AD%E3%83%B3%E3%82%B0-%E3%83%AA%E3%82%B9%E3%83%8B%E3%83%B3%E3%82%B0-%E8%8B%B1%E8%AA%9E%E5%AD%A6%E7%BF%92/id1129621266
- バディページの「パーソナライズ・ミッション機能」では、学習進捗や学習データの分析に基づきAIバディがミッションをレコメンドし、達成すると英語フレーズ付きの人気キャラクター壁紙が手に入る報酬設計 https://prtimes.jp/main/html/rd/p/000000063.000017082.html
- バディページは短期目標の設定、適切な学習コンテンツへの誘導、学習結果からの弱点・改善点フィードバックを担い、進捗の見せ方の中核になっている https://app.sumapo.com/app-speakbuddy/
- Duolingo型の「連続日数ストリーク」の有無は公開情報源では未確認（確認できる継続装置はランキング・メダル・ミッション・リマインドが中心）
- レッスン完了時の演出（完了画面・祝福アニメーション等）の具体仕様は未確認

### 6. 弱点/復習ループ
- 復習は忘却曲線を考慮した設計で、App Store説明でも「忘却曲線を考慮した復習機能」が挙げられている https://apps.apple.com/jp/app/ai%E8%8B%B1%E4%BC%9A%E8%A9%B1%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AF%E3%83%90%E3%83%87%E3%82%A3-%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AD%E3%83%B3%E3%82%B0-%E3%83%AA%E3%82%B9%E3%83%8B%E3%83%B3%E3%82%B0-%E8%8B%B1%E8%AA%9E%E5%AD%A6%E7%BF%92/id1129621266
- 「キーフレーズ道場」は弱点／復習ループの専用機能で、個々の学習履歴に基づき、忘却曲線に沿った最適なタイミングで学んだキーフレーズを復習するエクササイズ https://japan.zdnet.com/release/31106648/
- キーフレーズ道場は学習からの経過日数・スコア・学習回数等から個別にタイミングが決まり、出題範囲は進行中カリキュラムだけでなく修了済みカリキュラムからも選ばれる。各キーフレーズの習熟レベルを5段階のバーで判定し、結果に応じて次回復習までの日数の目安も表示され、AIが習得したと判断するまで繰り返し開催される https://prtimes.jp/main/html/rd/p/000000066.000017082.html
- 「パーソナル発音トレーニング」は、レッスン中にユーザーが発音した単語をAIが解析し、苦手な単語を検知・フィードバックして重点的にトレーニングさせる弱点特化機能 https://qa.speakbuddy.jp/blog/other/19
- 苦手な発音や単語はAIがデータベース化して把握し、忘却曲線に沿ったタイミングで自動的に復習を提案すると発音アプリ比較記事が整理 https://englishhub.jp/app/pronunciation-app.html
- ユニット単位の復習ループもあり、4〜6レッスンで1ユニットを構成し、受け終えるとユニットテストに挑戦でき、忘れた単語やキーフレーズがあれば該当レッスンに戻って復習する導線 https://qa.speakbuddy.jp/blog/other/19
- 一方でストアレビュー由来の声として「訂正内容を後から復習する機能が欲しい」「想定する復習タイミングでは頻度が足りない」という不満も紹介されており、復習の提示頻度・後追い確認のしやすさには課題感がある https://reskill.gakken.jp/4994

### 7. ペイウォール
- 現行の無料トライアルは3日間で、インストール後1回のみ利用でき、期間中は有料プランと同じ全機能・全コンテンツが使える https://qa.speakbuddy.jp/speakbuddy_faq/9
- 現行仕様では、トライアル中に有料契約・支払いをしなければ終了後に自動的に「無料ユーザー」となり、自動で有料プランに移行することはなく解約手続きも不要、という非自動課金型 https://aiteller.jp/blog/speakbuddy-ryokin
- App Store説明も「3日間の無料トライアル後、サブスクリプション登録を開始しなければ、料金が発生することはございません」と明記 https://apps.apple.com/jp/app/ai%E8%8B%B1%E4%BC%9A%E8%A9%B1%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AF%E3%83%90%E3%83%87%E3%82%A3-%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AD%E3%83%B3%E3%82%B0-%E3%83%AA%E3%82%B9%E3%83%8B%E3%83%B3%E3%82%B0-%E8%8B%B1%E8%AA%9E%E5%AD%A6%E7%BF%92/id1129621266
- ただし古い体験レビューではレベルチェック直後に「1週間無料体験」の課金登録画面が挟まれ、登録しないとサービスを利用できないフローだったと記録されており、ペイウォールの位置とトライアル日数は時期により変更されている https://english-with.com/speakbuddy-review/
- プランは現行2種類で、1ヶ月プラン3,980円（税込）と12ヶ月プラン28,400円（税込、月あたり2,367円）https://app.speakbuddy.me/
- どの料金プランでもアプリの全機能・全コンテンツを利用でき、上位プランで解放される機能はなく、違いは支払う期間と金額だけ https://aiteller.jp/blog/speakbuddy-ryokin
- 復元・引き継ぎ導線は「メニュー」→「復元・引き継ぎ」→「データの引き継ぎ」→「引き継ぎデータを作成」が旧端末側の手順で、SpeakBuddy IDでログインした場合はプレミアム状態もそのまま引き継がれる https://qa.speakbuddy.jp/speakbuddy_faq/6

### 8. 遷移とモーション
- レッスン内の遷移は「単語→リスニング→会話→英作文→応用練習（新カリキュラムではキーフレーズ練習→BuddyChat）」という固定順の線形遷移で、全レッスンで一貫した型 https://qa.speakbuddy.jp/blog/other/19
- 線形であることの副作用として、レッスンを飛ばして次のステップやレベルに進めない点や、1コースあたり1日のレッスン上限（3回）がある点に不満を述べた長期利用レビューがある https://betop20percent.com/about-speakbuddy-aieikaiwa/
- イベント演出として、「道場の日」には起動画面に通常時と異なる装い（ハチマキ・グローブ姿でリングに構えるプロティ）が登場し、今日が道場の日であることを宣言する https://prtimes.jp/main/html/rd/p/000000066.000017082.html
- ローディングについては、体験レビューが「時々レッスンの読み込みに5秒〜10秒程度かかることがある」と記録 https://english-with.com/speakbuddy-review/
- 中断からの復帰については、最新版の更新内容で「着信などでレッスンが中断された場合も、スムーズに再開できるようになりました」と案内されており、エラー／中断状態の扱いが改善対象になっている https://apps.apple.com/jp/app/ai%E8%8B%B1%E4%BC%9A%E8%A9%B1%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AF%E3%83%90%E3%83%87%E3%82%A3-%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AD%E3%83%B3%E3%82%B0-%E3%83%AA%E3%82%B9%E3%83%8B%E3%83%B3%E3%82%B0-%E8%8B%B1%E8%AA%9E%E5%AD%A6%E7%BF%92/id1129621266
- モーダル／ボトムシートの使い分け基準、画面遷移アニメーションの仕様、空状態や通信エラー時の表示仕様は未確認

### 9. アクセシビリティ
- 字幕まわりの配慮として、設定で「相手字幕を常に表示」を切り替えられ、AIバディの発話を文字で表示できる https://qa.speakbuddy.jp/speakbuddy_faq/11
- リスニングではワンタップで日本語訳を表示できるため、聞き取れない場合でもテキストで内容を確認しながら進められる https://qa.speakbuddy.jp/blog/other/19
- 聞き取りの負荷を下げる調整として、音声再生速度の変更、音声認識打ち切り速度の調整、字幕表示のON/OFFがユーザーのレベルに合わせて設定変更できる https://diamond.jp/educate/articles/english/400699/
- 発話操作の負荷を下げる設定として、マイクの自動スタートON/OFFや、発話後に自分のフレーズを復唱してくれる機能の切り替えが用意されている https://diamond.jp/educate/articles/english/400699/
- 画面の見やすさについては賛否があり、長期利用レビューは「メニュー画面によってはカラフルで絵も豊富だが、初めてだとごちゃごちゃして分かりにくい印象を受けた」と述べている https://betop20percent.com/about-speakbuddy-aieikaiwa/
- タップ領域のサイズ、文字サイズの可変対応、コントラスト比、VoiceOver等のスクリーンリーダー配慮については言及が確認できず未確認

### 特に特徴的なインタラクション設計
1. 「診断→提案→実行」をAIが一気通貫で担う設計：約10分のスピーキング形式レベルチェック（5観点・CEFR-J）で測り、その結果からAIがカリキュラムを提案し、初回は「1日1レッスン」を推奨して迷いを消す
2. 発話のたびに「認識結果テキスト表示＋音素レベルの発音判定＋1,000点スコア＋即時の代替表現提示」が返る高密度フィードバックループ
3. 復習をユーザーの能動操作に任せず、学習ログと忘却曲線からAIがタイミングを決めて「キーフレーズ道場」をイベントとして開催し、5段階バーで習熟度と次回復習までの日数まで見せる自動再提示

---

## 1-5. abceed

### 1. オンボーディング
- 全体の流れは「新しくはじめる」タップ→学習目的の選択→レベルチェックテスト→結果・スコア判定→1日の学習時間設定→利用開始、の順で、最初の学習体験の前にレベル測定を挟む設計 https://ninja.weblio.jp/abceed-use
- アカウント登録は開始の必須条件ではなく、会員登録なしでも無料機能を使え、名前・メールアドレスを登録せずそのまま利用継続も可能で、登録は複数デバイス利用のための後付け要素 https://ninja.weblio.jp/abceed-use
- レベルチェックはリスニング＋リーディングを実際のTOEIC形式で出題し、問題数は10問・15問・30問からユーザーが選択でき、多いほど精度が上がると案内される https://ninja.weblio.jp/abceed-use
- レベルチェック終了直後に結果と各設問の解説が表示され、回答時間も含めて予測スコアのイメージが提示される https://ninja.weblio.jp/abceed-use
- TOEIC対策開始時も同様にレベル判定テスト（10問・15問・30問から選択）を受け、結果をもとに目標到達レベルや学習時間を設定してから「おすすめの問題」が提示される https://diamond.jp/educate/articles/english/400844/
- 課金訴求のタイミングは学習開始直後ではなく、レベルチェック＋学習時間設定の完了後に3日間のPro無料トライアルが自動でスタートする形で、トライアル終了後に自動で料金が発生しないことが明示されている https://ninja.weblio.jp/abceed-use
- 公式ヘルプ上も、アカウント登録時に3日間のProトライアルが付与され、期間中は教材を無制限に使え、終了すると自動でフリープランに移行するとされている https://otteric.app/blog/abceed-free-plan

### 2. ナビゲーション構造
- 教材への基本導線は「教材」タブ→教材一覧（分類・人気ランキング・新着・検索窓）→教材をタップ→「学習トップ」→学習モード選択→「未学習」をタップして開始、と約4タップの階層型 https://blog.coachfit.net/toeic-abceed-how-to-use/
- ホーム画面の役割は学習のハブで、上部に「予測スコア」「英語力」が常時表示され、タップするとPart1〜7のS〜F評価やカテゴリ別の苦手分析画面へ遷移する https://blog.coachfit.net/toeic-abceed-how-to-use/
- ホームからは教材経由でなく「おすすめの問題」へ直接入る導線もあり、問題種別と学習方法の2択を選んで即演習に入れる https://diamond.jp/educate/articles/english/400844/
- 「総復習モード」はホーム画面の「総復習」ボタンからアクセス可能と公式ヘルプに明記されており、復習がホームの第一階層に置かれている https://globeejphelp.zendesk.com/hc/ja/articles/4402738607769-%E7%B7%8F%E5%BE%A9%E7%BF%92%E3%83%A2%E3%83%BC%E3%83%89%E3%81%AB%E3%81%84%E3%81%A6
- プラン確認導線はホーム画面上部の丸いアイコン→「利用プラン」 https://otteric.app/blog/abceed-free-plan
- 戻る導線（戻るボタンの一貫性、学習途中離脱時の再開位置など）の具体仕様は未確認

### 3. レッスン内インタラクション
- 入力方式は教材タイプで分かれ、問題演習はタップ選択のクイズ形式＋一問解答ごとに自動採点、紙教材併用時はマークシートをタップして自動採点する方式が併存 https://blog.formzu.com/abceed
- フレーズ／単語教材では画面上部で「例文」「単語」「例文訳」「単語訳」の出題形式を切り替え、画面下部の「わからない」「わかる」ボタンの二択タップで仕分けていくフラッシュカード型インタラクションが中心 https://blog.coachfit.net/toeic-abceed-how-to-use/
- 学習モードは教材ごとに「習得モード」「一覧モード」「総復習モード（復習モード）」の3モードを画面下タブで切り替える構造 https://blog.coachfit.net/toeic-abceed-how-to-use/
- 正誤フィードバックは即時で、1問解答が終わるごとに正誤が画面上部に表示され、背景がピンク色の画面下部に当該問題の解説が表示される画面へ遷移する https://blog.coachfit.net/toeic-abceed-how-to-use/
- 解答後フィードバックには正解だけでなく各選択肢の回答率、日本語訳、解説まで含まれ、間違えた理由をその場で振り返れる https://diamond.jp/educate/articles/english/400844/
- Part5形式などでは1問ごとの解答所要時間も自動記録され、解答後に時間配分を振り返れる https://blog.coachfit.net/toeic-abceed-how-to-use/
- 分からない単語・フレーズは学習中に長押し／ワンタップで「MY単語帳」に登録でき、意味・使い方は自動入力され、登録後は暗記カード形式で学習できる https://ninja.weblio.jp/abceed-use
- リスニング中は一覧の「＞」タップで解説を確認でき、わからない用語はその場で「辞書検索」をタップして調べられる、学習を止めない設計 https://appllio.com/app-abceed

### 4. 音声プレイヤー操作
- 倍速・シャッフル・区間リピート再生はフリープランでも使える中核機能で、公式ヘルプのフリープラン機能6項目に明記 https://globeejphelp.zendesk.com/hc/ja/articles/4402133060249-%E3%83%95%E3%83%AA%E3%83%BC%E3%83%97%E3%83%A9%E3%83%B3%E3%81%A7%E3%81%AF%E4%BD%95%E3%81%8C%E3%81%A7%E3%81%8D%E3%81%BE%E3%81%99%E3%81%8B
- 倍速の調整範囲は0.5〜2.0倍とレビューで確認されており、1.0倍から段階的に上げる使い方が推奨されている https://appllio.com/app-abceed
- 区間リピートは聞き取れなかった部分だけを指定して繰り返し再生する用途で、倍速と組み合わせて苦手な発音パターンを潰す使い方が紹介されている https://english-hack.com/abceed-how-to-use-recommended-features/
- ニュース音声では速度変更に加え「3秒巻き戻し」の細かい調整が可能で、全和訳もワンタップで切り替えられる https://ninja.weblio.jp/abceed-use
- リスニングの解説ページでは同じ画面のまま音声再生や少しの巻き戻しができ、復習のために別画面へ遷移する必要がない https://blog.coachfit.net/toeic-abceed-how-to-use/
- 文単位の移動は主に映画・ドラマ教材で実装され、日英同時字幕表示に加えフレーズ単位での巻き戻し・スキップ、フレーズのお気に入り登録、簡易辞書表示、再生速度0.5〜2.0倍調整が同一プレイヤーに集約 https://blog.coachfit.net/toeic-abceed-how-to-use/
- シャドーイング／ディクテーションへの導線は、対象教材を選択→音声をタップ→対象問題の「>」をタップ→学習開始、という手順で通常の音声再生フローから分岐する https://english-listening-center.com/blog/abceed-how-to-choose-plan/
- シャドーイングは自分の声を録音してお手本音声と聞き比べができ、SWトレーニングでは自分の発音をAIが採点し完成度をパーセンテージで表示 https://blog.formzu.com/abceed
- 例外として、オンライン模試形式（通し受験）では本番再現のため音声の倍速再生に対応していない https://blog.coachfit.net/toeic-abceed-how-to-use/

### 5. 継続の仕掛け
- 学習時間の計測・可視化が習慣化支援として明示され、フリープランでは直近7日分、Proでは無制限＋詳細分析が使える差別化になっている https://apps.apple.com/jp/app/abceed-toeic-%E8%8B%B1%E8%AA%9E%E5%AD%A6%E7%BF%92-%E8%8B%B1%E6%A4%9C-%E8%8B%B1%E4%BC%9A%E8%A9%B1%E3%82%A2%E3%83%97%E3%83%AA/id1060016132
- 学習ログは学習時間やスコア推移を自動でグラフ化して表示し、成長の軌跡を可視化する設計 https://apps.apple.com/jp/app/abceed-toeic-%E8%8B%B1%E8%AA%9E%E5%AD%A6%E7%BF%92-%E8%8B%B1%E6%A4%9C-%E8%8B%B1%E4%BC%9A%E8%A9%B1%E3%82%A2%E3%83%97%E3%83%AA/id1060016132
- 教材内の進捗は「習得済」「要復習」「未学習」の3状態で記録され、習得率がパーセンテージ／円グラフで表示される https://diamond.jp/educate/articles/english/400844/
- 目標設定は目標スコアと達成期日を設定すると残り日数が逆算表示され、アプリを開くたびに現在スコアとの距離が見える形で提示されるという利用者報告がある https://note.com/1933fk/n/na0f1948b26ba
- 学習時間は週単位の達成割合でも表示され、1日ノルマを週合計で巻き返せる設計になっているという利用者報告がある https://note.com/1933fk/n/na0f1948b26ba
- abceed以外での学習も手入力・ストップウォッチ形式・タイマー形式で学習時間として記録できる https://www.pgyer.com/ipa/id/ipa/com.globeejp.abceed
- プッシュ通知／リマインドの具体的な文面・頻度・タイミングは未確認で、復習タイミングの提示はアプリ内の「総復習」「おすすめの問題」側に寄せられている

### 6. 弱点/復習ループ
- 「おすすめの問題」はAIが20,000問以上から「①現在のレベルに合った問題」「②復習の必要な問題」の2種類をピックアップし、適切なタイミングでレコメンドする二層構造 https://www.pgyer.com/ipa/id/ipa/com.globeejp.abceed
- レコメンドの難易度は「10問出題したときに7問正解できるぐらい」のギリギリ解けそうな水準に調整され、解くほど予測スコアと弱点分析が更新される https://blog.formzu.com/abceed
- 復習対象の自動収集は、過去に間違えた問題と「？」をつけた問題が忘却曲線に基づき適切なタイミングで再レコメンドされる仕組み https://www.pgyer.com/ipa/id/ipa/com.globeejp.abceed
- 公式ヘルプの「総復習モード」は2方式：「条件指定」（間違えた回数・？をつけた回数で抽出）と「忘却曲線に沿った復習」（今復習すべき問題を自動抽出）を選べる https://globeejphelp.zendesk.com/hc/ja/articles/4402738607769-%E7%B7%8F%E5%BE%A9%E7%BF%92%E3%83%A2%E3%83%BC%E3%83%89%E3%81%AB%E3%81%84%E3%81%A6
- 忘却曲線抽出の具体条件も公式に開示されており、「最後に間違えてから1日以上経過し、かつ7日以内に正解していない問題」「最後に解いてから7日以上経過し、かつ過去の正答率が一定以下の問題」が中心 https://globeejphelp.zendesk.com/hc/ja/articles/4402738607769-%E7%B7%8F%E5%BE%A9%E7%BF%92%E3%83%A2%E3%83%BC%E3%83%89%E3%81%AB%E3%81%84%E3%81%A6
- 教材単位の復習でも、正答率などで出題範囲を絞り込んで間違えた問題だけを効率的に復習できる https://ninja.weblio.jp/abceed-use
- MY単語帳では問題演習やトレーニングで間違えた単語を自動で登録でき、それだけを抽出して見返すことで復習時間を半減できるという活用法が紹介されている https://english-hack.com/abceed-how-to-use-recommended-features/
- 弱点の可視化はPart別S〜F評価とカテゴリ別（例: 品詞）評価までドリルダウンでき、次にやるべき教材選択へ直結する https://blog.coachfit.net/toeic-abceed-how-to-use/

### 7. ペイウォール
- 無料枠の切れ目は明確で、フリープランではアプリ内の一問一答形式の問題演習自体が非対応となり、音声再生・マークシート・学習時間計測（7日分）のみが残る https://blog.coachfit.net/toeic-abceed-how-to-use/
- 一部教材にはフリープランでも数問だけ解ける「お試し問題」があり、一定数を解くと有料プランの案内が出る、体験の途中にペイウォールを置く設計 https://otteric.app/blog/abceed-free-plan
- トライアル中の制限として、オンライン模試は30問版のみ利用可能で、50問・100問・200問版はPro本契約の機能として段階的にロックされる https://otteric.app/blog/abceed-free-plan
- プラン提示はabceed proの期間選択型で、1ヶ月3,300円、3ヶ月8,000円、1年23,800円（1年は月あたり約1,983円）の3プラン（App Store表記）https://apps.apple.com/jp/app/abceed-toeic-%E8%8B%B1%E8%AA%9E%E5%AD%A6%E7%BF%92-%E8%8B%B1%E6%A4%9C-%E8%8B%B1%E4%BC%9A%E8%A9%B1%E3%82%A2%E3%83%97%E3%83%AA/id1060016132
- Pro以外に映画・ドラマ見放題プランとAI英会話プラン（各1ヶ月1,000円／1年7,200円）という機能別の廉価プランも並列提示される https://ninja.weblio.jp/abceed-use
- 代替導線として教材の単品購入（例: 金のフレーズ800円）や、紙の本の表紙写真で電子版を割引購入する「紙割」も用意され、サブスク一択にしていない https://otteric.app/blog/abceed-free-plan
- 解約・復元導線は申込チャネル依存で、アプリ削除だけでは解約にならない注意書きがある https://otteric.app/blog/abceed-free-plan
- Pro終了後のデータ扱いも導線として設計され、MY単語帳・メモ・ブックマークは閲覧のみ可能（新規登録不可）、学習履歴はフリープラン中は見られなくなるがデータは保持され、再加入すると以前の履歴も含めて復活する https://otteric.app/blog/abceed-free-plan

### 8. 遷移とモーション
- モーダル／ポップアップの使用例として、オフライン用の音声ダウンロードは書籍画面で「音声」ボタンを押すとポップアップが表示され「音声をダウンロード開始」を押して完了する誘導型フロー https://ninja.weblio.jp/abceed-use
- 画面遷移の一貫性については、機能追加のたびにメイン画面構成が変わることへの不満（「ホーム画面がAI英会話に乗っ取られた」という声）や、「機能が多すぎてどこに何があるか分からない」「アプリが落ちる」「同期エラー」というApp Storeレビュー由来の指摘が複数記事で報告されている https://erk-english.com/coaching/abceed-honest-review/
- エラー状態の扱いとして、学習中のフリーズでアプリを強制終了する必要があり、その間に解いた問題がリセットされたという体験レビューがあり、中断時の進捗保持が弱い場面がある https://ninja.weblio.jp/abceed-review
- 長文問題では画面が問題ウィンドウと選択肢ウィンドウに二分割され、それぞれをスワイプしながら解答する必要があり、誤タップ・誤スワイプで勝手に閉じる／答えが表示される事象も報告されている https://ninja.weblio.jp/abceed-review
- ローディング表示、空状態、オフライン時のエラー表示といった状態デザインの公式説明は未確認。モーション／アニメーションの仕様に関する公開情報も未確認

### 9. アクセシビリティ
- タップ領域、文字サイズ変更、コントラスト、VoiceOver対応について、公式サイト・公式ヘルプ・App Store掲載ページを確認した範囲では明記がなく未確認
- 間接的な証拠として、スマホでは画面が小さく長文問題が解きづらい、誤操作が多発するというレビューが複数あり、タブレット等の大画面利用が推奨される文脈で語られている https://ninja.weblio.jp/abceed-review
- 一方で対応端末はスマホ・タブレット・PCとマルチデバイスで、同一アカウントで複数デバイス同時ログインが可能なため、大画面への逃げ道自体は用意されている https://diamond.jp/educate/articles/english/400844/
- 音声面の代替手段として、全教材音声の再生・倍速・聞き直し（3秒巻き戻し等）が標準装備されている点は聴覚ベース学習のアクセシビリティには寄与するが、視覚障害向け配慮としての公式言及は未確認

### 特に特徴的なインタラクション設計
1. 「測定→レコメンド→復習」の閉ループをホームに集約：初回のレベル判定で予測スコアを出し、ホーム常設の予測スコア／Part別S〜F評価から「おすすめの問題」と「総復習」へ1タップで入れる
2. 忘却曲線の抽出条件まで公式ヘルプで開示した復習エンジン：間違えた問題・「？」問題の自動抽出＋条件指定の併用、間違えた単語のMY単語帳自動登録
3. 「紙の教材の相棒」としての無料層と、解いている途中で切れるペイウォール：無料でも音声＋倍速／区間リピート＋自動採点マークシートを開放し、アプリ内演習はお試し問題を一定数解いた時点で有料案内を出す体験連動型の課金導線

---

# 2. 横断サマリ表（観点 × アプリ）

| 観点 | Duolingo | ELSA Speak | Speak | スピークバディ | abceed |
|---|---|---|---|---|---|
| 1. オンボーディング | 約12画面。登録は初回レッスン＋ストリーク獲得後に後置。診断は通常レッスン形式の適応型プレイスメントテスト（任意） | 7ステップ。登録は冒頭（旧版は末尾）。発音診断（読み上げ式）で3スキルをスコア化し学習パスを自動生成 | 質問タップ式の初期設定＋任意の本格診断（60秒×3問の自由発話）。登録位置は時期差あり | 約10分のスピーキング形式レベルチェック（CEFR-J・5観点）→AIがカリキュラム提案。ID登録は任意 | 目的選択→レベルチェック（10/15/30問から選択可）→予測スコア→学習時間設定。登録なしでも開始可 |
| 2. ナビゲーション | ホーム＝縦スクロールの学習パス一本道。レッスン到達1〜2タップ。5タブ＋上部HUD | 下部5タブ。ホーム（Today）は「選ばせない」設計でタスクからレッスンへ直行 | ホームでレベル別コース選択。レッスン到達は短い。チューター入口は複数配置 | トップはAIバディのレコメンド画面（バディページ）。自由選択は「コンテンツ」タブ | 階層型で教材まで約4タップ。ただしホームから「おすすめの問題」「総復習」へ直接入れる |
| 3. レッスン内インタラクション | 多形式の入力が混在。Check→即時フィードバック→Continue の下部固定ボタンで手動進行。不正解は末尾に再出題 | 録音中心。即時に音素単位の色分け＋％スコア＋口形アニメ。誤った単語タップ→「Practice this word」で即ドリル分岐 | 音声入力中心のターン制会話。会話中は即時訂正でターンを止めず、終了後に発話し直しレビュー＋自動作成の復習レッスン | 音声入力中心の会話形式。即時に認識結果テキスト＋音素レベル判定＋1,000点スコア＋代替表現。5モード固定シーケンス | タップ選択クイズ＋自動採点。即時フィードバックで解説・選択肢別回答率・所要時間まで表示。フラッシュカード型の二択仕分けも |
| 4. 音声プレイヤー | スピーカーボタンで無制限リピート。速度は亀ボタンのスロー二択のみ。文単位移動・シークは未確認 | お手本と自分の録音を並べて比較再生。速度は通常/スローの2種。ABリピートは未確認 | お手本の再再生ボタン、単語タップで発音再生。録音は基本ハンズフリー（自動録音）。速度変更は情報が割れ未確認 | 速度変更は設定画面に集約。お手本追従の専用練習「コピーキャット」。シャドーイング専用モード・ABリピートは未確認 | 最も多機能：0.5〜2.0倍、区間リピート、3秒巻き戻し、フレーズ単位の移動、録音して聞き比べ。無料でも開放 |
| 5. 継続の仕掛け | ストリーク＋フリーズ、XP/週次リーグ、完了時の全画面祝福＋数値サマリ、完了後の報酬セレモニー | ストリーク（途切れは復元不可と明記）、毎日3タスク全完了で Goal Complete 祝福画面、Your Journey 進捗トラッカー、リーダーボード | ストリーク＋フリーズ/セーブチャレンジ/自動復活の多重救済、XP/リーグ、月別バッジ、進捗カード（今日話した文数等） | ランキング・記録メダル・AIミッション（達成で壁紙報酬）、決まった時刻のリマインド。ストリーク有無は未確認 | 学習時間の計測・グラフ化、習得率の円グラフ、目標スコアまでの残り日数逆算表示。通知の詳細は未確認 |
| 6. 弱点/復習ループ | パス自体に間隔反復を埋め込み＋Practice の Mistakes でミスを件数明示して再提示 | Word Bank がスコア80以下を自動で「要復習」に振り分け＋翌日の Today's Task が最弱スキルから生成 | 間違いを「コンセプト」化しスマートレビューが最適タイミングで別文脈で再提示。手動ブックマーク保存も併用 | 忘却曲線でAIが「キーフレーズ道場」をイベント開催。習熟度5段階バー＋次回復習までの日数表示。苦手発音の自動検知も | 忘却曲線の抽出条件を公式開示。間違えた問題・「？」問題を自動抽出する総復習＋条件指定。間違えた単語はMY単語帳へ自動登録 |
| 7. ペイウォール | ハート/エネルギー切れの中断が主接点。Super 1週間トライアル（終了前リマインド）。復元は設定内 Restore Purchases | アカウント作成直後に1回だけのトライアルオファー・ポップアップ。機能比較表で提示。復元は Upgrade 画面内 | 恒常的無料プランなし。約1レッスンでペイウォールに当たる構造。7日間トライアル＋Web限定の割引体験。復元ボタンは未確認 | 3日間トライアルは非自動課金型（契約しなければ課金なしと明記）。全プランで全機能開放、差は期間と金額のみ | お試し問題を一定数解くと有料案内が出る体験連動型。単品購入・紙割など代替導線も併設 |
| 8. 遷移とモーション | 下部固定CTAの同一位置反復、スライド/フェードの一貫性、演出型ローディング（コース作成中）。空/エラー状態は未確認 | 詳細はポップアップ/専用画面でその場展開。完了時は祝福画面＋紙吹雪。空状態・遷移アニメ仕様は未確認 | レッスン画面の型は全レッスン統一。フリーズ・無応答等の不具合報告あり。シート使い分け・ローディング表現は未確認 | レッスン内は固定順の線形遷移で一貫。道場の日は起動画面の特別装いでイベント提示。中断後の再開は改善対象として明記 | 機能追加で画面構成が変わる不満の声あり。フリーズ時に進捗リセットの報告。状態デザインの公式説明は未確認 |
| 9. アクセシビリティ | 44ptヒットエリア等の設計記録あり。VoiceOverは概ね可だが退行報告も。色＋アイコン＋文の冗長化あり。数値仕様は未確認 | 公式明記なし（未確認）。色分けに音（ベル/ブザー）・％・波形・口形の非色キューを併用。母語選択あり | 公式明記なし（未確認）。「今は話せない」リスニングモードとタイピング回答という代替入力あり | 公式明記なし（未確認）。字幕常時表示、訳のワンタップ表示、速度・認識打ち切り等の調整設定あり | 公式明記なし（未確認）。小画面での誤操作の指摘あり。マルチデバイス対応が逃げ道 |

---

# 3. 提言リスト

## 3-1. ミミトレが採用すべきパターン

1. **ホームに「今日の1本」を置き、開いて1タップで学習開始できるようにする。** ELSA の Today タブは毎日3タスクと対応ツールを自動提示し、タスクのタップ1回でレッスンへ直行させることで開始までの意思決定をほぼゼロにしている https://elsaspeak.com/en/news-events/today-s-task 。Duolingo も現在地ノードのタップから実質1〜2タップでレッスンが始まる https://blog.duolingo.com/new-duolingo-home-screen-design/?lang=en 。ミミトレは診断結果に基づくおすすめ提示を持っているので、それをライブラリの先頭ではなくホームの第一要素として「今日の1本」に格上げするのが自然な拡張になる。
2. **プレイヤー内の主要アクションは下部固定の1ボタンに集約し、位置を変えない。** Duolingo は Check と Continue を常に同じ下部位置に置き、筋肉記憶で進められる一貫性を学習ループの核にしている https://github.com/angel225588/vox-langauge-app/blob/HEAD/docs/research/DUOLINGO_UI_PATTERNS.md 。ミミトレのプレイヤーは操作要素が多い（前回調査）ため、再生/録音まわりの主ボタンだけでも下部固定・同一位置に統一する価値が高い。
3. **フィードバックは「色＋記号/数値＋音」の冗長化を標準にする。** ELSA は音素の色分けにベル音/ブザー音、％スコア、波形、口形アニメーションを併用し https://blog.elsaspeak.com/en/advantage-of-elsa-feedback/ 、Duolingo も緑/赤にチェック・×アイコンと正解文の提示を併用している https://github.com/angel225588/vox-langauge-app/blob/HEAD/docs/research/DUOLINGO_UI_PATTERNS.md 。ミミトレの音変化カラー表示は色への依存度が高いので、正誤や要注意箇所には下線形状・アイコン・短い効果音など色以外のキューを必ず重ねる。
4. **聞き取れなかった箇所をタップしたら、その場で該当フレーズだけのドリルに分岐させる。** ELSA の Advanced Mode は赤/オレンジの単語タップ→詳細→「Practice this word」で単語専用練習へ潜れる導線を公式手順として持ち、フィードバックと再練習が1ジェスチャでつながっている https://help.elsaspeak.com/en/articles/877410-pronunciation-conversation-single-word-practice 。ミミトレでも、カラオケ表示で聞き取れなかった文・音変化箇所のタップから、そのフレーズだけの繰り返し再生＋シャドーイング録音へ直行できる分岐が最も学習効果に直結する。
5. **苦手フレーズは手動保存に頼らず、聞き取りミスから自動収集し、翌日以降の「今日の1本」に混ぜて再提示する。** ELSA の Word Bank はスコア80以下を自動で「要復習」に振り分け https://www.alllanguageresources.com/elsa-speak/ 、abceed は間違えた単語を MY単語帳へ自動登録し、忘却曲線の条件で「総復習」に自動抽出する https://globeejphelp.zendesk.com/hc/ja/articles/4402738607769-%E7%B7%8F%E5%BE%A9%E7%BF%92%E3%83%A2%E3%83%BC%E3%83%89%E3%81%AB%E3%81%84%E3%81%A6 。Speak も間違いを「コンセプト」化して最適タイミングで別文脈で再提示する https://www.miyamanavi.net/app/speak/ 。ミミトレの苦手フレーズ帳は手動保存中心なので、診断・レッスン中のミスを自動で貯め、ホームの推奨に混ぜる二重ループ（自動収集＋能動保存）に変える。
6. **レッスン完了時に、全画面の完了サマリ（今日の学習時間・聞き取れた音変化の数・ストリーク更新）を1枚で見せる。** Duolingo の完了画面は獲得XP・正答率・所要時間をカードで数え上げて表示し https://duolingo.deconstructoroffun.com/mechanics/lesson-path 、ELSA も3タスク全完了で Goal Complete の祝福画面とストリーク更新・報酬付与を同時に行う https://elsaspeak.com/en/news-events/today-s-task 。ミミトレは「3分で終わる」設計なので、完了の手応えを数値で返すことが継続率に直結する。
7. **ストリークには救済（フリーズ等）を用意し、途切れの損失感を緩和する。** Duolingo の Streak Freeze https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/ 、Speak のフリーズ（最大2個・自動適用）／セーブチャレンジ／自動復活の多重救済 https://help.speak.com/ja/articles/11645358-%E9%80%A3%E7%B6%9A%E5%AD%A6%E7%BF%92-%E4%BB%95%E7%B5%84%E3%81%BF-%E7%B6%AD%E6%8C%81%E3%81%99%E3%82%8B%E6%96%B9%E6%B3%95 が代表例。対照的に ELSA は「1日空けると0・復元不可」と明記しており https://business-help.elsaspeak.com/en/articles/877181-progress-leaderboard-streaks 、厳格型は離脱リスクが高い。ミミトレは週1回分の自動フリーズ程度の緩和が適する。
8. **診断は「試験」に見せない。** Duolingo のプレイスメントテストは通常レッスンと同じ演習形式・進捗バー・ハート表示を使い、独立した試験画面に見えにくい設計で、適応型に出題難度が変わる https://www.useronboarding.ai/companies/duolingo / https://blog.duolingo.com/partial-credit-improvements-to-duolingos-placement-test/ 。ミミトレの60秒診断は既に短いが、通常レッスンと同じ見た目・操作（再生ボタンと選択肢）に統一し、「診断」という言葉の重さを下げることで初回離脱を防げる。
9. **シャドーイング録音は「お手本→間を置いて自動で録音開始」の流れを維持し、録音後の聞き比べまでを1セットにする。** Speak はコースレッスンを基本ハンズフリー（自動録音）化し、操作ではなく発話に集中させる設計で https://jibun-update.com/speak-04/ 、ELSA と abceed は自分の録音とお手本を並べて比較再生できる導線を持つ https://www.alllanguageresources.com/elsa-speak/ / https://blog.formzu.com/abceed 。ミミトレの「お手本再生→自動録音開始」はこの方向と一致しているので、次は録音直後に「お手本→自分の録音」を連続再生する聞き比べボタンを同じ場所に固定し、往復のタップ数を減らす。
10. **プレイヤーには「数秒巻き戻し」と文単位スキップを常設する。** abceed は3秒巻き戻しやフレーズ単位の巻き戻し・スキップ、0.5〜2.0倍速、区間リピートを同一プレイヤーに集約し、無料プランでも開放している https://blog.coachfit.net/toeic-abceed-how-to-use/ / https://globeejphelp.zendesk.com/hc/ja/articles/4402133060249-%E3%83%95%E3%83%AA%E3%83%BC%E3%83%97%E3%83%A9%E3%83%B3%E3%81%A7%E3%81%AF%E4%BD%95%E3%81%8C%E3%81%A7%E3%81%8D%E3%81%BE%E3%81%99%E3%81%8B 。聞き取れない箇所を何度も聞き直すのがミミトレの核体験なので、ABリピート設定より手軽な「少し戻る」の反復操作を標準装備すべきである。
11. **話せない環境向けの代替モードを用意する。** Duolingo の「Can't listen now」https://blog.duolingo.com/learning-with-hearing-aids/ と Speak の「今は話せない」リスニングモード（スピーキング省略＋タイピング回答）https://www.miyamanavi.net/app/speak/ は、電車内など声を出せない場面でも学習を継続させる。ミミトレでもシャドーイングを「聞くだけモード」に切り替えられる導線があると、利用場面が広がる。
12. **リマインダー設定をオンボーディング内に組み込む。** ELSA は初回フローにリマインダー時刻の設定と通知許可を含め https://www.elsa.emergentconcept.com/faqs.html 、Duolingo も通知設定を初期フローと設定画面の両方に置く https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/ 。ミミトレの診断直後（意欲が最も高い時点）に「毎日何時に3分やるか」を決めさせるのが最も安い継続施策になる。

## 3-2. 避けるべきパターン

1. **学習を中断させるタイプのペイウォール（残量切れで強制停止）。** Duolingo のハート/エネルギー切れは主要な課金接点だが https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/ 、Speak では約1レッスンでペイウォールに当たる構造が低評価の主因と分析されている https://productivity-apps.com/apps/speak-language-learning 。ミミトレはレッスン本数が少なく1回の体験が短いため、中断型は「まだ価値を感じる前」に当たる危険が高い。切れ目はレッスン完了後など区切りの良い場所に置く。
2. **トライアルの自動課金を曖昧にすること。** スピークバディは「契約しなければ料金は発生しない」と App Store 説明に明記する非自動課金型で信頼を得ており https://apps.apple.com/jp/app/ai%E8%8B%B1%E4%BC%9A%E8%A9%B1%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AF%E3%83%90%E3%83%87%E3%82%A3-%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AD%E3%83%B3%E3%82%B0-%E3%83%AA%E3%82%B9%E3%83%8B%E3%83%B3%E3%82%B0-%E8%8B%B1%E8%AA%9E%E5%AD%A6%E7%BF%92/id1129621266 、Speak は終了24時間前までの解約が必要なことを事前に案内し、Web申込では終了2日前にリマインダーを送る https://miralab.co.jp/media/speak_app_free_paid/ 。ミミトレも「いつから・いくら課金されるか」をトライアル開始前に明示し、終了前リマインドを送る側に倒す。
3. **完了後の報酬演出を何画面も連ねること。** Duolingo の完了後フローは XP・ストリーク・クエスト・リーグ・アップセルが連続する「報酬セレモニー」で、タップ数が多い点は批判もある https://aachmanshukla.com/case-studies/duolingo/ 。ミミトレの「3分で終わる軽さ」と相性が悪いので、完了サマリは1画面で完結させ、アップセルはその下部に小さく置く程度に留める。
4. **機能追加のたびにホームの構成を変えること。** abceed では「ホーム画面がAI英会話に乗っ取られた」「機能が多すぎてどこに何があるか分からない」という不満が報告されている https://erk-english.com/coaching/abceed-honest-review/ 。ミミトレのホームは「今日の1本＋ライブラリ」という骨格を固定し、新機能は既存の導線の中に差し込む。
5. **色だけに意味を持たせること。** ELSA の中核フィードバックは緑/黄/赤の色分けが中心で、色覚多様性への配慮は音や％など別キューの併用に頼っている https://blog.elsaspeak.com/en/advantage-of-elsa-feedback/ 。ミミトレの音変化カラーは種類の区別自体が色に依存しやすいので、色の追加ではなく形（下線種・太さ）やラベルでの冗長化を先にやる（提言3とセット）。
6. **中断時に進捗が消える実装。** abceed ではフリーズで強制終了した間に解いた問題がリセットされたという体験レビューがあり https://ninja.weblio.jp/abceed-review 、Speak でもフリーズ・進捗リセットの報告がある https://productivity-apps.com/apps/speak-language-learning 。ミミトレは文単位で進捗を即時保存し、着信等の中断後は同じ文から再開できることを仕様として保証する（スピークバディは「着信などで中断されてもスムーズに再開」を更新内容として明示している https://apps.apple.com/jp/app/ai%E8%8B%B1%E4%BC%9A%E8%A9%B1%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AF%E3%83%90%E3%83%87%E3%82%A3-%E3%82%B9%E3%83%94%E3%83%BC%E3%82%AD%E3%83%B3%E3%82%B0-%E3%83%AA%E3%82%B9%E3%83%8B%E3%83%B3%E3%82%B0-%E8%8B%B1%E8%AA%9E%E5%AD%A6%E7%BF%92/id1129621266 ）。
7. **教材までの階層を深くすること。** abceed の教材到達は約4タップの階層型で https://blog.coachfit.net/toeic-abceed-how-to-use/ 、コンテンツ量が多いアプリでは許容されても、ミミトレの12レッスン規模では過剰な階層になる。ライブラリからレッスン開始まで2タップ以内を維持する。
8. **ハンズフリー録音の副作用を放置すること。** Speak の自動聴取マイクは勝手に録音を始め文の途中で切れることがあり、恒常的にオフにする設定がない点が指摘されている https://productivity-apps.com/apps/speak-language-learning 。ミミトレの自動録音開始にも「今は自動で始めない」設定と、録音開始の明示的な合図（カウントやアニメーション）を必ず用意する。

---

# 付記: 未確認事項（公開情報で確認できなかったもの）

- Duolingo: オンボーディング内の課金訴求の正確なタイミング／シークバー・文単位スキップ・多段階速度の有無／空状態・エラー状態の専用画面仕様／文字サイズ・コントラストの公式数値仕様
- ELSA Speak: 戻る導線の公式説明／ABリピート専用機能の有無／空状態の表示仕様と遷移アニメーションのモーション仕様／タップ領域・文字サイズ・VoiceOverの公式明記
- Speak: 現行版オンボーディングの総ステップ数と登録位置（記事間で時期差）／講師音声の速度変更の現行仕様（情報が割れている）／アプリ内の明示的な「購入を復元」ボタンの有無／完了直後の専用サマリ画面の構成／モーダルとシートの使い分け基準
- スピークバディ: タブの完全な構成と戻る・復帰導線の詳細／正誤の色分け・効果音の具体仕様／専用シャドーイングモードとABリピートの有無／連続日数ストリークの有無／レッスン完了時の演出仕様
- abceed: 戻る導線の具体仕様／プッシュ通知・リマインドの文面・頻度・タイミング／ローディング・空状態・エラー表示の公式説明／モーション仕様／アクセシビリティ全般の公式明記
- 全アプリ共通: アクセシビリティ（タップ領域・Dynamic Type・コントラスト比・VoiceOver）の数値仕様は、Duolingo の設計分析資料を除き公式の明記がほぼ存在しなかった
