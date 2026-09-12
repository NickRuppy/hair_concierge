import Foundation
import Security

protocol SessionPersistence: Sendable {
    func loadSession() throws -> MobileSession?
    func saveSession(_ session: MobileSession?) throws
    func loadAttempt() throws -> AuthAttempt?
    func saveAttempt(_ attempt: AuthAttempt?) throws
}

struct KeychainSessionStore: SessionPersistence {
    private let service = "de.chaarlie.scanner.local"
    func loadSession() throws -> MobileSession? { try read("session") }
    func saveSession(_ session: MobileSession?) throws { try write(session, account: "session") }
    func loadAttempt() throws -> AuthAttempt? { try read("attempt") }
    func saveAttempt(_ attempt: AuthAttempt?) throws { try write(attempt, account: "attempt") }
    private func query(_ account: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
         kSecAttrAccount as String: account, kSecAttrSynchronizable as String: false]
    }
    private func read<T: Decodable>(_ account: String) throws -> T? {
        var query = query(account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let result = SecItemCopyMatching(query as CFDictionary, &value)
        if result == errSecItemNotFound { return nil }
        guard result == errSecSuccess, let data = value as? Data else { throw MobileError.unavailable }
        return try JSONDecoder().decode(T.self, from: data)
    }
    private func write<T: Encodable>(_ value: T?, account: String) throws {
        let base = query(account)
        guard let value else {
            let result = SecItemDelete(base as CFDictionary)
            guard [errSecSuccess, errSecItemNotFound].contains(result) else { throw MobileError.unavailable }
            return
        }
        let data = try JSONEncoder().encode(value)
        let attributes: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        let updated = SecItemUpdate(base as CFDictionary, attributes as CFDictionary)
        if updated == errSecItemNotFound {
            guard SecItemAdd(base.merging(attributes) { _, new in new } as CFDictionary, nil) == errSecSuccess else {
                throw MobileError.unavailable
            }
        } else if updated != errSecSuccess { throw MobileError.unavailable }
    }
}

struct LoginCallback: Equatable {
    let attemptId: String
    let tokenHash: String
    static func parse(_ url: URL, pending: AuthAttempt?, signedIn: Bool) -> Self? {
        #if DEBUG
        guard !signedIn, url.scheme == "chaarlie-local", url.host == "auth", url.path.isEmpty,
              url.user == nil, url.password == nil, url.port == nil, url.query == nil,
              let fragment = URLComponents(url: url, resolvingAgainstBaseURL: false)?.percentEncodedFragment else { return nil }
        var parts = URLComponents()
        parts.percentEncodedQuery = fragment
        let items = parts.queryItems ?? []
        guard items.count == 2,
              let hash = items.first(where: { $0.name == "tokenHash" })?.value,
              (16...256).contains(hash.count), hash.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_" || $0 == "-") }) else { return nil }
        let id: String
        if Set(items.map(\.name)) == ["attemptId", "tokenHash"],
           let direct = items.first(where: { $0.name == "attemptId" })?.value {
            id = direct
        } else if Set(items.map(\.name)) == ["callback", "tokenHash"],
                  let encoded = items.first(where: { $0.name == "callback" })?.value,
                  let nested = URL(string: encoded), nested.scheme == "chaarlie-local", nested.host == "auth",
                  nested.path.isEmpty, nested.user == nil, nested.password == nil, nested.port == nil,
                  nested.query == nil, let nestedFragment = URLComponents(url: nested, resolvingAgainstBaseURL: false)?.percentEncodedFragment {
            var nestedParts = URLComponents()
            nestedParts.percentEncodedQuery = nestedFragment
            guard let nestedItems = nestedParts.queryItems, nestedItems.count == 1,
                  nestedItems[0].name == "attemptId", let nestedId = nestedItems[0].value else { return nil }
            id = nestedId
        } else { return nil }
        guard UUID(uuidString: id) != nil, pending == nil || pending?.attemptId == id else { return nil }
        return Self(attemptId: id, tokenHash: hash)
        #else
        return nil
        #endif
    }
}

/// Only catalog HTTP(S) destinations; no custom schemes, credentials or protocol-relative URLs.
enum ShopDestination {
    static func url(_ value: String?, httpsOnly: Bool = false) -> URL? {
        guard let value, let url = URL(string: value), let scheme = url.scheme?.lowercased(),
              (httpsOnly ? ["https"] : ["https", "http"]).contains(scheme),
              let host = url.host?.lowercased(), host.contains("."), !host.hasPrefix("."), !host.hasSuffix("."),
              url.user == nil, url.password == nil,
              url.port == nil || url.port == (scheme == "https" ? 443 : 80),
              ![".localhost", ".local", ".internal"].contains(where: { host.hasSuffix($0) }) else { return nil }
        if host.allSatisfy({ $0.isNumber || $0 == "." }) {
            let parts = host.split(separator: ".").compactMap { Int($0) }
            guard parts.count == 4, parts.allSatisfy({ (0...255).contains($0) }),
                  ![0, 10, 127].contains(parts[0]),
                  !(parts[0] == 169 && parts[1] == 254),
                  !(parts[0] == 172 && (16...31).contains(parts[1])),
                  !(parts[0] == 192 && parts[1] == 168), parts[0] < 224 else { return nil }
        }
        return url
    }
}
