#if DEBUG
import SwiftUI
import Foundation

/// Finite, opt-in rendering scenarios. This renderer owns a separate in-memory client;
/// its synthetic session never enters the live client, Keychain, or an HTTP connection.
enum DesignReviewScenario: String, Sendable {
    case scan
    case scanResolveError = "scan-resolve-error"
    case login
    case loginLongEmail = "login-long-email"
    case code
    case codeError = "code-error"
    case loginLoading = "login-loading"
    case scanError = "scan-error"
    case scanLoading = "scan-loading"
    case searchResults = "search-results"
    case searchEmpty = "search-empty"
    case searchLoading = "search-loading"
    case searchError = "search-error"
    case profile
    case profileEdit = "profile-edit"
    case profileEditError = "profile-edit-error"
    case profileEditConflict = "profile-edit-conflict"
    case profileEditLoading = "profile-edit-loading"
    case profileEditLoadError = "profile-edit-load-error"
    case profileEditSaving = "profile-edit-saving"
    case profileEditMissingLength = "profile-edit-missing-length"
    case profileLoading = "profile-loading"
    case profileError = "profile-error"
    case recoveryMissing = "recovery-missing"
    case profileCompletion = "profile-completion"
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

    init(scenario: DesignReviewScenario, onboardingAnswers: QuizAnswers? = nil) {
        self.scenario = scenario
        // Constant loopback URL satisfies the normal configuration contract. The injected
        // transport below handles every request in memory and cannot open a connection.
        let configuration = try! MobileConfiguration(baseURL: URL(string: "http://127.0.0.1:3218/api/mobile/v1")!)
        let session = scenario.signedOut || scenario == .profileCompletion ? nil : DesignReviewData.session
        let attempt = [.code, .codeError].contains(scenario) ? DesignReviewData.attempt : nil
        let client = MobileClient(configuration: configuration,
                                  transport: DesignReviewTransport(scenario: scenario, onboardingAnswers: onboardingAnswers),
                                  store: DesignReviewPersistence(session: session, attempt: attempt))
        let model = AppModel(client: client)
        model.session = session
        model.attempt = attempt
        model.admission = .loading
        model.email = scenario == .login ? "" : DesignReviewData.email
        switch scenario {
        case .profileCompletion:
            model.installCompletionFixtureAuthority()
        case .codeError:
            model.code = "12345678"
            model.authError = "Der Code oder Link ist ungültig oder abgelaufen. Prüfe den Code oder fordere eine neue E-Mail an."
        case .scanError:
            model.lastRequest = .barcode("1234567890123")
            model.scanError = "Die Einschätzung konnte nicht geladen werden. Dein Barcode bleibt für einen neuen Versuch erhalten."
        case .searchResults, .searchEmpty, .searchLoading, .searchError:
            model.searchPresented = true
            model.searchText = "Chaarlie Designprüfung"
            if scenario == .searchResults { model.searchResults = DesignReviewData.products }
            if scenario == .searchError { model.searchError = "Die Suche ist gerade nicht verfügbar. Bitte versuche es erneut." }
        case .profile, .profileLoading, .profileError, .profileEdit, .profileEditError, .profileEditConflict, .profileEditLoading, .profileEditLoadError, .profileEditSaving, .profileEditMissingLength:
            model.selectedTab = .profile
        default: break
        }
        _model = State(initialValue: model)
    }

