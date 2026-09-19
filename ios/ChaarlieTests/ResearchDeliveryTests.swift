import XCTest
@testable import Chaarlie

@MainActor
private final class FakeResearchNotifications: ResearchNotificationSystem {
    var environment: String? = "sandbox"
    var topic: String? = "de.chaarlie.test"
    var authorized = false
    var permissionGranted = true
    var requests = 0
    var registrations = 0
    var permissionContinuation: CheckedContinuation<Bool, Never>?
    var holdPermission = false
    func isAuthorized() async -> Bool { authorized }
    func requestAuthorization() async -> Bool {
        requests += 1
        if holdPermission { return await withCheckedContinuation { permissionContinuation = $0 } }
        return permissionGranted
    }
    func register() { registrations += 1 }
    func unregister() {}
}

@MainActor
final class ResearchDeliveryTests: XCTestCase {
    private let identifier = UUID(uuidString: "0b6d6b0f-8b72-4a08-8a09-17b5a7f65718")!
    private var path: String { identifier.uuidString.lowercased() }
    private var link: URL { URL(string: "chaarlie-local://research/\(path)")! }

    func testDestinationAcceptsOnlyExactConfiguredSchemeAndPublicURL() {
        XCTAssertEqual(ResearchDestination.parse(link), identifier)
        XCTAssertEqual(ResearchDestination.parse(URL(string: "https://chaarlie.de/app/research/\(path)")!), identifier)
        XCTAssertEqual(ResearchDestination.parse(URL(string: "chaarlie://research/\(path)")!, scheme: "chaarlie"), identifier)
        for value in ["https://evil.test/app/research/\(path)", "http://chaarlie.de/app/research/\(path)",
                      "https://user@chaarlie.de/app/research/\(path)", "https://chaarlie.de:443/app/research/\(path)",
                      "chaarlie-local://research/\(path)?owner=other", "chaarlie-local://research/\(path)#token=x",
                      "chaarlie-local://research/\(path)/extra", "chaarlie-pilot://research/\(path)",
                      "chaarlie-local://research/not-a-uuid"] {
            XCTAssertNil(ResearchDestination.parse(URL(string: value)!), value)
        }
        XCTAssertNil(ResearchDestination.notificationURL(["url": "https://evil.test/app/research/\(path)"]))
    }

