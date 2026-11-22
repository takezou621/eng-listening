import XCTest

/// iPhone Duo 向けスモークテスト (Issue #60)。
///
/// iPhone Duo (SimDeviceType com.apple.CoreSimulator.SimDeviceType.iPhone-Duo) は
/// 内蔵ディスプレイを 2 枚持つ構成:
/// - LCD (アウター): 1398×2034 px @3x = 466×678 pt。右端に縦型センサーバーがあり、
///   セーフエリアの右インセットが大きい (eyechecker #243 の調査では 84pt)。
/// - LCD-1 (インナー): 2007×2853 px @3x = 669×951 pt。
/// アプリは LCD 側で起動する (eyechecker 2.45 の実績)。
///
/// このシミュレータは GUI (Simulator.app) が無い環境ではフレームバッファ撮影が
/// 真っ黒になるため、画面の裏取りは XCUITest のスクリーンショットで行う。
/// テストは「起動して主要画面が出ること」と「レッスン画面の再生バーが出ること」を
/// 確認し、各段階のスクリーンショットを添付として残す (目視確認用)。
final class DuoSmokeTests: XCTestCase {
    private let app = XCUIApplication()

    private func attachScreenshot(_ name: String) {
        let shot = XCUIScreen.main.screenshot()
        let att = XCTAttachment(screenshot: shot)
        att.name = name
        att.lifetime = .keepAlways
        add(att)
    }

    private func launchToLibrary() {
        app.launch()
        // 初回起動 (診断イントロ) と通常起動 (ライブラリ) のどちらにも対応する
        let libraryTitle = app.staticTexts["ライブラリ"]
        if libraryTitle.waitForExistence(timeout: 15) {
            return
        }
        // 診断イントロが出たら、質問画面のスキップリンクでライブラリへ抜ける
        let startButton = app.buttons["診断をはじめる"]
        XCTAssertTrue(startButton.waitForExistence(timeout: 10), "ライブラリか診断イントロのどちらかが出るべき")
        startButton.tap()
        let skip = app.buttons["スキップしてライブラリへ"]
        if !skip.waitForExistence(timeout: 8) {
            // スキップがボタンでなくテキスト要素の場合
            let skipText = app.staticTexts["スキップしてライブラリへ"]
            XCTAssertTrue(skipText.waitForExistence(timeout: 5), "診断画面にスキップ導線があるべき")
            skipText.tap()
        } else {
            skip.tap()
        }
        XCTAssertTrue(libraryTitle.waitForExistence(timeout: 10), "スキップ後にライブラリが出るべき")
    }

    func testLibraryOnDuo() throws {
        launchToLibrary()
        // 画面サイズを記録する (どのディスプレイに載ったかの証跡)
        let image = XCUIScreen.main.screenshot().image
        let px = "\(Int(image.size.width * image.scale))x\(Int(image.size.height * image.scale))"
        attachScreenshot("library-\(px)")

        XCTAssertTrue(app.staticTexts["今日の1本"].waitForExistence(timeout: 5)
                      || app.staticTexts["復習におすすめ"].waitForExistence(timeout: 5),
                      "ライブラリにおすすめカードが出るべき")
        XCTAssertTrue(app.buttons["ホーム"].waitForExistence(timeout: 5), "ホームタブがあるべき")
        XCTAssertTrue(app.buttons["苦手フレーズ"].waitForExistence(timeout: 5), "苦手フレーズタブがあるべき")
        XCTAssertTrue(app.buttons["進捗"].waitForExistence(timeout: 5), "進捗タブがあるべき")
        XCTAssertTrue(app.buttons["設定"].waitForExistence(timeout: 5), "設定タブがあるべき")
    }

    func testLessonTransportBarOnDuo() throws {
        launchToLibrary()
        // 「今日の1本」カード (Pressable) をタップしてレッスンへ
        let startText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "はじめる")).firstMatch
        XCTAssertTrue(startText.waitForExistence(timeout: 8), "おすすめカードに開始導線があるべき")
        startText.tap()

        // 再生バー (下部固定) の要素確認
        let nextButton = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "次の文")).firstMatch
        XCTAssertTrue(nextButton.waitForExistence(timeout: 10), "再生バーに「次の文」があるべき")
        let playButton = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "再生")).firstMatch
        XCTAssertTrue(playButton.waitForExistence(timeout: 5), "再生バーに「再生」があるべき")
        attachScreenshot("lesson")
    }
}
