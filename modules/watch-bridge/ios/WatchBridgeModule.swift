import ExpoModulesCore
import WatchConnectivity

/// WCSession のデリゲート専用オブジェクト。
/// ExpoModulesCore の Module は NSObject を継承しないため、NSObjectProtocol を
/// 要求する WCSessionDelegate への適合はこのクラスに分離する。
final class WatchSessionDelegate: NSObject, WCSessionDelegate {
  var onCommand: (([String: Any]) -> Void)?
  var onActivated: (() -> Void)?
  var onStudySession: (([String: Any]) -> Void)?

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if activationState == .activated, error == nil {
      onActivated?()
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // iOS ではペアリング先の Watch が切り替わることがあるため再活性化する。
    session.activate()
  }

  /// replyHandler なしで送られたメッセージ (Watch の即時送信はこちらに届く)。
  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handleMessage(message)
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    handleMessage(message)
    replyHandler(["ack": true])
  }

  private func handleMessage(_ message: [String: Any]) {
    // 学習セッションの即時送信 (sendMessage) も同じ受け口で処理する。
    if let studySession = message["session"] as? [String: Any] {
      onStudySession?(studySession)
    }
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
  }

  /// Watch 単体学習のセッション記録 (transferUserInfo で届く)。
  /// Watch が applicationContext で公開した未適用セッションの受け口。
  func session(
    _ session: WCSession,
    didReceiveApplicationContext applicationContext: [String: Any]
  ) {
    if let sessions = applicationContext["pendingSessions"] as? [[String: Any]] {
      for studySession in sessions {
        onStudySession?(studySession)
      }
    }
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    if let studySession = userInfo["session"] as? [String: Any] {
      onStudySession?(studySession)
    }
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
  /// 活性化前に届いた最新状態。活性化が完了した時点で再送する。
  private var lastState: [String: Any]?
  /// JS の購読が始まる前に届いた学習セッション。getPendingStudySessions で回収される。
  private var pendingStudySessions: [[String: Any]] = []
  /// lastState の読み書きと送信を直列化する (JS 側と WCSession の
  /// コールバックが別スレッドから触るため)。
  private let stateQueue = DispatchQueue(label: "com.takezou.englistening.watchbridge.state")

  public func definition() -> ModuleDefinition {
    Name("WatchBridge")

    Events("onWatchCommand", "onWatchSessions")

    OnCreate {
      self.setupSession()
    }

    /// 最新のアプリ状態 (再生状態 + ライブラリ状態) を Watch に送る。
    /// セッション未活性・未ペアリング時は false を返し、JS 側は失敗を無視する。
    Function("updateContext") { (context: [String: Any]) -> Bool in
      // 状態は常に保持しておき、未活性化なら活性化完了後に再送する
      // (初回の進捗・再生状態が届かないままにならないように)。
      self.stateQueue.sync {
        self.lastState = context
        return self.sendLastStateLocked()
      }
    }

    /// 購読開始前に届いていた学習セッションを返し、バッファを空にする。
    Function("getPendingStudySessions") { () -> [[String: Any]] in
      self.stateQueue.sync {
        let out = self.pendingStudySessions
        self.pendingStudySessions = []
        return out
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

  /// stateQueue の内側でだけ呼ぶ。
  private func sendLastStateLocked() -> Bool {
    guard let session = self.session, session.activationState == .activated,
      let lastState = self.lastState
    else {
      return false
    }
    do {
      try session.updateApplicationContext(["state": lastState])
      return true
    } catch {
      return false
    }
  }

  private func setupSession() {
    guard WCSession.isSupported() else { return }
    sessionDelegate.onCommand = { [weak self] payload in
      self?.sendEvent("onWatchCommand", payload)
    }
    sessionDelegate.onStudySession = { [weak self] studySession in
      guard let self = self else { return }
      self.stateQueue.sync {
        // Watch は未適用一覧を丸ごと再送するため、同じIDはバッファに重ねない。
        let id = studySession["id"] as? String
        let alreadyBuffered = id != nil
          && self.pendingStudySessions.contains { ($0["id"] as? String) == id }
        if !alreadyBuffered {
          self.pendingStudySessions.append(studySession)
        }
      }
      self.sendEvent("onWatchSessions", ["sessions": [studySession]])
    }
    sessionDelegate.onActivated = { [weak self] in
      guard let self = self else { return }
      _ = self.stateQueue.sync { self.sendLastStateLocked() }
    }
    let session = WCSession.default
    session.delegate = sessionDelegate
    session.activate()
    self.session = session
  }
}
