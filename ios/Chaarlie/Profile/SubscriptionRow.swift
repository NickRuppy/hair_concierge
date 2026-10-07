import StoreKit
import SwiftUI

/// Pure mapping from bootstrap `access` to the Profil "Abo" row's German copy.
/// No network or StoreKit calls; `SubscriptionRow` owns the manage-subscriptions sheet.
struct SubscriptionRowPresentation: Equatable {
    let title: String
    let detail: String
    let showsManageButton: Bool

    private static let yearlyProductId = "de.chaarlie.scanner.yearly"
    private static let monthlyProductId = "de.chaarlie.scanner.monthly"

    /// `nil` hides the row: no access info (a server that predates the paywall, or
    /// before the first bootstrap), an open source (paywall flag off), or a future
    /// source value this build does not know how to word yet.
    static func make(access: MobileAccess?) -> SubscriptionRowPresentation? {
        guard let access else { return nil }
        switch access.source {
        case "web":
            return SubscriptionRowPresentation(title: "Chaarlie-Abo", detail: "Über dein Chaarlie-Konto aktiv",
                                                showsManageButton: access.appStore != nil)
        case "app_store":
            guard let appStore = access.appStore else { return nil }
            return SubscriptionRowPresentation(title: title(for: appStore.productId), detail: detail(for: appStore),
                                                showsManageButton: true)
        default:
            return nil
        }
    }
    private static func title(for productId: String) -> String {
        switch productId {
        case yearlyProductId: "Chaarlie Scanner · Jährlich"
        case monthlyProductId: "Chaarlie Scanner · Monatlich"
        default: "Chaarlie Scanner"
        }
    }
    /// Billing retry takes priority: a lapsed renewal matters more than the plan's
    /// ordinary `willRenew` answer, which Apple keeps true during the retry window.
    private static func detail(for appStore: MobileAccess.AppStore) -> String {
        if appStore.inBillingRetry { return "Zahlungsproblem – bitte in den Apple-Einstellungen prüfen" }
        let date = formattedDate(appStore.expiresAt) ?? appStore.expiresAt
        return appStore.willRenew ? "verlängert sich am \(date)" : "läuft am \(date) ab"
    }
    /// Apple's timestamps are UTC; the calendar day they name never shifts with the
    /// device's local time zone.
    private static func formattedDate(_ iso: String) -> String? {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = parser.date(from: iso)
        if date == nil {
            parser.formatOptions = [.withInternetDateTime]
            date = parser.date(from: iso)
        }
        guard let date else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "dd.MM.yyyy"
        return formatter.string(from: date)
    }
}

/// Profil's own "Abo" section. Hidden entirely when there is nothing to show.
struct SubscriptionRow: View {
    @Bindable var model: AppModel
    @State private var manageSheetPresented = false

    var body: some View {
        if let presentation = SubscriptionRowPresentation.make(access: model.access) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Abo").chaarlieSystemFont(13, weight: .semibold)
                    .foregroundStyle(ChaarlieTheme.muted).accessibilityAddTraits(.isHeader)
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(presentation.title).chaarlieSystemFont(16)
                        Text(presentation.detail).chaarlieSystemFont(14).foregroundStyle(ChaarlieTheme.muted)
                    }.fixedSize(horizontal: false, vertical: true).accessibilityElement(children: .combine)
                    if presentation.showsManageButton {
                        Button("Abo verwalten") { manageSheetPresented = true }
                            .buttonStyle(ChaarlieTextButton()).accessibilityIdentifier("profile.subscription.manage")
                    }
                }.frame(maxWidth: .infinity, alignment: .leading).padding(16).chaarlieCard()
            }.accessibilityIdentifier("profile.subscription.row")
                .manageSubscriptionsSheet(isPresented: $manageSheetPresented)
                .onChange(of: manageSheetPresented) { wasPresented, isPresented in
                    if wasPresented, !isPresented { Task { await model.refreshAccountAccess() } }
                }
        }
    }
}
