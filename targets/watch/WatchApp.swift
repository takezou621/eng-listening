import SwiftUI
import WatchConnectivity

@main
struct MimitoreWatchApp: App {
    @StateObject private var connectivity = WatchConnectivityManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(connectivity)
        }
    }
}

// MARK: - iPhone から受け取る状態

struct PlaybackState: Equatable {
    var lessonTitle: String
    var sentenceIndex: Int
    var sentenceCount: Int
    var textEn: String
    var textJa: String
    var isPlaying: Bool
    var rate: Double

    init?(_ dict: [String: Any]) {
        // 数値は NSNumber 経由で読む (JS 側の数値は整数/小数の区別なく届くため、
        // as? Int のような直接キャストは小数で失敗する)。
        guard
            let title = dict["lessonTitle"] as? String,
            let index = (dict["sentenceIndex"] as? NSNumber)?.intValue,
            let count = (dict["sentenceCount"] as? NSNumber)?.intValue,
            let en = dict["textEn"] as? String,
            let ja = dict["textJa"] as? String,
            let playing = dict["isPlaying"] as? Bool,
            let rate = (dict["rate"] as? NSNumber)?.doubleValue
        else { return nil }
        lessonTitle = title
        sentenceIndex = index
        sentenceCount = count
        textEn = en
        textJa = ja
        isPlaying = playing
        self.rate = rate
    }
}

struct PhraseItem {
    var textEn: String
    var textJa: String
}

struct LibraryState {
    var todaySeconds: Int
    var streakDays: Int
    var todayCompletedCount: Int
    var phrases: [PhraseItem]

    init?(_ dict: [String: Any]) {
        // 数値は NSNumber 経由で読む (todaySeconds は JS 側で小数が届きうるため)。
        guard
            let seconds = (dict["todaySeconds"] as? NSNumber)?.intValue,
            let streak = (dict["streakDays"] as? NSNumber)?.intValue,
            let completed = (dict["todayCompletedCount"] as? NSNumber)?.intValue
        else { return nil }
        todaySeconds = seconds
        streakDays = streak
        todayCompletedCount = completed
        // applicationContext 由来の配列は NSArray として届くため、要素ごとに
        // 辞書へ変換する ([[String: Any]] への一括キャストは失敗しうる)。
        let rawPhrases = dict["phrases"] as? [Any] ?? []
        phrases = rawPhrases.compactMap { item in
            guard
                let entry = item as? [String: Any],
                let en = entry["textEn"] as? String,
                let ja = entry["textJa"] as? String
            else { return nil }
            return PhraseItem(textEn: en, textJa: ja)
        }
    }
}

// MARK: - WatchConnectivity

/// iPhone との WatchConnectivity セッション管理 (Phase 1)。
/// 状態は applicationContext で受け取り、操作は sendMessage で送る。
final class WatchConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
    @Published var playback: PlaybackState?
    @Published var library: LibraryState?
    @Published var connectionText: String = "未接続"

    private static let rates: [Double] = [0.7, 0.85, 1.0, 1.15, 1.3]

    /// 送信ごとの世代。失敗時の巻き戻しは、その送信が最新のときだけ行う
    /// (楽観更新が短時間に重なると、古い失敗で新しい状態を巻き戻してしまうため)。
    private var sendGeneration = 0

    override init() {
        super.init()
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }

    /// 操作コマンドを iPhone に送る。再生状態は iPhone からの次の状態同期で
    /// 確定するが、ボタンの反応が遅く見えないよう代表的なものは楽観的に反映する。
    func send(_ command: String) {
        let session = WCSession.default
        guard session.isReachable else {
            connectionText = "iPhoneに接続できません"
            return
        }
        sendGeneration += 1
        let generation = sendGeneration
        let previous = playback
        var optimistic: PlaybackState?
        if command == "togglePlay", var current = playback {
            current.isPlaying.toggle()
            optimistic = current
        }
        if command == "cycleRate", var current = playback,
           let index = Self.rates.firstIndex(of: current.rate) {
            current.rate = Self.rates[(index + 1) % Self.rates.count]
            optimistic = current
        }
        if let optimistic {
            playback = optimistic
        }
        session.sendMessage(["command": command], replyHandler: { _ in
            DispatchQueue.main.async {
                self.connectionText = "接続済み"
            }
        }, errorHandler: { _ in
            DispatchQueue.main.async {
                self.connectionText = "送信に失敗しました"
                // 楽観的に変えた表示が残り続けないよう、失敗時は元の状態に戻す
                // (この送信より後の操作や新しい状態が優先される)。
                if generation == self.sendGeneration, self.playback == optimistic {
                    self.playback = previous
                }
            }
        })
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        DispatchQueue.main.async {
            self.connectionText = activationState == .activated ? "接続済み" : "未接続"
        }
        if activationState == .activated {
            // 再起動時は新しい context が届くまで表示が空になるため、
            // 受信済みの最新 context をそのまま反映する。
            self.session(session, didReceiveApplicationContext: session.receivedApplicationContext)
        }
    }

    func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        guard let state = applicationContext["state"] as? [String: Any] else { return }
        DispatchQueue.main.async {
            if let raw = state["playback"] as? [String: Any] {
                self.playback = PlaybackState(raw)
            } else {
                self.playback = nil
            }
            if let raw = state["library"] as? [String: Any] {
                self.library = LibraryState(raw)
            }
        }
    }
}

