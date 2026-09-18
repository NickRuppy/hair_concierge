import SwiftUI
import CoreText

struct ProductImage: View {
    let product: ScanProduct
    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
        Group {
            if let url = ShopDestination.url(product.imageUrl, httpsOnly: true) {
                AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.25))) { phase in
                    if let image = phase.image { image.resizable().scaledToFit().padding(6).transition(.opacity) }
                    else { placeholder }
                }
            } else { placeholder }
        }.frame(maxWidth: .infinity, maxHeight: .infinity).background(Color.white).clipShape(shape)
            .accessibilityLabel("Produktbild: \(product.name)")
    }
    /// Quiet fixed-size glyph on a tinted tile; it must not grow with the frame.
    private var placeholder: some View {
        Image(systemName: "photo").font(.system(size: 17, weight: .medium)).foregroundStyle(ChaarlieTheme.plumMid.opacity(0.75))
            .frame(maxWidth: .infinity, maxHeight: .infinity).background(ChaarlieTheme.plumIce)
            .accessibilityLabel("Produktbild nicht verfügbar")
    }
}

struct AssessmentSheet: View {
    let result: ScanResult
    let onDismiss: () -> Void
    @State private var explanation: ScanRow?
    @State private var alternativesRevealed = false
    @State private var selectedAlternative: String?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.openURL) private var openURL
    private var reduceAnimations: Bool {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--ui-assessment-fixture"),
           ProcessInfo.processInfo.arguments.contains("--ui-reduce-motion") { return true }
        #endif
        return reduceMotion
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let product = result.product {
                    HStack(alignment: .top, spacing: 12) {
                        ProductImage(product: product).frame(width: 52, height: 64)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(product.name).chaarlieSystemFont(15, weight: .bold).fixedSize(horizontal: false, vertical: true)
                            Text(product.detail).chaarlieSystemFont(12).foregroundStyle(ChaarlieTheme.muted).fixedSize(horizontal: false, vertical: true)
                        }.frame(maxWidth: .infinity, alignment: .leading)
                        CloseButton(label: "Ergebnis schließen", action: onDismiss)
                    }
                } else {
                    HStack { Spacer(); CloseButton(label: "Ergebnis schließen", action: onDismiss) }
                }
                if result.kind == .assessment {
                    Text(result.verdictTitle ?? result.verdictLabel ?? "")
                        .chaarlieHeading().foregroundStyle(result.verdict == .supportive ? Color(hex: 0x805a16) : ChaarlieTheme.ink)
                        .accessibilityAddTraits(.isHeader).accessibilityIdentifier("assessment.verdict")
                    Text(result.mismatchSummary ?? AssessmentPresentation.deviation(result.rows ?? []))
                        .chaarlieSystemFont(15).fixedSize(horizontal: false, vertical: true)
                    ComparisonTable(rows: result.rows ?? [], compact: false, selected: explanation?.id) { explanation = $0 }
                    if let alternatives = result.alternatives, !alternatives.isEmpty {
                        Divider()
                        Text("Alternativen").chaarlieSystemFont(22, weight: .semibold, relativeTo: .title2).accessibilityAddTraits(.isHeader)
                        Text((result.verdict == .ideal ? "Passen auch zu deinem Haar" : "Passen gleich gut oder besser") + " · \(alternatives.count)")
                            .chaarlieSystemFont(13).foregroundStyle(ChaarlieTheme.muted)
                        ScrollView(.horizontal) {
                            LazyHStack(alignment: .top, spacing: 12) {
                                ForEach(alternatives) { alternative in
                                    AlternativeCard(alternative: alternative, revealed: alternativesRevealed || dynamicTypeSize.isAccessibilitySize,
                                                    selected: explanation?.id, explain: { explanation = $0 })
                                        .containerRelativeFrame(.horizontal) { width, _ in max(230, width - 34) }
                                        .id(alternative.id)
                                }
                            }.scrollTargetLayout()
                        }.scrollIndicators(.hidden).scrollTargetBehavior(.viewAligned)
                            .scrollPosition(id: $selectedAlternative)
                        HStack(spacing: 6) {
                            ForEach(alternatives) { alternative in
                                Capsule().fill((selectedAlternative ?? alternatives.first?.id) == alternative.id ? ChaarlieTheme.plum : ChaarlieTheme.border)
                                    .frame(width: (selectedAlternative ?? alternatives.first?.id) == alternative.id ? 16 : 6, height: 6)
                            }
                        }.frame(maxWidth: .infinity).accessibilityHidden(true)
                            .animation(reduceAnimations ? nil : ChaarlieTheme.Motion.state, value: selectedAlternative)
                    }
                } else {
                    unavailableContent
                }
            }.padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 18)
        }
        .onScrollGeometryChange(for: Bool.self) { geometry in
            geometry.contentOffset.y + geometry.contentInsets.top > 24
        } action: { _, revealed in
            if revealed { withAnimation(reduceAnimations ? nil : .easeOut(duration: 0.25)) { alternativesRevealed = true } }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let product = result.product, let url = ShopDestination.url(product.purchaseUrl) {
                Button("Kaufen ↗") { openURL(url) }.buttonStyle(ChaarlieButton(outline: true))
                    .accessibilityLabel("\(product.name) kaufen, öffnet den Shop")
                    .accessibilityIdentifier("assessment.buy")
                    .padding(16).background(.white).overlay(alignment: .top) { Divider() }
            }
        }
        .background(ChaarlieTheme.background).foregroundStyle(ChaarlieTheme.ink)
        .background {
            FloatingExplanationAnchor(row: explanation, reduceMotion: reduceAnimations,
                                      onClose: { explanation = nil })
        }
        .accessibilityAction(.escape) { if explanation != nil { explanation = nil } else { onDismiss() } }
    }
    @ViewBuilder private var unavailableContent: some View {
        if result.kind == .submission_required {
            #if DEBUG
            Text("Für dieses Produkt liegt noch keine Einschätzung vor.").chaarlieHeading()
            Text("Entwicklungsbuild: Die Produktaufnahme folgt in einem späteren Schritt.")
                .chaarlieSystemFont(13).foregroundStyle(ChaarlieTheme.muted)
            #else
            Text("Produkt derzeit nicht verfügbar.").chaarlieHeading()
            #endif
        } else {
            Text(result.headline ?? "Noch nicht einschätzbar").chaarlieHeading()
            if let subtitle = result.subtitle { Text(subtitle) }
            ForEach(result.reasons ?? [], id: \.self) { Text($0).chaarlieSystemFont() }
            ForEach(Array((result.coveredBy ?? []).enumerated()), id: \.offset) { _, coverage in
                Text([coverage.label, coverage.detail].compactMap { $0 }.joined(separator: ": "))
            }
            if let rows = result.rows, !rows.isEmpty { ComparisonTable(rows: rows, compact: false, selected: explanation?.id) { explanation = $0 } }
        }
    }
}

