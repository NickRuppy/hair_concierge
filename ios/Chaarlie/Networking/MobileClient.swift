import Foundation

struct AuthAttempt: Codable, Equatable, Sendable {
    let attemptId: String
    let codeLength: Int
}
struct MobileSession: Codable, Equatable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Double
    let userId: String
}
struct Bootstrap: Codable, Sendable {
    enum Status: String, Codable { case ready, profile_required, temporarily_unavailable }
    let status: Status
    let profileRevision: String?
    let contextRevision: String?
}
struct HairProfile: Codable, Sendable {
    struct Answer: Codable, Identifiable, Sendable {
        let id: String
        let label: String
        let values: [String]
    }
    let profileRevision: String
    let answers: [Answer]
}

enum MobileError: Error, Equatable {
    case configuration, unauthorized, invalidResponse, unavailable, stale, invalidCode, profileConflict, invalidProfile, profileRequired
}

enum MobileRuntime: Sendable, Equatable {
    case local
    case hostedPilot

    static var current: Self {
        #if HOSTED_PILOT
        .hostedPilot
        #else
        .local
        #endif
    }

    var baseURL: URL {
        switch self {
        case .local:
            URL(string: "http://127.0.0.1:3218/api/mobile/v1")!
        case .hostedPilot:
            URL(string: "https://chaarlie.de/api/mobile/v1")!
        }
    }

    var keychainService: String {
        switch self {
        case .local: "de.chaarlie.scanner.local"
        case .hostedPilot: "de.chaarlie.scanner.pilot"
        }
    }

    var callbackScheme: String {
        switch self {
        case .local: "chaarlie-local"
        case .hostedPilot: "chaarlie-pilot"
        }
    }
}

struct MobileConfiguration: Sendable {
    let baseURL: URL
    let runtime: MobileRuntime
    init(baseURL: URL, runtime: MobileRuntime = .local) throws {
        guard let host = baseURL.host, baseURL.user == nil, baseURL.password == nil,
              baseURL.query == nil, baseURL.fragment == nil else { throw MobileError.configuration }
        switch runtime {
        case .local:
            guard ["localhost", "127.0.0.1", "::1"].contains(host), baseURL.scheme == "http" else {
                throw MobileError.configuration
            }
        case .hostedPilot:
            guard baseURL == runtime.baseURL else { throw MobileError.configuration }
        }
        self.baseURL = baseURL
        self.runtime = runtime
    }
    static func current() throws -> Self {
        #if HOSTED_PILOT
        return try Self(baseURL: MobileRuntime.hostedPilot.baseURL, runtime: .hostedPilot)
        #elseif DEBUG
        if let value = ProcessInfo.processInfo.environment["CHAARLIE_API_BASE_URL"], let url = URL(string: value) {
            return try Self(baseURL: url, runtime: .local)
        }
        return try Self(baseURL: MobileRuntime.local.baseURL, runtime: .local)
        #else
        throw MobileError.configuration
        #endif
    }
}

protocol HTTPTransport: Sendable {
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse)
}
struct URLSessionTransport: HTTPTransport {
    private let session: URLSession
    init() {
        let config = URLSessionConfiguration.ephemeral
        config.urlCache = nil
        config.httpCookieStorage = nil
        config.httpShouldSetCookies = false
        config.timeoutIntervalForRequest = 25
        config.timeoutIntervalForResource = 35
        session = URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)
    }
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw MobileError.invalidResponse }
        return (data, response)
    }
    private final class NoRedirects: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
        func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                        newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
            completionHandler(nil)
        }
    }
}

