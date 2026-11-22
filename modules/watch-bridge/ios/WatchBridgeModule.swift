import ExpoModulesCore
import WatchConnectivity

/// WCSession のデリゲート専用オブジェクト。
/// ExpoModulesCore の Module は NSObject を継承しないため、NSObjectProtocol を
/// 要求する WCSessionDelegate への適合はこのクラスに分離する。
final class WatchSessionDelegate: NSObject, WCSessionDelegate {
  var onCommand: (([String: Any]) -> Void)?

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {}

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // iOS ではペアリング先の Watch が切り替わることがあるため再活性化する。
    session.activate()
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    var payload: [String: Any] = [:]
    if let type = message["command"] as? String {
      payload["type"] = type
    }
    if let rate = message["rate"] as? Double {
      payload["rate"] = rate
    }
    if payload["type"] != nil {
      onCommand?(payload)
    }
    replyHandler(["ack": true])
  }
}

/// iPhone 側の WatchConnectivity ブリッジ (Apple Watch Phase 1)。
///
/// - JS → Watch: 再生状態とライブラリ状態を `updateApplicationContext` で送る
///   (最新状態だけが Watch に残るため、状態同期に適している)。
/// - Watch → JS: 操作コマンドを `sendMessage` で受け、`onWatchCommand` イベントで
///   JS 側 (レッスン画面が登録したハンドラ) に渡す。即時に ack を返す。
public class WatchBridgeModule: Module {
  private let sessionDelegate = WatchSessionDelegate()
  private var session: WCSession?

  public func definition() -> ModuleDefinition {
    Name("WatchBridge")

    Events("onWatchCommand")

    OnCreate {
      self.setupSession()
    }

    /// 最新のアプリ状態 (再生状態 + ライブラリ状態) を Watch に送る。
    /// セッション未活性・未ペアリング時は false を返し、JS 側は失敗を無視する。
    Function("updateContext") { (context: [String: Any]) -> Bool in
      guard let session = self.session, session.activationState == .activated else {
        return false
      }
      do {
        try session.updateApplicationContext(["state": context])
        return true
      } catch {
        return false
      }
    }

    Function("getConnectionState") { () -> [String: Any] in
      guard let session = self.session else {
        return [
          "supported": false,
          "activated": false,
          "paired": false,
          "watchAppInstalled": false,
          "reachable": false,
        ]
      }
      return [
        "supported": true,
        "activated": session.activationState == .activated,
        "paired": session.isPaired,
        "watchAppInstalled": session.isWatchAppInstalled,
        "reachable": session.isReachable,
      ]
    }
  }

  private func setupSession() {
    guard WCSession.isSupported() else { return }
    sessionDelegate.onCommand = { [weak self] payload in
      self?.sendEvent("onWatchCommand", payload)
    }
    let session = WCSession.default
    session.delegate = sessionDelegate
    session.activate()
    self.session = session
  }
}