struct AlternativeCard: View {
    let alternative: ScanAlternative
    let revealed: Bool
    let selected: String?
    let explain: (ScanRow) -> Void
    @Environment(\.openURL) private var openURL
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ProductImage(product: alternative.product).frame(maxWidth: .infinity).frame(height: 88)
                .background(ChaarlieTheme.plumIce)
            VStack(alignment: .leading, spacing: 12) {
                Text(alternative.product.name).chaarlieSystemFont(14, weight: .bold).fixedSize(horizontal: false, vertical: true)
                if revealed {
                    Text(alternative.verdictTitle)
                        .chaarlieSystemFont(18, weight: .semibold, relativeTo: .title).foregroundStyle(alternative.verdict == .supportive ? Color(hex: 0x805a16) : ChaarlieTheme.ink)
                    Text(alternative.mismatchSummary).chaarlieSystemFont(13)
                    Text(alternative.product.detail).chaarlieSystemFont(12).foregroundStyle(ChaarlieTheme.muted)
                    ComparisonTable(rows: alternative.rows, compact: true, selected: selected, explain: explain)
                    if let url = ShopDestination.url(alternative.product.purchaseUrl) {
                        Button("Kaufen ↗") { openURL(url) }.buttonStyle(ChaarlieButton(outline: true))
                            .accessibilityLabel("\(alternative.product.name) kaufen, öffnet den Shop")
                    }
                }
            }.padding(.horizontal, 12).padding(.bottom, 14)
        }.background(.white).clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(ChaarlieTheme.border))
    }
}

