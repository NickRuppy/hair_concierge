import XCTest
import StoreKit
@testable import Chaarlie

/// StoreKit stand-in: `SKTestSession` is not reliable from xcodebuild here, so the
/// purchase core is exercised through the `StoreService` seam.
final class FakeStoreService: StoreService, @unchecked Sendable {
    private let lock = NSLock()
    private var pending: [StoreTransaction]
    private var entitlements: [StoreTransaction]
    private var finishedIDs: [UInt64] = []
    private var syncs = 0
    private let stream: AsyncStream<StoreTransaction>
    private let continuation: AsyncStream<StoreTransaction>.Continuation

    init(unfinished: [StoreTransaction] = [], entitlements: [StoreTransaction] = []) {
        pending = unfinished
        self.entitlements = entitlements
        (stream, continuation) = AsyncStream.makeStream()
    }
    var finished: [UInt64] { lock.withLock { finishedIDs } }
    var syncCount: Int { lock.withLock { syncs } }
    func emit(_ transaction: StoreTransaction) {
        lock.withLock { pending.append(transaction) }
        continuation.yield(transaction)
    }
    func updates() -> AsyncStream<StoreTransaction> { stream }
    func unfinished() async -> [StoreTransaction] { lock.withLock { pending } }
    func currentEntitlements() async -> [StoreTransaction] { lock.withLock { entitlements } }
    func sync() async throws { lock.withLock { syncs += 1 } }
    func finish(_ transaction: StoreTransaction) async {
        lock.withLock {
            finishedIDs.append(transaction.id)
            pending.removeAll { $0.id == transaction.id }
        }
    }
}

@MainActor
final class PaywallRoutingTests: XCTestCase {
    private let userID = "0b6f5c1e-8d3a-4c2b-9e1f-2a3b4c5d6e7f"
    private let noAccess = #"{"status":"none","source":null,"appStore":null}"#
    private let activeAccess = #"{"status":"active","source":"app_store","appStore":{"productId":"de.chaarlie.scanner.yearly","expiresAt":"2027-09-27T10:00:00.000Z","willRenew":true,"inBillingRetry":false}}"#
    private let purchase = StoreTransaction(id: 2_000_000_001, signedTransaction: "header.purchase.signature")

    // MARK: Bootstrap contract

