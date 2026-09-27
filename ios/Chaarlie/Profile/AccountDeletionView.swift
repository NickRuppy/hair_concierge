import StoreKit
import SwiftUI

/// "Konto löschen" (§6), shared by Profil and the paywall: the Apple-subscription notice
/// when it renews, then the confirmation. `AppModel` owns every step and the request.
struct AccountDeletionSheet: View {
    @Bindable var model: AppModel
    @State private var manageSheetPresented = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                switch model.accountDeletion {
                case .subscriptionNotice?: notice
                case .preflightFailed?: preflightFailed
                case .confirm(let webSubscription)?, .deleting(let webSubscription)?: confirmation(webSubscription: webSubscription)
                case .loading?, nil: BusyLabel(text: "Einen Moment …").frame(maxWidth: .infinity).padding(.top, 24)
                }
            }.padding(24).padding(.top, 8)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(ChaarlieTheme.background)
        .chaarlieSystemFont().foregroundStyle(ChaarlieTheme.ink).tint(ChaarlieTheme.plum)
        .interactiveDismissDisabled(model.accountDeletion?.isDeleting == true)
        .animation(ChaarlieTheme.Motion.state, value: model.accountDeletion)
        .manageSubscriptionsSheet(isPresented: $manageSheetPresented)
        .onChange(of: manageSheetPresented) { wasPresented, isPresented in
            if wasPresented, !isPresented { Task { await model.refreshAccountAccess() } }
        }
    }

    private var notice: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Dein Abo läuft über Apple und wird nicht automatisch gekündigt.")
                .chaarlieHeading(26).accessibilityAddTraits(.isHeader)
            Button("Abo kündigen") { manageSheetPresented = true }.buttonStyle(ChaarlieButton())
                .accessibilityIdentifier("delete.manageSubscription")
            Button("Trotzdem fortfahren") { Task { await model.continueAccountDeletion() } }
                .buttonStyle(ChaarlieButton(outline: true)).accessibilityIdentifier("delete.continue")
        }
    }

    private var preflightFailed: some View {
        VStack(alignment: .leading, spacing: 18) {
            NoticeCard(systemImage: "wifi.slash", message: model.accountDeletionError ?? "") {
                Button("Erneut versuchen") { Task { await model.continueAccountDeletion() } }.buttonStyle(ChaarlieButton())
            }
            cancelButton
        }
    }

    private func confirmation(webSubscription: Bool) -> some View {
        let deleting = model.accountDeletion?.isDeleting == true
        return VStack(alignment: .leading, spacing: 14) {
            Text("Konto endgültig löschen?").chaarlieHeading(28).accessibilityAddTraits(.isHeader)
            Text("Haarprofil, Scan-Verlauf und Merkliste werden gelöscht.").chaarlieSystemFont(16)
            Text("Zahlungsbelege bewahren wir aus gesetzlichen Gründen anonymisiert auf.")
                .chaarlieSystemFont(15).foregroundStyle(ChaarlieTheme.muted)
            if webSubscription {
                Text("Dein Chaarlie-Abo wird sofort beendet.").chaarlieSystemFont(16, weight: .semibold)
                    .accessibilityIdentifier("delete.webSubscription")
            }
            if let error = model.accountDeletionError {
                Text(error).chaarlieSystemFont(14).foregroundStyle(ChaarlieTheme.coral)
                    .chaarlieTransition(.opacity)
            }
            VStack(spacing: 10) {
                if deleting {
                    BusyLabel(text: "Konto wird gelöscht …").frame(maxWidth: .infinity, minHeight: 52)
                } else {
                    Button("Konto löschen", role: .destructive) { Task { await model.confirmAccountDeletion() } }
                        .buttonStyle(ChaarlieButton()).accessibilityIdentifier("delete.confirm")
                }
                cancelButton.disabled(deleting)
            }.padding(.top, 8)
        }.fixedSize(horizontal: false, vertical: true)
    }

    private var cancelButton: some View {
        Button("Abbrechen") { model.cancelAccountDeletion() }.buttonStyle(ChaarlieButton(outline: true))
    }
}