struct ComparisonTable: View {
    let rows: [ScanRow]
    let compact: Bool
    let selected: String?
    let explain: (ScanRow) -> Void
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        VStack(spacing: 0) {
            if !typeSize.isAccessibilitySize {
                HStack(spacing: compact ? 6 : 8) {
                    Color.clear.frame(width: 68, height: 1)
                    Color.clear.frame(width: 16, height: 1)
                    Text("PRODUKT").frame(maxWidth: .infinity, alignment: .leading)
                    Text("DEIN ZIEL").foregroundStyle(ChaarlieTheme.plum).frame(maxWidth: .infinity, alignment: .leading)
                    if !compact { Color.clear.frame(width: 18, height: 1) }
                }.chaarlieSystemFont(12, weight: .bold).padding(.horizontal, 10).padding(.vertical, 9)
                    .background(Color(hex: 0xf6f3f0))
            }
            ForEach(rows) { row in
                Button { explain(row) } label: {
                    Group {
                        if typeSize.isAccessibilitySize {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack { status(row); Text(GermanLineBreaks.text(row.label)).chaarlieSystemFont(15, weight: .bold); Spacer(); Image(systemName: "info.circle") }
                                Text("Produkt: \(row.productValue ?? "–")").foregroundStyle(color(row))
                                Text("Dein Ziel: \(row.targetValue ?? "–")").foregroundStyle(ChaarlieTheme.plum)
                            }.frame(maxWidth: .infinity, alignment: .leading)
                        } else {
                            HStack(spacing: compact ? 6 : 8) {
                                Text(row.label.replacingOccurrences(of: "Pflegegewicht", with: "Pflege-\ngewicht").replacingOccurrences(of: "Pflegerichtung", with: "Pflege-\nrichtung"))
                                    .chaarlieSystemFont(13, weight: .semibold)
                                    .frame(width: 68, alignment: .leading)
                                status(row)
                                Text(row.productValue ?? "–").foregroundStyle(color(row)).chaarlieSystemFont(compact ? 12 : 13, weight: .bold)
                                    .frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
                                Text(row.targetValue ?? "–").foregroundStyle(ChaarlieTheme.plum).chaarlieSystemFont(compact ? 12 : 13, weight: .semibold)
                                    .frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
                                if !compact { Image(systemName: selected == row.id ? "info.circle.fill" : "info.circle").frame(width: 18).foregroundStyle(ChaarlieTheme.plum) }
                            }
                        }
                    }.padding(.horizontal, 10).padding(.vertical, 10).frame(minHeight: 52)
                        .background(background(row))
                        .overlay { if selected == row.id { Rectangle().strokeBorder(ChaarlieTheme.plum, lineWidth: 1.5) } }
                }.buttonStyle(.plain)
                    .accessibilityLabel("\(row.label), \(statusLabel(row)), Produkt: \(row.productValue ?? "nicht verfügbar"), dein Ziel: \(row.targetValue ?? "nicht verfügbar")")
                    .accessibilityHint("Öffnet die Erklärung")
                    .accessibilityIdentifier("comparison.\(row.id)")
                if row.id != rows.last?.id { Divider() }
            }
        }.clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(ChaarlieTheme.border))
    }
    private func status(_ row: ScanRow) -> some View {
        Text(row.displayStatus == .green ? "✓" : row.displayStatus == .amber ? "!" : row.displayStatus == .red ? "×" : "–")
            .font(.system(size: 12, weight: .bold)).foregroundStyle(.white).frame(width: 16, height: 16)
            .background(color(row)).clipShape(Circle()).accessibilityHidden(true)
    }
    private func color(_ row: ScanRow) -> Color {
        switch row.displayStatus {
        case .green: Color(hex: 0x356b45)
        case .amber: Color(hex: 0x805a16)
        case .red: Color(hex: 0x9a3f48)
        case .neutral: ChaarlieTheme.muted
        }
    }
    private func background(_ row: ScanRow) -> Color {
        switch row.displayStatus {
        case .green: Color(hex: 0xedf7ef)
        case .amber: Color(hex: 0xfff5df)
        case .red: Color(hex: 0xfff0f1)
        case .neutral: Color(hex: 0xf6f3f0)
        }
    }
    private func statusLabel(_ row: ScanRow) -> String {
        switch row.displayStatus {
        case .green: "passt"
        case .amber: "mit Einschränkung"
        case .red: "passt nicht"
        case .neutral: "nicht einschätzbar"
        }
    }
}