/// Holds one account session. Epoch checks cover every await, including refresh token rotation.
actor MobileClient {
    let configuration: MobileConfiguration
    private let transport: any HTTPTransport
    private let store: any SessionPersistence
    private var session: MobileSession?
    private var epoch = UUID()
    private var refreshTask: (id: UUID, task: Task<MobileSession, Error>)?
    private var inFlight: [UUID: Task<(Data, HTTPURLResponse), Error>] = [:]

    init(configuration: MobileConfiguration, transport: any HTTPTransport = URLSessionTransport(),
         store: (any SessionPersistence)? = nil) {
        self.configuration = configuration
        self.transport = transport
        let resolvedStore = store ?? KeychainSessionStore(runtime: configuration.runtime)
        self.store = resolvedStore
        self.session = try? resolvedStore.loadSession()
    }
    func currentSession() -> MobileSession? { session }
    func pendingAttempt() -> AuthAttempt? { try? store.loadAttempt() }
    func clearPendingAttempt() { try? store.saveAttempt(nil) }

    func sessionGeneration() -> UUID { epoch }
    func install(_ newSession: MobileSession, ifGeneration expected: UUID? = nil) throws {
        if let expected, expected != epoch { throw MobileError.stale }
        try store.saveSession(newSession)
        epoch = UUID()
        refreshTask?.task.cancel()
        refreshTask = nil
        session = newSession
        try? store.saveAttempt(nil)
    }
    func clear() {
        epoch = UUID()
        inFlight.values.forEach { $0.cancel() }
        inFlight.removeAll()
        refreshTask?.task.cancel()
        refreshTask = nil
        session = nil
        try? store.saveSession(nil)
        try? store.saveAttempt(nil)
    }
    func logout() async {
        let oldToken = session?.accessToken
        clear() // Local account removal never waits on the network.
        if let oldToken { _ = try? await raw("auth/logout", method: "POST", bearer: oldToken) }
    }
    func start(email: String) async throws -> AuthAttempt {
        guard session == nil else { throw MobileError.stale }
        epoch = UUID()
        let expected = epoch
        let attempt: AuthAttempt = try await decode(raw("auth/start", method: "POST", body: ["email": email]))
        guard expected == epoch, session == nil else { throw MobileError.stale }
        try store.saveAttempt(attempt)
        return attempt
    }
    func verify(attemptId: String, code: String? = nil, tokenHash: String? = nil) async throws -> AuthVerificationResponse {
        guard session == nil else { throw MobileError.stale }
        let expected = epoch
        var body = ["attemptId": attemptId]
        if let code { body["code"] = code }
        if let tokenHash { body["tokenHash"] = tokenHash }
        let verified: AuthVerificationResponse = try await decode(raw("auth/verify", method: "POST", body: body))
        guard expected == epoch, session == nil else { throw MobileError.stale }
        return verified
    }
    /// Registration remains a separate unauthenticated capability. These methods
    /// deliberately do not install a session; only a ready completion may do that.
    func registrationStart(_ submission: RegistrationSubmissionBody) async throws -> AuthAttempt {
        guard session == nil else { throw MobileError.stale }
        return try await decode(raw("registration/start", method: "POST", encodedBody: JSONEncoder().encode(submission)))
    }
    func registrationVerify(attemptId: String, code: String? = nil, tokenHash: String? = nil) async throws -> RegistrationVerification {
        guard session == nil else { throw MobileError.stale }
        var body = ["attemptId": attemptId]
        if let code { body["code"] = code }
        if let tokenHash { body["tokenHash"] = tokenHash }
        return try await decode(raw("registration/verify", method: "POST", body: body))
    }
    func registrationComplete(_ request: RegistrationCompleteRequest) async throws -> RegistrationCompletion {
        guard session == nil else { throw MobileError.stale }
        return try await decode(raw("registration/complete", method: "POST", encodedBody: JSONEncoder().encode(request)))
    }
    func missingProfileCompletion(completionToken: String? = nil) async throws -> MissingProfileCompletion {
        if let completionToken { return try await decode(raw("profile/complete", bearer: completionToken)) }
        return try await authorized("profile/complete")
    }
    func completeMissingProfile(_ request: MissingProfileCompletionRequest,
                                completionToken: String? = nil) async throws -> RegistrationCompletion {
        if let completionToken {
            return try await decode(raw("profile/complete", method: "POST", encodedBody: JSONEncoder().encode(request), bearer: completionToken))
        }
        return try await authorized("profile/complete", method: "POST", encodedBody: JSONEncoder().encode(request))
    }
    func bootstrap() async throws -> Bootstrap { try await authorized("bootstrap") }
    func profile() async throws -> HairProfile { try await authorized("profile") }
    func editableProfile() async throws -> ProfileEditSnapshot {
        let snapshot: ProfileEditSnapshot = try await authorized("profile/edit")
        try snapshot.validate()
        return snapshot
    }
    func saveProfile(_ request: ProfileEditRequest) async throws -> ProfileEditResponse {
        try await authorized("profile/edit", method: "POST", encodedBody: JSONEncoder().encode(request))
    }
    func resolve(_ request: ScanRequest) async throws -> ScanResult {
        let result: ScanResult = try await authorized("scan/resolve", method: "POST", encodedBody: JSONEncoder().encode(request))
        try result.validate()
        return result
    }
    func search(_ query: String) async throws -> SearchResponse {
        let response: SearchResponse = try await authorized("scan/search", query: [URLQueryItem(name: "q", value: query)])
        guard response.contractVersion == 1 else { throw MobileError.invalidResponse }
        return response
    }
    private func authorized<T: Decodable>(_ path: String, method: String = "GET", encodedBody: Data? = nil,
                                          query: [URLQueryItem] = []) async throws -> T {
        let expected = epoch
        guard let initial = session else { throw MobileError.unauthorized }
        let token = initial.expiresAt <= Date().timeIntervalSince1970 + 30 ? try await refreshed(expected).accessToken : initial.accessToken
        do {
            let value: T = try await decode(raw(path, method: method, encodedBody: encodedBody, bearer: token, query: query))
            guard expected == epoch else { throw MobileError.stale }
            return value
        } catch MobileError.unauthorized {
            guard expected == epoch else { throw MobileError.stale }
            let updated: MobileSession
            if let current = session, current.accessToken != token { updated = current }
            else { updated = try await refreshed(expected) }
            let value: T = try await decode(raw(path, method: method, encodedBody: encodedBody, bearer: updated.accessToken, query: query))
            guard expected == epoch else { throw MobileError.stale }
            return value
        }
    }
    private func refreshed(_ expected: UUID) async throws -> MobileSession {
        guard expected == epoch, let current = session else { throw MobileError.stale }
        let active: (id: UUID, task: Task<MobileSession, Error>)
        if let existing = refreshTask { active = existing }
        else {
            active = (UUID(), Task { try await self.decode(self.raw("auth/refresh", method: "POST", body: ["refreshToken": current.refreshToken])) })
            refreshTask = active
        }
        do {
            let updated = try await active.task.value
            guard expected == epoch, updated.userId == current.userId else { throw MobileError.stale }
            if refreshTask?.id == active.id {
                try store.saveSession(updated)
                session = updated
                refreshTask = nil
            }
            // Another waiter may already have committed a newer rotation.
            guard let latest = session else { throw MobileError.stale }
            return latest
        } catch {
            guard expected == epoch else { throw MobileError.stale }
            if refreshTask?.id == active.id {
                refreshTask = nil
                if error as? MobileError == .unauthorized { clear() }
                throw error
            }
            guard let latest = session, latest.accessToken != current.accessToken else { throw error }
            return latest
        }
    }
    private func raw(_ path: String, method: String = "GET", body: [String: String]? = nil,
                     encodedBody: Data? = nil, bearer: String? = nil, query: [URLQueryItem] = []) async throws -> Data {
        guard var parts = URLComponents(url: configuration.baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false) else {
            throw MobileError.configuration
        }
        if !query.isEmpty { parts.queryItems = query }
        guard let url = parts.url else { throw MobileError.configuration }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        if let bearer { request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        request.httpBody = try encodedBody ?? body.map { try JSONEncoder().encode($0) }
        if request.httpBody != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let id = UUID()
        let operation = Task { [transport, request] in try await transport.data(for: request) }
        if path != "auth/logout" { inFlight[id] = operation }
        defer { inFlight[id] = nil }
        let (data, response) = try await operation.value
        guard (200..<300).contains(response.statusCode) else {
            if response.statusCode == 401 { throw MobileError.unauthorized }
            if path == "auth/verify", response.statusCode == 400 { throw MobileError.invalidCode }
            if path == "profile/edit" {
                let code = (try? JSONDecoder().decode(ProfileEditErrorBody.self, from: data))?.error
                if response.statusCode == 409, code == "profile_conflict" { throw MobileError.profileConflict }
                if response.statusCode == 400, code == "invalid_request" { throw MobileError.invalidProfile }
                if response.statusCode == 403, code == "profile_required" { throw MobileError.profileRequired }
            }
            if path == "profile/complete", response.statusCode == 409 { throw MobileError.profileConflict }
            if path == "registration/complete", response.statusCode == 409 { throw MobileError.profileConflict }
            throw MobileError.unavailable
        }
        return data
    }
    private func decode<T: Decodable>(_ data: Data) throws -> T {
        try JSONDecoder().decode(T.self, from: data)
    }
}

private struct ProfileEditErrorBody: Decodable { let error: String }
