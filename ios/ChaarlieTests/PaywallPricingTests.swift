import XCTest
@testable import Chaarlie

/// Plan-tile copy (Guideline 3.1.2): the billed amount leads, the monthly equivalent,
/// savings badge and trial stay secondary, and the renewal terms are always spelled out.
final class PaywallPricingTests: XCTestCase {
    private let eur = Decimal.FormatStyle.Currency(code: "EUR", locale: Locale(identifier: "de_DE"))
    private let chf = Decimal.FormatStyle.Currency(code: "CHF", locale: Locale(identifier: "de_CH"))
    private let year = PlanPeriod(value: 1, unit: .year)
    private let month = PlanPeriod(value: 1, unit: .month)
    private let week = PlanPeriod(value: 1, unit: .week)
    private let nbsp = "\u{00A0}"

    private func decimal(_ value: String) -> Decimal { Decimal(string: value)! }

    // MARK: Monthly equivalent

    func testMonthlyEquivalentOfTheYearlyPriceInEuro() {
        XCTAssertEqual(PaywallPricing.monthlyEquivalent(yearly: decimal("39.99"), style: eur), "nur 3,33\(nbsp)€/Monat")
    }
    func testMonthlyEquivalentRoundsHalfUpInsteadOfTruncatingOrBankersRounding() {
        // 1.50 / 12 = 0.125: truncation and banker's rounding would both show 0,12 €.
        XCTAssertEqual(PaywallPricing.monthlyEquivalent(yearly: decimal("1.50"), style: eur), "nur 0,13\(nbsp)€/Monat")
        // 49.90 / 12 = 4.1583…: truncation would show 4,15 €.
        XCTAssertEqual(PaywallPricing.monthlyEquivalent(yearly: decimal("49.90"), style: eur), "nur 4,16\(nbsp)€/Monat")
    }
    func testMonthlyEquivalentUsesTheStorefrontCurrencyFormat() {
        XCTAssertEqual(PaywallPricing.monthlyEquivalent(yearly: decimal("49.90"), style: chf), "nur CHF\(nbsp)4.16/Monat")
    }

    // MARK: Savings badge

    func testSavingsPercentComparesTheYearToTwelveMonths() {
        XCTAssertEqual(PaywallPricing.savingsPercent(yearly: decimal("39.99"), monthly: decimal("4.99")), 33)
        XCTAssertEqual(PaywallPricing.badge(percent: 33), "−33\(nbsp)%")
    }
    func testSavingsPercentWorksForOtherCurrencies() {
        // CHF 44.00 vs 12 × CHF 5.50 = 66.00 → 33.3 %.
        XCTAssertEqual(PaywallPricing.savingsPercent(yearly: decimal("44.00"), monthly: decimal("5.50")), 33)
        // 1 − 50 / 60 = 16.67 % rounds to 17.
        XCTAssertEqual(PaywallPricing.savingsPercent(yearly: decimal("50"), monthly: decimal("5")), 17)
    }
    func testSavingsBadgeIsHiddenWhenAProductIsMissing() {
        XCTAssertNil(PaywallPricing.savingsPercent(yearly: nil, monthly: decimal("4.99")))
        XCTAssertNil(PaywallPricing.savingsPercent(yearly: decimal("39.99"), monthly: nil))
        XCTAssertNil(PaywallPricing.savingsPercent(yearly: decimal("39.99"), monthly: 0))
    }
    func testSavingsBadgeIsHiddenWithoutARealSaving() {
        XCTAssertNil(PaywallPricing.savingsPercent(yearly: decimal("59.88"), monthly: decimal("4.99")))
        XCTAssertNil(PaywallPricing.savingsPercent(yearly: decimal("70"), monthly: decimal("4.99")))
        // 0.2 % would round to a "−0 %" badge.
        XCTAssertNil(PaywallPricing.savingsPercent(yearly: decimal("59.76"), monthly: decimal("4.99")))
    }

    // MARK: Billed amount, titles and trial

    func testBilledAmountNamesThePeriod() {
        XCTAssertEqual(PaywallPricing.billed("39,99\(nbsp)€", per: year), "39,99\(nbsp)€/Jahr")
        XCTAssertEqual(PaywallPricing.billed("4,99\(nbsp)€", per: month), "4,99\(nbsp)€/Monat")
        XCTAssertEqual(PaywallPricing.billed("CHF\(nbsp)44.00", per: year), "CHF\(nbsp)44.00/Jahr")
        XCTAssertEqual(PaywallPricing.billed("12,99\(nbsp)€", per: PlanPeriod(value: 3, unit: .month)), "12,99\(nbsp)€ für 3 Monate")
    }
    func testTitleFollowsTheBillingPeriod() {
        XCTAssertEqual(PaywallPricing.title(for: year, fallback: "Scanner"), "Jährlich")
        XCTAssertEqual(PaywallPricing.title(for: month, fallback: "Scanner"), "Monatlich")
        XCTAssertEqual(PaywallPricing.title(for: PlanPeriod(value: 3, unit: .month), fallback: "Quartal"), "Quartal")
    }
    func testTrialDurationInGerman() {
        XCTAssertEqual(PaywallPricing.trial(week), "1 Woche kostenlos")
        XCTAssertEqual(PaywallPricing.trial(PlanPeriod(value: 2, unit: .week)), "2 Wochen kostenlos")
        XCTAssertEqual(PaywallPricing.trial(PlanPeriod(value: 3, unit: .day)), "3 Tage kostenlos")
        XCTAssertEqual(PaywallPricing.trial(month), "1 Monat kostenlos")
    }

    // MARK: Renewal disclosure and action

    func testDisclosureForTheYearWithAFreeTrial() {
        XCTAssertEqual(PaywallPricing.disclosure(billed: "39,99\(nbsp)€/Jahr", trial: week),
                       "1 Woche kostenlos, dann 39,99\(nbsp)€/Jahr. Verlängert sich automatisch, jederzeit kündbar.")
    }
    func testDisclosureForTheYearWithoutATrial() {
        XCTAssertEqual(PaywallPricing.disclosure(billed: "39,99\(nbsp)€/Jahr", trial: nil),
                       "39,99\(nbsp)€/Jahr, verlängert sich automatisch bis zur Kündigung.")
    }
    func testDisclosureForTheMonth() {
        XCTAssertEqual(PaywallPricing.disclosure(billed: "4,99\(nbsp)€/Monat", trial: nil),
                       "4,99\(nbsp)€/Monat, verlängert sich automatisch bis zur Kündigung.")
    }
    func testActionLabelOffersTheTrialOnlyWhenOneApplies() {
        XCTAssertEqual(PaywallPricing.actionLabel(hasFreeTrial: true), "Kostenlos testen")
        XCTAssertEqual(PaywallPricing.actionLabel(hasFreeTrial: false), "Abonnieren")
    }
}
