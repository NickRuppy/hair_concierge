import XCTest
@testable import Chaarlie

final class SubscriptionRowPresentationTests: XCTestCase {
    private func appStoreAccess(productId: String = "de.chaarlie.scanner.yearly", expiresAt: String = "2027-09-27T10:00:00.000Z",
                                 willRenew: Bool = true, inBillingRetry: Bool = false) -> MobileAccess {
        MobileAccess(status: .active, source: "app_store",
                     appStore: .init(productId: productId, expiresAt: expiresAt, willRenew: willRenew, inBillingRetry: inBillingRetry))
    }

    func testRenewingYearlyShowsTheNextRenewalDate() throws {
        let presentation = try XCTUnwrap(SubscriptionRowPresentation.make(access: appStoreAccess()))
        XCTAssertEqual(presentation.title, "Chaarlie Scanner · Jährlich")
        XCTAssertEqual(presentation.detail, "verlängert sich am 27.09.2027")
        XCTAssertTrue(presentation.showsManageButton)
    }
    func testRenewingMonthlyShowsTheMonthlyTitle() throws {
        let presentation = try XCTUnwrap(SubscriptionRowPresentation.make(
            access: appStoreAccess(productId: "de.chaarlie.scanner.monthly")))
        XCTAssertEqual(presentation.title, "Chaarlie Scanner · Monatlich")
        XCTAssertEqual(presentation.detail, "verlängert sich am 27.09.2027")
        XCTAssertTrue(presentation.showsManageButton)
    }
    func testNonRenewingSubscriptionShowsTheExpiryDate() throws {
        let presentation = try XCTUnwrap(SubscriptionRowPresentation.make(access: appStoreAccess(willRenew: false)))
        XCTAssertEqual(presentation.detail, "läuft am 27.09.2027 ab")
        XCTAssertTrue(presentation.showsManageButton)
    }
    func testBillingRetryShowsThePaymentProblemRegardlessOfWillRenew() throws {
        let presentation = try XCTUnwrap(SubscriptionRowPresentation.make(
            access: appStoreAccess(willRenew: true, inBillingRetry: true)))
        XCTAssertEqual(presentation.detail, "Zahlungsproblem – bitte in den Apple-Einstellungen prüfen")
        XCTAssertTrue(presentation.showsManageButton)
    }
    func testWebSourceShowsTheAccountTextWithoutAManageButton() throws {
        let presentation = try XCTUnwrap(SubscriptionRowPresentation.make(
            access: MobileAccess(status: .active, source: "web", appStore: nil)))
        XCTAssertEqual(presentation.title, "Chaarlie-Abo")
        XCTAssertEqual(presentation.detail, "Über dein Chaarlie-Konto aktiv")
        XCTAssertFalse(presentation.showsManageButton)
    }
    func testWebWithAnAppStoreRowStillOffersToManageTheDuplicate() throws {
        let access = MobileAccess(status: .active, source: "web", appStore: appStoreAccess().appStore)
        let presentation = try XCTUnwrap(SubscriptionRowPresentation.make(access: access))
        XCTAssertEqual(presentation.title, "Chaarlie-Abo")
        XCTAssertEqual(presentation.detail, "Über dein Chaarlie-Konto aktiv")
        XCTAssertTrue(presentation.showsManageButton)
    }
    func testOpenSourceHidesTheRow() {
        XCTAssertNil(SubscriptionRowPresentation.make(access: MobileAccess.open))
    }
    func testMissingAccessInfoHidesTheRow() {
        XCTAssertNil(SubscriptionRowPresentation.make(access: nil))
    }
    func testUnrecognizedSourceHidesTheRowInsteadOfGuessing() {
        let access = MobileAccess(status: .active, source: "future_source", appStore: nil)
        XCTAssertNil(SubscriptionRowPresentation.make(access: access))
    }
    func testDateIsFormattedDdMmYyyyInGermanRegardlessOfDeviceLocale() throws {
        let presentation = try XCTUnwrap(SubscriptionRowPresentation.make(
            access: appStoreAccess(expiresAt: "2026-01-05T00:00:00.000Z")))
        XCTAssertEqual(presentation.detail, "verlängert sich am 05.01.2026")
    }
}
