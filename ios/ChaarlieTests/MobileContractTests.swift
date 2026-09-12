import XCTest
import SwiftUI
@testable import Chaarlie

final class MobileContractTests: XCTestCase {
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
}
