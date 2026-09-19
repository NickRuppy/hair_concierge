import XCTest
import SwiftUI
import CoreText
@testable import Chaarlie

final class MobileContractTests: XCTestCase {
    @MainActor func testAppPreservesLicensedFontsAndRegisteredWordmark() throws {
        let fontURL = try XCTUnwrap(Bundle.main.url(forResource: "Manrope", withExtension: "ttf"))
        XCTAssertGreaterThan(try Data(contentsOf: fontURL).count, 0)
        let license = try XCTUnwrap(Bundle.main.url(forResource: "Manrope-OFL", withExtension: "txt"))
        XCTAssertTrue(try String(contentsOf: license, encoding: .utf8).contains("SIL OPEN FONT LICENSE"))
        XCTAssertNotNil(UIFont(name: "PlayfairDisplay-Regular", size: 30), "Wordmark font remains registered")
    }

    @MainActor func testTypographyRespondsToSwiftUIDynamicTypeEnvironment() {
        let samples = [
            AnyView(Text("Haare").chaarlieSystemFont(15)),
            AnyView(Text("Haare").chaarlieSystemFont(38, design: .serif, relativeTo: .title)),
            AnyView(Text("Haare").chaarlieHeading())
        ]
        for sample in samples {
            let normal = UIHostingController(rootView: sample.environment(\.dynamicTypeSize, .large))
                .sizeThatFits(in: CGSize(width: 2000, height: 2000)).height
            let accessible = UIHostingController(rootView: sample.environment(\.dynamicTypeSize, .accessibility5))
                .sizeThatFits(in: CGSize(width: 2000, height: 2000)).height
            XCTAssertGreaterThan(normal, 0)
            XCTAssertGreaterThan(accessible, normal * 1.5, "Each font role must respond to SwiftUI Dynamic Type")
        }
    }

