import SwiftUI

struct HistoryView: View {
    @Bindable var model: AppModel
    @State private var confirmClear = false
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack {
                        Text("Verlauf").chaarlieHeading(30)
                        Spacer()
                        if !model.historyEntries.isEmpty || model.hasUnsavedHistory {
                            Menu {
                                Button("Verlauf löschen", role: .destructive) { confirmClear = true }
                            } label: {
                                Image(systemName: "ellipsis").frame(minWidth: 44, minHeight: 44)
                            }.accessibilityLabel("Verlauf verwalten")
                                .disabled(model.historyClearing || model.historySaveBusy)
                        }
                    }
                    HistorySaveNotice(model: model)
                    ResolveFeedback(model: model, origin: .history)
                    if model.historyBusy { ProgressView("Verlauf wird geladen …") }
                    if model.historyClearing { ProgressView("Verlauf wird gelöscht …") }
                    if let error = model.historyError {
                        Text(error).foregroundStyle(ChaarlieTheme.coral)
                        Button("Erneut versuchen") { Task { await model.loadHistory() } }.buttonStyle(ChaarlieButton(outline: true))
                    }
                    if model.historyLoaded, model.historyEntries.isEmpty, model.historyError == nil, !model.historyBusy {
                        ContentUnavailableView {
                            Label("Noch keine Produkte", systemImage: "clock.arrow.circlepath")
                        } description: {
                            Text("Gescannte und geöffnete Produkte erscheinen hier.")
                        } actions: {
                            Button("Produkt scannen") { model.selectedTab = .scan }.buttonStyle(ChaarlieButton())
                            Button("Produkt suchen") { model.selectedTab = .search }.buttonStyle(ChaarlieButton(outline: true))
                        }
                    }
                    LazyVStack(spacing: 12) {
                        ForEach(model.historyEntries) { entry in
                            if let request = entry.request, entry.status != .unavailable {
                                Button { Task { await model.resolve(request) } } label: { HistoryRow(entry: entry) }
                                    .buttonStyle(.plain).disabled(model.historyClearing)
                            } else { HistoryRow(entry: entry) }
                        }
                    }
                    if model.historyNextCursor != nil {
                        Button("Weitere laden") { Task { await model.loadHistory(more: true) } }
                            .buttonStyle(ChaarlieButton(outline: true)).disabled(model.historyBusy)
                    }
                }.padding(24)
            }.background(ChaarlieTheme.background)
                .chaarlieStatusBarBackground()
                .refreshable { await model.loadHistory() }
                .task(id: model.selectedTab) {
                    if model.selectedTab == .history { await model.loadHistory() }
                }
                .onChange(of: model.scanResult?.id) { _, resultID in
                    if resultID == nil, model.selectedTab == .history { Task { await model.loadHistory() } }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active, model.selectedTab == .history { Task { await model.loadHistory() } }
                }
                .confirmationDialog("Verlauf löschen?", isPresented: $confirmClear, titleVisibility: .visible) {
                    Button("Verlauf löschen", role: .destructive) { Task { await model.clearHistory() } }
                    Button("Abbrechen", role: .cancel) { }
                } message: { Text("Alle Einträge werden entfernt. Eingereichte Produkte bleiben in Prüfung.") }
        }
    }
}

private struct HistoryRow: View {
    let entry: HistoryEntry
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            if !typeSize.isAccessibilitySize {
                ProductImage(product: ScanProduct(id: entry.id, name: entry.title, brand: entry.brand,
                    category: "", categoryLabel: "", imageUrl: entry.imageUrl, priceEur: nil, currency: nil, purchaseUrl: nil))
                    .frame(width: 52, height: 64)
            }
            VStack(alignment: .leading, spacing: 5) {
                Text(entry.title).chaarlieSystemFont(15, weight: .bold)
                if let brand = entry.brand { Text(brand).chaarlieSystemFont(12).foregroundStyle(ChaarlieTheme.muted) }
                Text(entry.statusLabel).chaarlieSystemFont(12).foregroundStyle(entry.status == .in_research ? ChaarlieTheme.plum : ChaarlieTheme.muted)
                if let date = entry.date {
                    Text(date, format: .dateTime.day().month(.abbreviated).hour().minute())
                        .chaarlieSystemFont(12).foregroundStyle(ChaarlieTheme.muted)
                }
            }.frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            if entry.status != .unavailable { Image(systemName: "chevron.right").accessibilityHidden(true) }
        }.multilineTextAlignment(.leading).padding(14).background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .accessibilityElement(children: .combine)
    }
}

struct ResolveFeedback: View {
    let model: AppModel
    let origin: AppModel.Tab
    var body: some View {
        if model.resolveOrigin == origin {
            if model.scanBusy { ProgressView("Produkt wird geprüft …") }
            if let error = model.scanError {
                Text(error).foregroundStyle(ChaarlieTheme.coral)
                if let request = model.lastRequest {
                    Button("Erneut versuchen") { Task { await model.resolve(request) } }.buttonStyle(ChaarlieButton(outline: true))
                }
                Button("Schließen") { model.dismissScan() }.frame(minHeight: 44)
            }
        }
    }
}

struct HistorySaveNotice: View {
    let model: AppModel
    var body: some View {
        if model.hasUnsavedHistory {
            VStack(alignment: .leading, spacing: 8) {
                Text("Noch nicht im Verlauf gespeichert.").chaarlieSystemFont(14)
                Button("Erneut speichern") { Task { await model.retryHistorySaving() } }
                    .disabled(model.historySaveBusy).frame(minHeight: 44)
                if model.historySaveBusy { ProgressView() }
            }.foregroundStyle(ChaarlieTheme.plum)
        }
    }
}
