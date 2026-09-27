import StoreKit
import SwiftUI
import UIKit

/// Hard paywall (D8): Apple's subscription store with a Chaarlie photo header and our
/// own legal footer. No close button; access returns only through the server.
struct PaywallView: View {
    @Bindable var model: AppModel

    static func purchaseOptions(for token: UUID?) -> Set<Product.PurchaseOption> {
        token.map { [.appAccountToken($0)] } ?? []
    }

    var body: some View {
        Group {
            if let token = model.purchaseAccountToken, let groupID = SubscriptionConfiguration.groupID {
                SubscriptionStoreView(groupID: groupID) { PaywallHeader() }
                    .containerBackground(for: .subscriptionStoreFullHeight) { ChaarlieTheme.background }
                    .subscriptionStoreControlStyle(.compactPicker)
                    .subscriptionStoreButtonLabel(.action)
                    .subscriptionStorePickerItemBackground(.white)
                    .storeButton(.hidden, for: .policies, .restorePurchases)
                    .inAppPurchaseOptions { _ in Self.purchaseOptions(for: token) }
                    .onInAppPurchaseStart { _ in model.purchaseStarted() }
                    .onInAppPurchaseCompletion { _, result in await model.handlePurchase(PurchaseOutcome(result)) }
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
        // row sits above the photo. Task 7 adds "Konto löschen" after a separator here.
        .safeAreaInset(edge: .top, spacing: 0) { PaywallAccountRow(model: model) }
        .animation(ChaarlieTheme.Motion.state, value: model.purchaseState)
        .animation(ChaarlieTheme.Motion.state, value: model.paywallMessage)
    }
}

struct PaywallHeader: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private static let photo = UIImage(named: "paywall-regal.jpg")
    /// Minimum photo height. Accessibility text sizes shrink it so tiles and the buy button
    /// stay reachable; the headline may still grow the card, it is never truncated.
    static func height(for size: DynamicTypeSize) -> CGFloat { size.isAccessibilitySize ? 240 : 470 }

    var body: some View {
        VStack(spacing: 8) {
            Text("Sofort wissen, ob es passt.").chaarlieHeading(30).accessibilityAddTraits(.isHeader)
            Text("Jedes Produkt, geprüft für dein Haar.").chaarlieSystemFont(16).foregroundStyle(.white.opacity(0.9))
        }
        .fixedSize(horizontal: false, vertical: true)
        .foregroundStyle(.white).multilineTextAlignment(.center)
        .padding(.horizontal, 24).padding(.bottom, 26).padding(.top, 24)
        .frame(maxWidth: .infinity, minHeight: Self.height(for: dynamicTypeSize), alignment: .bottom)
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
        .padding(.horizontal, 16).padding(.top, 8)
    }
}

private struct PaywallFooter: View {
    @Bindable var model: AppModel
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: 8) {
            if let status = model.purchaseState.statusText {
                if model.purchaseState == .unlockFailed {
                    VStack(spacing: 6) {
                        Text(status).chaarlieSystemFont(14, weight: .medium).foregroundStyle(ChaarlieTheme.ink)
                        Button("Erneut versuchen") { Task { await model.retryUnfinishedTransactions() } }
                            .chaarlieSystemFont(14, weight: .semibold).foregroundStyle(ChaarlieTheme.plum).frame(minHeight: 44)
                    }.multilineTextAlignment(.center).chaarlieTransition(.opacity)
                } else {
                    BusyLabel(text: status).chaarlieTransition(.opacity)
                }
            }
            if let message = model.paywallMessage {
                Text(message).chaarlieSystemFont(14).foregroundStyle(ChaarlieTheme.coral)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                    .chaarlieTransition(.opacity)
            }
            // Large text stacks the links instead of breaking words.
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
