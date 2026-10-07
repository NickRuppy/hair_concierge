import Foundation
import UIKit
import UserNotifications

/// Links carry an opaque identifier, never assessment data or account authority.
enum ResearchDestination {
    static var callbackScheme: String {
        #if HOSTED_PILOT
        "chaarlie-pilot"
        #elseif DEBUG
        "chaarlie-local"
        #else
        "chaarlie"
        #endif
    }

    static func parse(_ url: URL, scheme: String = callbackScheme) -> UUID? {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.user == nil, parts.password == nil, parts.port == nil,
              parts.query == nil, parts.fragment == nil else { return nil }
        let prefix: String
        if parts.scheme == "https", parts.host == "chaarlie.de" { prefix = "/app/research/" }
        else if parts.scheme == scheme, parts.host == "research" { prefix = "/" }
        else { return nil }
        // Exact path avoids encoded separators, extra components and partial UUID matches.
        guard parts.percentEncodedPath.hasPrefix(prefix) else { return nil }
        let identifier = String(parts.percentEncodedPath.dropFirst(prefix.count))
        guard let id = UUID(uuidString: identifier), identifier.lowercased() == id.uuidString.lowercased() else { return nil }
        return id
    }

    static func notificationURL(_ userInfo: [AnyHashable: Any]) -> URL? {
        guard let value = userInfo["url"] as? String, let url = URL(string: value), parse(url) != nil else { return nil }
        return url
    }
}

struct PushRegistration: Encodable, Sendable {
    let installationId: String
    let token: String
    let environment: String
    let topic: String
}
struct PushRegistrationResponse: Decodable { let registered: Bool }

@MainActor
protocol ResearchNotificationSystem {
    var environment: String? { get }
    var topic: String? { get }
    func isAuthorized() async -> Bool
    func requestAuthorization() async -> Bool
    func register()
    func unregister()
}

@MainActor
struct AppleResearchNotifications: ResearchNotificationSystem {
    var environment: String? {
        #if targetEnvironment(simulator)
        return nil
        #else
        // Set only alongside the matching signed APNs entitlement at release setup.
        guard let value = Bundle.main.object(forInfoDictionaryKey: "ChaarliePushEnvironment") as? String,
              ["sandbox", "production"].contains(value) else { return nil }
        return value
        #endif
    }
    var topic: String? { Bundle.main.bundleIdentifier }
    func isAuthorized() async -> Bool {
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        return status == .authorized || status == .provisional || status == .ephemeral
    }
    func requestAuthorization() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) ?? false
    }
    func register() { UIApplication.shared.registerForRemoteNotifications() }
    func unregister() { UIApplication.shared.unregisterForRemoteNotifications() }
}

/// Permission is contextual and contingent on successful APNs registration. Merely
/// enabling a server flag cannot prompt an unsigned or unconfigured application.
@MainActor
final class ResearchPushCoordinator {
    private(set) var installationId: String
    private let persistsInstallation: Bool
    private let system: any ResearchNotificationSystem
    private var client: MobileClient?
    private var clientGeneration: UUID?
    private var generation = UUID()
    private var wantsPermission = false
    var installationToRevoke: String? { client == nil ? nil : installationId }

    init(system: any ResearchNotificationSystem = AppleResearchNotifications(), installationId: String? = nil) {
        self.system = system
        persistsInstallation = installationId == nil
        if let installationId { self.installationId = installationId }
        else {
            let key = "research-push-installation"
            let existing = UserDefaults.standard.string(forKey: key).flatMap(UUID.init(uuidString:))
            let value = (existing ?? UUID()).uuidString.lowercased()
            UserDefaults.standard.set(value, forKey: key)
            self.installationId = value
        }
    }

    func activate(client: MobileClient, enabled: Bool) async {
        guard enabled, system.environment != nil, system.topic != nil else { reset(); return }
        let operation = generation
        let epoch = await client.sessionGeneration()
        guard operation == generation else { return }
        self.client = client; clientGeneration = epoch
        let authorized = await system.isAuthorized()
        guard operation == generation else { return }
        if authorized { system.register() }
    }

    func confirmedResearch() {
        guard client != nil, clientGeneration != nil, system.environment != nil else { return }
        wantsPermission = true
        // Registration itself does not show the permission prompt. A successful
        // token callback is required before requesting alert authorization.
        system.register()
    }

    func didRegister(token: Data) async {
        guard !token.isEmpty, let client, let expected = clientGeneration,
              let environment = system.environment, let topic = system.topic else { return }
        let operation = generation
        let requestPermission = wantsPermission
        wantsPermission = false
        let authorized = requestPermission ? await system.requestAuthorization() : await system.isAuthorized()
        guard operation == generation, authorized else { return }
        let registration = PushRegistration(installationId: installationId,
            token: token.map { String(format: "%02x", $0) }.joined(), environment: environment, topic: topic)
        // Failures are retried by APNs registration on the next active session.
        try? await client.registerPush(registration, ifGeneration: expected)
    }

    func didFailRegistration() { wantsPermission = false }
    func endSession() {
        reset()
        installationId = UUID().uuidString.lowercased()
        if persistsInstallation { UserDefaults.standard.set(installationId, forKey: "research-push-installation") }
    }
    func reset() {
        generation = UUID(); client = nil; clientGeneration = nil; wantsPermission = false
        system.unregister()
    }
}

@MainActor
final class ResearchNotificationDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    weak var model: AppModel?
    private var pendingURL: URL?

    func attach(_ model: AppModel) {
        self.model = model
        if let pendingURL {
            self.pendingURL = nil
            Task { await model.receive(pendingURL) }
        }
    }
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { await model?.push.didRegister(token: deviceToken) }
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        model?.push.didFailRegistration()
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                            withCompletionHandler completionHandler: @escaping () -> Void) {
        let url = ResearchDestination.notificationURL(response.notification.request.content.userInfo)
        Task { @MainActor in
            if let url {
                if let model { await model.receive(url) }
                else { pendingURL = url }
            }
        }
        completionHandler()
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                            withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // A foreground notification never interrupts an open assessment.
        completionHandler([.banner, .sound])
    }
}