struct ExplanationOverlay: View {
    let row: ScanRow
    let onClose: () -> Void
    @AccessibilityFocusState private var focused: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(GermanLineBreaks.text(row.label))
                .accessibilityLabel(row.label)
                .chaarlieHeading(22)
                .modifier(GlossaryLineHeight(size: 22, multiple: 1.2, font: ChaarlieTheme.headingFont(22), relativeTo: .title))
                .foregroundStyle(ChaarlieTheme.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.trailing, 40)
                .accessibilityAddTraits(.isHeader)
                .accessibilityFocused($focused)
                .accessibilityIdentifier("explanation.title")
            ViewThatFits(in: .vertical) {
                details.fixedSize(horizontal: false, vertical: true)
                ScrollView { details }
                    .accessibilityIdentifier("explanation.body")
            }
        }
        .padding(20)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(alignment: .topTrailing) {
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ChaarlieTheme.ink)
                    .frame(width: 30, height: 30)
                    .background(Color(hex: 0xefebe6), in: Circle())
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Erklärung schließen")
            .padding(7) // The 30-point circle is 14 points from the card edges.
        }
        .shadow(color: Color(hex: 0x140c08).opacity(0.24), radius: 36, y: 14)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("explanation.panel")
        .accessibilityAddTraits(.isModal)
        .accessibilityAction(.escape, onClose)
        .onAppear { focused = true }
    }
    private var details: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(row.definition)
                .chaarlieSystemFont(15)
                .modifier(GlossaryLineHeight(size: 15, multiple: 1.45))
                .foregroundStyle(ChaarlieTheme.ink)
                .fixedSize(horizontal: false, vertical: true)
            GlossaryList(row: row)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Measures complete rows, including their vertical padding, before placing any row.
/// The rail and separators use the same geometry as the native Layout.
struct GlossaryGeometry {
    let count: Int
    let rowHeight: CGFloat
    init(naturalHeights: [CGFloat]) {
        count = naturalHeights.count
        rowHeight = max(48, naturalHeights.max() ?? 0)
    }
    var height: CGFloat { count == 0 ? 0 : CGFloat(count) * rowHeight + CGFloat(count - 1) }
    func rowOrigin(_ index: Int) -> CGFloat { CGFloat(index) * (rowHeight + 1) }
    var firstCenter: CGFloat { rowHeight / 2 }
    var lastCenter: CGFloat { height - rowHeight / 2 }
}

struct EqualHeightGlossaryLayout: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
        let geometry = geometry(width: width, subviews: subviews)
        return CGSize(width: width, height: geometry.height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let geometry = geometry(width: bounds.width, subviews: subviews)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX, y: bounds.minY + geometry.rowOrigin(index)),
                          anchor: .topLeading,
                          proposal: ProposedViewSize(width: bounds.width, height: geometry.rowHeight))
        }
    }
    private func geometry(width: CGFloat, subviews: Subviews) -> GlossaryGeometry {
        GlossaryGeometry(naturalHeights: subviews.map {
            $0.sizeThatFits(ProposedViewSize(width: width, height: nil)).height
        })
    }
}

