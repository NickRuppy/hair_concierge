import SwiftUI

struct HistoryView: View {
    @Bindable var model: AppModel
    @State private var confirmClear = false
    @Environment(\.scenePhase) private var scenePhase
    private var showsEmptyState: Bool {
        model.historyLoaded && model.historyEntries.isEmpty && model.historyError == nil && !model.historyBusy
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(spacing: 12) {
                        Text("Verlauf").chaarlieHeading(30).accessibilityAddTraits(.isHeader)
                        if model.historyBusy, !model.historyEntries.isEmpty {
                            ProgressView().tint(ChaarlieTheme.plum).transition(.opacity)
                                .accessibilityLabel("Verlauf wird geladen …")
                        }
                        Spacer()
                        if !model.historyEntries.isEmpty || model.hasUnsavedHistory {
                            Menu {
                                Button("Verlauf löschen", systemImage: "trash", role: .destructive) { confirmClear = true }
                            } label: {
                                Image(systemName: "ellipsis").font(.system(size: 15, weight: .bold))
                                    .frame(width: 34, height: 34).background(.white, in: Circle())
                                    .overlay(Circle().strokeBorder(ChaarlieTheme.border))
                                    .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
                            }.accessibilityLabel("Verlauf verwalten")
                                .disabled(model.historyClearing || model.historySaveBusy)
                        }
                    }
                    HistorySaveNotice(model: model)
                    ResolveFeedback(model: model, origin: .history)
                    if model.historyBusy, model.historyEntries.isEmpty {
                        SkeletonProductRows(label: "Verlauf wird geladen …", count: 4).transition(.opacity)
                    }
                    if model.historyClearing { BusyLabel(text: "Verlauf wird gelöscht …").transition(.opacity) }
                    if let error = model.historyError {
                        NoticeCard(systemImage: "wifi.slash", message: error) {
                            Button("Erneut versuchen") { Task { await model.loadHistory() } }.buttonStyle(ChaarlieButton(outline: true))
                        }.transition(.opacity)
                    }
                    if showsEmptyState {
                        EmptyStateView(systemImage: "clock.arrow.circlepath", title: "Noch keine Produkte",
                                       message: "Gescannte und geöffnete Produkte erscheinen hier.") {
                            VStack(spacing: 10) {
                                Button("Produkt scannen") { model.selectedTab = .scan }.buttonStyle(ChaarlieButton())
                                Button("Produkt suchen") { model.selectedTab = .search }.buttonStyle(ChaarlieButton(outline: true))
                            }.padding(.top, 18)
                        }.transition(.opacity)
                    }
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(HistorySection.group(model.historyEntries)) { section in
                            Text(section.title).chaarlieSystemFont(13, weight: .semibold)
                                .foregroundStyle(ChaarlieTheme.muted).accessibilityAddTraits(.isHeader)
                                .padding(.top, section.id == 0 ? 0 : 10)
                            ForEach(section.entries) { entry in
                                Group {
                                    if let request = entry.request, entry.status != .unavailable {
                                        Button { Task { await model.resolve(request) } } label: { HistoryRow(entry: entry, day: section.day) }
                                            .buttonStyle(ChaarliePressStyle()).disabled(model.historyClearing)
                                    } else { HistoryRow(entry: entry, day: section.day) }
                                }.chaarlieReveal(section.offset + (section.entries.firstIndex { $0.id == entry.id } ?? 0))
                                    .transition(.opacity)
                            }
                        }
                    }.opacity(model.historyClearing ? 0.45 : 1)
                    if model.historyNextCursor != nil {
                        Button("Weitere laden") { Task { await model.loadHistory(more: true) } }
                            .buttonStyle(ChaarlieButton(outline: true)).disabled(model.historyBusy)
                    }
                }.padding(24)
                    .animation(ChaarlieTheme.Motion.state, value: model.historyBusy)
                    .animation(ChaarlieTheme.Motion.state, value: model.historyClearing)
                    .animation(ChaarlieTheme.Motion.state, value: model.historyError)
                    .animation(ChaarlieTheme.Motion.state, value: showsEmptyState)
                    .animation(ChaarlieTheme.Motion.state, value: model.historyEntries.map(\.id))
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

/// Presentation-only day buckets; order stays the server's newest-first order.
private struct HistorySection: Identifiable {
    enum Day { case today, yesterday, earlier }
    let id: Int
    let day: Day
    let offset: Int
    let entries: [HistoryEntry]
    var title: String {
        switch day {
        case .today: "Heute"
        case .yesterday: "Gestern"
        case .earlier: "Früher"
        }
    }
    static func group(_ entries: [HistoryEntry], calendar: Calendar = .current) -> [Self] {
        var sections: [Self] = []
        var offset = 0
        for day in [Day.today, .yesterday, .earlier] {
            let matching = entries.filter { entry in
                guard let date = entry.date else { return day == .earlier }
                if calendar.isDateInToday(date) { return day == .today }
                if calendar.isDateInYesterday(date) { return day == .yesterday }
                return day == .earlier
            }
            guard !matching.isEmpty else { continue }
            sections.append(.init(id: sections.count, day: day, offset: offset, entries: matching))
            offset += matching.count
        }
        return sections
    }
}

