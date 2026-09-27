import Foundation
import StoreKit

/// Apple's signed transaction as the server receives it. The JWS is posted unverified:
/// the backend verifies it with Apple's library and is the only authority on access.
struct StoreTransaction: Equatable, Sendable {
    let id: UInt64
    let signedTransaction: String
    /// The Chaarlie account the purchase was bound to; nil for purchases made outside the app.
    let appAccountToken: UUID?
    init(id: UInt64, signedTransaction: String, appAccountToken: UUID? = nil) {
        self.id = id; self.signedTransaction = signedTransaction; self.appAccountToken = appAccountToken
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
}

enum SubscriptionConfiguration {
    /// Per build configuration (`CHAARLIE_SUBSCRIPTION_GROUP_ID`): Debug uses the local
    /// `Chaarlie.storekit` group; HostedPilot/Release carry a placeholder until App Store Connect.
    static var groupID: String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "ChaarlieSubscriptionGroupID") as? String,
              !value.isEmpty, value.allSatisfy(\.isNumber) else { return nil }
        return value
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
}

extension StoreTransaction {
    init(_ result: VerificationResult<Transaction>) {
        self.init(id: result.unsafePayloadValue.id, signedTransaction: result.jwsRepresentation,
                  appAccountToken: result.unsafePayloadValue.appAccountToken)
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
