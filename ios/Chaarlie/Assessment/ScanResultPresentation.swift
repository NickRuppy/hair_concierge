import SwiftUI

/// One presentation host for camera, manual search and history. The assessment
/// itself remains the existing server-authored view.
struct ScanResultPresentation: View {
    let model: AppModel
    let result: ScanResult
    var body: some View {
        VStack(spacing: 0) {
            if model.hasUnsavedHistory { HistorySaveNotice(model: model).padding(.horizontal, 24).padding(.top, 16) }
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
                ResearchSheet(model: model, barcode: barcode)
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
    // These are the existing intake categories. Their labels carry no new
    // assessment rules or inferred classification from the scanned barcode.
    private let categories: [(String, String)] = [
        ("shampoo", "Shampoo"), ("conditioner", "Conditioner"), ("leave_in", "Leave-in"),
        ("mask", "Maske"), ("oil", "Haaröl"), ("dry_shampoo", "Trockenshampoo"),
        ("deep_cleansing_shampoo", "Tiefenreinigungsshampoo"), ("bondbuilder", "Bondbuilder"),
        ("heat_protectant", "Hitzeschutz"), ("scalp_care", "Kopfhautpflege")
    ]
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    Label("Barcode \(barcode)", systemImage: "barcode").labelStyle(.titleAndIcon)
                        .chaarlieSystemFont(13, weight: .medium).monospacedDigit().foregroundStyle(ChaarlieTheme.muted)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(ChaarlieTheme.surfaceMuted, in: Capsule())
                    Spacer()
                    CloseButton(label: "Ergebnis schließen") { model.dismissScan() }.disabled(model.researchBusy)
                }
                if model.researchPending {
                    Image(systemName: "checkmark").font(.system(size: 26, weight: .semibold)).foregroundStyle(ChaarlieTheme.plum)
                        .symbolEffect(.bounce, value: model.researchPending)
                        .frame(width: 72, height: 72).background(ChaarlieTheme.plumIce, in: Circle())
                        .overlay(Circle().strokeBorder(ChaarlieTheme.plumScale))
                        .accessibilityHidden(true).transition(.scale(scale: 0.6).combined(with: .opacity))
                }
                Text(model.researchPending ? "In Prüfung" : "Noch nicht im Katalog").chaarlieHeading(30)
                    .accessibilityIdentifier("research.status").accessibilityAddTraits(.isHeader)
                    .contentTransition(.opacity)
                if model.researchPending {
                    Text("Deine Anfrage ist eingegangen. Den aktuellen Stand findest du im Verlauf.")
                        .foregroundStyle(ChaarlieTheme.muted)
                    Button("Zum Verlauf") { model.dismissScan(); model.selectedTab = .history }.buttonStyle(ChaarlieButton())
                } else if model.researchChecking {
                    BusyLabel(text: "Prüfstatus wird geladen …")
                } else if !model.researchChecked {
                    NoticeCard(systemImage: "wifi.slash", message: model.researchError ?? "Prüfstatus konnte nicht geladen werden.") {
                        Button("Erneut versuchen") { Task { await model.checkResearchStatus() } }.buttonStyle(ChaarlieButton(outline: true))
                    }
                } else {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Welche Produktart?").chaarlieSystemFont(20, weight: .semibold, relativeTo: .title2)
                        Text("Ein Tipp reicht das Produkt zur Prüfung ein.").foregroundStyle(ChaarlieTheme.muted)
                    }
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
            }.padding(24)
                .animation(ChaarlieTheme.Motion.state, value: model.researchPending)
                .animation(ChaarlieTheme.Motion.state, value: model.researchChecking)
                .animation(ChaarlieTheme.Motion.state, value: model.researchRequest)
        }.task { await model.checkResearchStatus() }
            .sensoryFeedback(.success, trigger: model.researchPending) { _, pending in pending }
            .sensoryFeedback(.error, trigger: model.researchError) { _, error in error != nil }
    }
}