private struct GlossaryList: View {
    let row: ScanRow
    @Environment(\.dynamicTypeSize) private var typeSize
    private var labelWidth: CGFloat {
        row.dimensionId == "shampoo.scalp_route" ? 118 : row.stops.count == 2 ? 64 : 92
    }
    var body: some View {
        EqualHeightGlossaryLayout {
            ForEach(Array(row.stops.enumerated()), id: \.element.id) { index, stop in
                HStack(spacing: 10) {
                    Circle()
                        .fill(dotColor(index))
                        .overlay {
                            if row.axisKind != .ordered {
                                Circle().strokeBorder(ChaarlieTheme.plumMid, lineWidth: 1.5)
                            }
                        }
                        .frame(width: 12, height: 12)
                        .frame(width: 14)
                        .accessibilityHidden(true)
                    if typeSize.isAccessibilitySize {
                        VStack(alignment: .leading, spacing: 6) {
                            label(stop)
                            meaning(stop)
                        }.frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        label(stop).frame(width: labelWidth, alignment: .leading)
                        meaning(stop).frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.vertical, 6)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(stop.label): \(stop.displayMeaning)")
                .accessibilityIdentifier("glossary.row.\(stop.id)")
            }
        }
        .background {
            GlossaryRail(count: row.stops.count, ordered: row.axisKind == .ordered)
                .accessibilityHidden(true)
        }
        .overlay {
            GlossarySeparators(count: row.stops.count)
                .stroke(Color(hex: 0xf6f3f0), lineWidth: 1)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }
    private func label(_ stop: ScanRow.Stop) -> some View {
        Text(GermanLineBreaks.text(stop.label)).chaarlieSystemFont(15, weight: .semibold)
            .modifier(GlossaryLineHeight(size: 15, multiple: 1.35))
            .foregroundStyle(ChaarlieTheme.ink)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("glossary.label.\(stop.id)")
    }
    private func meaning(_ stop: ScanRow.Stop) -> some View {
        Text(stop.displayMeaning).chaarlieSystemFont(13)
            .modifier(GlossaryLineHeight(size: 13, multiple: 1.45))
            .foregroundStyle(ChaarlieTheme.muted)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("glossary.meaning.\(stop.id)")
    }
    private func dotColor(_ index: Int) -> Color {
        guard row.axisKind == .ordered else { return ChaarlieTheme.plumScale }
        if row.stops.count == 3 && index == 1 { return ChaarlieTheme.plumMid }
        let fraction = row.stops.count > 1 ? Double(index) / Double(row.stops.count - 1) : 0
        return Color(.sRGB, red: (231 + (107 - 231) * fraction) / 255,
                     green: (223 + (80 - 223) * fraction) / 255,
                     blue: (245 + (160 - 245) * fraction) / 255, opacity: 1)
    }
}

private struct GlossaryLineHeight: ViewModifier {
    @ScaledMetric(relativeTo: .body) private var spacing: CGFloat = 0
    init(size: CGFloat, multiple: CGFloat, font: CTFont? = nil, relativeTo: Font.TextStyle = .body) {
        let nativeHeight = font.map { CTFontGetAscent($0) + CTFontGetDescent($0) + CTFontGetLeading($0) } ?? UIFont.systemFont(ofSize: size).lineHeight
        _spacing = ScaledMetric(wrappedValue: max(0, size * multiple - nativeHeight), relativeTo: relativeTo)
    }
    func body(content: Content) -> some View { content.lineSpacing(spacing) }
}

private struct GlossaryRail: View {
    let count: Int
    let ordered: Bool
    var body: some View {
        Canvas { context, size in
            guard count > 1 else { return }
            let rowHeight = (size.height - CGFloat(count - 1)) / CGFloat(count)
            let start = CGPoint(x: 7, y: rowHeight / 2)
            let end = CGPoint(x: 7, y: size.height - rowHeight / 2)
            let path = Path { path in
                path.move(to: start)
                path.addLine(to: end)
            }
            context.stroke(path, with: ordered
                           ? .linearGradient(Gradient(colors: [ChaarlieTheme.plumScale, ChaarlieTheme.plum]), startPoint: start, endPoint: end)
                           : .color(ChaarlieTheme.plumScale), lineWidth: 2)
        }
    }
}
private struct GlossarySeparators: Shape {
    let count: Int
    func path(in rect: CGRect) -> Path {
        guard count > 1 else { return Path() }
        let rowHeight = (rect.height - CGFloat(count - 1)) / CGFloat(count)
        return Path { path in
            for index in 1..<count {
                let y = CGFloat(index) * (rowHeight + 1) - 0.5
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: rect.width, y: y))
            }
        }
    }
}