    var body: some View {
        Group {
            if scenario == .profileCompletion {
                MissingProfileCompletionView(app: model)
            } else {
                RootView(model: model, prefersExistingLogin: scenario.signedOut)
            }
        }
            .overlay(alignment: .bottomLeading) {
                // Marker is isolated from the real view hierarchy, avoiding identifier inheritance.
                Text("Designprüfung")
                    .font(.system(size: 1)).foregroundStyle(.clear)
                    .accessibilityIdentifier("design.review.\(scenario.rawValue)")
                    .allowsHitTesting(false)
            }
            .task {
                guard scenario != .profileCompletion else { return }
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
    static func editSnapshot(missingLength: Bool = false) throws -> ProfileEditSnapshot {
        guard let fixture = Bundle.main.url(forResource: "profile-edit-v1", withExtension: "json") else { throw MobileError.invalidResponse }
        let snapshot = try JSONDecoder().decode(ProfileEditSnapshot.self, from: Data(contentsOf: fixture))
        var answers = snapshot.answers
        // Defensive decoder/recovery scenario only; this does not assert affected live users.
        if missingLength { answers.hair_length = nil }
        return ProfileEditSnapshot(profileRevision: snapshot.profileRevision, answers: answers, questions: snapshot.questions)
    }
    static func profile(_ snapshot: ProfileEditSnapshot) -> HairProfile {
        var rows: [HairProfile.Answer] = snapshot.questions.compactMap { question in
            guard let property = ProfileProperty.find(question.id), let displayID = property.displayIDs.first else { return nil }
            let values = snapshot.answers.values(for: question.id).map { value in
                question.options(for: snapshot.answers.structure).first { $0.value == value }?.label ?? value
            }
            return .init(id: displayID, label: property.title, values: values)
        }
        let scalp = snapshot.questions.first { $0.id == "scalp_type" }
        let condition = snapshot.answers.scalp_condition
        rows.append(.init(id: "scalp_condition", label: "Kopfhaut-Beschwerden", values: snapshot.answers.has_scalp_issue
            ? [scalp?.conditionOptions?.first { $0.value == condition }?.label ?? condition ?? ""] : []))
        if let note = snapshot.answers.concerns_other_text, !note.isEmpty {
            rows.append(.init(id: "concerns_other_text", label: "Weitere Anliegen", values: [note]))
        }
        rows.append(.init(id: "styling_tools", label: "Stylinggeräte", values: ["Regelmäßiges Föhnen", "Gelegentliche Anwendung eines Glätteisens"]))
        return HairProfile(profileRevision: snapshot.profileRevision, answers: rows)
    }
    static func assessment(product: ScanProduct, revision: String) -> ScanResult {
        let row = ScanRow(displayStatus: .neutral, dimensionId: "fixture.weight", label: "Pflegegewicht",
            axisKind: .ordered, definition: "Synthetische Darstellung der Vergleichstabelle.", categoryFit: nil,
            targetValue: "leicht", productValue: "mittel", state: .unknown,
            stops: [.init(id: "light", label: "leicht"), .init(id: "medium", label: "mittel")],
            targetStopIds: ["light"], productStopIds: ["medium"])
        return ScanResult(contractVersion: 1, kind: .assessment, contextRevision: revision, product: product,
            verdict: .supportive, verdictLabel: "Lokale Vorschau", verdictTitle: "Lokale Beispiel-Einschätzung",
            mismatchSummary: "Synthetische Testdaten – keine persönliche Produktbewertung.", headline: nil,
            subtitle: nil, rows: [row], categoryFit: nil, alternatives: [], reasons: nil, coveredBy: nil,
            reason: nil, productId: nil, missingFacts: nil, code: nil)
    }
    static let products: [ScanProduct] = [
        .init(id: "design-long-product", name: "Chaarlie Designprüfung Sanftes Feuchtigkeits-Shampoo für trockene und empfindliche Kopfhaut mit sehr langem Produktnamen", brand: "Synthetische Testmarke mit langem Namen", category: "shampoo", categoryLabel: "Shampoo", imageUrl: nil, priceEur: nil, currency: nil, purchaseUrl: nil),
        .init(id: "design-second-product", name: "Leichter Conditioner", brand: "Chaarlie Designprüfung", category: "conditioner", categoryLabel: "Conditioner", imageUrl: nil, priceEur: nil, currency: nil, purchaseUrl: nil)
    ]
}

actor DesignReviewTransport: HTTPTransport {
    let scenario: DesignReviewScenario
    private var savedSnapshot: ProfileEditSnapshot?
    private var saveAttempts = 0
    private var resolveAttempts = 0
    private struct ResolveInput: Decodable {
        struct Identifier: Decodable { let type: String; let value: String }
        let productId: String?
        let identifier: Identifier?
    }
    init(scenario: DesignReviewScenario, onboardingAnswers: QuizAnswers? = nil) {
        self.scenario = scenario
        if let onboardingAnswers, let source = try? DesignReviewData.editSnapshot() {
            savedSnapshot = .init(profileRevision: "onboarding-fixture-1", answers: onboardingAnswers, questions: source.questions)
        }
    }
    private func currentSnapshot() throws -> ProfileEditSnapshot {
        if let savedSnapshot { return savedSnapshot }
        return try DesignReviewData.editSnapshot(missingLength: scenario == .profileEditMissingLength)
    }
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
        } else if path.hasSuffix("/profile/complete") {
            if request.httpMethod == "POST" {
                data = try JSONEncoder().encode(RegistrationCompletion(session: DesignReviewData.session,
                    bootstrap: .init(status: .ready, profileRevision: "synthetic-design-profile", contextRevision: "synthetic-design-context")))
            } else {
                let question = try currentSnapshot().questions.first { $0.id == "structure" }!
                data = try JSONEncoder().encode(MissingProfileCompletion(profileRevision: "synthetic-completion-revision",
                    questions: [question], answers: PartialQuizAnswers()))
            }
        } else if path.hasSuffix("/profile/edit") {
            if request.httpMethod == "POST" {
                if scenario == .profileEditSaving { try await Task.sleep(for: .seconds(30)); throw MobileError.unavailable }
                saveAttempts += 1
                if scenario == .profileEditError, saveAttempts == 1 { throw URLError(.networkConnectionLost) }
                if scenario == .profileEditConflict, saveAttempts == 1 {
                    return (Data("{\"error\":\"profile_conflict\"}".utf8), HTTPURLResponse(url: url, statusCode: 409, httpVersion: nil, headerFields: nil)!)
                }
                guard let body = request.httpBody else { throw MobileError.invalidResponse }
                let submitted = try JSONDecoder().decode(ProfileEditRequest.self, from: body)
                let previous = try currentSnapshot()
                let next = ProfileEditSnapshot(profileRevision: String((Int(previous.profileRevision) ?? 2) + 1), answers: submitted.answers, questions: previous.questions)
                savedSnapshot = next
                data = try JSONEncoder().encode(ProfileEditResponse(profileRevision: next.profileRevision, contextRevision: "saved-design-context", answers: DesignReviewData.profile(next).answers))
            } else {
                if scenario == .profileEditLoading { try await Task.sleep(for: .seconds(30)); throw MobileError.unavailable }
                if scenario == .profileEditLoadError { throw MobileError.unavailable }
                data = try JSONEncoder().encode(currentSnapshot())
            }
        } else if path.hasSuffix("/profile") {
            if scenario == .profileError { throw MobileError.unavailable }
            data = try JSONEncoder().encode(DesignReviewData.profile(currentSnapshot()))
        } else if path.hasSuffix("/scan/resolve") {
            guard request.httpMethod == "POST", let body = request.httpBody else { throw MobileError.invalidResponse }
            let input = try JSONDecoder().decode(ResolveInput.self, from: body)
            let product: ScanProduct?
            if let id = input.productId, input.identifier == nil {
                product = DesignReviewData.products.first { $0.id == id }
            } else if input.productId == nil, input.identifier?.type == "ean", input.identifier?.value == "1234567890123" {
                product = DesignReviewData.products.first
            } else { product = nil }
            guard let product else { throw MobileError.invalidResponse }
            resolveAttempts += 1
            if scenario == .scanResolveError, resolveAttempts == 1 { throw MobileError.unavailable }
            let result = DesignReviewData.assessment(product: product, revision: try currentSnapshot().profileRevision)
            try result.validate()
            data = try JSONEncoder().encode(result)
        } else if path.hasSuffix("/scan/search") {
            if scenario == .searchError { throw MobileError.unavailable }
            data = try JSONEncoder().encode(SearchResponse(contractVersion: 1, results: scenario == .searchEmpty ? [] : DesignReviewData.products, truncated: false))
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
