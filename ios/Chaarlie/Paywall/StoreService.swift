import Foundation
import StoreKit

/// Apple's signed transaction as the server receives it. The JWS is posted unverified:
/// the backend verifies it with Apple's library and is the only authority on access.
struct StoreTransaction: Equatable, Sendable {
    let id: UInt64
    let signedTransaction: String
    /// The Chaarlie account the purchase was bound to; nil for purchases made outside the app.
    let appAccountToken: UUID?
    /// The subscription this period belongs to; finds its renewal info.
    let originalID: UInt64
    let subscriptionGroupID: String?
    init(id: UInt64, signedTransaction: String, appAccountToken: UUID? = nil,
         originalID: UInt64? = nil, subscriptionGroupID: String? = nil) {
        self.id = id; self.signedTransaction = signedTransaction; self.appAccountToken = appAccountToken
        self.originalID = originalID ?? id; self.subscriptionGroupID = subscriptionGroupID
    }
}

enum PurchaseOutcome: Equatable, Sendable {
    case purchased(StoreTransaction)
    /// Ask to Buy or strong customer authentication; the result arrives on `updates()`.
    case pending
    case cancelled
    case failed
}

/// The StoreKit seam. `AppModel` owns posting and finishing order; tests use a fake.
protocol StoreService: Sendable {
    func updates() -> AsyncStream<StoreTransaction>
    func unfinished() async -> [StoreTransaction]
    func currentEntitlements() async -> [StoreTransaction]
    /// Throws `CancellationError` when the person dismisses Apple's sign-in sheet.
    func sync() async throws
    func finish(_ transaction: StoreTransaction) async
    /// Apple's signed renewal info (auto-renew, billing retry) for the transaction's
    /// subscription, posted next to it so the server need not wait for Apple's webhook.
    func signedRenewalInfo(for transaction: StoreTransaction) async -> String?
    /// The active auto-renewable subscriptions StoreKit knows on this device. Only a local
    /// fallback for the deletion notice; the server stays the authority on access.
    func activeSubscriptions() async -> [LocalSubscription]
}

/// One active subscription as StoreKit reports it on this device (unverified is fine: it
/// only decides whether an informational notice appears).
struct LocalSubscription: Equatable, Sendable {
    let appAccountToken: UUID?
    let willAutoRenew: Bool
    /// Apple keeps billing it: this account's purchase, or one made outside the app.
    func renews(for account: UUID?) -> Bool {
        willAutoRenew && (appAccountToken == nil || appAccountToken == account)
    }
}

enum SubscriptionConfiguration {
    /// Per build configuration (`CHAARLIE_SUBSCRIPTION_GROUP_ID`): Debug uses the local
    /// `Chaarlie.storekit` group; HostedPilot/Release carry a placeholder until App Store Connect.
    static var groupID: String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "ChaarlieSubscriptionGroupID") as? String,
              !value.isEmpty, value.allSatisfy(\.isNumber) else { return nil }
        return value
    }
    /// The scanner subscription's App Store product identifiers (server allowlist in
    /// `src/lib/app-store/state.ts`). Kept here too so a status entry for some other
    /// product sharing the group is never mistaken for a Chaarlie subscription.
    static let productIDs: Set<String> = ["de.chaarlie.scanner.monthly", "de.chaarlie.scanner.yearly"]
    /// Apple still bills the account in these renewal states, even once `currentEntitlements`
    /// has already dropped the transaction (billing retry with no grace period looks expired
    /// there). A pure decision function so it is testable without a live StoreKit status call.
    static func isStillBilled(productID: String, state: Product.SubscriptionInfo.RenewalState) -> Bool {
        productIDs.contains(productID) && [.subscribed, .inGracePeriod, .inBillingRetryPeriod].contains(state)
    }
}

struct LiveStoreService: StoreService {
    func updates() -> AsyncStream<StoreTransaction> {
        AsyncStream { continuation in
            let task = Task.detached {
                for await result in Transaction.updates { continuation.yield(StoreTransaction(result)) }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
    func unfinished() async -> [StoreTransaction] {
        var transactions: [StoreTransaction] = []
        for await result in Transaction.unfinished { transactions.append(StoreTransaction(result)) }
        return transactions
    }
    func currentEntitlements() async -> [StoreTransaction] {
        var transactions: [StoreTransaction] = []
        for await result in Transaction.currentEntitlements { transactions.append(StoreTransaction(result)) }
        return transactions
    }
    func sync() async throws {
        do { try await AppStore.sync() }
        catch StoreKitError.userCancelled { throw CancellationError() }
    }
    func finish(_ transaction: StoreTransaction) async {
        // Stateless lookup: the transaction may come from a purchase, an update or a relaunch.
        for await result in Transaction.unfinished where result.unsafePayloadValue.id == transaction.id {
            await result.unsafePayloadValue.finish()
        }
    }
    func signedRenewalInfo(for transaction: StoreTransaction) async -> String? {
        guard let group = transaction.subscriptionGroupID,
              let statuses = try? await Product.SubscriptionInfo.status(for: group) else { return nil }
        // A group can hold several subscriptions (e.g. Family Sharing); take this one's.
        return statuses.first { $0.transaction.unsafePayloadValue.originalID == transaction.originalID }?
            .renewalInfo.jwsRepresentation
    }
    func activeSubscriptions() async -> [LocalSubscription] {
        // Apple's own status for the group, not `currentEntitlements`: a subscription in
        // billing retry with no open grace period has already expired there, even though
        // Apple keeps charging it for up to 60 days (see `isStillBilled`).
        guard let group = SubscriptionConfiguration.groupID,
              let statuses = try? await Product.SubscriptionInfo.status(for: group) else { return [] }
        var subscriptions: [LocalSubscription] = []
        for status in statuses {
            let transaction = status.transaction.unsafePayloadValue
            guard SubscriptionConfiguration.isStillBilled(productID: transaction.productID, state: status.state)
            else { continue }
            subscriptions.append(LocalSubscription(appAccountToken: transaction.appAccountToken,
                                                   willAutoRenew: status.renewalInfo.unsafePayloadValue.willAutoRenew))
        }
        return subscriptions
    }
}

extension StoreTransaction {
    init(_ result: VerificationResult<Transaction>) {
        let transaction = result.unsafePayloadValue
        self.init(id: transaction.id, signedTransaction: result.jwsRepresentation,
                  appAccountToken: transaction.appAccountToken, originalID: transaction.originalID,
                  subscriptionGroupID: transaction.subscriptionGroupID)
    }
}

extension PurchaseOutcome {
    init(_ result: Result<Product.PurchaseResult, any Error>) {
        switch result {
        case .success(.success(let verification)): self = .purchased(StoreTransaction(verification))
        case .success(.pending): self = .pending
        case .success(.userCancelled): self = .cancelled
        case .failure(StoreKitError.userCancelled): self = .cancelled
        case .success, .failure: self = .failed
        }
    }
}
