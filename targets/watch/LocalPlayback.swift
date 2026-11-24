import AVFoundation
import Foundation
import WatchConnectivity

// MARK: - 同梱レッスン (Watch 単体再生用)

struct WatchSentence {
    let startSec: Double
    let endSec: Double
    let text: String
    let translationJa: String
}

struct WatchLesson: Identifiable {
    let id: String
    let titleJa: String
    let durationSec: Double
    let sentences: [WatchSentence]
    let audioURL: URL
}

/// targets/watch/Lessons/<id>.json / <id>.m4a (tools/watch-assets/sync_watch_assets.sh で
/// assets/lessons から同期) を読む。並びは iPhone 側カタログと同じ順序。
enum LessonLibrary {
    static let orderedIds: [String] = [
        "cafe-ordering", "hotel-checkin", "asking-directions", "shopping-clothes",
        "restaurant-order", "phone-appointment", "at-the-airport", "small-talk-coworker",
        "gym-signup", "weekend-plans",
        "my-morning-routine", "weekend-in-kyoto", "introducing-my-hometown", "my-favorite-movie",
        "rainy-day-indoors",
    ]

    static let all: [WatchLesson] = orderedIds.compactMap(load)

    private static func load(id: String) -> WatchLesson? {
        guard let jsonURL = Bundle.main.url(forResource: id, withExtension: "json"),
              let audioURL = Bundle.main.url(forResource: id, withExtension: "m4a"),
              let data = try? Data(contentsOf: jsonURL),
              let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let rawSentences = root["sentences"] as? [Any]
        else { return nil }
        let sentences: [WatchSentence] = rawSentences.compactMap { item in
            guard let s = item as? [String: Any],
                  let text = s["text"] as? String,
                  let ja = s["translationJa"] as? String
            else { return nil }
            return WatchSentence(
                startSec: (s["startSec"] as? NSNumber)?.doubleValue ?? 0,
                endSec: (s["endSec"] as? NSNumber)?.doubleValue ?? 0,
                text: text,
                translationJa: ja
            )
        }
        guard !sentences.isEmpty else { return nil }
        return WatchLesson(
            id: id,
            titleJa: (root["titleJa"] as? String) ?? id,
            durationSec: (root["durationSec"] as? NSNumber)?.doubleValue ?? (sentences.last?.endSec ?? 0),
            sentences: sentences,
            audioURL: audioURL
        )
    }
}

// MARK: - Watch で記録した学習セッション (iPhone へ同期して戻す)

struct WatchStudySession {
    let id: String
    let date: String
    let lessonId: String
    let seconds: Int
    let completed: Bool

    var asDictionary: [String: Any] {
        ["id": id, "date": date, "lessonId": lessonId, "seconds": seconds, "completed": completed]
    }
}

/// 未送信セッションを UserDefaults に保持し、WCSession が使えるタイミングで
/// transferUserInfo (キューイングされ、iPhone 側アプリ未起動でも後で届く) に載せる。
/// 載せた時点でローカルからは消す (転送キュー自体が永続化されるため)。
/// iPhone 側はセッションIDで重複を排除するので、二重に届いても二重計上しない。
final class WatchSessionStore {
    static let shared = WatchSessionStore()
    private let key = "watchLocalSessions.v1"
    private let defaults = UserDefaults.standard

    func append(_ session: WatchStudySession) {
        var all = pending()
        all.append(session)
        // 削除は iPhone の ack (removeApplied) だけが根拠。件数上限で
        // 未確認のセッションを落とすことはしない。
        defaults.set(all.map { $0.asDictionary }, forKey: key)
        publishContext()
        transferOne(session)
    }

    /// 追加した1件だけを即時配送の補助経路に載せる (一覧全体は context が担う)。
    private func transferOne(_ item: WatchStudySession) {
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        session.transferUserInfo(["session": item.asDictionary])
        if session.isReachable {
            session.sendMessage(["session": item.asDictionary], replyHandler: nil, errorHandler: nil)
        }
    }

    /// iPhone が適用済みと返してきたセッションを取り除き、残りを再公開する。
    func removeApplied(_ ids: [String]) {
        let idSet = Set(ids)
        let remaining = pending().filter { !idSet.contains($0.id) }
        defaults.set(remaining.map { $0.asDictionary }, forKey: key)
        publishContext()
    }

    /// 未適用セッションの一覧を自分の applicationContext に公開する。
    /// iPhone 側はこれを受けて進捗へ合算し、適用済みIDを自側の context で返す。
    func publishContext() {
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        try? session.updateApplicationContext(
            ["pendingSessions": pending().map { $0.asDictionary }]
        )
    }

    func pending() -> [WatchStudySession] {
        let raw = defaults.array(forKey: key) as? [[String: Any]] ?? []
        return raw.compactMap { d in
            guard let id = d["id"] as? String,
                  let date = d["date"] as? String,
                  let lessonId = d["lessonId"] as? String
            else { return nil }
            return WatchStudySession(
                id: id,
                date: date,
                lessonId: lessonId,
                seconds: (d["seconds"] as? NSNumber)?.intValue ?? 0,
                completed: (d["completed"] as? NSNumber)?.boolValue ?? false
            )
        }
    }

    func flush() {
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        let items = pending()
        guard !items.isEmpty else { return }
        // ここではローカル一覧を消さない。適用済みの確定は iPhone からの
        // ack (removeApplied) だけが根拠で、転送キューの都合で消すと
        // オフライン分の記録が失われる。
        // 既に転送キューに載っている分は再投入しない。
        let outstandingIds = Set(session.outstandingUserInfoTransfers.compactMap { transfer in
            ((transfer.userInfo["session"] as? [String: Any])?["id"] as? String)
        })
        for item in items where !outstandingIds.contains(item.id) {
            // 届く保証のあるキューに載せつつ、近くに iPhone があれば即時送信も試す
            // (iPhone 側はセッションIDで重複排除するため二重計上しない)。
            session.transferUserInfo(["session": item.asDictionary])
            if session.isReachable {
                session.sendMessage(["session": item.asDictionary], replyHandler: nil, errorHandler: nil)
            }
        }
    }
}