    func testSharedServerFixtureDecodesCompleteMainAndAlternativeRows() throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "scan-v1", withExtension: "json"))
        let result = try JSONDecoder().decode(ScanResult.self, from: Data(contentsOf: url))
        XCTAssertEqual(result.contractVersion, 1)
        XCTAssertEqual(result.kind, .assessment)
        XCTAssertEqual(result.product?.id, "fixture-current")
        XCTAssertEqual(result.rows?.first?.displayStatus, .amber)
        XCTAssertEqual(result.alternatives?.first?.rows.first?.displayStatus, .green)
        XCTAssertNotEqual(result.product?.purchaseUrl, result.alternatives?.first?.product.purchaseUrl)
        XCTAssertTrue(result.mismatchSummary?.hasPrefix("Pflegegewicht: mittel statt leicht") == true)
        XCTAssertEqual(result.rows?.count, 3)
    }
    func testProductIdentityUsesRenderReadyTitleAndKeepsCategorySeparate() throws {
        let product = try JSONDecoder().decode(ScanProduct.self, from: Data(#"{"id":"p1","name":"Leave-In Moisturizing Mist","displayName":"NEQI x @_the.beautiful.people Leave-In Moisturizing Mist","brand":"Neqi","category":"leave_in","categoryLabel":"Leave-in","imageUrl":null,"priceEur":12.99,"currency":"EUR","purchaseUrl":null}"#.utf8))
        XCTAssertEqual(product.title, "NEQI x @_the.beautiful.people Leave-In Moisturizing Mist")
        XCTAssertEqual(product.detail, "Leave-in · ca. 12,99 €")
        XCTAssertFalse(product.detail.contains("Neqi"))

        let legacy = try JSONDecoder().decode(ScanProduct.self, from: Data(#"{"id":"p2","name":"Legacy Shampoo","brand":"Legacy","category":"shampoo","categoryLabel":"Shampoo","imageUrl":null,"priceEur":null,"currency":null,"purchaseUrl":null}"#.utf8))
        XCTAssertEqual(legacy.title, "Legacy Shampoo")
    }
    func testResearchRequestEncodesOptionalRetailerMatchDecision() throws {
        let accepted = ResearchRequest(identifier: .init(type: "ean", value: "4001638530378"),
                                       category: "shampoo", retailerMatchDecision: .accepted)
        let acceptedObject = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(accepted)) as? [String: Any])
        XCTAssertEqual(acceptedObject["retailerMatchDecision"] as? String, "accepted")

        let legacy = ResearchRequest(identifier: .init(type: "ean", value: "4001638530378"), category: "shampoo")
        let legacyObject = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(legacy)) as? [String: Any])
        XCTAssertNil(legacyObject["retailerMatchDecision"])
    }
    func testGlossaryStopDecodesOldPayloadWithoutMeaning() throws {
        let stop = try JSONDecoder().decode(ScanRow.Stop.self, from: Data(#"{"id":"light","label":"leicht"}"#.utf8))
        XCTAssertNil(stop.meaning)
        XCTAssertEqual(stop.displayMeaning, "leicht")
    }
    func testGlossaryStopPreservesServerMeaning() throws {
        let stop = try JSONDecoder().decode(ScanRow.Stop.self, from: Data(#"{"id":"light","label":"leicht","meaning":"Vom Server gelieferte Bedeutung."}"#.utf8))
        XCTAssertEqual(stop.meaning, "Vom Server gelieferte Bedeutung.")
        XCTAssertEqual(stop.displayMeaning, stop.meaning)
    }
    func testGlossaryStopFallsBackForNullAndWhitespaceMeaning() throws {
        for value in [NSNull(), "", " \n\t "] as [Any] {
            let data = try JSONSerialization.data(withJSONObject: ["id": "unknown", "label": "Stufenwort", "meaning": value])
            let stop = try JSONDecoder().decode(ScanRow.Stop.self, from: data)
            XCTAssertEqual(stop.displayMeaning, "Stufenwort")
        }
    }
    @MainActor func testNativeGlossaryLayoutUsesTallestNaturalRowAndSeparators() {
        let host = UIHostingController(rootView: EqualHeightGlossaryLayout {
            Color.clear.frame(minHeight: 24)
            Color.clear.frame(minHeight: 54)
            Color.clear.frame(minHeight: 84)
        })
        let size = host.sizeThatFits(in: CGSize(width: 330, height: 800))
        XCTAssertEqual(size.width, 330, accuracy: 0.01)
        XCTAssertEqual(size.height, 254, accuracy: 0.01) // Three 84-point rows plus two 1-point separators.
        let geometry = GlossaryGeometry(naturalHeights: [24, 54, 84])
        XCTAssertEqual(geometry.rowOrigin(1), 85)
        XCTAssertEqual(geometry.rowOrigin(2), 170)
        XCTAssertEqual(geometry.firstCenter, 42)
        XCTAssertEqual(geometry.lastCenter, 212)
    }
    @MainActor func testNativeGlossaryLayoutKeepsTwoShortRowsAtMinimumHeight() {
        let host = UIHostingController(rootView: EqualHeightGlossaryLayout {
            Color.clear.frame(minHeight: 18)
            Color.clear.frame(minHeight: 36)
        })
        XCTAssertEqual(host.sizeThatFits(in: CGSize(width: 330, height: 800)).height, 97, accuracy: 0.01)
        XCTAssertEqual(GlossaryGeometry(naturalHeights: []).height, 0)
    }
    func testShopURLSafety() {
        for value in ["javascript:alert(1)", "file:///etc/passwd", "//shop.example.test/x", "https://user:password@shop.example.test", "https://localhost/x", "https://127.0.0.1/x", "http://127.0.0.2/x", "http://10.0.0.4/x", "https://printer.local/x", "https://shop.example.test:8080"] {
            XCTAssertNil(ShopDestination.url(value), value)
        }
        XCTAssertEqual(ShopDestination.url("https://shop.example.test/product?ref=chaarlie")?.host, "shop.example.test")
        XCTAssertNotNil(ShopDestination.url("http://shop.example.test/product"))
        XCTAssertNil(ShopDestination.url("http://shop.example.test/product", httpsOnly: true))
    }
    func testLoginCallbackRequiresTrustedShapeAndCurrentAttempt() throws {
        let id = UUID().uuidString
        let attempt = AuthAttempt(attemptId: id, codeLength: 8)
        let valid = try XCTUnwrap(URL(string: "chaarlie-local://auth#attemptId=\(id)&tokenHash=abcdefghijklmnop"))
        XCTAssertNotNil(LoginCallback.parse(valid, pending: attempt, signedIn: false))
        XCTAssertNotNil(LoginCallback.parse(valid, pending: nil, signedIn: false)) // Cold start: server binds the attempt.
        XCTAssertNil(LoginCallback.parse(valid, pending: attempt, signedIn: true))
        XCTAssertNil(LoginCallback.parse(valid, pending: AuthAttempt(attemptId: UUID().uuidString, codeLength: 8), signedIn: false))
        for value in [
            "chaarlie-local://other#attemptId=\(id)&tokenHash=abcdefghijklmnop",
            "chaarlie-local://auth?attemptId=\(id)&tokenHash=abcdefghijklmnop",
            "chaarlie-local://auth#attemptId=\(id)&tokenHash=abcdefghijklmnop&destination=https://evil.test",
            "https://evil.test/#attemptId=\(id)&tokenHash=abcdefghijklmnop"
        ] {
            XCTAssertNil(LoginCallback.parse(try XCTUnwrap(URL(string: value)), pending: attempt, signedIn: false))
        }
    }
    func testRegistrationCallbackRequiresAnExactPendingRegistrationAttempt() throws {
        let id = UUID().uuidString
        let current = AuthAttempt(attemptId: id, codeLength: 8)
        let old = AuthAttempt(attemptId: UUID().uuidString, codeLength: 8)
        let url = try XCTUnwrap(URL(string: "chaarlie-local://auth#attemptId=\(id)&tokenHash=abcdefghijklmnop"))
        XCTAssertNotNil(RegistrationCallback.parse(url, pending: current))
        XCTAssertNil(RegistrationCallback.parse(url, pending: old))
        XCTAssertNil(RegistrationCallback.parse(url, pending: nil))
        XCTAssertTrue(RegistrationCallback.matchesDestination(url))
        XCTAssertFalse(RegistrationCallback.matchesDestination(try XCTUnwrap(URL(string: "chaarlie-local://other#attemptId=\(id)&tokenHash=abcdefghijklmnop"))))
    }
    func testLocalSignedEmailProofRequiresMatchingPendingAttemptAndDestination() throws {
        let id = UUID().uuidString
        let current = AuthAttempt(attemptId: id, codeLength: 8)
        let other = AuthAttempt(attemptId: UUID().uuidString, codeLength: 8)
        let proof = "eyJhbGciOiJIUzI1NiJ9.eyJwdXJwb3NlIjoicmVnaXN0cmF0aW9uIn0.signature"
        let local = try XCTUnwrap(URL(string: "chaarlie-local://auth#attemptId=\(id)&tokenHash=\(proof)"))
        XCTAssertEqual(LoginCallback.parse(local, pending: current, signedIn: false)?.tokenHash, proof)
        XCTAssertEqual(RegistrationCallback.parse(local, pending: current)?.tokenHash, proof)
        XCTAssertNil(RegistrationCallback.parse(local, pending: other))
        XCTAssertNil(RegistrationCallback.parse(try XCTUnwrap(URL(string: "chaarlie-local://other#attemptId=\(id)&tokenHash=\(proof)")), pending: current))
    }
    func testAuthVerificationDecodesOnlyTheRealLimitedCapabilityShape() throws {
        let decoder = JSONDecoder()
        let limited = try decoder.decode(AuthVerificationResponse.self,
                                         from: Data(#"{"status":"profile_required","completionToken":"capability","profileRevision":"r1"}"#.utf8))
        XCTAssertNil(limited.session)
        XCTAssertEqual(limited.completionToken, "capability")
        for payload in [
            #"{"status":"profile_required","profileRevision":"r1"}"#,
            #"{"status":"profile_required","completionToken":"capability","profileRevision":""}"#,
            #"{"status":"ready","completionToken":"capability","profileRevision":"r1"}"#,
            #"{"session":null,"status":"profile_required","completionToken":"capability","profileRevision":"r1"}"#
        ] {
            XCTAssertThrowsError(try decoder.decode(AuthVerificationResponse.self, from: Data(payload.utf8)))
        }
    }
    func testNestedLocalEmailCallbackValidatesBothURLLayers() throws {
        let id = UUID().uuidString
        let pending = AuthAttempt(attemptId: id, codeLength: 8)
        func link(_ callback: String) throws -> URL {
            var fragment = URLComponents()
            fragment.queryItems = [URLQueryItem(name: "callback", value: callback), URLQueryItem(name: "tokenHash", value: "abcdefghijklmnop")]
            var outer = URLComponents(string: "chaarlie-local://auth")!
            outer.percentEncodedFragment = fragment.percentEncodedQuery
            return try XCTUnwrap(outer.url)
        }
        XCTAssertNotNil(LoginCallback.parse(try link("chaarlie-local://auth#attemptId=\(id)"), pending: pending, signedIn: false))
        for nested in ["https://evil.test/#attemptId=\(id)", "chaarlie-local://other#attemptId=\(id)",
                       "chaarlie-local://auth?attemptId=\(id)", "chaarlie-local://auth#attemptId=\(id)&destination=x",
                       "chaarlie-local://auth#attemptId=bad"] {
            XCTAssertNil(LoginCallback.parse(try link(nested), pending: pending, signedIn: false))
        }
    }
    func testDevelopmentConfigurationRejectsProductionAndCredentials() throws {
        for value in ["https://chaarlie.de/api/mobile/v1", "http://user:secret@localhost:3218", "http://localhost:3218?token=a"] {
            XCTAssertThrowsError(try MobileConfiguration(baseURL: XCTUnwrap(URL(string: value))))
        }
        XCTAssertNoThrow(try MobileConfiguration(baseURL: XCTUnwrap(URL(string: "http://127.0.0.1:3218/api/mobile/v1"))))
    }
    func testHostedPilotConfigurationUsesOnlyItsFixedHTTPSOrigin() throws {
        let hosted = try MobileConfiguration(baseURL: XCTUnwrap(URL(string: "https://chaarlie.de/api/mobile/v1")), runtime: .hostedPilot)
        XCTAssertEqual(hosted.baseURL.absoluteString, "https://chaarlie.de/api/mobile/v1")
        for value in ["http://127.0.0.1:3218/api/mobile/v1", "https://chaarlie.de/api/mobile/v1/", "https://user:secret@chaarlie.de/api/mobile/v1"] {
            XCTAssertThrowsError(try MobileConfiguration(baseURL: XCTUnwrap(URL(string: value)), runtime: .hostedPilot), value)
        }
        XCTAssertEqual(MobileRuntime.local.keychainService, "de.chaarlie.scanner.local")
        XCTAssertEqual(MobileRuntime.hostedPilot.keychainService, "de.chaarlie.scanner.pilot")
        XCTAssertNotEqual(MobileRuntime.local.keychainService, MobileRuntime.hostedPilot.keychainService)
    }

    func testHostedAndLocalStoresCannotReadOrDeleteEachOthersState() throws {
        let local = KeychainSessionStore(runtime: .local)
        let pilot = KeychainSessionStore(runtime: .hostedPilot)
        let localDraft = KeychainOnboardingDraftStore(service: MobileRuntime.local.keychainService)
        let pilotDraft = KeychainOnboardingDraftStore(service: MobileRuntime.hostedPilot.keychainService)
        defer {
            try? local.saveSession(nil); try? pilot.saveSession(nil)
            try? local.saveAttempt(nil); try? pilot.saveAttempt(nil)
            try? localDraft.save(nil); try? pilotDraft.save(nil)
        }
        try local.saveSession(MobileSession(accessToken: "local", refreshToken: "local-refresh", expiresAt: 1900000000, userId: UUID().uuidString))
        try pilot.saveSession(MobileSession(accessToken: "pilot", refreshToken: "pilot-refresh", expiresAt: 1900000000, userId: UUID().uuidString))
        let localAttempt = AuthAttempt(attemptId: UUID().uuidString, codeLength: 8)
        let pilotAttempt = AuthAttempt(attemptId: UUID().uuidString, codeLength: 8)
        try local.saveAttempt(localAttempt); try pilot.saveAttempt(pilotAttempt)
        try localDraft.save(OnboardingDraft())
        XCTAssertEqual(try local.loadSession()?.accessToken, "local")
        XCTAssertEqual(try pilot.loadSession()?.accessToken, "pilot")
        XCTAssertEqual(try local.loadAttempt(), localAttempt)
        XCTAssertEqual(try pilot.loadAttempt(), pilotAttempt)
        XCTAssertNil(try pilotDraft.load())
        try pilot.saveSession(nil); try pilot.saveAttempt(nil); try pilotDraft.save(nil)
        XCTAssertEqual(try local.loadSession()?.accessToken, "local")
        XCTAssertEqual(try local.loadAttempt(), localAttempt)
        XCTAssertNotNil(try localDraft.load())
    }

    func testHostedPilotCallbackAcceptsOnlyItsOpaqueCompactJWS() throws {
        let id = UUID().uuidString
        let attempt = AuthAttempt(attemptId: id, codeLength: 8)
        let proof = "eyJhbGciOiJIUzI1NiJ9.eyJhdHRlbXB0SWQiOiJ4In0.signature"
        let pilot = try XCTUnwrap(URL(string: "chaarlie-pilot://auth#attemptId=\(id)&tokenHash=\(proof)"))
        XCTAssertEqual(LoginCallback.parse(pilot, pending: attempt, signedIn: false, runtime: .hostedPilot)?.tokenHash, proof)
        XCTAssertNil(LoginCallback.parse(pilot, pending: attempt, signedIn: false, runtime: .local))
        for value in [
            "chaarlie-pilot://auth#attemptId=\(id)&tokenHash=raw-token-value",
            "chaarlie-pilot://auth#callback=chaarlie-pilot://auth%23attemptId=\(id)&tokenHash=\(proof)",
            "chaarlie-pilot://auth#attemptId=\(id)&tokenHash=\(proof)&destination=https://evil.test",
            "chaarlie-local://auth#attemptId=\(id)&tokenHash=\(proof)"
        ] {
            XCTAssertNil(LoginCallback.parse(try XCTUnwrap(URL(string: value)), pending: attempt, signedIn: false, runtime: .hostedPilot), value)
        }
    }
}
