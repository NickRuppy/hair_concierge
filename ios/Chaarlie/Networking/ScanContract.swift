import Foundation

struct ScanRequest: Encodable, Equatable, Sendable {
    struct Identifier: Encodable, Equatable, Sendable { let type: String; let value: String }
    let identifier: Identifier?
    let productId: String?
    static func barcode(_ value: String) -> Self { Self(identifier: Identifier(type: "ean", value: value), productId: nil) }
    static func product(_ id: String) -> Self { Self(identifier: nil, productId: id) }
}
struct ScanProduct: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let brand: String?
    let category: String
    let categoryLabel: String
    let imageUrl: String?
    let priceEur: Double?
    let currency: String?
    let purchaseUrl: String?
    var detail: String {
        var parts = [brand, categoryLabel].compactMap { $0 }.filter { !$0.isEmpty }
        if let priceEur, let currency {
            parts.append("ca. " + priceEur.formatted(.currency(code: currency).locale(Locale(identifier: "de_DE"))))
        }
        return parts.joined(separator: " · ")
    }
}
enum ScanVerdict: String, Codable, Sendable { case ideal, supportive, mismatch }
struct ScanRow: Codable, Identifiable, Sendable {
    enum State: String, Codable, Sendable { case in_target, outside_target, no_target, unknown }
    enum Axis: String, Codable, Sendable { case ordered, set, binary, categorical }
    struct Stop: Codable, Identifiable, Sendable {
        let id: String
        let label: String
        let meaning: String?
        init(id: String, label: String, meaning: String? = nil) {
            self.id = id
            self.label = label
            self.meaning = meaning
        }
        var displayMeaning: String {
            guard let meaning, !meaning.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return label }
            return meaning
        }
    }
    enum DisplayStatus: String, Codable, Sendable { case green, amber, red, neutral }
    let displayStatus: DisplayStatus
    let dimensionId: String
    let label: String
    let axisKind: Axis
    let definition: String
    let categoryFit: String?
    let targetValue: String?
    let productValue: String?
    let state: State
    let stops: [Stop]
    let targetStopIds: [String]
    let productStopIds: [String]
    var id: String { dimensionId }
}
struct ScanAlternative: Codable, Identifiable, Sendable {
    let product: ScanProduct
    let verdict: ScanVerdict
    let verdictLabel: String
    let verdictTitle: String
    let mismatchSummary: String
    let rows: [ScanRow]
    let categoryFit: String?
    var id: String { product.id }
}
struct ScanResult: Codable, Identifiable, Sendable {
    enum Kind: String, Codable, Sendable {
        case assessment, not_needed, profile_decision_deferred, submission_required, authority_unavailable, profile_required, retryable_error
    }
    struct Coverage: Codable, Sendable { let label: String; let detail: String? }
    let contractVersion: Int
    let kind: Kind
    let contextRevision: String?
    let product: ScanProduct?
    let verdict: ScanVerdict?
    let verdictLabel: String?
    let verdictTitle: String?
    let mismatchSummary: String?
    let headline: String?
    let subtitle: String?
    let rows: [ScanRow]?
    let categoryFit: String?
    let alternatives: [ScanAlternative]?
    let reasons: [String]?
    let coveredBy: [Coverage]?
    let reason: String?
    let productId: String?
    let missingFacts: [String]?
    let code: String?
    func validate() throws {
        guard contractVersion == 1 else { throw MobileError.invalidResponse }
        switch kind {
        case .assessment:
            guard product != nil, verdict != nil, verdictTitle != nil, mismatchSummary != nil,
                  let rows, !rows.isEmpty, let alternatives, alternatives.count <= 5,
                  contextRevision != nil else { throw MobileError.invalidResponse }
        case .not_needed, .profile_decision_deferred:
            guard product != nil, headline != nil, subtitle != nil, contextRevision != nil else { throw MobileError.invalidResponse }
        case .submission_required:
            guard let missingFacts, !missingFacts.isEmpty else { throw MobileError.invalidResponse }
        case .authority_unavailable:
            guard ["personal_target_unavailable", "temporarily_unavailable"].contains(reason ?? "") else { throw MobileError.invalidResponse }
        case .retryable_error:
            guard code != nil else { throw MobileError.invalidResponse }
        case .profile_required: break
        }
    }
    var id: String { [kind.rawValue, contextRevision ?? "", product?.id ?? productId ?? ""].joined(separator: ":") }
}
struct SearchResponse: Codable, Sendable {
    let contractVersion: Int
    let results: [ScanProduct]
    let truncated: Bool
}

/// Presentation only. The backend owns dimensions, target matching, verdict and alternative order.
enum AssessmentPresentation {
    static func deviation(_ rows: [ScanRow]) -> String {
        let mismatches = rows.filter { $0.state == .outside_target }.map {
            "\($0.label): \($0.productValue ?? "–") statt \($0.targetValue ?? "–")"
        }
        if !mismatches.isEmpty { return mismatches.joined(separator: " · ") }
        return rows.allSatisfy { $0.state == .in_target } && !rows.isEmpty ? "Alles im Ziel." : ""
    }
}