    func testBootstrapV2FixtureDecodesAccess() throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "bootstrap-v2", withExtension: "json"))
        let bootstrap = try JSONDecoder().decode(Bootstrap.self, from: Data(contentsOf: url))
        XCTAssertEqual(bootstrap.status, .ready)
        XCTAssertEqual(bootstrap.access?.status, .active)
        XCTAssertEqual(bootstrap.access?.source, "app_store")
        XCTAssertEqual(bootstrap.access?.appStore?.productId, "de.chaarlie.scanner.yearly")
        XCTAssertEqual(bootstrap.access?.appStore?.expiresAt, "2027-09-27T10:00:00.000Z")
        XCTAssertEqual(bootstrap.access?.appStore?.willRenew, true)
        XCTAssertEqual(bootstrap.access?.appStore?.inBillingRetry, false)
    }
    func testBootstrapWithoutAccessRoutesToPaywall() async throws {
        let (model, transport, _) = try await signedInModel()
        let boot = Task { await model.bootstrap() }
        try await waitFor("bootstrap", transport)
        await transport.complete("bootstrap", json: bootstrapJSON(noAccess))
        await boot.value
        XCTAssertEqual(model.admission, .paywall)
    }
    func testBootstrapWithActiveAccessRoutesToReady() async throws {
        let (model, transport, _) = try await signedInModel()
        let boot = Task { await model.bootstrap() }
        try await waitFor("bootstrap", transport)
        await transport.complete("bootstrap", json: bootstrapJSON(activeAccess))
        await boot.value
        XCTAssertEqual(model.admission, .ready)
    }
    func testOldServerBootstrapWithoutAccessFieldStaysOpen() async throws {
        let (model, transport, _) = try await signedInModel()
        let boot = Task { await model.bootstrap() }
        try await waitFor("bootstrap", transport)
        await transport.complete("bootstrap", json: #"{"status":"ready","profileRevision":"1","contextRevision":"1"}"#)
        await boot.value
        XCTAssertEqual(model.admission, .ready)
    }
    func testRegistrationCompletionWithoutAccessAsksBootstrapAndRoutesToPaywall() async throws {
        let transport = ControlledTransport(), client = try client(transport)
        let model = AppModel(client: client, store: FakeStoreService())
        let completion = RegistrationCompletion(session: session(userID),
            bootstrap: .init(status: .ready, profileRevision: "1", contextRevision: "1"))
        let finishing = Task { await model.finishRegistration(completion) }
        try await waitFor("bootstrap", transport)
        await transport.complete("bootstrap", json: bootstrapJSON(noAccess))
        let accepted = await finishing.value
        XCTAssertTrue(accepted)
        XCTAssertEqual(model.admission, .paywall)
        XCTAssertEqual(model.purchaseAccountToken, UUID(uuidString: userID))
    }
    func testCompletionCarryingActiveAccessSkipsTheExtraBootstrap() async throws {
        let transport = ControlledTransport(), client = try client(transport)
        let model = AppModel(client: client, store: FakeStoreService())
        var bootstrap = Bootstrap(status: .ready, profileRevision: "1", contextRevision: "1")
        bootstrap.access = MobileAccess(status: .active, source: "web", appStore: nil)
        let accepted = await model.finishRegistration(RegistrationCompletion(session: session(userID), bootstrap: bootstrap))
        XCTAssertTrue(accepted)
        XCTAssertEqual(model.admission, .ready)
        let requests = await transport.requestCount("bootstrap")
        XCTAssertEqual(requests, 0)
    }

    // MARK: 402 subscription_required

    func testSubscriptionRequiredRoutesEveryGatedCallToPaywall() async throws {
        let gated: [(path: String, run: @MainActor (AppModel) async -> Void)] = [
            ("resolve", { await $0.resolve(.barcode("4006381333931")) }),
            ("search", { $0.searchText = "Shampoo"; await $0.search() }),
            ("history", { await $0.loadHistory() }),
            ("entry-1", { await $0.toggleHistoryFavorite(Self.entry) }),
            ("history", { $0.lastRequest = .barcode("4006381333931"); await $0.checkResearchStatus() }),
            ("submit", { m in
                m.lastRequest = .barcode("4006381333931"); m.researchChecked = true
                await m.submitResearch(category: "shampoo")
            }),
            ("11111111-2222-4333-8444-555555555555", { m in
                await m.receive(URL(string: "chaarlie-local://research/11111111-2222-4333-8444-555555555555")!)
            }),
        ]
        for (index, call) in gated.enumerated() {
            let (model, transport, _) = try await signedInModel()
            model.admission = .ready
            model.historyEntries = [Self.entry]
            let running = Task { await call.run(model) }
            try await waitFor(call.path, transport)
            await transport.complete(call.path, status: 402, json: #"{"error":"subscription_required"}"#)
            await running.value
            XCTAssertEqual(model.admission, .paywall, "gated call \(index) (\(call.path)) must route to the paywall")
            XCTAssertNil(model.scanResult)
            XCTAssertFalse(model.scanBusy || model.searchBusy || model.historyBusy || model.researchBusy || model.researchChecking)
            XCTAssertNil(model.searchError); XCTAssertNil(model.historyError); XCTAssertNil(model.scanError)
            XCTAssertNil(model.researchError); XCTAssertNil(model.historyFavoriteError); XCTAssertNil(model.researchDestinationError)
        }
    }
    func testClientMapsOnlySubscriptionRequired402() async throws {
        let transport = ControlledTransport(), client = try client(transport)
        try await client.install(session(userID))
        let first = Task { try await client.search("Shampoo") }
        try await waitFor("search", transport)
        await transport.complete("search", status: 402, json: #"{"error":"subscription_required"}"#)
        do { _ = try await first.value; XCTFail("expected 402") } catch { XCTAssertEqual(error as? MobileError, .subscriptionRequired) }
        let second = Task { try await client.search("Shampoo") }
        try await waitFor("search", transport)
        await transport.complete("search", status: 402, json: #"{"error":"payment_required"}"#)
        do { _ = try await second.value; XCTFail("expected failure") } catch { XCTAssertEqual(error as? MobileError, .unavailable) }
    }
    func testStale402AfterAccountSwitchIsIgnored() async throws {
        let (model, transport, client) = try await signedInModel()
        model.admission = .ready
        model.searchText = "Shampoo"
        let search = Task { await model.search() }
        try await waitFor("search", transport)
        let logout = Task { await model.logout() }
        try await waitFor("logout", transport)
        await transport.complete("logout", json: "{}")
        await logout.value
        // Another account is admitted before the old response lands.
        let other = session("7c9e6679-7425-40de-944b-e07fc1f90ae7")
        try await client.install(other)
        model.session = other
        model.admission = .ready
        await transport.complete("search", status: 402, json: #"{"error":"subscription_required"}"#)
        await search.value
        XCTAssertEqual(model.admission, .ready)
    }

    // MARK: Purchase binding and transaction posting

    func testPurchaseOptionsCarryTheLoggedInUserUUID() async throws {
        let (model, transport, _) = try await signedInModel()
        model.admission = .paywall
        XCTAssertEqual(model.purchaseAccountToken, UUID(uuidString: userID))
        let token = try XCTUnwrap(UUID(uuidString: userID))
        XCTAssertEqual(PaywallView.purchaseOptions(for: model.purchaseAccountToken), [.appAccountToken(token)])
        let logout = Task { await model.logout() }
        try await waitFor("logout", transport)
        await transport.complete("logout", json: "{}")
        await logout.value
        XCTAssertNil(model.purchaseAccountToken, "No purchase without an installed session")
        XCTAssertTrue(PaywallView.purchaseOptions(for: model.purchaseAccountToken).isEmpty)
        model.session = session("not-a-uuid"); model.admission = .paywall
        XCTAssertNil(model.purchaseAccountToken)
    }
    func testSuccessfulPurchasePostsFinishesAndOpensScanner() async throws {
        let store = FakeStoreService(unfinished: [purchase])
        let (model, transport, _) = try await signedInModel(store: store)
        model.admission = .paywall
        model.selectedTab = .profile
        let buying = Task { await model.handlePurchase(.purchased(purchase)) }
        try await waitFor("transactions", transport)
        XCTAssertEqual(model.purchaseState, .unlocking)
        let body = await transport.lastBody("transactions")
        let posted = try JSONDecoder().decode([String: [String]].self, from: XCTUnwrap(body))
        XCTAssertEqual(posted, ["signedTransactions": ["header.purchase.signature"]])
        let request = await transport.lastRequest("transactions")
        XCTAssertEqual(request?.httpMethod, "POST")
        XCTAssertEqual(request?.url?.path, "/api/mobile/v1/app-store/transactions")
        XCTAssertEqual(request?.value(forHTTPHeaderField: "Authorization"), "Bearer access-\(userID)")
        await transport.complete("transactions", json: #"{"access":\#(activeAccess)}"#)
        await buying.value
        XCTAssertEqual(store.finished, [purchase.id])
        XCTAssertEqual(model.admission, .ready)
        XCTAssertEqual(model.selectedTab, .scan)
        XCTAssertEqual(model.purchaseState, .idle)
    }
    func testPostFailureKeepsTransactionUnfinishedAndRetries() async throws {
        let store = FakeStoreService(unfinished: [purchase])
        let (model, transport, _) = try await signedInModel(store: store)
        model.admission = .paywall
        let buying = Task { await model.handlePurchase(.purchased(purchase)) }
        try await waitFor("transactions", transport)
        await transport.complete("transactions", status: 503, json: #"{"error":"temporarily_unavailable"}"#)
        await buying.value
        XCTAssertTrue(store.finished.isEmpty, "Never finish before the server acknowledged the purchase")
        XCTAssertEqual(model.purchaseState, .unlockFailed)
        XCTAssertEqual(model.purchaseState.statusText, "Kauf erfolgreich – Freischaltung läuft …")
        XCTAssertEqual(model.admission, .paywall)

        let retry = Task { await model.retryUnfinishedTransactions() }
        try await waitFor("transactions", transport)
        await transport.fail("transactions")
        await retry.value
        XCTAssertTrue(store.finished.isEmpty)
        XCTAssertEqual(model.purchaseState, .unlockFailed)

        let second = Task { await model.retryUnfinishedTransactions() }
        try await waitFor("transactions", transport)
        await transport.complete("transactions", json: #"{"access":\#(activeAccess)}"#)
        await second.value
        XCTAssertEqual(store.finished, [purchase.id])
        XCTAssertEqual(model.admission, .ready)
    }
    func testLaunchListenerPostsUnfinishedTransactionAndLaterUpdates() async throws {
        let store = FakeStoreService(unfinished: [purchase])
        let (model, transport, _) = try await signedInModel(store: store)
        let boot = Task { await model.bootstrap() }
        try await waitFor("bootstrap", transport)
        await transport.complete("bootstrap", json: bootstrapJSON(noAccess))
        await boot.value
        XCTAssertEqual(model.admission, .paywall)
        try await waitFor("transactions", transport)
        await transport.complete("transactions", json: #"{"access":\#(activeAccess)}"#)
        try await until { model.admission == .ready }
        XCTAssertEqual(store.finished, [purchase.id])

        let renewal = StoreTransaction(id: 2_000_000_002, signedTransaction: "header.renewal.signature")
        store.emit(renewal)
        try await waitFor("transactions", transport)
        await transport.complete("transactions", json: #"{"access":\#(activeAccess)}"#)
        try await until { store.finished.count == 2 }
        XCTAssertEqual(model.admission, .ready)
    }
    func testPendingPurchaseWaitsForUpdates() async throws {
        let store = FakeStoreService()
        let (model, transport, _) = try await signedInModel(store: store)
        model.admission = .paywall
        model.startTransactionListener()
        await model.handlePurchase(.pending)
        XCTAssertEqual(model.purchaseState, .pending)
        XCTAssertEqual(model.purchaseState.statusText, "Kauf wird bestätigt …")
        store.emit(purchase)
        try await waitFor("transactions", transport)
        await transport.complete("transactions", json: #"{"access":\#(activeAccess)}"#)
        try await until { model.admission == .ready }
        XCTAssertEqual(store.finished, [purchase.id])
    }
    func testCancelledPurchaseChangesNothing() async throws {
        let (model, transport, _) = try await signedInModel()
        model.admission = .paywall
        await model.handlePurchase(.cancelled)
        XCTAssertEqual(model.purchaseState, .idle)
        XCTAssertNil(model.paywallMessage)
        let count = await transport.requestCount("transactions")
        XCTAssertEqual(count, 0)
    }
    func testOwnedByOtherAccountShowsMessageFinishesAndAppliesAccess() async throws {
        let store = FakeStoreService(unfinished: [purchase])
        let (model, transport, _) = try await signedInModel(store: store)
        model.admission = .paywall
        let buying = Task { await model.handlePurchase(.purchased(purchase)) }
        try await waitFor("transactions", transport)
        await transport.complete("transactions", status: 409, json: #"{"error":"owned_by_other_account","access":\#(noAccess)}"#)
        await buying.value
        XCTAssertEqual(store.finished, [purchase.id])
        XCTAssertEqual(model.paywallMessage, "Dieses Abo gehört zu einem anderen Chaarlie-Konto.")
        XCTAssertEqual(model.admission, .paywall)
        XCTAssertEqual(model.purchaseState, .idle)
    }
    func testOwnedByOtherAccountWithOwnActiveRowStillUnlocks() async throws {
        let store = FakeStoreService(unfinished: [purchase])
        let (model, transport, _) = try await signedInModel(store: store)
        model.admission = .paywall
        let buying = Task { await model.handlePurchase(.purchased(purchase)) }
        try await waitFor("transactions", transport)
        await transport.complete("transactions", status: 409, json: #"{"error":"owned_by_other_account","access":\#(activeAccess)}"#)
        await buying.value
        XCTAssertEqual(store.finished, [purchase.id])
        XCTAssertEqual(model.admission, .ready)
    }
    func testInvalidTransactionIsFinishedWithoutUnlocking() async throws {
        for status in [409, 400] {
            let store = FakeStoreService(unfinished: [purchase])
            let (model, transport, _) = try await signedInModel(store: store)
            model.admission = .paywall
            let buying = Task { await model.handlePurchase(.purchased(purchase)) }
            try await waitFor("transactions", transport)
            await transport.complete("transactions", status: status, json: #"{"error":"invalid_transaction"}"#)
            await buying.value
            XCTAssertEqual(store.finished, [purchase.id], "status \(status)")
            XCTAssertEqual(model.admission, .paywall)
            XCTAssertEqual(model.purchaseState, .idle)
        }
    }
    func testLateTransactionAcknowledgementAfterLogoutIsIgnored() async throws {
        let store = FakeStoreService(unfinished: [purchase])
        let (model, transport, _) = try await signedInModel(store: store)
        model.admission = .paywall
        let buying = Task { await model.handlePurchase(.purchased(purchase)) }
        try await waitFor("transactions", transport)
        let logout = Task { await model.logout() }
        try await waitFor("logout", transport)
        await transport.complete("logout", json: "{}")
        await logout.value
        await transport.complete("transactions", json: #"{"access":\#(activeAccess)}"#)
        await buying.value
        XCTAssertEqual(model.admission, .signedOut)
        XCTAssertEqual(model.purchaseState, .idle)
        XCTAssertTrue(store.finished.isEmpty, "An unconfirmed post stays unfinished for the next session's retry")
    }
    func testLogoutStopsTheTransactionListener() async throws {
        let store = FakeStoreService()
        let (model, transport, _) = try await signedInModel(store: store)
        model.admission = .ready
        model.startTransactionListener()
        let logout = Task { await model.logout() }
        try await waitFor("logout", transport)
        await transport.complete("logout", json: "{}")
        await logout.value
        store.emit(purchase)
        try await Task.sleep(for: .milliseconds(100))
        let count = await transport.requestCount("transactions")
        XCTAssertEqual(count, 0)
        XCTAssertTrue(store.finished.isEmpty)
    }

    // MARK: Restore

    func testRestoreWithoutEntitlementsReportsNoSubscription() async throws {
        let store = FakeStoreService()
        let (model, transport, _) = try await signedInModel(store: store)
        model.admission = .paywall
        await model.restorePurchases()
        XCTAssertEqual(store.syncCount, 1)
        XCTAssertEqual(model.paywallMessage, "Kein aktives Abo gefunden.")
        XCTAssertEqual(model.purchaseState, .idle)
        let count = await transport.requestCount("transactions")
        XCTAssertEqual(count, 0)
    }
    func testRestorePostsCurrentEntitlementsAndUnlocks() async throws {
        let store = FakeStoreService(entitlements: [purchase])
        let (model, transport, _) = try await signedInModel(store: store)
        model.admission = .paywall
        let restoring = Task { await model.restorePurchases() }
        try await waitFor("transactions", transport)
        XCTAssertEqual(model.purchaseState, .restoring)
        await transport.complete("transactions", json: #"{"access":\#(activeAccess)}"#)
        await restoring.value
        XCTAssertEqual(model.admission, .ready)
    }
    func testRestoreOfExpiredEntitlementReportsNoSubscription() async throws {
        let store = FakeStoreService(entitlements: [purchase])
        let (model, transport, _) = try await signedInModel(store: store)
        model.admission = .paywall
        let restoring = Task { await model.restorePurchases() }
        try await waitFor("transactions", transport)
        await transport.complete("transactions", json: #"{"access":\#(noAccess)}"#)
        await restoring.value
        XCTAssertEqual(model.admission, .paywall)
        XCTAssertEqual(model.paywallMessage, "Kein aktives Abo gefunden.")
    }

    // MARK: Helpers

    private static let entry = HistoryEntry(id: "entry-1", barcodeGtin: "4006381333931", productId: nil, productName: nil,
                                            brand: nil, imageUrl: nil, lastSeenAt: "2026-09-19T12:00:00Z", status: .not_in_catalog)
    private func bootstrapJSON(_ access: String) -> String {
        #"{"status":"ready","profileRevision":"1","contextRevision":"1","access":\#(access)}"#
    }
    private func session(_ id: String) -> MobileSession {
        MobileSession(accessToken: "access-\(id)", refreshToken: "refresh-\(id)",
                      expiresAt: Date().timeIntervalSince1970 + 600, userId: id)
    }
    private func client(_ transport: ControlledTransport) throws -> MobileClient {
        MobileClient(configuration: try MobileConfiguration(baseURL: XCTUnwrap(URL(string: "http://127.0.0.1:3218/api/mobile/v1"))),
                     transport: transport, store: MemorySessionStore())
    }
    private func signedInModel(store: FakeStoreService = FakeStoreService()) async throws -> (AppModel, ControlledTransport, MobileClient) {
        let transport = ControlledTransport(), client = try client(transport)
        let active = session(userID)
        try await client.install(active)
        let model = AppModel(client: client, store: store)
        model.session = active
        return (model, transport, client)
    }
    private func waitFor(_ path: String, _ transport: ControlledTransport) async throws {
        for _ in 0..<200 {
            if await transport.hasRequest(path) { return }
            try await Task.sleep(for: .milliseconds(5))
        }
        throw NSError(domain: "PaywallTest.RequestDidNotReach.\(path)", code: 1)
    }
    private func until(_ condition: () -> Bool) async throws {
        for _ in 0..<200 {
            if condition() { return }
            try await Task.sleep(for: .milliseconds(5))
        }
        throw NSError(domain: "PaywallTest.ConditionNotReached", code: 1)
    }
}
