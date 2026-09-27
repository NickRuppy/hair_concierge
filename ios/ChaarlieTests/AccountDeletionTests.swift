import XCTest
@testable import Chaarlie

@MainActor
private final class SilentNotifications: ResearchNotificationSystem {
    var environment: String? { nil }
    var topic: String? { nil }
    func isAuthorized() async -> Bool { false }
    func requestAuthorization() async -> Bool { false }
    func register() {}
    func unregister() {}
}
private final class MemoryDraftStore: OnboardingDraftPersistence, @unchecked Sendable {
    private let lock = NSLock()
    private var value: OnboardingDraft?
    init(_ value: OnboardingDraft?) { self.value = value }
    var draft: OnboardingDraft? { lock.withLock { value } }
    func load() throws -> OnboardingDraft? { lock.withLock { value } }
    func save(_ draft: OnboardingDraft?) throws { lock.withLock { value = draft } }
}

@MainActor
final class AccountDeletionTests: XCTestCase {
    private let userID = "0b6f5c1e-8d3a-4c2b-9e1f-2a3b4c5d6e7f"
    private let purchase = StoreTransaction(id: 2_000_000_001, signedTransaction: "header.purchase.signature")

    private func appStore(willRenew: Bool) -> String {
        #"{"status":"active","source":"app_store","appStore":{"productId":"de.chaarlie.scanner.yearly","expiresAt":"2027-09-27T10:00:00.000Z","willRenew":\#(willRenew),"inBillingRetry":false}}"#
    }
    private let webAccess = #"{"status":"active","source":"web","appStore":null}"#

    // MARK: Step 1 — Apple subscription notice

