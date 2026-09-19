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
    @State private var selectedCategoryKey: String?
    @State private var retailerMatchRejected = false
    // These are the existing intake categories. Their labels carry no new
    // assessment rules or inferred classification from the scanned barcode.
    private static let categories: [(String, String)] = [
        ("shampoo", "Shampoo"), ("conditioner", "Conditioner"), ("leave_in", "Leave-in"),
        ("mask", "Maske"), ("oil", "Haaröl"), ("dry_shampoo", "Trockenshampoo"),
        ("deep_cleansing_shampoo", "Tiefenreinigungsshampoo"), ("bondbuilder", "Bondbuilder"),
        ("heat_protectant", "Hitzeschutz"), ("scalp_care", "Kopfhautpflege")
    ]
    init(model: AppModel, barcode: String, identified: IdentifiedScanProduct?) {
        self.model = model
        self.barcode = barcode
        self.identified = identified
        let suggestion = identified?.suggestedCategory
        _selectedCategoryKey = State(initialValue: Self.categories.contains { $0.0 == suggestion } ? suggestion : nil)
    }
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private var motionReduced: Bool {
        #if DEBUG
        if DesignReviewScenario.current != nil, ProcessInfo.processInfo.arguments.contains("--ui-reduce-motion") { return true }
        #endif
        return reduceMotion
    }
    private var suggestion: (String, String)? {
        Self.categories.first { $0.0 == identified?.suggestedCategory }
    }
    private var selectedCategory: (String, String)? {
        Self.categories.first { $0.0 == selectedCategoryKey }
    }
    private var activeIdentified: IdentifiedScanProduct? {
        retailerMatchRejected ? nil : identified
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
            Text(activeIdentified != nil ? "Produkt gefunden" : "Noch nicht im Katalog").chaarlieHeading(30)
                .accessibilityIdentifier("research.status").accessibilityAddTraits(.isHeader)
            if let product = activeIdentified {
                identityPreview(product)
                Button("Nicht dein Produkt?") {
                    retailerMatchRejected = true
                    choosingCategory = true
                    selectedCategoryKey = nil
                }
                .frame(minHeight: 44)
                .accessibilityIdentifier("research.reject")
            }
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
                if activeIdentified != nil {
                    Text("Als was verwendest du das Produkt?")
                        .chaarlieSystemFont(20, weight: .semibold, relativeTo: .title2)
                } else {
                    Text("Welche Produktart?").chaarlieSystemFont(20, weight: .semibold, relativeTo: .title2)
                }
                if let suggestion, !choosingCategory, activeIdentified != nil {
                    categoryChoice(suggestion, identifier: "research.suggestion")
                    Button("Andere Kategorie") { choosingCategory = true }
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .disabled(model.researchBusy || model.researchRequest != nil)
                } else {
                    categoryGrid
                }
                if let selectedCategory {
                    Button {
                        let decision: ResearchRequest.RetailerMatchDecision? = identified == nil ? nil :
                            (retailerMatchRejected ? .rejected : .accepted)
                        Task { await model.submitResearch(category: selectedCategory.0,
                                                          retailerMatchDecision: decision) }
                    } label: {
                        HStack {
                            if model.researchBusy { ProgressView().tint(.white) }
                            Text("Zur Prüfung einreichen")
                        }
                    }
                    .buttonStyle(ChaarlieButton())
                    .disabled(model.researchBusy || model.researchRequest != nil)
                    .accessibilityIdentifier("research.submit")
                }
            }
        }.padding(24)
            .background { GeometryReader { proxy in
                Color.clear.preference(key: ResearchConfirmationHeightKey.self,
                    value: activeIdentified != nil && !choosingCategory ? proxy.size.height : 0)
            } }
    }
    private func categoryChoice(_ category: (String, String), identifier: String? = nil) -> some View {
        let chosen = selectedCategoryKey == category.0
        return Button { selectedCategoryKey = category.0 } label: {
            HStack(spacing: 10) {
                Text(category.1).chaarlieSystemFont(16, weight: .semibold)
                Spacer()
                if chosen { Image(systemName: "checkmark.circle.fill").foregroundStyle(ChaarlieTheme.plum) }
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
            .foregroundStyle(chosen ? ChaarlieTheme.plum : ChaarlieTheme.ink)
            .background(chosen ? ChaarlieTheme.plumIce : .white,
                        in: RoundedRectangle(cornerRadius: ChaarlieTheme.Radius.control, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: ChaarlieTheme.Radius.control, style: .continuous)
                .strokeBorder(chosen ? ChaarlieTheme.plum : ChaarlieTheme.border, lineWidth: chosen ? 1.5 : 1))
        }
        .buttonStyle(ChaarliePressStyle())
        .disabled(model.researchBusy || model.researchRequest != nil)
        .accessibilityLabel(chosen ? "\(category.1), ausgewählt" : category.1)
        .accessibilityIdentifier(identifier ?? "research.category.\(category.0)")
    }
    private var categoryGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: typeSize.isAccessibilitySize ? 1 : 2), spacing: 10) {
            ForEach(Array(Self.categories.enumerated()), id: \.element.0) { index, category in
                let chosen = selectedCategoryKey == category.0
                Button { selectedCategoryKey = category.0 } label: {
                    HStack(spacing: 8) {
                        Text(GermanLineBreaks.text(category.1)).chaarlieSystemFont(15, weight: .semibold)
                            .accessibilityLabel(category.1)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                        if chosen { Image(systemName: "checkmark.circle.fill").foregroundStyle(ChaarlieTheme.plum) }
                    }.padding(.horizontal, 16).padding(.vertical, 12)
                        .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
                        .foregroundStyle(chosen ? ChaarlieTheme.plum : ChaarlieTheme.ink)
                        .background(chosen ? ChaarlieTheme.plumIce : .white, in: RoundedRectangle(cornerRadius: ChaarlieTheme.Radius.control, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: ChaarlieTheme.Radius.control, style: .continuous)
                            .strokeBorder(chosen ? ChaarlieTheme.plum : ChaarlieTheme.border, lineWidth: chosen ? 1.5 : 1))
                        .contentShape(Rectangle())
                }.buttonStyle(ChaarliePressStyle()).disabled(model.researchBusy || model.researchRequest != nil)
                    .accessibilityLabel(chosen ? "\(category.1), ausgewählt" : category.1)
                    .accessibilityIdentifier("research.category.\(category.0)")
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
                Text(product.title).chaarlieSystemFont(17, weight: .semibold)
            }.fixedSize(horizontal: false, vertical: true)
        }.accessibilityElement(children: .combine)
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
