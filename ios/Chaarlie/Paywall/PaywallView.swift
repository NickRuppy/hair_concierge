import StoreKit
import SwiftUI
import UIKit

/// Hard paywall (D8): Apple's subscription store with a Chaarlie photo header, our own
/// plan tiles (`PaywallPlanStyle`) and legal footer. No close button; access returns only
/// through the server.
struct PaywallView: View {
    @Bindable var model: AppModel
    /// Set on the CTA tap, cleared when StoreKit reports any result: a second tap before
    /// Apple's sheet appears must not start a second purchase.
    @State private var purchaseInFlight = false

    static func purchaseOptions(for token: UUID?) -> Set<Product.PurchaseOption> {
        token.map { [.appAccountToken($0)] } ?? []
    }

    var body: some View {
        Group {
            if let token = model.purchaseAccountToken, let groupID = SubscriptionConfiguration.groupID {
                SubscriptionStoreView(groupID: groupID) { PaywallHeader(model: model) }
                    .containerBackground(for: .subscriptionStoreFullHeight) { ChaarlieTheme.background }
                    .subscriptionStoreControlStyle(PaywallPlanStyle(purchaseInFlight: $purchaseInFlight), placement: .bottomBar)
                    .storeButton(.hidden, for: .policies, .restorePurchases)
                    .inAppPurchaseOptions { _ in Self.purchaseOptions(for: token) }
                    .onInAppPurchaseStart { _ in model.purchaseStarted() }
                    .onInAppPurchaseCompletion { _, result in
                        purchaseInFlight = false
                        await model.handlePurchase(PurchaseOutcome(result))
                    }
                    .disabled(model.purchaseState == .unlocking || model.purchaseState == .restoring)
                    .modifier(HiddenScrollEdge())
            } else {
                // A build without a configured subscription group cannot sell anything.
                VStack(spacing: 16) {
                    PaywallHeader()
                    Text("Abos sind in diesem Build noch nicht verfügbar.")
                        .chaarlieSystemFont(15).foregroundStyle(ChaarlieTheme.muted)
                        .multilineTextAlignment(.center).padding(.horizontal, 24)
                    Spacer(minLength: 0)
                }
            }
        }
        .tint(ChaarlieTheme.plum)
        .background(ChaarlieTheme.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) { PaywallFooter(model: model) }
        // A second bottom row squeezes Apple's tiles into the price line, so the account
        // row sits above the photo.
        .safeAreaInset(edge: .top, spacing: 0) { PaywallAccountRow(model: model) }
        .animation(ChaarlieTheme.Motion.state, value: model.purchaseState)
        .animation(ChaarlieTheme.Motion.state, value: model.paywallMessage)
    }
}

struct PaywallHeader: View {
    /// Nil only in the build without a subscription group, which cannot show a status.
    var model: AppModel? = nil
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private static let photo = UIImage(named: "paywall-regal.jpg")
    /// Minimum photo height. Accessibility text sizes shrink it so tiles and the buy button
    /// stay reachable; the headline may still grow the card, it is never truncated. A
    /// purchase status sits between photo and tiles, so the photo gives up its height:
    /// Apple's pinned store controls never share their space with our rows.
    static func height(for size: DynamicTypeSize, showsStatus: Bool = false) -> CGFloat {
        size.isAccessibilitySize ? 240 : showsStatus ? 340 : 470
    }
    static func showsStatus(_ model: AppModel?) -> Bool {
        guard let model else { return false }
        return model.purchaseState.statusText != nil || model.paywallMessage != nil
    }

    var body: some View {
        VStack(spacing: 12) {
            card
            if let model, Self.showsStatus(model) { PaywallStatus(model: model).chaarlieTransition(.opacity) }
        }
        .padding(.horizontal, 16).padding(.top, 8)
    }

