import SwiftUI

/// One presentation host for camera, manual search and history. The assessment
/// itself remains the existing server-authored view.
struct ScanResultPresentation: View {
    let model: AppModel
    let result: ScanResult
    var body: some View {
        VStack(spacing: 0) {
            if model.hasUnsavedHistory {
                HistorySaveNotice(model: model).padding(.horizontal, 24).padding(.top, 16)
                    .background { GeometryReader { proxy in
                        Color.clear.preference(key: ResearchSaveNoticeHeightKey.self, value: proxy.size.height)
                    } }
            }
            if model.scanBusy || model.scanError != nil {
                VStack(alignment: .leading, spacing: 20) {
                    HStack { Spacer(); CloseButton(label: "Ergebnis schließen") { model.dismissScan() } }
                    if model.scanBusy { BusyLabel(text: "Produkt wird geprüft …") }
                    if let error = model.scanError {
                        NoticeCard(systemImage: "exclamationmark.circle", message: error) {
                            if let request = model.lastRequest {
                                Button("Erneut versuchen") { Task { await model.resolve(request, replacingPresentedResult: true) } }
                                    .buttonStyle(ChaarlieButton())
                            }
                        }
                    }
                    Spacer()
                }.padding(24)
            } else if result.kind == .submission_required, let barcode = model.lastRequest?.identifier?.value {
                ResearchSheet(model: model, barcode: barcode, identified: result.identified)
            } else {
                AssessmentSheet(result: result, onDismiss: { model.dismissScan() })
            }
        }.background(ChaarlieTheme.background)
            .chaarlieSystemFont().foregroundStyle(ChaarlieTheme.ink).tint(ChaarlieTheme.plum)
            .interactiveDismissDisabled(model.researchBusy)
    }
}

