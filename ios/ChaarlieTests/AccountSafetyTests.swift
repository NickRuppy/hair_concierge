import XCTest
@testable import Chaarlie

final class MemorySessionStore: SessionPersistence, @unchecked Sendable {
    private let lock = NSLock()
    private var session: MobileSession?
    private var attempt: AuthAttempt?
    func loadSession() throws -> MobileSession? { lock.lock(); defer { lock.unlock() }; return session }
    func saveSession(_ session: MobileSession?) throws { lock.lock(); defer { lock.unlock() }; self.session = session }
    func loadAttempt() throws -> AuthAttempt? { lock.lock(); defer { lock.unlock() }; return attempt }
    func saveAttempt(_ attempt: AuthAttempt?) throws { lock.lock(); defer { lock.unlock() }; self.attempt = attempt }
}
actor ControlledTransport: HTTPTransport {
    private var continuations: [String: CheckedContinuation<(Data, HTTPURLResponse), Error>] = [:]
    private var requests: [URLRequest] = []
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        return try await withCheckedThrowingContinuation { continuations[request.url!.lastPathComponent] = $0 }
    }
    func requestCount(_ path: String) -> Int { requests.filter { $0.url?.lastPathComponent == path }.count }
    func hasRequest(_ path: String) -> Bool { continuations[path] != nil }
    func complete(_ path: String, status: Int = 200, json: String) {
        guard let continuation = continuations.removeValue(forKey: path) else { return }
        continuation.resume(returning: (Data(json.utf8), HTTPURLResponse(url: URL(string: "http://localhost/\(path)")!, statusCode: status, httpVersion: nil, headerFields: nil)!))
    }
}
@MainActor
final class AccountSafetyTests: XCTestCase {
    private func session(_ id: String, expiresAt: Double = Date().timeIntervalSince1970 + 600) -> MobileSession {
        MobileSession(accessToken: "access-\(id)", refreshToken: "refresh-\(id)", expiresAt: expiresAt, userId: id)
    }
    private func waitFor(_ path: String, transport: ControlledTransport) async throws {
        for _ in 0..<200 {
            if await transport.hasRequest(path) { return }
            try await Task.sleep(for: .milliseconds(5))
        }
        throw NSError(domain: "NativeTest.RequestDidNotReach.\(path)", code: 1)
    }
    private func client(_ transport: ControlledTransport) throws -> MobileClient {
        MobileClient(configuration: try MobileConfiguration(baseURL: XCTUnwrap(URL(string: "http://127.0.0.1:3218/api/mobile/v1"))),
                     transport: transport, store: MemorySessionStore())
    }
    func testColdLinkHydratesPersistedAccountBeforeOfferingASwitch() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("A"))
        let model = AppModel(client: client)
        let id = UUID().uuidString
        let callback = try XCTUnwrap(URL(string: "chaarlie-local://auth#attemptId=\(id)&tokenHash=abcdefghijklmnop"))
        let link = Task { await model.receive(callback) }
        try await waitFor("bootstrap", transport: transport)
        let startup = Task { await model.restore() }
        await Task.yield()
        await transport.complete("bootstrap", json: "{\"status\":\"ready\"}")
        await link.value
        await startup.value
        XCTAssertEqual(model.session?.userId, "A")
        XCTAssertEqual(model.admission, .ready)
        XCTAssertEqual(model.pendingAccountLink?.attemptId, id)
        let verifyRequests = await transport.requestCount("verify")
        let bootstrapRequests = await transport.requestCount("bootstrap")
        XCTAssertEqual(verifyRequests, 0)
        XCTAssertEqual(bootstrapRequests, 1)
        model.declineAccountLink()
        XCTAssertEqual(model.session?.userId, "A")
        XCTAssertNil(model.pendingAccountLink)
    }
    func testColdRestoreCannotReplaceAnActiveLinkVerification() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        let model = AppModel(client: client)
        let id = UUID().uuidString
        let callback = try XCTUnwrap(URL(string: "chaarlie-local://auth#attemptId=\(id)&tokenHash=abcdefghijklmnop"))
        let verification = Task { await model.receive(callback) }
        try await waitFor("verify", transport: transport)
        await model.restore()
        XCTAssertTrue(model.authBusy)
        await transport.complete("verify", json: "{\"accessToken\":\"b\",\"refreshToken\":\"b-refresh\",\"expiresAt\":9999999999,\"userId\":\"B\"}")
        try await waitFor("bootstrap", transport: transport)
        await transport.complete("bootstrap", json: "{\"status\":\"ready\"}")
        await verification.value
        XCTAssertEqual(model.session?.userId, "B")
        XCTAssertEqual(model.admission, .ready)
    }
    func testDuplicateScanCannotReplaceRequestOrPresentedResultUntilDismissed() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("A"))
        let model = AppModel(client: client)
        model.admission = .ready
        let first = Task { await model.resolve(.barcode("12345678")) }
        try await waitFor("resolve", transport: transport)
        await model.resolve(.barcode("98765432"))
        let whileLoading = await transport.requestCount("resolve")
        XCTAssertEqual(whileLoading, 1)
        await transport.complete("resolve", json: "{\"contractVersion\":1,\"kind\":\"submission_required\",\"productId\":null,\"missingFacts\":[\"unknown_product\"]}")
        await first.value
        await model.resolve(.barcode("98765432"))
        let whilePresented = await transport.requestCount("resolve")
        XCTAssertEqual(whilePresented, 1)
        XCTAssertEqual(model.lastRequest, .barcode("12345678"))
        model.dismissScan()
        let rearmed = Task { await model.resolve(.barcode("12345678")) }
        try await waitFor("resolve", transport: transport)
        let afterDismissal = await transport.requestCount("resolve")
        XCTAssertEqual(afterDismissal, 2)
        await transport.complete("resolve", json: "{\"contractVersion\":1,\"kind\":\"submission_required\",\"productId\":null,\"missingFacts\":[\"unknown_product\"]}")
        await rearmed.value
        XCTAssertNotNil(model.scanResult)
    }
    func testAccountLinkConfirmationClearsOldAccountBeforeVerifyingNewOne() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("A"))
        let model = AppModel(client: client)
        model.session = session("A")
        model.admission = .ready
        model.profile = HairProfile(profileRevision: "A", answers: [])
        let callback = LoginCallback(attemptId: UUID().uuidString, tokenHash: "abcdefghijklmnop")
        model.pendingAccountLink = callback
        let switching = Task { await model.confirmAccountLink(callback) }
        try await waitFor("logout", transport: transport)
        XCTAssertNil(model.session)
        XCTAssertNil(model.profile)
        let removed = await client.currentSession()
        XCTAssertNil(removed)
        await transport.complete("logout", json: "{}")
        try await waitFor("verify", transport: transport)
        await transport.complete("verify", json: "{\"accessToken\":\"b\",\"refreshToken\":\"b-refresh\",\"expiresAt\":9999999999,\"userId\":\"B\"}")
        try await waitFor("bootstrap", transport: transport)
        await transport.complete("bootstrap", json: "{\"status\":\"ready\"}")
        await switching.value
        XCTAssertEqual(model.session?.userId, "B")
        XCTAssertNil(model.profile)
        XCTAssertEqual(model.admission, .ready)
    }
    func testMissingPersonalTargetIsD3WhileTechnicalUnavailableRetries() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("A"))
        let model = AppModel(client: client)
        model.admission = .ready
        let first = Task { await model.resolve(.barcode("12345678")) }
        try await waitFor("resolve", transport: transport)
        await transport.complete("resolve", json: "{\"contractVersion\":1,\"kind\":\"authority_unavailable\",\"reason\":\"personal_target_unavailable\",\"headline\":\"Noch nicht einschätzbar\"}")
        await first.value
        XCTAssertEqual(model.scanResult?.headline, "Noch nicht einschätzbar")
        XCTAssertNil(model.scanError)
        model.dismissScan()
        let second = Task { await model.resolve(.barcode("12345678")) }
        try await waitFor("resolve", transport: transport)
        await transport.complete("resolve", json: "{\"contractVersion\":1,\"kind\":\"authority_unavailable\",\"reason\":\"temporarily_unavailable\"}")
        await second.value
        XCTAssertNil(model.scanResult)
        XCTAssertNotNil(model.scanError)
        XCTAssertEqual(model.lastRequest, .barcode("12345678"))
    }
    func testConcurrentProfileAndBootstrapShareRefreshRotation() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("A", expiresAt: 1))
        let profile = Task { try await client.profile() }
        let bootstrap = Task { try await client.bootstrap() }
        try await waitFor("refresh", transport: transport)
        await transport.complete("refresh", json: "{\"accessToken\":\"rotated\",\"refreshToken\":\"rotated-refresh\",\"expiresAt\":9999999999,\"userId\":\"A\"}")
        try await waitFor("profile", transport: transport)
        try await waitFor("bootstrap", transport: transport)
        let refreshCount = await transport.requestCount("refresh")
        XCTAssertEqual(refreshCount, 1)
        await transport.complete("profile", json: "{\"profileRevision\":\"a\",\"answers\":[]}")
        await transport.complete("bootstrap", json: "{\"status\":\"ready\"}")
        _ = try await profile.value
        _ = try await bootstrap.value
        let stored = await client.currentSession()
        XCTAssertEqual(stored?.refreshToken, "rotated-refresh")
    }
    func testRefreshOwnerMismatchNeverInstallsOrUsesAnotherAccount() async throws {
        let transport = ControlledTransport()
        let store = MemorySessionStore()
        let client = MobileClient(configuration: try MobileConfiguration(baseURL: XCTUnwrap(URL(string: "http://127.0.0.1:3218/api/mobile/v1"))), transport: transport, store: store)
        try await client.install(session("A", expiresAt: 1))
        let request = Task { try await client.profile() }
        try await waitFor("refresh", transport: transport)
        await transport.complete("refresh", json: "{\"accessToken\":\"b\",\"refreshToken\":\"b-refresh\",\"expiresAt\":9999999999,\"userId\":\"B\"}")
        do { _ = try await request.value; XCTFail("Cross-account refresh accepted") }
        catch { XCTAssertEqual(error as? MobileError, .stale) }
        let installed = await client.currentSession()
        let profileRequests = await transport.requestCount("profile")
        XCTAssertEqual(installed?.userId, "A")
        XCTAssertEqual(try store.loadSession()?.refreshToken, "refresh-A")
        XCTAssertEqual(profileRequests, 0)
    }
    func testRefreshUnavailablePreservesSessionForAnExplicitRetry() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("A", expiresAt: 1))
        let first = Task { try await client.profile() }
        try await waitFor("refresh", transport: transport)
        await transport.complete("refresh", status: 503, json: "{}")
        do { _ = try await first.value; XCTFail("Unavailable refresh succeeded") }
        catch { XCTAssertEqual(error as? MobileError, .unavailable) }
        let retained = await client.currentSession()
        XCTAssertEqual(retained?.refreshToken, "refresh-A")
        let retry = Task { try await client.profile() }
        try await waitFor("refresh", transport: transport)
        await transport.complete("refresh", json: "{\"accessToken\":\"a-new\",\"refreshToken\":\"a-new-refresh\",\"expiresAt\":9999999999,\"userId\":\"A\"}")
        try await waitFor("profile", transport: transport)
        await transport.complete("profile", json: "{\"profileRevision\":\"a\",\"answers\":[]}")
        _ = try await retry.value
        let rotated = await client.currentSession()
        XCTAssertEqual(rotated?.refreshToken, "a-new-refresh")
    }
    func testSignedInCallbackRequiresConfirmationAndDeclinePreservesAccount() async throws {
        let client = try client(ControlledTransport())
        let model = AppModel(client: client)
        model.session = session("A")
        model.admission = .ready
        let url = try XCTUnwrap(URL(string: "chaarlie-local://auth#attemptId=\(UUID().uuidString)&tokenHash=abcdefghijklmnop"))
        await model.receive(url)
        XCTAssertNotNil(model.pendingAccountLink)
        XCTAssertEqual(model.session?.userId, "A")
        model.declineAccountLink()
        XCTAssertNil(model.pendingAccountLink)
        XCTAssertEqual(model.session?.userId, "A")
    }
    func testLateStartCannotPersistAttemptAfterLogout() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        let pending = Task { try await client.start(email: "synthetic@example.invalid") }
        try await waitFor("start", transport: transport)
        await client.clear()
        await transport.complete("start", json: "{\"attemptId\":\"\(UUID().uuidString)\",\"codeLength\":8}")
        do { _ = try await pending.value; XCTFail("Stale attempt persisted") }
        catch { XCTAssertEqual(error as? MobileError, .stale) }
        let attempt = await client.pendingAttempt()
        XCTAssertNil(attempt)
    }
    func testAtomicSessionInstallRejectsLogoutBetweenVerificationAndInstall() async throws {
        let client = try client(ControlledTransport())
        let authorization = await client.sessionGeneration()
        await client.clear()
        do { try await client.install(session("A"), ifGeneration: authorization); XCTFail("Cancelled install accepted") }
        catch { XCTAssertEqual(error as? MobileError, .stale) }
        let current = await client.currentSession()
        XCTAssertNil(current)
    }
    func testLateProfileCannotCrossAccountChange() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("A"))
        let pending = Task { try await client.profile() }
        try await waitFor("profile", transport: transport)
        await client.clear()
        try await client.install(session("B"))
        await transport.complete("profile", json: "{\"profileRevision\":\"a\",\"answers\":[]}")
        do { _ = try await pending.value; XCTFail("Stale account result accepted") }
        catch { XCTAssertEqual(error as? MobileError, .stale) }
        let current = await client.currentSession()
        XCTAssertEqual(current?.userId, "B")
    }
    func testLateRefreshCannotRestoreLoggedOutSession() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("A", expiresAt: 1))
        let pending = Task { try await client.profile() }
        try await waitFor("refresh", transport: transport)
        await client.clear()
        await transport.complete("refresh", json: "{\"accessToken\":\"new\",\"refreshToken\":\"new-r\",\"expiresAt\":9999999999,\"userId\":\"A\"}")
        do { _ = try await pending.value; XCTFail("Stale refresh accepted") }
        catch { XCTAssertEqual(error as? MobileError, .stale) }
        let current = await client.currentSession()
        XCTAssertNil(current)
    }
    func testLateVerificationCannotInstallAfterChangingLoginAttempt() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        let model = AppModel(client: client)
        model.admission = .signedOut
        model.attempt = AuthAttempt(attemptId: UUID().uuidString, codeLength: 8)
        model.code = "12345678"
        let pending = Task { await model.verifyCode() }
        try await waitFor("verify", transport: transport)
        await model.changeEmail()
        await transport.complete("verify", json: "{\"accessToken\":\"old\",\"refreshToken\":\"old-r\",\"expiresAt\":9999999999,\"userId\":\"A\"}")
        await pending.value
        let current = await client.currentSession()
        XCTAssertNil(current)
        XCTAssertNil(model.session)
    }
    func testDismissRejectsLateScanWithoutLosingNewRequest() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("A"))
        let model = AppModel(client: client)
        model.admission = .ready
        let pending = Task { await model.resolve(.barcode("12345678")) }
        try await waitFor("resolve", transport: transport)
        model.dismissScan()
        await transport.complete("resolve", json: "{\"contractVersion\":1,\"kind\":\"submission_required\",\"productId\":null,\"missingFacts\":[\"unknown_product\"]}")
        await pending.value
        XCTAssertNil(model.scanResult)
        XCTAssertNil(model.lastRequest)
        XCTAssertFalse(model.scanBusy)
    }
}