/// A system sheet clips its own overlay at the rounded top edge. This native presenter
/// puts the card in the same app window, above the sheet, with an explicit close backdrop.
/// It never opens another window or changes account/navigation state.
private struct FloatingExplanationAnchor: UIViewControllerRepresentable {
    let row: ScanRow?
    let reduceMotion: Bool
    let onClose: () -> Void
    func makeUIViewController(context: Context) -> Controller { Controller() }
    func updateUIViewController(_ controller: Controller, context: Context) {
        controller.update(row: row, reduceMotion: reduceMotion, onClose: onClose)
    }
    static func dismantleUIViewController(_ controller: Controller, coordinator: ()) { controller.removeCard() }

    @MainActor final class Controller: UIViewController {
        private var row: ScanRow?
        private var reduceMotion = false
        private var closing = false
        private var onClose: () -> Void = {}
        private var backdrop: UIControl?
        private var card: UIHostingController<ExplanationOverlay>?
        override func loadView() { view = UIView(); view.isUserInteractionEnabled = false }
        override func viewDidAppear(_ animated: Bool) { super.viewDidAppear(animated); layoutCard() }
        override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); layoutCard() }
        override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); removeCard() }
        func update(row: ScanRow?, reduceMotion: Bool, onClose: @escaping () -> Void) {
            self.row = row
            self.reduceMotion = reduceMotion
            self.onClose = onClose
            if row == nil { removeCard(animated: true) } else { layoutCard() }
        }
        func layoutCard() {
            guard let row, let window = view.window else { return }
            let safe = window.bounds.inset(by: window.safeAreaInsets).insetBy(dx: 16, dy: 24)
            let limit = max(1, safe.height)
            let width = min(480, max(1, safe.width))
            let content = ExplanationOverlay(row: row, onClose: onClose)
            let shouldFadeIn = backdrop == nil || closing
            closing = false
            if backdrop == nil {
                let background = UIControl(frame: window.bounds)
                background.backgroundColor = UIColor.black.withAlphaComponent(0.32)
                background.alpha = 0
                background.accessibilityViewIsModal = true
                background.addAction(UIAction { [weak self] _ in self?.onClose() }, for: .touchUpInside)
                let host = UIHostingController(rootView: content)
                host.view.backgroundColor = .clear
                host.overrideUserInterfaceStyle = .light
                // This view is a direct window overlay, not a child of the sheet controller.
                // UIKit requires the hosting controller to remain parentless in this hierarchy.
                host.beginAppearanceTransition(true, animated: false)
                background.addSubview(host.view)
                window.addSubview(background)
                host.endAppearanceTransition()
                backdrop = background
                card = host
            } else { card?.rootView = content }
            guard let card, let backdrop else { return }
            backdrop.frame = window.bounds
            let size = card.sizeThatFits(in: CGSize(width: width, height: limit))
            let height = min(limit, size.height)
            card.view.frame = CGRect(x: safe.midX - width / 2, y: safe.midY - height / 2, width: width, height: height)
            if shouldFadeIn {
                UIView.animate(withDuration: reduceMotion ? 0 : 0.18, delay: 0,
                               options: [.beginFromCurrentState, .curveEaseInOut, .allowUserInteraction]) {
                    backdrop.alpha = 1
                }
            }
        }
        func removeCard(animated: Bool = false) {
            if animated, let backdrop, !reduceMotion {
                guard !closing else { return }
                closing = true
                UIView.animate(withDuration: 0.18, delay: 0,
                               options: [.beginFromCurrentState, .curveEaseInOut, .allowUserInteraction]) {
                    backdrop.alpha = 0
                } completion: { [weak self, weak backdrop] _ in
                    guard let self, self.row == nil, self.backdrop === backdrop else { return }
                    self.removeCard()
                }
                return
            }
            closing = false
            backdrop?.layer.removeAllAnimations()
            card?.beginAppearanceTransition(false, animated: false)
            card?.view.removeFromSuperview()
            card?.endAppearanceTransition()
            card = nil
            backdrop?.removeFromSuperview()
            backdrop = nil
        }
    }
}
