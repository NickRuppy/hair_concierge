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
    func lastBody(_ path: String) -> Data? { requests.last { $0.url?.lastPathComponent == path }?.httpBody }
    func fail(_ path: String) { continuations.removeValue(forKey: path)?.resume(throwing: URLError(.networkConnectionLost)) }
    func requestCount(_ path: String) -> Int { requests.filter { $0.url?.lastPathComponent == path }.count }
    func hasRequest(_ path: String) -> Bool { continuations[path] != nil }
    func complete(_ path: String, status: Int = 200, json: String) {
        guard let continuation = continuations.removeValue(forKey: path) else { return }
        continuation.resume(returning: (Data(json.utf8), HTTPURLResponse(url: URL(string: "http://localhost/\(path)")!, statusCode: status, httpVersion: nil, headerFields: nil)!))
    }
}
@MainActor
final class AccountSafetyTests: XCTestCase {
    private struct CapturedProof: Decodable {
        struct DeliveredEmail: Decodable {
            struct MessageData: Decodable { let token_hash: String? }
            let message_data: MessageData
        }
        let email: String
        let code: String?
        let emails: [DeliveredEmail]
    }
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
    private func capturedProof(for email: String) async throws -> (code: String, tokenHash: String) {
        let endpoint = try XCTUnwrap(URL(string: "http://127.0.0.1:3231/captured"))
        for _ in 0..<30 {
            let (data, response) = try await URLSession.shared.data(from: endpoint)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw MobileError.unavailable }
            let entries = try JSONDecoder().decode([CapturedProof].self, from: data)
            if let entry = entries.reversed().first(where: { $0.email.caseInsensitiveCompare(email) == .orderedSame }),
               let code = entry.code,
               let tokenHash = entry.emails.first?.message_data.token_hash {
                return (code, tokenHash)
            }
            try await Task.sleep(for: .milliseconds(100))
        }
        throw MobileError.unavailable
    }
    func testOptInLocalExistingProfileMissingOnlyWire() async throws {
        guard ProcessInfo.processInfo.environment["CHAARLIE_REGISTRATION_LOCAL_PROOF"] == "1",
              let email = ProcessInfo.processInfo.environment["CHAARLIE_REGISTRATION_LOCAL_PROOF_EMAIL"], !email.isEmpty else {
            throw XCTSkip("Set CHAARLIE_REGISTRATION_LOCAL_PROOF=1 and CHAARLIE_REGISTRATION_LOCAL_PROOF_EMAIL for the isolated loopback proof.")
        }
        let base = try XCTUnwrap(URL(string: "http://127.0.0.1:3231/api/mobile/v1"))
        let client = try MobileClient(configuration: MobileConfiguration(baseURL: base), store: MemorySessionStore())
        let attempt = try await client.start(email: email)
        let proof = try await capturedProof(for: email)
        XCTAssertEqual(attempt.attemptId.count, 36)
        XCTAssertFalse(proof.code.isEmpty)
        let verified = try await client.verify(attemptId: attempt.attemptId, tokenHash: proof.tokenHash)
        XCTAssertNil(verified.session)
        let authority = try XCTUnwrap(verified.completionToken)
        let missing = try await client.missingProfileCompletion(completionToken: authority)
        XCTAssertEqual(missing.questions.map(\.id), ["hair_length"])
        let option = try XCTUnwrap(missing.questions.first?.options.first)
        var answers = PartialQuizAnswers()
        answers.set([option.value], for: "hair_length")
        let completed = try await client.completeMissingProfile(.init(requestId: UUID(), expectedProfileRevision: missing.profileRevision,
                                                                       answers: answers), completionToken: authority)
        XCTAssertEqual(completed.bootstrap?.status, .ready)
        let session = try XCTUnwrap(completed.session)
        try await client.install(session)
        let bootstrap = try await client.bootstrap()
        XCTAssertEqual(bootstrap.status, .ready)
    }
    func testOptInLocalNewRegistrationGatewayWireAndIdempotentCompletion() async throws {
        guard ProcessInfo.processInfo.environment["CHAARLIE_REGISTRATION_LOCAL_PROOF"] == "1",
              let email = ProcessInfo.processInfo.environment["CHAARLIE_REGISTRATION_LOCAL_PROOF_NEW_EMAIL"],
              email.hasPrefix("native-new-"), email.hasSuffix("@example.test") else {
            throw XCTSkip("Set the local-proof flag and an exact cohort-listed CHAARLIE_REGISTRATION_LOCAL_PROOF_NEW_EMAIL.")
        }
        let base = try XCTUnwrap(URL(string: "http://127.0.0.1:3231/api/mobile/v1"))
        let client = try MobileClient(configuration: MobileConfiguration(baseURL: base), store: MemorySessionStore())
        let gateway = MobileOnboardingGateway(client: client)
        let submission = OnboardingSubmission(requestId: UUID(), answers: OnboardingFixtureView.completedDraft().answers,
                                              firstName: "Lea", email: email, marketingOptIn: false)
        let attempt = try await gateway.register(submission)
        let proof = try await capturedProof(for: email)
        let callbackURL = try XCTUnwrap(URL(string: "chaarlie-local://auth#attemptId=\(attempt.attemptId)&tokenHash=\(proof.tokenHash)"))
        let callback = try XCTUnwrap(RegistrationCallback.parse(callbackURL, pending: attempt))
        let account = try await gateway.verify(attempt, code: nil, tokenHash: callback.tokenHash)
        let first = try await gateway.complete(account, submission: submission, choice: .create)
        let repeated = try await gateway.complete(account, submission: submission, choice: .create)
        XCTAssertEqual(first.session?.userId, repeated.session?.userId)
        XCTAssertEqual(first.bootstrap?.status, .ready)
        XCTAssertEqual(repeated.bootstrap?.status, .ready)
        XCTAssertEqual(try XCTUnwrap(first.bootstrap?.profileRevision), try XCTUnwrap(repeated.bootstrap?.profileRevision))
        XCTAssertEqual(try XCTUnwrap(first.bootstrap?.contextRevision), try XCTUnwrap(repeated.bootstrap?.contextRevision))
        // Envelopes can be re-signed in a later second; publication identity must stay stable.
        let session = try XCTUnwrap(repeated.session)
        try await client.install(session)
        let bootstrap = try await client.bootstrap()
        XCTAssertEqual(bootstrap.status, .ready)
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
    func testRegistrationGatewayKeepsSessionOutOfClientUntilReadyCompletionIsAcknowledged() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        let gateway = MobileOnboardingGateway(client: client)
        let submission = OnboardingSubmission(requestId: UUID(), answers: OnboardingFixtureView.completedDraft().answers,
                                              firstName: "Lea", email: "lea@example.test", marketingOptIn: false)

        let starting = Task { try await gateway.register(submission) }
        try await waitFor("start", transport: transport)
        let attemptID = UUID()
        await transport.complete("start", json: "{\"attemptId\":\"\(attemptID.uuidString)\",\"codeLength\":8}")
        let attempt = try await starting.value
        let afterStart = await client.currentSession()
        XCTAssertNil(afterStart)

        let verifying = Task { try await gateway.verify(attempt, code: "12345678", tokenHash: nil) }
        try await waitFor("verify", transport: transport)
        let userID = UUID()
        await transport.complete("verify", json: "{\"userId\":\"\(userID.uuidString)\",\"hasExistingProfile\":false,\"profileRevision\":\"none\",\"completionToken\":\"opaque-completion-capability\"}")
        let account = try await verifying.value
        let afterVerification = await client.currentSession()
        XCTAssertNil(afterVerification)

        let completing = Task { try await gateway.complete(account, submission: submission, choice: .create) }
        try await waitFor("complete", transport: transport)
        await transport.complete("complete", json: "{\"session\":{\"accessToken\":\"new-access\",\"refreshToken\":\"new-refresh\",\"expiresAt\":9999999999,\"userId\":\"\(userID.uuidString)\"},\"bootstrap\":{\"status\":\"ready\",\"profileRevision\":\"1\",\"contextRevision\":\"1\"}}")
        let completion = try await completing.value
        XCTAssertEqual(completion.bootstrap?.status, .ready)
        let afterCompletion = await client.currentSession()
        XCTAssertNil(afterCompletion, "Gateway must not install a session itself")

        let app = AppModel(client: client)
        let installedReady = await app.finishRegistration(completion)
        XCTAssertTrue(installedReady)
        let installed = await client.currentSession()
        XCTAssertEqual(installed?.userId, userID.uuidString)
        XCTAssertEqual(app.admission, .ready)
    }
    func testVerifiedIncompleteProfileKeepsCompletionAuthorityOutOfSessionStore() async throws {
        let client = try client(ControlledTransport())
        let app = AppModel(client: client)
        let accepted = await app.finishRegistration(.init(status: .profile_required, completionToken: "completion-only-authority", profileRevision: "r1"))
        XCTAssertTrue(accepted)
        XCTAssertEqual(app.admission, .profileRequired)
        let stored = await client.currentSession()
        XCTAssertNil(stored)
        XCTAssertEqual(app.completionAuthority, "completion-only-authority")
    }
    func testOrdinaryVerifyRoutesIncompleteProfileToMemoryOnlyCompletionAuthority() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        let app = AppModel(client: client)
        app.email = "existing@example.test"
        let starting = Task { await app.startLogin() }
        try await waitFor("start", transport: transport)
        let attemptID = UUID()
        await transport.complete("start", json: "{\"attemptId\":\"\(attemptID.uuidString)\",\"codeLength\":8}")
        await starting.value
        app.code = "12345678"
        let verifying = Task { await app.verifyCode() }
        try await waitFor("verify", transport: transport)
        await transport.complete("verify", json: "{\"status\":\"profile_required\",\"completionToken\":\"completion-authority\",\"profileRevision\":\"r1\"}")
        await verifying.value
        XCTAssertEqual(app.admission, .profileRequired)
        XCTAssertEqual(app.completionAuthority, "completion-authority")
        XCTAssertNil(app.session)
        let storedSession = await client.currentSession()
        let pendingAttempt = await client.pendingAttempt()
        XCTAssertNil(storedSession)
        XCTAssertNil(pendingAttempt)
    }
    func testMissingProfileCompletionSubmitsOnlyTheServerListedQuestion() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("existing"))
        let model = MissingProfileCompletionModel(client: client, ready: { $0.bootstrap?.status == .ready })
        let loading = Task { await model.load() }
        try await waitFor("complete", transport: transport)
        await transport.complete("complete", json: "{\"profileRevision\":\"r1\",\"questions\":[{\"id\":\"structure\",\"title\":\"Wie ist dein Haar?\",\"instruction\":\"Wähle eine Antwort.\",\"selectionMode\":\"single\",\"options\":[{\"value\":\"wavy\",\"label\":\"Wellig\",\"description\":null}],\"maxSelections\":null,\"conditionOptions\":null}],\"answers\":{}}")
        await loading.value
        XCTAssertEqual(model.question?.id, "structure")
        model.select("wavy")
        model.advance()
        try await waitFor("complete", transport: transport)
        let rawBody = await transport.lastBody("complete")
        let body = try XCTUnwrap(rawBody)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        let answers = try XCTUnwrap(object["answers"] as? [String: Any])
        XCTAssertEqual(answers["structure"] as? String, "wavy")
        XCTAssertEqual(answers.count, 1, "The missing-only route must not rewrite present profile fields")
        await transport.complete("complete", json: "{\"status\":\"ready\",\"profileRevision\":\"r2\",\"contextRevision\":\"c2\"}")
    }
    func testLateVerifyResponseCannotRestoreSessionAfterLogout() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        let app = AppModel(client: client)
        app.email = "existing@example.test"
        let starting = Task { await app.startLogin() }
        try await waitFor("start", transport: transport)
        let attemptID = UUID()
        await transport.complete("start", json: "{\"attemptId\":\"\(attemptID.uuidString)\",\"codeLength\":8}")
        await starting.value
        app.code = "12345678"
        let verification = Task { await app.verifyCode() }
        try await waitFor("verify", transport: transport)

        await app.logout()
        await transport.complete("verify", json: "{\"accessToken\":\"late\",\"refreshToken\":\"late\",\"expiresAt\":9999999999,\"userId\":\"late-user\"}")
        await verification.value

        XCTAssertNil(app.session)
        let storedAfterLogout = await client.currentSession()
        XCTAssertNil(storedAfterLogout)
        XCTAssertEqual(app.admission, .signedOut)
    }
    func testLateLimitedCompletionCannotRestoreSessionAfterLogout() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        let app = AppModel(client: client)
        let accepted = await app.finishRegistration(.init(status: .profile_required, completionToken: "authority", profileRevision: "r1"))
        XCTAssertTrue(accepted)
        let authority = try XCTUnwrap(app.completionAuthority)
        let model = MissingProfileCompletionModel(client: client, completionAuthority: authority,
                                                  ready: { await app.finishMissingProfile($0, expectedAuthority: authority) })
        let loading = Task { await model.load() }
        try await waitFor("complete", transport: transport)
        await transport.complete("complete", json: "{\"profileRevision\":\"r1\",\"questions\":[{\"id\":\"structure\",\"title\":\"Wie ist dein Haar?\",\"instruction\":\"Wähle eine Antwort.\",\"selectionMode\":\"single\",\"options\":[{\"value\":\"wavy\",\"label\":\"Wellig\",\"description\":null}],\"maxSelections\":null,\"conditionOptions\":null}],\"answers\":{}}")
        await loading.value
        model.select("wavy")
        model.advance()
        try await waitFor("complete", transport: transport)

        await app.logout()
        await transport.complete("complete", json: "{\"session\":{\"accessToken\":\"late\",\"refreshToken\":\"late\",\"expiresAt\":9999999999,\"userId\":\"late-user\"},\"bootstrap\":{\"status\":\"ready\"}}")

        XCTAssertNil(app.session)
        let storedAfterLimitedLogout = await client.currentSession()
        XCTAssertNil(storedAfterLimitedLogout)
        XCTAssertNil(app.completionAuthority)
    }
    func testMissingProfileWithNoQuestionsFinalizesAnEmptyAnswerPayload() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("existing"))
        let model = MissingProfileCompletionModel(client: client, ready: { $0.bootstrap?.status == .ready })
        let loading = Task { await model.load() }
        try await waitFor("complete", transport: transport)
        await transport.complete("complete", json: "{\"profileRevision\":\"r1\",\"questions\":[],\"answers\":{\"structure\":\"wavy\"}}")
        try await waitFor("complete", transport: transport)
        let rawBody = await transport.lastBody("complete")
        let body = try XCTUnwrap(rawBody)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual((object["answers"] as? [String: Any])?.count, 0)
        await transport.complete("complete", json: "{\"status\":\"ready\"}")
        await loading.value
    }
    func testMissingGoalsUseExistingStructureForConditionalOptions() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("existing"))
        let model = MissingProfileCompletionModel(client: client, ready: { _ in true })
        let loading = Task { await model.load() }
        try await waitFor("complete", transport: transport)
        await transport.complete("complete", json: "{\"profileRevision\":\"r1\",\"questions\":[{\"id\":\"goals\",\"title\":\"Ziel\",\"instruction\":\"Wähle ein Ziel.\",\"selectionMode\":\"multi\",\"options\":[],\"optionsByTexture\":{\"wavy\":[{\"value\":\"definition\",\"label\":\"Definition\",\"description\":null}]},\"maxSelections\":3,\"conditionOptions\":null}],\"answers\":{\"structure\":\"wavy\"}}")
        await loading.value
        XCTAssertEqual(model.currentOptions.map(\.value), ["definition"])
        model.select("definition")
        XCTAssertEqual(model.selected, ["definition"])
    }
    func testMissingProfileConflictRequiresReloadInsteadOfRetryingStaleRevision() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("existing"))
        let model = MissingProfileCompletionModel(client: client, ready: { _ in true })
        let loading = Task { await model.load() }
        try await waitFor("complete", transport: transport)
        await transport.complete("complete", json: "{\"profileRevision\":\"r1\",\"questions\":[{\"id\":\"hair_length\",\"title\":\"Länge\",\"instruction\":\"Wähle.\",\"selectionMode\":\"single\",\"options\":[{\"value\":\"medium\",\"label\":\"Mittel\",\"description\":null}],\"maxSelections\":null,\"conditionOptions\":null}],\"answers\":{}}")
        await loading.value
        model.select("medium"); model.advance()
        try await waitFor("complete", transport: transport)
        await transport.complete("complete", status: 409, json: "{\"error\":\"profile_conflict\"}")
        for _ in 0..<200 {
            if model.stage == .unavailable { break }
            try await Task.sleep(for: .milliseconds(5))
        }
        XCTAssertEqual(model.stage, .unavailable)
        XCTAssertEqual(model.error, "Dein Haarprofil wurde geändert. Bitte lade die fehlenden Angaben erneut.")
    }
    func testEmptyMissingProfileSaveFailureKeepsAnExplicitRetry() async throws {
        let transport = ControlledTransport()
        let client = try client(transport)
        try await client.install(session("existing"))
        let model = MissingProfileCompletionModel(client: client, ready: { _ in true })
        let loading = Task { await model.load() }
        try await waitFor("complete", transport: transport)
        await transport.complete("complete", json: "{\"profileRevision\":\"r1\",\"questions\":[],\"answers\":{}}")
        try await waitFor("complete", transport: transport)
        let firstBody = await transport.lastBody("complete")
        await transport.fail("complete")
        await loading.value
        XCTAssertEqual(model.stage, .unavailable)
        let retrying = Task { await model.retry() }
        try await waitFor("complete", transport: transport)
        let retryBody = await transport.lastBody("complete")
        XCTAssertEqual(try JSONSerialization.jsonObject(with: XCTUnwrap(firstBody)) as? NSDictionary,
                       try JSONSerialization.jsonObject(with: XCTUnwrap(retryBody)) as? NSDictionary)
        await transport.complete("complete", json: "{\"bootstrap\":{\"status\":\"ready\"}}")
        await retrying.value
    }
    func testPresentationDismissalKeepsResolveFailureUntilExplicitClose() throws {
        let model = AppModel(client: try client(ControlledTransport()))
        model.admission = .ready
        model.lastRequest = .product("selected-product")
        model.scanError = "Die Verbindung ist gerade nicht verfügbar. Versuche es erneut."
        model.searchPresented = true
        model.dismissScanPresentation()
        XCTAssertFalse(model.searchPresented)
        XCTAssertEqual(model.lastRequest, .product("selected-product"))
        XCTAssertNotNil(model.scanError)
        model.dismissScanPresentation() // SwiftUI binding and onDismiss may both fire.
        XCTAssertEqual(model.lastRequest, .product("selected-product"))
        XCTAssertNotNil(model.scanError)
        model.dismissScan() // The explicit close action acknowledges the error.
        XCTAssertNil(model.lastRequest); XCTAssertNil(model.scanError)
        model.lastRequest = .barcode("12345678"); model.scanBusy = true
        model.dismissScanPresentation() // A normal cancellation still clears pending scan state.
        XCTAssertNil(model.lastRequest); XCTAssertFalse(model.scanBusy)
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
        model.scanError = "Retained resolve failure"
        model.lastRequest = .product("account-A-product")
        model.dismissScanPresentation()
        XCTAssertNotNil(model.scanError)
        let callback = LoginCallback(attemptId: UUID().uuidString, tokenHash: "abcdefghijklmnop")
        model.pendingAccountLink = callback
        let switching = Task { await model.confirmAccountLink(callback) }
        try await waitFor("logout", transport: transport)
        XCTAssertNil(model.session)
        XCTAssertNil(model.profile)
        XCTAssertNil(model.scanError)
        XCTAssertNil(model.lastRequest)
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
    private func editFixture() throws -> String {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "profile-edit-v1", withExtension: "json"))
        return try String(contentsOf: url, encoding: .utf8)
    }
    private func editModel(_ transport: ControlledTransport) async throws -> AppModel {
        let client = try client(transport)
        try await client.install(session("A"))
        let model = AppModel(client: client)
        model.session = session("A")
        model.admission = .ready
        model.profile = HairProfile(profileRevision: "2", answers: [])
        return model
    }
    private func openEdit(_ model: AppModel, _ transport: ControlledTransport) async throws {
        let load = Task { await model.beginProfileEdit() }
        try await waitFor("edit", transport: transport)
        await transport.complete("edit", json: try editFixture())
        await load.value
        XCTAssertNotNil(model.profileDraft)
    }
    private func reviewEdit(_ model: AppModel) {
        model.changeProfileDraft { $0.step = $0.snapshot.questions.count }
    }
    func testEditCancelDiscardsLocalChangesAndRejectsLateLoad() async throws {
        let transport = ControlledTransport()
        let model = try await editModel(transport)
        try await openEdit(model, transport)
        model.changeProfileDraft { $0.step = 0; $0.select("straight") }
        XCTAssertEqual(model.profileDraft?.answers.structure, "straight")
        model.cancelProfileEdit()
        XCTAssertNil(model.profileDraft)
        XCTAssertEqual(model.profile?.profileRevision, "2")
        let load = Task { await model.beginProfileEdit() }
        try await waitFor("edit", transport: transport)
        model.cancelProfileEdit()
        await transport.complete("edit", json: try editFixture())
        await load.value
        XCTAssertNil(model.profileDraft)
        XCTAssertFalse(model.profileEditPresented)
    }
    func testAmbiguousSaveRetriesSameIdentityAndFreezesInFlightDraft() async throws {
        let transport = ControlledTransport()
        let model = try await editModel(transport)
        try await openEdit(model, transport)
        reviewEdit(model)
        let save = Task { await model.saveProfileEdit() }
        try await waitFor("edit", transport: transport)
        let capturedFirst = await transport.lastBody("edit")
        let firstData = try XCTUnwrap(capturedFirst)
        let first = try JSONDecoder().decode(ProfileEditRequest.self, from: firstData)
        model.changeProfileDraft { $0.answers.structure = "straight" }
        model.cancelProfileEdit()
        XCTAssertTrue(model.profileSaving)
        XCTAssertTrue(model.profileEditPresented)
        XCTAssertEqual(model.profileDraft?.answers.structure, "wavy")
        await transport.fail("edit")
        await save.value
        XCTAssertNotNil(model.profileDraft)
        XCTAssertTrue(model.profileEditError?.contains("nicht bestätigen") == true)
        let retry = Task { await model.saveProfileEdit() }
        try await waitFor("edit", transport: transport)
        let capturedRetry = await transport.lastBody("edit")
        let retryData = try XCTUnwrap(capturedRetry)
        let retryRequest = try JSONDecoder().decode(ProfileEditRequest.self, from: retryData)
        XCTAssertEqual(first.requestId, retryRequest.requestId)
        XCTAssertEqual(first.answers, retryRequest.answers)
        await transport.complete("edit", json: "{\"profileRevision\":\"3\",\"contextRevision\":\"c3\",\"answers\":[]}")
        await retry.value
        XCTAssertEqual(model.profile?.profileRevision, "3")
        XCTAssertNil(model.profileDraft)
    }
    func testConflictKeepsDraftAndRequiresExplicitReload() async throws {
        let transport = ControlledTransport()
        let model = try await editModel(transport)
        try await openEdit(model, transport)
        model.changeProfileDraft { $0.answers.structure = "straight" }
        reviewEdit(model)
        let save = Task { await model.saveProfileEdit() }
        try await waitFor("edit", transport: transport)
        await transport.complete("edit", status: 409, json: "{\"error\":\"profile_conflict\"}")
        await save.value
        XCTAssertTrue(model.profileEditConflict)
        XCTAssertEqual(model.profileDraft?.answers.structure, "straight")
        let count = await transport.requestCount("edit")
        await model.saveProfileEdit()
        let retryCount = await transport.requestCount("edit")
        XCTAssertEqual(count, retryCount)
        let reload = Task { await model.reloadProfileEdit() }
        try await waitFor("edit", transport: transport)
        await transport.complete("edit", json: try editFixture())
        await reload.value
        XCTAssertFalse(model.profileEditConflict)
        XCTAssertEqual(model.profileDraft?.answers.structure, "wavy")
    }
    func testSaveInvalidatesLateProfileScanAndSearchAndClearsCachedResults() async throws {
        let transport = ControlledTransport()
        let model = try await editModel(transport)
        try await openEdit(model, transport)
        let profileLoad = Task { await model.loadProfile() }
        try await waitFor("profile", transport: transport)
        let scan = Task { await model.resolve(.barcode("12345678")) }
        try await waitFor("resolve", transport: transport)
        model.searchPresented = true
        model.searchText = "Shampoo"
        let search = Task { await model.search() }
        try await waitFor("search", transport: transport)
        reviewEdit(model)
        let save = Task { await model.saveProfileEdit() }
        try await waitFor("edit", transport: transport)
        await transport.complete("edit", json: "{\"profileRevision\":\"3\",\"contextRevision\":\"c3\",\"answers\":[]}")
        await save.value
        await transport.complete("profile", json: "{\"profileRevision\":\"2\",\"answers\":[]}")
        await transport.complete("resolve", json: "{\"contractVersion\":1,\"kind\":\"submission_required\",\"productId\":null,\"missingFacts\":[\"unknown_product\"]}")
        await transport.complete("search", json: "{\"contractVersion\":1,\"results\":[],\"truncated\":false}")
        await profileLoad.value; await scan.value; await search.value
        XCTAssertEqual(model.profile?.profileRevision, "3")
        XCTAssertNil(model.scanResult)
        XCTAssertNil(model.lastRequest)
        XCTAssertFalse(model.scanBusy)
        XCTAssertFalse(model.searchPresented)
        XCTAssertFalse(model.searchBusy)
        XCTAssertEqual(model.searchText, "")
        XCTAssertTrue(model.searchResults.isEmpty)
    }
    func testLogoutClearsDraftAndRejectsLateSuccessfulSave() async throws {
        let transport = ControlledTransport()
        let model = try await editModel(transport)
        try await openEdit(model, transport)
        reviewEdit(model)
        let save = Task { await model.saveProfileEdit() }
        try await waitFor("edit", transport: transport)
        let logout = Task { await model.logout() }
        try await waitFor("logout", transport: transport)
        XCTAssertNil(model.profileDraft)
        XCTAssertFalse(model.profileSaving)
        await transport.complete("edit", json: "{\"profileRevision\":\"3\",\"contextRevision\":\"c3\",\"answers\":[]}")
        await transport.complete("logout", json: "{}")
        await save.value; await logout.value
        XCTAssertNil(model.profile)
        XCTAssertNil(model.profileSavedMessage)
        XCTAssertEqual(model.admission, .signedOut)
    }
    func testExpiredSaveClearsDraftAfterFailedRefresh() async throws {
        let transport = ControlledTransport()
        let model = try await editModel(transport)
        try await openEdit(model, transport)
        reviewEdit(model)
        let save = Task { await model.saveProfileEdit() }
        try await waitFor("edit", transport: transport)
        await transport.complete("edit", status: 401, json: "{}")
        try await waitFor("refresh", transport: transport)
        await transport.complete("refresh", status: 401, json: "{}")
        await save.value
        XCTAssertNil(model.profileDraft)
        XCTAssertFalse(model.profileEditPresented)
        XCTAssertEqual(model.admission, .signedOut)
    }

    func testSinglePropertySaveAcknowledgmentRetryAndConflictReloadPreserveTarget() async throws {
        let transport = ControlledTransport()
        let model = try await editModel(transport)
        let load = Task { await model.beginProfileEdit(propertyID: "thickness") }
        try await waitFor("edit", transport: transport)
        await transport.complete("edit", json: try editFixture())
        await load.value
        XCTAssertEqual(model.profileEditPropertyID, "thickness")
        XCTAssertEqual(model.profileDraft?.question?.id, "thickness")
        let before = try XCTUnwrap(model.profileDraft?.answers)
        await model.saveProfileEdit()
        let beforeChangeRequests = await transport.requestCount("edit")
        XCTAssertEqual(beforeChangeRequests, 1, "Unchanged single-property draft must not POST")
        model.changeProfileDraft { $0.select("coarse") }
        let save = Task { await model.saveProfileEdit() }
        try await waitFor("edit", transport: transport)
        let firstBody = await transport.lastBody("edit")
        let first = try JSONDecoder().decode(ProfileEditRequest.self, from: XCTUnwrap(firstBody))
        var expected = before
        expected.thickness = "coarse"
        XCTAssertEqual(first.answers, expected)
        XCTAssertTrue(model.profileSaving)
        XCTAssertTrue(model.profileEditPresented)
        XCTAssertEqual(model.profile?.profileRevision, "2", "No optimistic success before acknowledgment")
        model.changeProfileDraft { $0.select("normal") }
        model.cancelProfileEdit()
        XCTAssertEqual(model.profileDraft?.answers, expected)
        await transport.fail("edit")
        await save.value
        XCTAssertEqual(model.profileDraft?.question?.id, "thickness")
        XCTAssertEqual(model.profileDraft?.answers, expected)
        let retry = Task { await model.saveProfileEdit() }
        try await waitFor("edit", transport: transport)
        let retryBody = await transport.lastBody("edit")
        let repeated = try JSONDecoder().decode(ProfileEditRequest.self, from: XCTUnwrap(retryBody))
        XCTAssertEqual(first.requestId, repeated.requestId)
        XCTAssertEqual(first.answers, repeated.answers)
        await transport.complete("edit", status: 409, json: "{\"error\":\"profile_conflict\"}")
        await retry.value
        XCTAssertTrue(model.profileEditConflict)
        XCTAssertEqual(model.profileDraft?.answers, expected)
        let reload = Task { await model.reloadProfileEdit() }
        try await waitFor("edit", transport: transport)
        await transport.complete("edit", json: try editFixture())
        await reload.value
        XCTAssertEqual(model.profileEditPropertyID, "thickness")
        XCTAssertEqual(model.profileDraft?.question?.id, "thickness")
        XCTAssertEqual(model.profileDraft?.answers, before)
        XCTAssertFalse(model.profileEditConflict)
        model.changeProfileDraft { $0.select("normal") }
        let acknowledged = Task { await model.saveProfileEdit() }
        try await waitFor("edit", transport: transport)
        await transport.complete("edit", json: "{\"profileRevision\":\"3\",\"contextRevision\":\"c3\",\"answers\":[]}")
        await acknowledged.value
        XCTAssertFalse(model.profileEditPresented)
        XCTAssertNil(model.profileEditPropertyID)
        XCTAssertNil(model.profileDraft)
        XCTAssertEqual(model.profile?.profileRevision, "3")
    }
    func testSinglePropertyLateLoadCannotReopenAfterCancelOrAccountSwitch() async throws {
        let transport = ControlledTransport()
        let model = try await editModel(transport)
        let load = Task { await model.beginProfileEdit(propertyID: "goals") }
        try await waitFor("edit", transport: transport)
        model.cancelProfileEdit()
        XCTAssertNil(model.profileEditPropertyID)
        let logout = Task { await model.logout() }
        try await waitFor("logout", transport: transport)
        await transport.complete("edit", json: try editFixture())
        await transport.complete("logout", json: "{}")
        await load.value
        await logout.value
        XCTAssertNil(model.profileDraft)
        XCTAssertNil(model.profileEditPropertyID)
        XCTAssertFalse(model.profileEditPresented)
        XCTAssertEqual(model.admission, .signedOut)
    }

}