    private var card: some View {
        VStack(spacing: 8) {
            Text("Sofort wissen, ob es passt.").chaarlieHeading(30).accessibilityAddTraits(.isHeader)
            Text("Jedes Produkt, geprüft für dein Haar.").chaarlieSystemFont(16).foregroundStyle(.white.opacity(0.9))
        }
        // The largest sizes would outgrow any photo; cap the card text like the footer.
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
        .fixedSize(horizontal: false, vertical: true)
        .foregroundStyle(.white).multilineTextAlignment(.center)
        .padding(.horizontal, 24).padding(.bottom, 26).padding(.top, 24)
        .frame(maxWidth: .infinity, minHeight: Self.height(for: dynamicTypeSize, showsStatus: Self.showsStatus(model)),
               alignment: .bottom)
        // Grow with the headline instead of clipping it under the rounded photo.
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: .combine)
        .background {
            ZStack {
                if let photo = Self.photo {
                    Image(uiImage: photo).resizable().scaledToFill()
                } else {
                    ChaarlieTheme.plum
                }
                LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .center, endPoint: .bottom)
            }
            .accessibilityHidden(true)
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    }
}

/// Pending, unlocking, retry and message rows. They live in the store's header content,
/// not the pinned footer: a taller footer squeezed Apple's controls onto the price tiles.
private struct PaywallStatus: View {
    @Bindable var model: AppModel

    var body: some View {
        VStack(spacing: 6) {
            if let status = model.purchaseState.statusText {
                if model.purchaseState == .unlockFailed {
                    VStack(spacing: 0) {
                        Text(status).chaarlieSystemFont(14, weight: .medium).foregroundStyle(ChaarlieTheme.ink)
                        Button("Erneut versuchen") { Task { await model.retryUnfinishedTransactions() } }
                            .chaarlieSystemFont(14, weight: .semibold).foregroundStyle(ChaarlieTheme.plum).frame(minHeight: 44)
                            .buttonStyle(.plain)
                    }
                } else {
                    BusyLabel(text: status)
                }
            }
            if let message = model.paywallMessage {
                Text(message).chaarlieSystemFont(14).foregroundStyle(ChaarlieTheme.coral)
            }
        }
        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
    }
}

private struct PaywallFooter: View {
    @Bindable var model: AppModel
    @Environment(\.openURL) private var openURL

    var body: some View {
        // Large text stacks the links instead of breaking words. Status rows live in
        // PaywallStatus: this pinned footer keeps one height in every purchase state.
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 14) {
                restoreButton
                Text("·").accessibilityHidden(true)
                agbButton
                Text("·").accessibilityHidden(true)
                privacyButton
            }
            VStack(spacing: 4) { restoreButton; agbButton; privacyButton }
        }
        .chaarlieSystemFont(12, relativeTo: .footnote).foregroundStyle(ChaarlieTheme.muted).buttonStyle(.plain)
        // The pinned footer must leave room for Apple's store controls at the largest sizes.
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .padding(.horizontal, 16).padding(.top, 2).padding(.bottom, 6)
        .frame(maxWidth: .infinity).background(ChaarlieTheme.background)
        .accessibilityElement(children: .contain)
    }
    private var restoreButton: some View {
        Button("Wiederherstellen") { Task { await model.restorePurchases() } }
            .accessibilityLabel("Käufe wiederherstellen")
            .disabled(model.purchaseState == .restoring || model.purchaseState == .unlocking)
            .fixedSize()
    }
    private var agbButton: some View {
        Button("AGB") { openURL(URL(string: "https://chaarlie.de/agb")!) }
            .accessibilityLabel("Allgemeine Geschäftsbedingungen").fixedSize()
    }
    private var privacyButton: some View {
        Button("Datenschutz") { openURL(URL(string: "https://chaarlie.de/datenschutz")!) }
            .accessibilityLabel("Datenschutzerklärung").fixedSize()
    }
}

private struct PaywallAccountRow: View {
    let model: AppModel
    var body: some View {
        HStack(spacing: 14) {
            Spacer(minLength: 0)
            Button("Abmelden") { Task { await model.logout() } }.fixedSize()
            Text("·").accessibilityHidden(true)
            Button("Konto löschen") { Task { await model.beginAccountDeletion() } }.fixedSize()
                .accessibilityIdentifier("paywall.delete")
        }
        .chaarlieSystemFont(12, relativeTo: .footnote).foregroundStyle(ChaarlieTheme.muted).buttonStyle(.plain)
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .frame(minHeight: 32).padding(.horizontal, 24)
        .background(ChaarlieTheme.background)
    }
}

