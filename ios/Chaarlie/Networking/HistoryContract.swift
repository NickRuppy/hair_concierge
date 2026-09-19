import Foundation

struct HistoryResponse: Codable, Sendable {
    let contractVersion: Int
    let entries: [HistoryEntry]
    var nextCursor: String? = nil
}

struct HistoryEntry: Codable, Identifiable, Sendable {
    enum Status: String, Codable, Sendable { case available, not_in_catalog, in_research, unavailable }
    let id: String
    let barcodeGtin: String?
    let productId: String?
    let productName: String?
    let displayName: String?
    let brand: String?
    let categoryLabel: String?
    let imageUrl: String?
    let lastSeenAt: String
    let status: Status
    var isFavorite: Bool = false

    enum CodingKeys: String, CodingKey {
        case id, barcodeGtin, productId, productName, displayName, brand, categoryLabel, imageUrl, lastSeenAt, status, isFavorite
    }
    init(id: String, barcodeGtin: String?, productId: String?, productName: String?, displayName: String? = nil,
         brand: String?, categoryLabel: String? = nil, imageUrl: String?, lastSeenAt: String, status: Status,
         isFavorite: Bool = false) {
        self.id = id; self.barcodeGtin = barcodeGtin; self.productId = productId
        self.productName = productName; self.displayName = displayName; self.brand = brand
        self.categoryLabel = categoryLabel; self.imageUrl = imageUrl
        self.lastSeenAt = lastSeenAt; self.status = status; self.isFavorite = isFavorite
    }
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        barcodeGtin = try values.decodeIfPresent(String.self, forKey: .barcodeGtin)
        productId = try values.decodeIfPresent(String.self, forKey: .productId)
        productName = try values.decodeIfPresent(String.self, forKey: .productName)
        displayName = try values.decodeIfPresent(String.self, forKey: .displayName)
        brand = try values.decodeIfPresent(String.self, forKey: .brand)
        categoryLabel = try values.decodeIfPresent(String.self, forKey: .categoryLabel)
        imageUrl = try values.decodeIfPresent(String.self, forKey: .imageUrl)
        lastSeenAt = try values.decode(String.self, forKey: .lastSeenAt)
        status = try values.decode(Status.self, forKey: .status)
        isFavorite = try values.decodeIfPresent(Bool.self, forKey: .isFavorite) ?? false
    }

    var title: String { displayName ?? productName ?? barcodeGtin.map { "Barcode \($0)" } ?? "Produkt" }
    var statusLabel: String {
        switch status {
        case .available: "Produkt öffnen"
        case .not_in_catalog: "Noch nicht im Katalog"
        case .in_research: "In Prüfung"
        case .unavailable: "Derzeit nicht verfügbar"
        }
    }
    var request: ScanRequest? {
        if let barcodeGtin { return .barcode(barcodeGtin).withoutHistory() }
        return productId.map { .product($0).withoutHistory() }
    }
    var date: Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: lastSeenAt) ?? ISO8601DateFormatter().date(from: lastSeenAt)
    }
}

struct HistoryFavoriteRequest: Codable, Sendable { let isFavorite: Bool }
struct HistoryFavoriteResponse: Codable, Sendable {
    let contractVersion: Int
    let entryId: String
    let isFavorite: Bool
}

struct ResearchRequest: Encodable, Equatable, Sendable {
    enum RetailerMatchDecision: String, Encodable, Sendable { case accepted, rejected }
    let identifier: ScanRequest.Identifier
    let category: String
    var retailerMatchDecision: RetailerMatchDecision? = nil
}

struct ResearchResponse: Decodable, Sendable {
    enum Kind: String, Decodable, Sendable { case pending_submission, already_in_catalog }
    let contractVersion: Int
    let kind: Kind
    let submissionId: String?
    let productId: String?
    let headline: String?
    let historySaved: Bool
}

struct HistoryClearResponse: Decodable, Sendable { let contractVersion: Int }