    func testOldBootstrapDefaultsDeliveryOff() throws {
        let bootstrap = try JSONDecoder().decode(Bootstrap.self, from: Data(#"{"status":"ready"}"#.utf8))
        XCTAssertNotEqual(bootstrap.researchDeliveryEnabled, true)
    }

    func testColdStartRestoresSessionBeforeOpeningOwnerBoundResult() async throws {
        let (model, transport) = try await makeModel()
        let task = Task { await model.receive(link) }
        try await waitFor("bootstrap", transport)
        await transport.complete("bootstrap", json: #"{"status":"ready"}"#)
        try await waitFor(path, transport)
        await transport.complete(path, json: try fixture())
        await task.value
        XCTAssertEqual(model.selectedTab, .history)
        XCTAssertEqual(model.scanResult?.kind, .assessment)
        XCTAssertNil(model.pendingResearchDestination)
    }

    func testSignedOutDestinationSurvivesLoginBootstrap() async throws {
        let transport = ControlledTransport()
        let client = try makeClient(transport)
        let model = AppModel(client: client)
        await model.receive(link)
        XCTAssertEqual(model.admission, .signedOut)
        XCTAssertEqual(model.pendingResearchDestination, identifier)
        model.attempt = AuthAttempt(attemptId: UUID().uuidString, codeLength: 8)
        model.code = "12345678"
        let task = Task { await model.verifyCode() }
        try await waitFor("verify", transport)
        await transport.complete("verify", json: #"{"accessToken":"a","refreshToken":"r","expiresAt":9999999999,"userId":"owner"}"#)
        try await waitFor("bootstrap", transport)
        await transport.complete("bootstrap", json: #"{"status":"ready"}"#)
        try await waitFor(path, transport)
        await transport.complete(path, json: try fixture())
        await task.value
        XCTAssertEqual(model.scanResult?.kind, .assessment)
        XCTAssertNil(model.pendingResearchDestination)
    }

    func testNotReadyKeepsDestinationForExplicitRetry() async throws {
        let (model, transport) = try await makeModel()
        model.admission = .ready
        let task = Task { await model.receive(link) }
        try await waitFor(path, transport)
        await transport.complete(path, status: 409, json: #"{"kind":"not_ready"}"#)
        await task.value
        XCTAssertEqual(model.pendingResearchDestination, identifier)
        XCTAssertNotNil(model.researchDestinationError)
        let retry = Task { await model.openResearchDestination() }
        try await waitFor(path, transport)
        await transport.complete(path, json: try fixture())
        await retry.value
        XCTAssertNil(model.researchDestinationError)
        XCTAssertNotNil(model.scanResult)
    }

    func testForeignOwnerResultNeverDisplaysAndDismissClearsIntent() async throws {
        let (model, transport) = try await makeModel()
        model.admission = .ready
        let task = Task { await model.receive(link) }
        try await waitFor(path, transport)
        await transport.complete(path, status: 404, json: #"{"error":"not_found"}"#)
        await task.value
        XCTAssertNil(model.scanResult)
        XCTAssertTrue(model.researchDestinationError?.contains("Konto") == true)
        model.dismissResearchDestination()
        XCTAssertNil(model.pendingResearchDestination)
    }

    func testLateResultCannotReappearAfterLogout() async throws {
        let (model, transport) = try await makeModel()
        model.admission = .ready
        let task = Task { await model.receive(link) }
        try await waitFor(path, transport)
        let logout = Task { await model.logout() }
        try await waitFor("logout", transport)
        await transport.complete(path, json: try fixture())
        await transport.complete("logout", json: "{}")
        await task.value; await logout.value
        XCTAssertNil(model.scanResult)
        XCTAssertNil(model.pendingResearchDestination)
        XCTAssertEqual(model.admission, .signedOut)
    }

    func testUnconfiguredBuildAndDisabledFlagCannotPrompt() async throws {
        for configured in [true, false] {
            let system = FakeResearchNotifications()
            system.environment = configured ? "sandbox" : nil
            let coordinator = ResearchPushCoordinator(system: system, installationId: UUID().uuidString)
            let client = try makeClient(ControlledTransport())
            await coordinator.activate(client: client, enabled: !configured)
            coordinator.confirmedResearch()
            await coordinator.didRegister(token: Data([1, 2]))
            XCTAssertEqual(system.requests, 0)
            XCTAssertEqual(system.registrations, 0)
        }
        #if targetEnvironment(simulator)
        XCTAssertNil(AppleResearchNotifications().environment)
        #endif
    }

    func testPermissionWaitsForSuccessfulAPNsRegistrationAndDenialDoesNotUpload() async throws {
        let system = FakeResearchNotifications()
        system.permissionGranted = false
        let coordinator = ResearchPushCoordinator(system: system, installationId: UUID().uuidString)
        let transport = ControlledTransport()
        let client = try makeClient(transport)
        await coordinator.activate(client: client, enabled: true)
        XCTAssertEqual(system.requests, 0)
        coordinator.confirmedResearch()
        XCTAssertEqual(system.requests, 0)
        XCTAssertEqual(system.registrations, 1)
        await coordinator.didRegister(token: Data([1, 2]))
        XCTAssertEqual(system.requests, 1)
        let count = await transport.requestCount("registration")
        XCTAssertEqual(count, 0)
    }

    func testAuthorizedTokenRegistrationUsesInstallationEnvironmentAndTopic() async throws {
        let system = FakeResearchNotifications(); system.authorized = true
        let coordinator = ResearchPushCoordinator(system: system, installationId: path)
        let transport = ControlledTransport(); let client = try makeClient(transport)
        try await client.install(session())
        await coordinator.activate(client: client, enabled: true)
        let task = Task { await coordinator.didRegister(token: Data([0, 15, 255])) }
        try await waitFor("registration", transport)
        let body = await transport.lastBody("registration")
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(body)) as? [String: String])
        XCTAssertEqual(object["token"], "000fff")
        XCTAssertEqual(object["installationId"], path)
        XCTAssertEqual(object["environment"], "sandbox")
        XCTAssertEqual(object["topic"], "de.chaarlie.test")
        await transport.complete("registration", json: #"{"registered":true}"#)
        await task.value
        XCTAssertEqual(system.requests, 0)
    }

    func testLatePermissionCannotBindPushToNextAccount() async throws {
        let system = FakeResearchNotifications(); system.holdPermission = true
        let coordinator = ResearchPushCoordinator(system: system, installationId: path)
        let transport = ControlledTransport(); let client = try makeClient(transport)
        try await client.install(session())
        await coordinator.activate(client: client, enabled: true)
        coordinator.confirmedResearch()
        let task = Task { await coordinator.didRegister(token: Data([1])) }
        for _ in 0..<100 where system.permissionContinuation == nil { await Task.yield() }
        XCTAssertNotNil(system.permissionContinuation)
        coordinator.reset()
        try await client.install(session("other"))
        system.permissionContinuation?.resume(returning: true)
        await task.value
        let count = await transport.requestCount("registration")
        XCTAssertEqual(count, 0)
    }

    func testOnlyConfirmedPendingSubmissionStartsContextualRegistration() async throws {
        let system = FakeResearchNotifications()
        system.permissionGranted = false
        let coordinator = ResearchPushCoordinator(system: system, installationId: path)
        let transport = ControlledTransport(); let client = try makeClient(transport)
        try await client.install(session())
        let model = AppModel(client: client, push: coordinator)
        let restore = Task { await model.restore() }
        try await waitFor("bootstrap", transport)
        await transport.complete("bootstrap", json: #"{"status":"ready","researchDeliveryEnabled":true}"#)
        await restore.value
        XCTAssertEqual(system.registrations, 0)
        model.lastRequest = .barcode("4006381333931"); model.researchChecked = true
        let failure = Task { await model.submitResearch(category: "Shampoo") }
        try await waitFor("submit", transport)
        await transport.fail("submit")
        await failure.value
        XCTAssertEqual(system.registrations, 0)
        XCTAssertFalse(model.researchPending)
        let success = Task { await model.submitResearch(category: "Shampoo") }
        try await waitFor("submit", transport)
        await transport.complete("submit", json: "{\"contractVersion\":1,\"kind\":\"pending_submission\",\"submissionId\":\"\(path)\",\"historySaved\":true}")
        await success.value
        XCTAssertTrue(model.researchPending)
        XCTAssertEqual(system.registrations, 1)
        XCTAssertEqual(system.requests, 0)
        await coordinator.didRegister(token: Data([1]))
        XCTAssertTrue(model.researchPending, "Push denial must preserve confirmed research")
        XCTAssertNil(model.researchError)
    }

    func testLateResultCannotReplaceNewerDeepLink() async throws {
        let (model, transport) = try await makeModel()
        model.admission = .ready
        let older = Task { await model.receive(link) }
        try await waitFor(path, transport)
        let nextID = UUID().uuidString.lowercased()
        let newer = Task { await model.receive(URL(string: "chaarlie-local://research/\(nextID)")!) }
        try await waitFor(nextID, transport)
        await transport.complete(nextID, status: 404, json: "{}")
        await newer.value
        await transport.complete(path, json: try fixture())
        await older.value
        XCTAssertNil(model.scanResult)
        XCTAssertEqual(model.pendingResearchDestination, UUID(uuidString: nextID))
        XCTAssertTrue(model.researchDestinationError?.contains("Konto") == true)
    }

    func testLeavingHistoryCancelsPendingResearchPresentation() async throws {
        let (model, transport) = try await makeModel()
        model.admission = .ready
        let task = Task { await model.receive(link) }
        try await waitFor(path, transport)
        model.selectedTab = .search
        model.changeTab(from: .history)
        await transport.complete(path, json: try fixture())
        await task.value
        XCTAssertNil(model.scanResult)
        XCTAssertNil(model.pendingResearchDestination)
        XCTAssertFalse(model.researchDestinationBusy)
    }

    func testMissingProfileCompletionPreservesDestination() async throws {
        let (model, transport) = try await makeModel()
        let restore = Task { await model.restore() }
        try await waitFor("bootstrap", transport)
        await transport.complete("bootstrap", json: #"{"status":"profile_required"}"#)
        await restore.value
        await model.receive(link)
        XCTAssertEqual(model.pendingResearchDestination, identifier)
        let count = await transport.requestCount(path)
        XCTAssertEqual(count, 0)
        let response = try JSONDecoder().decode(RegistrationCompletion.self,
            from: Data(#"{"bootstrap":{"status":"ready"}}"#.utf8))
        let finish = Task { await model.finishMissingProfile(response) }
        try await waitFor(path, transport)
        await transport.complete(path, json: try fixture())
        let completed = await finish.value
        XCTAssertTrue(completed)
        XCTAssertNotNil(model.scanResult)
    }

    func testLogoutRevokesOldInstallationAndRotatesBeforeNetworkCompletes() async throws {
        let system = FakeResearchNotifications()
        let coordinator = ResearchPushCoordinator(system: system, installationId: path)
        let transport = ControlledTransport(); let client = try makeClient(transport)
        try await client.install(session())
        let model = AppModel(client: client, push: coordinator)
        await coordinator.activate(client: client, enabled: true)
        let task = Task { await model.logout() }
        try await waitFor("registration", transport)
        XCTAssertEqual(model.admission, .signedOut)
        XCTAssertNotEqual(coordinator.installationId, path)
        let body = await transport.lastBody("registration")
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(body)) as? [String: String])
        XCTAssertEqual(object["installationId"], path)
        await transport.complete("registration", json: #"{"revoked":true}"#)
        try await waitFor("logout", transport)
        await transport.complete("logout", json: "{}")
        await task.value
        XCTAssertNil(coordinator.installationToRevoke)
    }

    private func fixture() throws -> String {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "scan-v1", withExtension: "json"))
        return try String(contentsOf: url, encoding: .utf8)
    }
    private func session(_ owner: String = "owner") -> MobileSession {
        MobileSession(accessToken: "a", refreshToken: "r", expiresAt: 9999999999, userId: owner)
    }
    private func makeClient(_ transport: ControlledTransport) throws -> MobileClient {
        MobileClient(configuration: try MobileConfiguration(baseURL: URL(string: "http://localhost/api/mobile/v1")!),
                     transport: transport, store: MemorySessionStore())
    }
    private func makeModel() async throws -> (AppModel, ControlledTransport) {
        let transport = ControlledTransport(); let client = try makeClient(transport)
        try await client.install(session())
        return (AppModel(client: client), transport)
    }
    private func waitFor(_ path: String, _ transport: ControlledTransport) async throws {
        for _ in 0..<400 {
            if await transport.hasRequest(path) { return }
            try await Task.sleep(for: .milliseconds(5))
        }
        XCTFail("Missing request: \(path)")
        throw MobileError.unavailable
    }
}