/// iOS 26 draws a soft scroll-edge effect behind the store's bottom controls.
private struct HiddenScrollEdge: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) { content.scrollEdgeEffectHidden(true, for: .all) } else { content }
    }
}

/// Two plan tiles and our own purchase button (Guideline 3.1.2): the billed amount is the
/// largest and boldest price, the monthly equivalent, badge and trial stay smaller and
/// lighter, and the selected plan's renewal terms sit directly above the button. Purchases still run
/// through the store view, so `.inAppPurchaseOptions` and the completion handlers apply.
/// Applied with `placement: .bottomBar`: the default `.automatic` placement puts a custom
/// style into the scroll view, below the photo and under the footer.
struct PaywallPlanStyle: SubscriptionStoreControlStyle {
    @Binding var purchaseInFlight: Bool
    func makeBody(configuration: Configuration) -> some View {
        PaywallPlanControls(configuration: configuration, purchaseInFlight: $purchaseInFlight)
    }
}

private typealias PlanOption = SubscriptionStoreControlStyleConfiguration.Option

private extension Product {
    var planPeriod: PlanPeriod? { subscription.map { PlanPeriod($0.subscriptionPeriod) } }
    var periodDays: Int {
        guard let period = planPeriod else { return 0 }
        let days = switch period.unit { case .day: 1; case .week: 7; case .month: 30; case .year: 365 }
        return days * period.value
    }
}

private extension Product.SubscriptionOffer {
    /// Only a free trial changes the button and the terms; no paid intro offers exist.
    var freeTrial: PlanPeriod? { paymentMode == .freeTrial ? PlanPeriod(period) : nil }
}

private struct PaywallPlanControls: View {
    let configuration: SubscriptionStoreControlStyleConfiguration
    @Binding var purchaseInFlight: Bool
    @State private var selectedID: Product.ID?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Longest period first, so the yearly plan leads and is preselected.
    private var options: [PlanOption] {
        configuration.options.sorted { $0.subscription.periodDays > $1.subscription.periodDays }
    }
    private var selected: PlanOption? {
        options.first { $0.id == selectedID } ?? options.first
    }
    private var savingsPercent: Int? {
        func price(_ unit: PlanPeriod.Unit) -> Decimal? {
            configuration.options.first { $0.subscription.planPeriod == PlanPeriod(value: 1, unit: unit) }?.subscription.price
        }
        return PaywallPricing.savingsPercent(yearly: price(.year), monthly: price(.month))
    }

    var body: some View {
        let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(spacing: 10)) : AnyLayout(HStackLayout(alignment: .top, spacing: 10))
        VStack(spacing: 0) {
            layout {
                ForEach(options) { option in
                    let isSelected = option.id == selected?.id
                    Button { selectedID = option.id } label: {
                        PlanTile(product: option.subscription, trial: option.activeOffer?.freeTrial,
                                 savingsPercent: option.subscription.planPeriod?.unit == .year ? savingsPercent : nil,
                                 isSelected: isSelected)
                    }
                    .buttonStyle(ChaarliePressStyle())
                    .accessibilityAddTraits(isSelected ? [.isSelected] : [])
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            // One haptic per selection change, not one per tile whose state flips.
            .sensoryFeedback(.selection, trigger: selected?.id)
            if let selected { PurchaseSection(option: selected, purchaseInFlight: $purchaseInFlight) }
        }
        .fixedSize(horizontal: false, vertical: true)
        // Like the footer: the pinned controls must leave room for the page at the largest sizes.
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 8)
        // Failsafe: a purchase that never reports back must not lock the only way out.
        .task(id: purchaseInFlight) {
            guard purchaseInFlight else { return }
            try? await Task.sleep(for: .seconds(10))
            if !Task.isCancelled { purchaseInFlight = false }
        }
    }
}