private struct HistoryRow: View {
    let entry: HistoryEntry
    let day: HistorySection.Day
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            if !typeSize.isAccessibilitySize { thumbnail.frame(width: 52, height: 64) }
            VStack(alignment: .leading, spacing: 5) {
                Text(entry.productName == nil ? entry.title : GermanLineBreaks.text(entry.title))
                    .chaarlieSystemFont(15, weight: .bold).monospacedDigit()
                    .accessibilityLabel(entry.title)
                if let brand = entry.brand { Text(brand).chaarlieSystemFont(12).foregroundStyle(ChaarlieTheme.muted) }
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 8) { status; time }
                    VStack(alignment: .leading, spacing: 6) { status; time }
                }.padding(.top, 3)
            }.frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            if entry.status != .unavailable {
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold))
                    .foregroundStyle(ChaarlieTheme.plumMid).accessibilityHidden(true)
            }
        }.multilineTextAlignment(.leading).padding(14).chaarlieCard().contentShape(Rectangle())
            .opacity(entry.status == .unavailable ? 0.62 : 1)
            .accessibilityElement(children: .combine)
            .accessibilityHint(entry.status == .available ? "Öffnet die aktuelle Einschätzung" : "")
    }
    @ViewBuilder private var thumbnail: some View {
        if entry.productName == nil, entry.barcodeGtin != nil {
            Image(systemName: "barcode").font(.system(size: 20, weight: .medium)).foregroundStyle(ChaarlieTheme.plumMid)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(ChaarlieTheme.plumIce, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .accessibilityHidden(true)
        } else {
            ProductImage(product: ScanProduct(id: entry.id, name: entry.title, brand: entry.brand,
                category: "", categoryLabel: "", imageUrl: entry.imageUrl, priceEur: nil, currency: nil, purchaseUrl: nil))
        }
    }
    @ViewBuilder private var status: some View {
        switch entry.status {
        case .available: EmptyView()
        case .not_in_catalog: StatusPill(text: entry.statusLabel, systemImage: "questionmark")
        case .in_research: StatusPill(text: entry.statusLabel, systemImage: "hourglass", tone: .accent)
        case .unavailable: StatusPill(text: entry.statusLabel, systemImage: "slash.circle")
        }
    }
    @ViewBuilder private var time: some View {
        if let date = entry.date {
            Group {
                if day == .earlier { Text(date, format: .dateTime.day().month(.abbreviated)) }
                else { Text(date, format: .dateTime.hour().minute()) }
            }.chaarlieSystemFont(12).foregroundStyle(ChaarlieTheme.muted)
        }
    }
}

struct ResolveFeedback: View {
    let model: AppModel
    let origin: AppModel.Tab
    var body: some View {
        if model.resolveOrigin == origin {
            if model.scanBusy { BusyLabel(text: "Produkt wird geprüft …").transition(.opacity) }
            if let error = model.scanError {
                NoticeCard(systemImage: "exclamationmark.circle", message: error) {
                    if let request = model.lastRequest {
                        Button("Erneut versuchen") { Task { await model.resolve(request) } }.buttonStyle(ChaarlieButton(outline: true))
                    }
                    Button("Schließen") { model.dismissScan() }.frame(maxWidth: .infinity, minHeight: 44)
                }.transition(.opacity)
            }
        }
    }
}

struct HistorySaveNotice: View {
    let model: AppModel
    var body: some View {
        if model.hasUnsavedHistory {
            HStack(spacing: 12) {
                Image(systemName: "arrow.triangle.2.circlepath").font(.system(size: 15, weight: .semibold)).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Noch nicht im Verlauf gespeichert.").chaarlieSystemFont(14, weight: .medium)
                    Button("Erneut speichern") { Task { await model.retryHistorySaving() } }
                        .chaarlieSystemFont(14, weight: .bold).disabled(model.historySaveBusy).frame(minHeight: 44)
                }
                Spacer(minLength: 0)
                if model.historySaveBusy { ProgressView().tint(ChaarlieTheme.plum) }
            }.padding(.horizontal, 14).padding(.top, 10).padding(.bottom, 2)
                .foregroundStyle(ChaarlieTheme.plum)
                .background(ChaarlieTheme.plumIce, in: RoundedRectangle(cornerRadius: ChaarlieTheme.Radius.control, style: .continuous))
        }
    }
}