// MARK: - Views

struct ContentView: View {
    var body: some View {
        TabView {
            NowPlayingView()
            ProgressView()
            PhrasesView()
        }
        .tabViewStyle(.verticalPage)
    }
}

struct NowPlayingView: View {
    @EnvironmentObject private var connectivity: WatchConnectivityManager

    var body: some View {
        ScrollView {
            if let playback = connectivity.playback {
                VStack(alignment: .leading, spacing: 6) {
                    Text(playback.lessonTitle)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text("文 \(playback.sentenceIndex + 1) / \(playback.sentenceCount)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(playback.textEn)
                        .font(.body)
                    Text(playback.textJa)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 12) {
                        Button {
                            connectivity.send("prevSentence")
                        } label: {
                            Image(systemName: "backward.fill")
                        }
                        .accessibilityLabel("前の文")
                        Button {
                            connectivity.send("togglePlay")
                        } label: {
                            Image(systemName: playback.isPlaying ? "pause.fill" : "play.fill")
                        }
                        .accessibilityLabel(playback.isPlaying ? "一時停止" : "再生")
                        Button {
                            connectivity.send("nextSentence")
                        } label: {
                            Image(systemName: "forward.fill")
                        }
                        .accessibilityLabel("次の文")
                    }
                    .buttonStyle(.plain)
                    .font(.title3)
                    Button {
                        connectivity.send("cycleRate")
                    } label: {
                        Text(rateLabel(playback.rate))
                            .font(.caption)
                    }
                    .accessibilityLabel("再生速度")
                    if connectivity.connectionText != "接続済み" {
                        // 送信失敗などの理由を、レッスン表示中でも見える場所に出す
                        Text(connectivity.connectionText)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                VStack(spacing: 6) {
                    Text("ミミトレ")
                        .font(.headline)
                    Text("iPhoneでレッスンを開いてください")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(connectivity.connectionText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func rateLabel(_ rate: Double) -> String {
        // %g: 1.15 や 0.85 はそのまま、1.0 は "1" と表示する (%.2g では 1.15 が化ける)
        let trimmed = String(format: "%g", rate)
        return "\(trimmed)x"
    }
}

struct ProgressView: View {
    @EnvironmentObject private var connectivity: WatchConnectivityManager

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("今日の進捗")
                    .font(.headline)
                if let library = connectivity.library {
                    progressRow(label: "学習時間", value: "\(library.todaySeconds / 60)分")
                    progressRow(label: "連続学習", value: "\(library.streakDays)日")
                    progressRow(label: "今日の完了", value: "\(library.todayCompletedCount)レッスン")
                } else {
                    Text("データがありません")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func progressRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.body)
        }
    }
}

struct PhrasesView: View {
    @EnvironmentObject private var connectivity: WatchConnectivityManager

    var body: some View {
        Group {
            if let library = connectivity.library, !library.phrases.isEmpty {
                List {
                    Section("苦手フレーズ") {
                        ForEach(Array(library.phrases.enumerated()), id: \.offset) { _, phrase in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(phrase.textEn)
                                    .font(.caption)
                                Text(phrase.textJa)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            } else {
                VStack(spacing: 6) {
                    Text("苦手フレーズ")
                        .font(.headline)
                    Text("まだありません")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}
