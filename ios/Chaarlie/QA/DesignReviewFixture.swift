#if DEBUG
import SwiftUI
import Foundation

/// Finite, opt-in rendering scenarios. This renderer owns a separate in-memory client;
/// its synthetic session never enters the live client, Keychain, or an HTTP connection.
enum DesignReviewScenario: String, Sendable {
    case login
    case loginLongEmail = "login-long-email"
    case code
    case codeError = "code-error"
    case loginLoading = "login-loading"
    case scanError = "scan-error"
    case scanLoading = "scan-loading"
    case searchResults = "search-results"
    case searchLoading = "search-loading"
    case searchError = "search-error"
    case profile
    case profileLoading = "profile-loading"
    case profileError = "profile-error"
    case recoveryMissing = "recovery-missing"
    case recoveryUnavailable = "recovery-unavailable"

    static var current: Self? {
        guard ProcessInfo.processInfo.arguments.contains("--ui-design-review"),
              let value = ProcessInfo.processInfo.environment["CHAARLIE_DESIGN_SCENARIO"] else { return nil }
        return Self(rawValue: value)
    }
    var signedOut: Bool {
        switch self {
        case .login, .loginLongEmail, .code, .codeError, .loginLoading: true
        default: false
        }
    }
}

@MainActor
struct DesignReviewFixture: View {
    let scenario: DesignReviewScenario
    @State private var model: AppModel

    init(scenario: DesignReviewScenario) {
        self.scenario = scenario
        // Constant loopback URL satisfies the normal configuration contract. The injected
        // transport below handles every request in memory and cannot open a connection.
        let configuration = try! MobileConfiguration(baseURL: URL(string: "http://127.0.0.1:3218/api/mobile/v1")!)
        let session = scenario.signedOut ? nil : DesignReviewData.session
        let attempt = [.code, .codeError].contains(scenario) ? DesignReviewData.attempt : nil
        let client = MobileClient(configuration: configuration,
                                  transport: DesignReviewTransport(scenario: scenario),
                                  store: DesignReviewPersistence(session: session, attempt: attempt))
        let model = AppModel(client: client)
        model.session = session
        model.attempt = attempt
        model.admission = .loading
        model.email = scenario == .login ? "" : DesignReviewData.email
        switch scenario {
        case .codeError:
            model.code = "12345678"
            model.authError = "Der Code oder Link ist ungültig oder abgelaufen. Prüfe den Code oder fordere eine neue E-Mail an."
        case .scanError:
            model.lastRequest = .barcode("1234567890123")
            model.scanError = "Die Einschätzung konnte nicht geladen werden. Dein Barcode bleibt für einen neuen Versuch erhalten."
        case .searchResults, .searchLoading, .searchError:
            model.searchPresented = true
            model.searchText = "Chaarlie Designprüfung"
            if scenario == .searchResults { model.searchResults = DesignReviewData.products }
            if scenario == .searchError { model.searchError = "Die Suche ist gerade nicht verfügbar. Bitte versuche es erneut." }
        case .profile, .profileLoading, .profileError:
            model.selectedTab = .profile
        default: break
        }
        _model = State(initialValue: model)
    }

    var body: some View {
        RootView(model: model)
            .overlay(alignment: .bottomLeading) {
                // Marker is isolated from the real view hierarchy, avoiding identifier inheritance.
                Text("Designprüfung")
                    .font(.system(size: 1)).foregroundStyle(.clear)
                    .accessibilityIdentifier("design.review.\(scenario.rawValue)")
                    .allowsHitTesting(false)
            }
            .task {
                // RootView owns restoration. Wait for its canned bootstrap before starting
                // loading actions; a second restore could dismiss an already-presented search.
                while model.admission == .loading {
                    do { try await Task.sleep(for: .milliseconds(10)) }
                    catch { return }
                }
                switch scenario {
                case .loginLoading: await model.startLogin()
                case .scanLoading: await model.resolve(.barcode("1234567890123"))
                case .searchLoading: await model.search()
                default: break
                }
            }
    }
}

