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
                    if model.scanBusy { ProgressView("Produkt wird geprüft …") }
                    if let error = model.scanError {
                        Text(error)
                        if let request = model.lastRequest {
                            Button("Erneut versuchen") { Task { await model.resolve(request, replacingPresentedResult: true) } }
                                .buttonStyle(ChaarlieButton())
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
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    Text("Barcode \(barcode)").chaarlieSystemFont(13).foregroundStyle(ChaarlieTheme.muted)
                    Spacer()
                    CloseButton(label: "Ergebnis schließen") { model.dismissScan() }.disabled(model.researchBusy)
                }
                Text(model.researchPending ? "In Prüfung" : "Noch nicht im Katalog").chaarlieHeading(30)
                    .accessibilityIdentifier("research.status")
                if model.researchPending {
                    Text("Deine Anfrage ist eingegangen. Den aktuellen Stand findest du im Verlauf.")
                    Button("Zum Verlauf") { model.dismissScan(); model.selectedTab = .history }.buttonStyle(ChaarlieButton())
                } else if model.researchChecking {
                    ProgressView("Prüfstatus wird geladen …")
                } else if !model.researchChecked {
                    Text(model.researchError ?? "Prüfstatus konnte nicht geladen werden.")
                    Button("Erneut versuchen") { Task { await model.checkResearchStatus() } }.buttonStyle(ChaarlieButton(outline: true))
                } else {
                    Text("Welche Produktart?").chaarlieSystemFont(22, weight: .semibold, relativeTo: .title2)
                    Text("Ein Tipp reicht das Produkt zur Prüfung ein.").foregroundStyle(ChaarlieTheme.muted)
                    if model.researchBusy { ProgressView("Produkt wird eingereicht …") }
                    if let error = model.researchError {
                        Text(error).foregroundStyle(ChaarlieTheme.coral)
                        if let request = model.researchRequest {
                            Button("Erneut versuchen") { Task { await model.submitResearch(category: request.category) } }
                                .buttonStyle(ChaarlieButton()).disabled(model.researchBusy)
                        } else {
                            Button("Status erneut laden") { Task { await model.checkResearchStatus() } }.frame(minHeight: 44)
                        }
                    }
                    ForEach(categories, id: \.0) { category in
                        Button {
                            Task { await model.submitResearch(category: category.0) }
                        } label: {
                            HStack {
                                Text(category.1).fixedSize(horizontal: false, vertical: true)
                                Spacer()
                                Image(systemName: "chevron.right").accessibilityHidden(true)
                            }.padding(16).frame(minHeight: 44).background(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }.buttonStyle(.plain).disabled(model.researchBusy || model.researchRequest != nil)
                    }
                }
            }.padding(24)
        }.task { await model.checkResearchStatus() }
    }
}