private struct ResearchSheet: View {
    let model: AppModel
    let barcode: String
    let identified: IdentifiedScanProduct?
    @State private var choosingCategory = false
    // These are the existing intake categories. Their labels carry no new
    // assessment rules or inferred classification from the scanned barcode.
    private let categories: [(String, String)] = [
        ("shampoo", "Shampoo"), ("conditioner", "Conditioner"), ("leave_in", "Leave-in"),
        ("mask", "Maske"), ("oil", "Haaröl"), ("dry_shampoo", "Trockenshampoo"),
        ("deep_cleansing_shampoo", "Tiefenreinigungsshampoo"), ("bondbuilder", "Bondbuilder"),
        ("heat_protectant", "Hitzeschutz"), ("scalp_care", "Kopfhautpflege")
    ]
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private var motionReduced: Bool {
        #if DEBUG
        if DesignReviewScenario.current != nil, ProcessInfo.processInfo.arguments.contains("--ui-reduce-motion") { return true }
        #endif
        return reduceMotion
    }
    private var suggestion: (String, String)? {
        categories.first { $0.0 == identified?.suggestedCategory }
    }
    var body: some View {
        Group {
            if model.researchPending {
                ViewThatFits(in: .vertical) {
                    confirmation.fixedSize(horizontal: false, vertical: true)
                    ScrollView { confirmation }
                }
            } else {
                ScrollView { chooser }
            }
        }
            .animation(motionReduced ? nil : ChaarlieTheme.Motion.state, value: model.researchPending)
            .task { if !model.researchChecked { await model.checkResearchStatus() } }
            .sensoryFeedback(.success, trigger: model.researchPending) { _, pending in pending }
            .sensoryFeedback(.error, trigger: model.researchError) { _, error in error != nil }
    }
    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            Label("Barcode \(barcode)", systemImage: "barcode")
                .chaarlieSystemFont(13, weight: .medium).monospacedDigit().foregroundStyle(ChaarlieTheme.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 11).padding(.vertical, 7)
                .background(ChaarlieTheme.surfaceMuted, in: Capsule())
            Spacer(minLength: 0)
            CloseButton(label: "Ergebnis schließen") { model.dismissScan() }.disabled(model.researchBusy)
        }
    }
    private var confirmation: some View {
        VStack(spacing: 0) {
            header.padding(.bottom, 16)
            Image(systemName: "checkmark").font(.system(size: 26, weight: .semibold)).foregroundStyle(ChaarlieTheme.plum)
                .symbolEffect(.bounce, options: .nonRepeating, isActive: !motionReduced)
                .frame(width: 64, height: 64).background(ChaarlieTheme.plumIce, in: Circle())
                .overlay(Circle().strokeBorder(ChaarlieTheme.plumScale)).accessibilityHidden(true)
            Text("In Prüfung").chaarlieHeading(30).padding(.top, 14)
                .accessibilityIdentifier("research.status").accessibilityAddTraits(.isHeader)
            Text("Wir melden uns, sobald das Ergebnis da ist.")
                .foregroundStyle(ChaarlieTheme.muted).padding(.top, 8)
                .fixedSize(horizontal: false, vertical: true)
            Button("Verlauf öffnen") { model.dismissScan(); model.selectedTab = .history }
                .buttonStyle(ChaarlieButton()).padding(.top, 20)
        }.multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(24)
            .background { GeometryReader { proxy in
                Color.clear.preference(key: ResearchConfirmationHeightKey.self, value: proxy.size.height)
            } }
    }
    private var chooser: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            if let identified { identityPreview(identified) }
            Text(identified != nil ? "Produkt erkannt" : "Noch nicht im Katalog").chaarlieHeading(30)
                .accessibilityIdentifier("research.status").accessibilityAddTraits(.isHeader)
            if model.researchChecking {
                BusyLabel(text: "Prüfstatus wird geladen …")
            } else if !model.researchChecked {
                NoticeCard(systemImage: "wifi.slash", message: model.researchError ?? "Prüfstatus konnte nicht geladen werden.") {
                    Button("Erneut versuchen") { Task { await model.checkResearchStatus() } }.buttonStyle(ChaarlieButton(outline: true))
                }
            } else {
                if let error = model.researchError {
                    NoticeCard(systemImage: "exclamationmark.circle", message: error) {
                        if let request = model.researchRequest {
                            Button("Erneut versuchen") { Task { await model.submitResearch(category: request.category) } }
                                .buttonStyle(ChaarlieButton()).disabled(model.researchBusy)
                        } else {
                            Button("Status erneut laden") { Task { await model.checkResearchStatus() } }.frame(minHeight: 44)
                        }
                    }
                }
                if let suggestion, !choosingCategory {
                    Text(categoryQuestion(suggestion.0, label: suggestion.1))
                        .chaarlieSystemFont(20, weight: .semibold, relativeTo: .title2)
                    Button {
                        Task { await model.submitResearch(category: suggestion.0) }
                    } label: {
                        HStack {
                            if model.researchBusy { ProgressView().tint(.white) }
                            Text("Als \(suggestion.1) einreichen")
                        }
                    }.buttonStyle(ChaarlieButton()).disabled(model.researchBusy || model.researchRequest != nil)
                        .accessibilityIdentifier("research.suggestion")
                    Button("Andere Produktart") { choosingCategory = true }
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .disabled(model.researchBusy || model.researchRequest != nil)
                } else {
                    Text("Welche Produktart?").chaarlieSystemFont(20, weight: .semibold, relativeTo: .title2)
                    categoryGrid
                }
            }
        }.padding(24)
            .background { GeometryReader { proxy in
                Color.clear.preference(key: ResearchConfirmationHeightKey.self,
                    value: suggestion != nil && !choosingCategory ? proxy.size.height : 0)
            } }
    }
    private var categoryGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: typeSize.isAccessibilitySize ? 1 : 2), spacing: 10) {
            ForEach(Array(categories.enumerated()), id: \.element.0) { index, category in
                let chosen = model.researchRequest?.category == category.0
                Button {
                    Task { await model.submitResearch(category: category.0) }
                } label: {
                    HStack(spacing: 8) {
                        Text(GermanLineBreaks.text(category.1)).chaarlieSystemFont(15, weight: .semibold)
                            .accessibilityLabel(category.1)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                        if chosen && model.researchBusy { ProgressView().tint(ChaarlieTheme.plum) }
                    }.padding(.horizontal, 16).padding(.vertical, 12)
                        .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
                        .foregroundStyle(chosen ? ChaarlieTheme.plum : ChaarlieTheme.ink)
                        .background(chosen ? ChaarlieTheme.plumIce : .white, in: RoundedRectangle(cornerRadius: ChaarlieTheme.Radius.control, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: ChaarlieTheme.Radius.control, style: .continuous)
                            .strokeBorder(chosen ? ChaarlieTheme.plum : ChaarlieTheme.border, lineWidth: chosen ? 1.5 : 1))
                        .contentShape(Rectangle())
                }.buttonStyle(ChaarliePressStyle()).disabled(model.researchBusy || model.researchRequest != nil)
                    .opacity(model.researchRequest != nil && !chosen ? 0.5 : 1)
                    .chaarlieReveal(index)
            }
        }
    }
    private func identityPreview(_ product: IdentifiedScanProduct) -> some View {
        HStack(spacing: 14) {
            if !typeSize.isAccessibilitySize {
                ProductImage(product: ScanProduct(id: barcode, name: product.productName, brand: product.brand,
                    category: "", categoryLabel: "", imageUrl: product.imageUrl, priceEur: nil, currency: nil, purchaseUrl: nil))
                    .frame(width: 72, height: 88).accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(product.productName).chaarlieSystemFont(17, weight: .semibold)
                if let brand = product.brand { Text(brand).chaarlieSystemFont(13).foregroundStyle(ChaarlieTheme.muted) }
            }.fixedSize(horizontal: false, vertical: true)
        }.accessibilityElement(children: .combine)
    }
    private func categoryQuestion(_ category: String, label: String) -> String {
        switch category {
        case "mask": "Ist das eine Maske?"
        case "scalp_care": "Ist das eine Kopfhautpflege?"
        default: "Ist das ein \(label)?"
        }
    }
}

/// iPhone sheet detents do not derive their height from presentationSizing alone.
/// Measure compact research states, including Dynamic Type and save notices.
struct ResearchConfirmationHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value += nextValue() }
}
struct ResearchSaveNoticeHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value += nextValue() }
}
