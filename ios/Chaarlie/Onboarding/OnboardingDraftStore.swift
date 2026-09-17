import Foundation
import Security

protocol OnboardingDraftPersistence: Sendable {
    func load() throws -> OnboardingDraft?
    func save(_ draft: OnboardingDraft?) throws
}

struct KeychainOnboardingDraftStore: OnboardingDraftPersistence {
    private let service: String
    private let account = "onboarding-draft-v1"

    init(service: String = MobileRuntime.current.keychainService) { self.service = service }

    func load() throws -> OnboardingDraft? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let result = SecItemCopyMatching(query as CFDictionary, &value)
        if result == errSecItemNotFound { return nil }
        guard result == errSecSuccess, let data = value as? Data else { throw MobileError.unavailable }
        do { return try JSONDecoder().decode(OnboardingDraft.self, from: data) }
        catch { throw MobileError.invalidResponse }
    }

    func save(_ draft: OnboardingDraft?) throws {
        guard let draft else {
            let result = SecItemDelete(baseQuery as CFDictionary)
            guard result == errSecSuccess || result == errSecItemNotFound else { throw MobileError.unavailable }
            return
        }
        let attributes: [String: Any] = [
            kSecValueData as String: try JSONEncoder().encode(draft),
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        let update = SecItemUpdate(baseQuery as CFDictionary, attributes as CFDictionary)
        if update == errSecItemNotFound {
            guard SecItemAdd(baseQuery.merging(attributes) { _, new in new } as CFDictionary, nil) == errSecSuccess else {
                throw MobileError.unavailable
            }
        } else if update != errSecSuccess { throw MobileError.unavailable }
    }

    private var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account,
         kSecAttrSynchronizable as String: false]
    }
}