private struct PlanTile: View {
    let product: Product
    let trial: PlanPeriod?
    let savingsPercent: Int?
    let isSelected: Bool

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: ChaarlieTheme.Radius.control, style: .continuous)
        VStack(spacing: 4) {
            HStack(spacing: 6) {
                Text(PaywallPricing.title(for: period, fallback: product.displayName))
                    .chaarlieSystemFont(13, weight: .semibold).foregroundStyle(ChaarlieTheme.plum)
                if let savingsPercent {
                    Text(PaywallPricing.badge(percent: savingsPercent)).chaarlieSystemFont(11, weight: .semibold, relativeTo: .caption)
                        .foregroundStyle(ChaarlieTheme.plum)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(ChaarlieTheme.plumScale, in: Capsule())
                        .fixedSize()
                }
            }
            // The billed amount is the most prominent price on the tile.
            Text(PaywallPricing.billed(product.displayPrice, per: period))
                .chaarlieSystemFont(18, weight: .bold, relativeTo: .headline).foregroundStyle(ChaarlieTheme.ink)
            if isYearly {
                Text(PaywallPricing.monthlyEquivalent(yearly: product.price, style: product.priceFormatStyle))
                    .chaarlieSystemFont(12, relativeTo: .footnote).foregroundStyle(ChaarlieTheme.muted)
            } else if let note = PaywallPricing.cancellationNote(for: period) {
                Text(note).chaarlieSystemFont(12, relativeTo: .footnote).foregroundStyle(ChaarlieTheme.muted)
            }
            if let trial {
                Text(PaywallPricing.trial(trial)).chaarlieSystemFont(12, relativeTo: .footnote).foregroundStyle(ChaarlieTheme.plum)
            }
        }
        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 10).padding(.vertical, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(isSelected ? Color.white : ChaarlieTheme.surfaceMuted, in: shape)
        .overlay(shape.strokeBorder(isSelected ? ChaarlieTheme.plum : ChaarlieTheme.border, lineWidth: isSelected ? 2 : 1))
        .contentShape(shape)
        .animation(ChaarlieTheme.Motion.state, value: isSelected)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(PaywallPricing.tileAccessibilityLabel(
            displayPrice: product.displayPrice, period: period,
            title: PaywallPricing.title(for: period, fallback: product.displayName), savingsPercent: savingsPercent,
            monthlyAmount: isYearly ? PaywallPricing.monthlyAmount(yearly: product.price, style: product.priceFormatStyle) : nil,
            trial: trial))
    }
    private var period: PlanPeriod { product.planPeriod ?? PlanPeriod(value: 1, unit: .month) }
    private var isYearly: Bool { period == PlanPeriod(value: 1, unit: .year) }
}

private struct PurchaseSection: View {
    let option: PlanOption
    @Binding var purchaseInFlight: Bool

    var body: some View {
        let product = option.subscription
        let trial = option.activeOffer?.freeTrial
        let billed = PaywallPricing.billed(product.displayPrice, per: product.planPeriod ?? PlanPeriod(value: 1, unit: .month))
        VStack(spacing: 10) {
            Text(PaywallPricing.disclosure(billed: billed, trial: trial))
                .chaarlieSystemFont(12, relativeTo: .footnote).foregroundStyle(ChaarlieTheme.muted)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            Button {
                guard !purchaseInFlight else { return }
                purchaseInFlight = true
                option.subscribe()
            } label: {
                Text(PaywallPricing.actionLabel(hasFreeTrial: trial != nil))
            }
            .buttonStyle(PaywallBuyButton())
            .disabled(purchaseInFlight)
            .accessibilityIdentifier("paywall.subscribe")
        }
        .padding(.top, 10)
    }
}

/// Plum capsule, as Apple's store button looked in the approved layout.
private struct PaywallBuyButton: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.chaarlieSystemFont(17, weight: .semibold, relativeTo: .headline)
            .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 50).padding(.horizontal, 12)
            .background(ChaarlieTheme.plum, in: Capsule())
            .opacity(!isEnabled ? 0.45 : configuration.isPressed ? 0.88 : 1)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.985 : 1)
            .animation(ChaarlieTheme.Motion.press, value: configuration.isPressed)
    }
}
