import Foundation
import StoreKit

/// A subscription or trial length, independent of StoreKit so the copy stays testable.
struct PlanPeriod: Equatable, Sendable {
    enum Unit: Sendable { case day, week, month, year }
    let value: Int
    let unit: Unit
}

extension PlanPeriod {
    init(_ period: Product.SubscriptionPeriod) {
        let unit: Unit = switch period.unit {
        case .day: .day
        case .week: .week
        case .month: .month
        case .year: .year
        @unknown default: .month
        }
        self.init(value: period.value, unit: unit)
    }
}

/// Copy for the plan tiles (Guideline 3.1.2). The billed amount is the lead price; the
/// monthly equivalent, savings badge and trial are secondary; the renewal terms of the
/// selected plan always stay visible next to the purchase button.
enum PaywallPricing {
    /// Whole-percent saving of the year against twelve months; nil hides the badge.
    static func savingsPercent(yearly: Decimal?, monthly: Decimal?) -> Int? {
        guard let yearly, let monthly, monthly > 0 else { return nil }
        var percent = (1 - yearly / (12 * monthly)) * 100
        var rounded = Decimal()
        NSDecimalRound(&rounded, &percent, 0, .plain)
        let value = NSDecimalNumber(decimal: rounded).intValue
        return value > 0 ? value : nil
    }
    static func badge(percent: Int) -> String { "−\(percent)\u{00A0}%" }

    /// A twelfth of the yearly price, standard rounding at the currency's precision, never truncated.
    static func monthlyAmount(yearly: Decimal, style: Decimal.FormatStyle.Currency) -> String {
        (yearly / 12).formatted(style.rounded(rule: .toNearestOrAwayFromZero))
    }
    static func monthlyEquivalent(yearly: Decimal, style: Decimal.FormatStyle.Currency) -> String {
        "nur \(monthlyAmount(yearly: yearly, style: style))/Monat"
    }

    static func billed(_ displayPrice: String, per period: PlanPeriod) -> String {
        guard period.value == 1 else { return "\(displayPrice) für \(duration(period))" }
        return "\(displayPrice)/\(unitName(period.unit, plural: false))"
    }

    /// Only a monthly plan says it can be cancelled monthly.
    static func cancellationNote(for period: PlanPeriod) -> String? {
        period == PlanPeriod(value: 1, unit: .month) ? "monatlich kündbar" : nil
    }

    /// VoiceOver reads the billed price first, then the tile's secondary lines that are shown.
    static func tileAccessibilityLabel(displayPrice: String, period: PlanPeriod, title: String, savingsPercent: Int?,
                                       monthlyAmount: String?, trial: PlanPeriod?) -> String {
        let billed = period.value == 1
            ? "\(displayPrice) pro \(unitName(period.unit, plural: false))"
            : "\(displayPrice) für \(duration(period))"
        let details = [
            title,
            savingsPercent.map { "\($0) % günstiger" },
            monthlyAmount.map { "entspricht \($0) pro Monat" },
            cancellationNote(for: period),
            trial.map(Self.trial),
        ].compactMap { $0 }
        return "\(billed). \(details.joined(separator: ", "))."
    }

    static func title(for period: PlanPeriod, fallback: String) -> String {
        guard period.value == 1 else { return fallback }
        return switch period.unit {
        case .year: "Jährlich"
        case .month: "Monatlich"
        case .week: "Wöchentlich"
        case .day: "Täglich"
        }
    }

    static func trial(_ period: PlanPeriod) -> String { "\(duration(period)) kostenlos" }

    static func disclosure(billed: String, trial: PlanPeriod?) -> String {
        guard let trial else { return "\(billed), verlängert sich automatisch bis zur Kündigung." }
        return "\(Self.trial(trial)), dann \(billed). Verlängert sich automatisch, jederzeit kündbar."
    }

    static func actionLabel(hasFreeTrial: Bool) -> String { hasFreeTrial ? "Kostenlos testen" : "Abonnieren" }

    private static func duration(_ period: PlanPeriod) -> String {
        "\(period.value) \(unitName(period.unit, plural: period.value != 1))"
    }
    private static func unitName(_ unit: PlanPeriod.Unit, plural: Bool) -> String {
        switch unit {
        case .day: plural ? "Tage" : "Tag"
        case .week: plural ? "Wochen" : "Woche"
        case .month: plural ? "Monate" : "Monat"
        case .year: plural ? "Jahre" : "Jahr"
        }
    }
}