    func testNoticeOnlyForARenewingAppStoreSubscription() async throws {
        let (model, transport, _, _) = try await signedInModel(access: appStore(willRenew: true))
        await model.beginAccountDeletion()
        XCTAssertEqual(model.accountDeletion, .subscriptionNotice)
        let asked = await transport.requestCount("preflight")
        XCTAssertEqual(asked, 0, "The notice comes before any server call")

        // "Trotzdem fortfahren" moves on to the confirmation.
        let continuing = Task { await model.continueAccountDeletion() }
        try await waitFor("preflight", transport)
        await transport.complete("preflight", json: #"{"webSubscription":false}"#)
        await continuing.value
        XCTAssertEqual(model.accountDeletion, .confirm(webSubscription: false))

        for access in [appStore(willRenew: false), webAccess, nil] {
            let (other, otherTransport, _, _) = try await signedInModel(access: access)
            let beginning = Task { await other.beginAccountDeletion() }
            try await waitFor("preflight", otherTransport)
            XCTAssertEqual(other.accountDeletion, .loading, "No notice for \(String(describing: access))")
            await otherTransport.complete("preflight", json: #"{"webSubscription":false}"#)
            await beginning.value
            XCTAssertEqual(other.accountDeletion, .confirm(webSubscription: false))
        }
    }
    func testPaywalledAccountCanStartDeletion() async throws {
        let (model, transport, _, _) = try await signedInModel(access: #"{"status":"none","source":null,"appStore":null}"#)
        XCTAssertEqual(model.admission, .paywall)
        let beginning = Task { await model.beginAccountDeletion() }
        try await waitFor("preflight", transport)
        await transport.complete("preflight", json: #"{"webSubscription":false}"#)
        await beginning.value
        XCTAssertEqual(model.accountDeletion, .confirm(webSubscription: false))
    }

    // MARK: Step 2 — confirmation and the A1 disclosure

    func testA1LineOnlyWhenPreflightReportsAWebSubscription() async throws {
        for webSubscription in [true, false] {
            let (model, transport, _, _) = try await signedInModel()
            let beginning = Task { await model.beginAccountDeletion() }
            try await waitFor("preflight", transport)
            let request = await transport.lastRequest("preflight")
            XCTAssertEqual(request?.httpMethod, "GET")
            XCTAssertEqual(request?.url?.path, "/api/mobile/v1/account/delete/preflight")
            XCTAssertEqual(request?.value(forHTTPHeaderField: "Authorization"), "Bearer access-\(userID)")
            await transport.complete("preflight", json: #"{"webSubscription":\#(webSubscription)}"#)
            await beginning.value
            XCTAssertEqual(model.accountDeletion, .confirm(webSubscription: webSubscription))
            XCTAssertNotNil(model.accountDeletionRequestID)
        }
    }
    func testPreflightFailureBlocksTheConfirmationUntilRetrySucceeds() async throws {
        let (model, transport, _, _) = try await signedInModel()
        let beginning = Task { await model.beginAccountDeletion() }
        try await waitFor("preflight", transport)
        await transport.complete("preflight", status: 503, json: #"{"error":"temporarily_unavailable"}"#)
        await beginning.value
        XCTAssertEqual(model.accountDeletion, .preflightFailed)
        XCTAssertEqual(model.accountDeletionError, "Das hat nicht geklappt. Bitte versuche es erneut.")
        XCTAssertNil(model.accountDeletionRequestID, "Nothing can be confirmed without the A1 answer")
        await model.confirmAccountDeletion()
        let posted = await transport.requestCount("delete")
        XCTAssertEqual(posted, 0)

        let retry = Task { await model.continueAccountDeletion() }
        try await waitFor("preflight", transport)
        await transport.complete("preflight", json: #"{"webSubscription":true}"#)
        await retry.value
        XCTAssertEqual(model.accountDeletion, .confirm(webSubscription: true))
        XCTAssertNil(model.accountDeletionError)
    }

    // MARK: Deletion outcomes

    func testSuccessWipesLocalStateStopsStoreKitAndShowsSignedOutNotice() async throws {
        let store = FakeStoreService()
        let drafts = MemoryDraftStore(OnboardingDraft(version: 1))
        let push = ResearchPushCoordinator(system: SilentNotifications(), installationId: "old-installation")
        let (model, transport, client, sessions) = try await signedInModel(store: store, drafts: drafts, push: push, access: webAccess)
        try sessions.saveAttempt(AuthAttempt(attemptId: "pending", codeLength: 8))
        XCTAssertNotNil(model.access)
        model.profile = HairProfile(profileRevision: "1", answers: [])
        model.historyEntries = [HistoryEntry(id: "entry-1", barcodeGtin: "4006381333931", productId: nil, productName: nil,
                                             brand: nil, imageUrl: nil, lastSeenAt: "2026-09-19T12:00:00Z", status: .not_in_catalog)]
        try await confirm(model, transport, webSubscription: true)
        let requestID = try XCTUnwrap(model.accountDeletionRequestID)

        let deleting = Task { await model.confirmAccountDeletion() }
        try await waitFor("delete", transport)
        XCTAssertEqual(model.accountDeletion, .deleting(webSubscription: true))
        let request = await transport.lastRequest("delete")
        XCTAssertEqual(request?.httpMethod, "POST")
        XCTAssertEqual(request?.url?.path, "/api/mobile/v1/account/delete")
        XCTAssertEqual(request?.value(forHTTPHeaderField: "Authorization"), "Bearer access-\(userID)")
        let body = try JSONDecoder().decode([String: String].self, from: XCTUnwrap(request?.httpBody))
        XCTAssertEqual(body, ["requestId": requestID.uuidString.lowercased(), "confirm": "delete"])
        await transport.complete("delete", json: #"{"status":"deleted"}"#)
        await deleting.value

        XCTAssertEqual(model.admission, .signedOut)
        XCTAssertEqual(model.signedOutNotice, "Dein Konto wurde gelöscht.")
        XCTAssertNil(model.authError)
        XCTAssertNil(model.session)
        XCTAssertNil(model.accountDeletion)
        XCTAssertNil(model.accountDeletionRequestID)
        XCTAssertNil(model.access)
        XCTAssertNil(model.profile)
        XCTAssertTrue(model.historyEntries.isEmpty)
        let savedSession = await client.currentSession()
        XCTAssertNil(savedSession)
        XCTAssertNil(try sessions.loadSession(), "Keychain session removed")
        XCTAssertNil(try sessions.loadAttempt(), "Pending login attempt removed")
        XCTAssertNil(drafts.draft, "Onboarding draft removed")
        XCTAssertNotEqual(push.installationId, "old-installation", "Installation ID rotated")
        let loggedOut = await transport.requestCount("logout")
        XCTAssertEqual(loggedOut, 0, "The deleted account is never contacted again")
        let statusLookups = await transport.requestCount(requestID.uuidString.lowercased())
        XCTAssertEqual(statusLookups, 0)

        store.emit(purchase)
        try await Task.sleep(for: .milliseconds(100))
        let posted = await transport.requestCount("transactions")
        XCTAssertEqual(posted, 0, "StoreKit listener detached")
    }
    func testFailureKeepsTheSessionAndRetryReusesTheRequestID() async throws {
        let (model, transport, client, _) = try await signedInModel()
        try await confirm(model, transport, webSubscription: true)
        let requestID = try XCTUnwrap(model.accountDeletionRequestID)
        let status = requestID.uuidString.lowercased()

        let failing = Task { await model.confirmAccountDeletion() }
        try await waitFor("delete", transport)
        await transport.complete("delete", status: 503, json: #"{"error":"billing_cancel_failed"}"#)
        // A failed POST may still have deleted; the status lookup decides.
        try await waitFor(status, transport)
        let lookup = await transport.lastRequest(status)
        XCTAssertNil(lookup?.value(forHTTPHeaderField: "Authorization"), "Status lookup is unauthenticated")
        XCTAssertEqual(lookup?.url?.path, "/api/mobile/v1/account/delete/\(status)")
        await transport.complete(status, json: #"{"state":"requested"}"#)
        await failing.value
        XCTAssertEqual(model.accountDeletion, .confirm(webSubscription: true))
        XCTAssertEqual(model.accountDeletionError, "Löschen hat nicht geklappt. Bitte versuche es erneut.")
        XCTAssertEqual(model.admission, .ready)
        XCTAssertNotNil(model.session)
        let kept = await client.currentSession()
        XCTAssertNotNil(kept)

        let retry = Task { await model.confirmAccountDeletion() }
        try await waitFor("delete", transport)
        let retried = await transport.lastBody("delete")
        let body = try JSONDecoder().decode([String: String].self, from: XCTUnwrap(retried))
        XCTAssertEqual(body["requestId"], status, "The same requestId on retry")
        await transport.complete("delete", json: #"{"status":"deleted"}"#)
        await retry.value
        XCTAssertEqual(model.admission, .signedOut)
        XCTAssertEqual(model.signedOutNotice, "Dein Konto wurde gelöscht.")
    }
    func testLostResponseThen401IsConfirmedByTheStatusLookup() async throws {
        let (model, transport, _, _) = try await signedInModel()
        try await confirm(model, transport, webSubscription: false)
        let status = try XCTUnwrap(model.accountDeletionRequestID).uuidString.lowercased()

        // The server deleted the account, but the response and the first lookup are lost.
        let first = Task { await model.confirmAccountDeletion() }
        try await waitFor("delete", transport)
        await transport.fail("delete")
        try await waitFor(status, transport)
        await transport.fail(status)
        await first.value
        XCTAssertEqual(model.accountDeletionError, "Löschen hat nicht geklappt. Bitte versuche es erneut.")

        // The retry answers 401 (the account is gone) and the refresh is refused.
        let retry = Task { await model.confirmAccountDeletion() }
        try await waitFor("delete", transport)
        await transport.complete("delete", status: 401, json: #"{"error":"unauthorized"}"#)
        try await waitFor("refresh", transport)
        await transport.complete("refresh", status: 401, json: #"{"error":"unauthorized"}"#)
        try await waitFor(status, transport)
        await transport.complete(status, json: #"{"state":"data_deleted"}"#)
        await retry.value
        XCTAssertEqual(model.admission, .signedOut)
        XCTAssertEqual(model.signedOutNotice, "Dein Konto wurde gelöscht.")
        XCTAssertNil(model.authError, "A completed deletion is not an expired login")
    }
    func testUnauthorizedWithoutAnyServerRecordIsAnExpiredLogin() async throws {
        let (model, transport, _, _) = try await signedInModel()
        try await confirm(model, transport, webSubscription: false)
        let status = try XCTUnwrap(model.accountDeletionRequestID).uuidString.lowercased()
        let deleting = Task { await model.confirmAccountDeletion() }
        try await waitFor("delete", transport)
        await transport.complete("delete", status: 401, json: #"{"error":"unauthorized"}"#)
        try await waitFor("refresh", transport)
        await transport.complete("refresh", status: 401, json: #"{"error":"unauthorized"}"#)
        try await waitFor(status, transport)
        await transport.complete(status, status: 404, json: #"{"error":"not_found"}"#)
        await deleting.value
        XCTAssertEqual(model.admission, .signedOut)
        XCTAssertNil(model.signedOutNotice)
        XCTAssertEqual(model.authError, "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.")
    }
    func testAdminAccountIsRefusedWithItsOwnMessage() async throws {
        let (model, transport, _, _) = try await signedInModel()
        try await confirm(model, transport, webSubscription: false)
        let status = try XCTUnwrap(model.accountDeletionRequestID).uuidString.lowercased()
        let deleting = Task { await model.confirmAccountDeletion() }
        try await waitFor("delete", transport)
        await transport.complete("delete", status: 403, json: #"{"error":"admin_account"}"#)
        await deleting.value
        XCTAssertEqual(model.accountDeletion, .confirm(webSubscription: false))
        XCTAssertEqual(model.accountDeletionError, "Dieses Konto kann nicht in der App gelöscht werden.")
        XCTAssertEqual(model.admission, .ready)
        XCTAssertNotNil(model.session)
        let lookups = await transport.requestCount(status)
        XCTAssertEqual(lookups, 0)
    }
    func testLateDeletionResponseAfterLogoutIsIgnored() async throws {
        let drafts = MemoryDraftStore(OnboardingDraft(version: 1))
        let (model, transport, client, _) = try await signedInModel(drafts: drafts)
        try await confirm(model, transport, webSubscription: false)
        let status = try XCTUnwrap(model.accountDeletionRequestID).uuidString.lowercased()
        let deleting = Task { await model.confirmAccountDeletion() }
        try await waitFor("delete", transport)
        let logout = Task { await model.logout() }
        try await waitFor("logout", transport)
        await transport.complete("logout", json: "{}")
        await logout.value
        XCTAssertNil(model.accountDeletion)
        // Another account signs in before the old response lands.
        let other = session("7c9e6679-7425-40de-944b-e07fc1f90ae7")
        try await client.install(other)
        model.session = other
        model.admission = .ready
        await transport.complete("delete", json: #"{"status":"deleted"}"#)
        await deleting.value
        XCTAssertEqual(model.admission, .ready)
        XCTAssertEqual(model.session, other)
        let installed = await client.currentSession()
        XCTAssertEqual(installed, other, "The new account's session is untouched")
        XCTAssertNil(model.signedOutNotice)
        XCTAssertNotNil(drafts.draft)
        let lookups = await transport.requestCount(status)
        XCTAssertEqual(lookups, 0)
    }
    func testCancelClosesTheFlowButNotWhileDeleting() async throws {
        let (model, transport, _, _) = try await signedInModel()
        try await confirm(model, transport, webSubscription: false)
        let deleting = Task { await model.confirmAccountDeletion() }
        try await waitFor("delete", transport)
        model.cancelAccountDeletion()
        XCTAssertEqual(model.accountDeletion, .deleting(webSubscription: false))
        await transport.complete("delete", json: #"{"status":"deleted"}"#)
        await deleting.value
        XCTAssertEqual(model.admission, .signedOut)

        let (other, otherTransport, _, _) = try await signedInModel()
        try await confirm(other, otherTransport, webSubscription: false)
        other.cancelAccountDeletion()
        XCTAssertNil(other.accountDeletion)
    }

    // MARK: Helpers

    private func confirm(_ model: AppModel, _ transport: ControlledTransport, webSubscription: Bool) async throws {
        let beginning = Task { await model.beginAccountDeletion() }
        try await waitFor("preflight", transport)
        await transport.complete("preflight", json: #"{"webSubscription":\#(webSubscription)}"#)
        await beginning.value
        XCTAssertEqual(model.accountDeletion, .confirm(webSubscription: webSubscription))
    }
    private func session(_ id: String) -> MobileSession {
        MobileSession(accessToken: "access-\(id)", refreshToken: "refresh-\(id)",
                      expiresAt: Date().timeIntervalSince1970 + 600, userId: id)
    }
    private func signedInModel(store: FakeStoreService = FakeStoreService(), drafts: MemoryDraftStore = MemoryDraftStore(nil),
                               push: ResearchPushCoordinator? = nil, access: String? = nil)
        async throws -> (AppModel, ControlledTransport, MobileClient, MemorySessionStore) {
        let transport = ControlledTransport(), sessions = MemorySessionStore()
        let client = MobileClient(configuration: try MobileConfiguration(baseURL: XCTUnwrap(URL(string: "http://127.0.0.1:3218/api/mobile/v1"))),
                                  transport: transport, store: sessions)
        let active = session(userID)
        try await client.install(active)
        let model = AppModel(client: client,
                             push: push ?? ResearchPushCoordinator(system: SilentNotifications(), installationId: UUID().uuidString),
                             store: store, drafts: drafts)
        model.session = active
        // Access arrives only from the server's bootstrap, as in the app.
        let boot = Task { await model.bootstrap() }
        try await waitFor("bootstrap", transport)
        let accessField = access.map { #","access":\#($0)"# } ?? ""
        await transport.complete("bootstrap", json: #"{"status":"ready","profileRevision":"1","contextRevision":"1"\#(accessField)}"#)
        await boot.value
        return (model, transport, client, sessions)
    }
    private func waitFor(_ path: String, _ transport: ControlledTransport) async throws {
        for _ in 0..<200 {
            if await transport.hasRequest(path) { return }
            try await Task.sleep(for: .milliseconds(5))
        }
        throw NSError(domain: "AccountDeletionTest.RequestDidNotReach.\(path)", code: 1)
    }
}