// MARK: - ローカルプレイヤー (iPhone なしで再生する)

final class LocalPlayer: NSObject, ObservableObject, AVAudioPlayerDelegate {
    @Published private(set) var lesson: WatchLesson?
    @Published private(set) var sentenceIndex = 0
    @Published private(set) var isPlaying = false
    @Published private(set) var rate: Double = 1.0

    private var player: AVAudioPlayer?
    private var timer: Timer?
    /// 再生していた実時間の計測 (Timer の通知回数ではなく壁時計で測る)。
    private var elapsedBase: Double = 0
    private var playStartedAt: Date?
    private var sessionCompleted = false

    private var currentElapsed: Double {
        elapsedBase + (playStartedAt.map { Date().timeIntervalSince($0) } ?? 0)
    }

    static let rates: [Double] = [0.7, 0.85, 1.0, 1.15, 1.3]

    var hasLesson: Bool { lesson != nil }
    var currentSentence: WatchSentence? {
        guard let lesson = lesson, lesson.sentences.indices.contains(sentenceIndex) else { return nil }
        return lesson.sentences[sentenceIndex]
    }

    func start(_ target: WatchLesson) {
        flushSession()
        do {
            let p = try AVAudioPlayer(contentsOf: target.audioURL)
            p.delegate = self
            p.enableRate = true
            p.rate = Float(rate)
            p.prepareToPlay()
            player = p
            lesson = target
            sentenceIndex = 0
            elapsedBase = 0
            playStartedAt = nil
            sessionCompleted = false
            play()
        } catch {
            player = nil
            lesson = nil
            isPlaying = false
        }
    }

    func togglePlay() {
        guard player != nil else { return }
        if isPlaying {
            pause()
        } else {
            play()
        }
    }

    func play() {
        guard let player = player else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback)
        try? AVAudioSession.sharedInstance().setActive(true)
        player.rate = Float(rate)
        // 開始に失敗したら再生中にはせず、停止状態のまま再試行できるようにする。
        if player.play() {
            isPlaying = true
            playStartedAt = Date()
            startTimer()
        } else {
            isPlaying = false
        }
    }

    func pause() {
        player?.pause()
        if let started = playStartedAt {
            elapsedBase += Date().timeIntervalSince(started)
            playStartedAt = nil
        }
        isPlaying = false
        stopTimer()
        flushSession()
    }

    /// ローカル再生をやめて、表示を iPhone リモコン側に戻す。
    func stopAndUnload() {
        pause()
        player = nil
        lesson = nil
        sentenceIndex = 0
    }

    func nextSentence() {
        guard let lesson = lesson else { return }
        seek(toSentence: min(sentenceIndex + 1, lesson.sentences.count - 1))
    }

    func prevSentence() {
        seek(toSentence: max(sentenceIndex - 1, 0))
    }

    func cycleRate() {
        let idx = Self.rates.firstIndex(of: rate) ?? 2
        rate = Self.rates[(idx + 1) % Self.rates.count]
        if isPlaying {
            player?.rate = Float(rate)
        }
    }

    private func seek(toSentence index: Int) {
        guard let lesson = lesson, let player = player,
              lesson.sentences.indices.contains(index) else { return }
        player.currentTime = lesson.sentences[index].startSec + 0.01
        sentenceIndex = index
    }

    private func startTimer() {
        stopTimer()
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func tick() {
        guard let player = player, let lesson = lesson, player.isPlaying else { return }
        let t = player.currentTime
        if let idx = lesson.sentences.firstIndex(where: { t >= $0.startSec && t < $0.endSec }) {
            if idx != sentenceIndex {
                sentenceIndex = idx
            }
        } else if t >= (lesson.sentences.last?.endSec ?? 0) {
            sentenceIndex = lesson.sentences.count - 1
        }
    }

    /// 再生し終えたら記録して次のレッスンを自動で続ける (ハンズフリー前提)。
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        guard flag, let lesson = lesson else { return }
        if let started = playStartedAt {
            elapsedBase += Date().timeIntervalSince(started)
            playStartedAt = nil
        }
        sessionCompleted = true
        isPlaying = false
        stopTimer()
        flushSession()
        let ids = LessonLibrary.orderedIds
        if let idx = ids.firstIndex(of: lesson.id),
           let next = LessonLibrary.all.first(where: { $0.id == ids[(idx + 1) % ids.count] }) {
            start(next)
        }
    }

    /// 5秒以上聴いた分をセッションとして記録する (完了は秒数に関わらず記録)。
    /// 閾値未満の一時停止ではリセットせず、同じレッスンの再開で積み上がるようにする
    /// (レッスン切替時は start() が明示的にゼロへ戻す)。
    private func flushSession() {
        guard let lesson = lesson else { return }
        let seconds = Int(currentElapsed)
        if seconds >= 5 || sessionCompleted {
            let formatter = DateFormatter()
            formatter.calendar = Calendar(identifier: .gregorian)
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd"
            WatchSessionStore.shared.append(WatchStudySession(
                id: UUID().uuidString,
                date: formatter.string(from: Date()),
                lessonId: lesson.id,
                seconds: max(seconds, 0),
                completed: sessionCompleted
            ))
            elapsedBase = 0
            sessionCompleted = false
        }
    }
}
