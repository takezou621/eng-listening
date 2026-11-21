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

/// iPhone との WatchConnectivity セッション管理 (スパイク用)。
/// 接続状態の表示と、iPhone への ping 送信だけを行う。
final class WatchConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
    @Published var statusText: String = "未接続"

    override init() {
        super.init()
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }

    func sendPing() {
        let session = WCSession.default
        guard session.isReachable else {
            statusText = "iPhone に届きません"
            return
        }
        session.sendMessage(["ping": Date().timeIntervalSince1970], replyHandler: { reply in
            DispatchQueue.main.async {
                self.statusText = "応答: \(reply["pong"] != nil ? "OK" : "?")"
            }
        }, errorHandler: { error in
            DispatchQueue.main.async {
                self.statusText = "送信失敗"
                _ = error
            }
        })
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.statusText = activationState == .activated ? "接続済み" : "未接続"
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        replyHandler(["ack": true])
    }
}

struct ContentView: View {
    @EnvironmentObject private var connectivity: WatchConnectivityManager

    var body: some View {
        VStack(spacing: 8) {
            Text("ミミトレ")
                .font(.headline)
            Text(connectivity.statusText)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Button("iPhone へ ping") {
                connectivity.sendPing()
            }
        }
    }
}