private enum DesignReviewData {
    static let email = "anna.lena.sehr-langer-testname+designpruefung@example.test"
    static let attempt = AuthAttempt(attemptId: "11111111-2222-4333-8444-555555555555", codeLength: 8)
    static let session = MobileSession(accessToken: "synthetic-design-access", refreshToken: "synthetic-design-refresh",
                                       expiresAt: 4_102_444_800, userId: "synthetic-design-user")
    static let profile = HairProfile(profileRevision: "synthetic-design-profile", answers: [
        .init(id: "texture", label: "Haarstruktur", values: ["Wellig"]),
        .init(id: "thickness", label: "Haardicke", values: ["Fein"]),
        .init(id: "scalp", label: "Kopfhaut", values: ["Trocken", "Gelegentlich empfindlich"]),
        .init(id: "history", label: "Bisherige Behandlungen und Styling", values: ["Blondiert", "Regelmäßiges Föhnen", "Gelegentliche Anwendung eines Glätteisens"]),
        .init(id: "goals", label: "Wünsche für meine Haarpflege", values: ["Weniger beschwerte Längen", "Eine unkomplizierte Pflege für den Alltag"])
    ])
    static let products: [ScanProduct] = [
        .init(id: "design-long-product", name: "Chaarlie Designprüfung Sanftes Feuchtigkeits-Shampoo für trockene und empfindliche Kopfhaut mit sehr langem Produktnamen", brand: "Synthetische Testmarke mit langem Namen", category: "shampoo", categoryLabel: "Shampoo", imageUrl: nil, priceEur: nil, currency: nil, purchaseUrl: nil),
        .init(id: "design-second-product", name: "Leichter Conditioner", brand: "Chaarlie Designprüfung", category: "conditioner", categoryLabel: "Conditioner", imageUrl: nil, priceEur: nil, currency: nil, purchaseUrl: nil)
    ]
}

private struct DesignReviewTransport: HTTPTransport {
    let scenario: DesignReviewScenario
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        guard let url = request.url else { throw MobileError.configuration }
        let path = url.path
        if (scenario == .loginLoading && path.hasSuffix("/auth/start")) ||
            (scenario == .profileLoading && path.hasSuffix("/profile")) ||
            (scenario == .scanLoading && path.hasSuffix("/scan/resolve")) ||
            (scenario == .searchLoading && path.hasSuffix("/scan/search")) {
            try await Task.sleep(for: .seconds(30))
            throw MobileError.unavailable
        }
        let data: Data
        if path.hasSuffix("/bootstrap") {
            let status: Bootstrap.Status = scenario == .recoveryMissing ? .profile_required : scenario == .recoveryUnavailable ? .temporarily_unavailable : .ready
            data = try JSONEncoder().encode(Bootstrap(status: status, profileRevision: "synthetic-design-profile", contextRevision: "synthetic-design-context"))
        } else if path.hasSuffix("/profile") {
            if scenario == .profileError { throw MobileError.unavailable }
            data = try JSONEncoder().encode(DesignReviewData.profile)
        } else if path.hasSuffix("/scan/search") {
            if scenario == .searchError { throw MobileError.unavailable }
            data = try JSONEncoder().encode(SearchResponse(contractVersion: 1, results: DesignReviewData.products, truncated: false))
        } else if path.hasSuffix("/auth/start") {
            data = try JSONEncoder().encode(DesignReviewData.attempt)
        } else if path.hasSuffix("/auth/logout") {
            data = Data()
        } else {
            // No catch-all forwarding: unsupported fixture actions fail locally.
            throw MobileError.unavailable
        }
        guard let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "application/json"]) else { throw MobileError.invalidResponse }
        return (data, response)
    }
}

private final class DesignReviewPersistence: SessionPersistence, @unchecked Sendable {
    private let lock = NSLock()
    private var session: MobileSession?
    private var attempt: AuthAttempt?
    init(session: MobileSession?, attempt: AuthAttempt?) { self.session = session; self.attempt = attempt }
    func loadSession() throws -> MobileSession? { lock.withLock { session } }
    func saveSession(_ value: MobileSession?) throws { lock.withLock { session = value } }
    func loadAttempt() throws -> AuthAttempt? { lock.withLock { attempt } }
    func saveAttempt(_ value: AuthAttempt?) throws { lock.withLock { attempt = value } }
}
#endif
