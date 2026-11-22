import XCTest

/// iPhone Duo smoke tests (Issue #60).
/// The Duo simulator cannot be captured with simctl screenshots headlessly,
/// so layout verification goes through XCUITest: element existence, frames,
/// and screen recordings attached to the test result.
final class DuoSmokeTests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    private func rectStr(_ r: CGRect) -> String {
        String(format: "(%.1f,%.1f,%.1f,%.1f)", r.origin.x, r.origin.y, r.width, r.height)
    }

    private func attachScreenshot(_ name: String) {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    private func waitForLibrary(timeout: TimeInterval = 30) {
        // Seeded state goes straight to the library; a fresh install shows the
        // diagnostic intro instead. Handle both.
        let tab = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "ホーム")).firstMatch
        if tab.waitForExistence(timeout: timeout) { return }
        let intro = app.buttons["診断をはじめる"]
        if intro.waitForExistence(timeout: 5) {
            intro.tap()
            let skip = app.buttons["スキップしてライブラリへ"]
            XCTAssertTrue(skip.waitForExistence(timeout: 10), "スキップ導線があるべき")
            skip.tap()
            XCTAssertTrue(tab.waitForExistence(timeout: 15), "ライブラリへ遷移するべき")
        }
    }

    func testLibraryOnDuo() throws {
        waitForLibrary()
        attachScreenshot("duo-library")

        // Today's pick card is one combined accessibility element.
        let card = app.otherElements.matching(NSPredicate(format: "label CONTAINS %@", "今日の1本")).firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 10), "ライブラリにおすすめカードが出るべき")

        for name in ["ホーム", "苦手フレーズ", "進捗", "設定"] {
            let tab = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", name)).firstMatch
            XCTAssertTrue(tab.exists, "\(name)タブがあるべき")
        }

        // If the app build carries the insets probe, log the reported
        // safe-area insets as evidence (sensor-bar analysis).
        let probe = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "INSETS-PROBE")).firstMatch
        if probe.waitForExistence(timeout: 5) {
            NSLog("DUO-EVIDENCE %@", probe.label)
        }

        // Soft probe: do synthetic taps reach the app at all here?
        let progressTab = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "進捗")).firstMatch
        progressTab.tap()
        let progressTitle = app.staticTexts["進捗"]
        let tabResponded = progressTitle.waitForExistence(timeout: 6)
        NSLog("DUO-EVIDENCE tabTapResponded=%@", tabResponded ? "YES" : "NO")
        if tabResponded {
            app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "ホーム")).firstMatch.tap()
        }

        // Record frames as evidence for the sensor-bar / safe-area analysis.
        let tabBar = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "ホーム")).firstMatch
        NSLog("DUO-EVIDENCE window=%@ card=%@ firstTab=%@",
              rectStr(app.windows.firstMatch.frame),
              rectStr(card.frame),
              rectStr(tabBar.frame))
    }

    @available(iOS 16.4, *)
    func testLessonTransportBarOnDuo() throws {
        waitForLibrary()
        // Navigate by deep link: synthetic taps on combined RN elements are
        // unreliable in this headless environment, while the route is the
        // same one the card's onPress pushes (/lesson?lesson=<id>).
        app.open(URL(string: "englistening:///lesson?lesson=hotel-checkin")!)

        let next = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "次の文")).firstMatch
        XCTAssertTrue(next.waitForExistence(timeout: 20), "レッスン下部に「次の文」があるべき")
        let play = app.buttons.matching(NSPredicate(format: "label CONTAINS %@ OR label CONTAINS %@", "再生", "一時停止")).firstMatch
        XCTAssertTrue(play.exists, "再生/一時停止ボタンがあるべき")
        attachScreenshot("duo-lesson")
        NSLog("DUO-EVIDENCE nextBtn=%@ playBtn=%@",
              rectStr(next.frame), rectStr(play.frame))
    }
}
