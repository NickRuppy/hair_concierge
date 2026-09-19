import SwiftUI

struct ScannerView: View {
    @Bindable var model: AppModel
    @State private var camera = CameraController()
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL
    private var fixtureBackdrop: Color? {
        #if DEBUG
        if DesignReviewScenario.current == .scan { return Color(hex: 0x17141b) }
        if DesignReviewScenario.current == .scanBright { return Color(hex: 0xc5c0b4) }
        #endif
        return nil
    }
    private var cameraActive: Bool {
        fixtureBackdrop == nil && model.selectedTab == .scan && model.admission == .ready && scenePhase == .active && model.scanResult == nil
    }
    private var detectionActive: Bool { cameraActive && model.scanResult == nil && !model.scanBusy && (model.scanError == nil || model.resolveOrigin != .scan) }
    var body: some View {
        ZStack {
            Color(hex: 0x17141b).ignoresSafeArea()
            if let fixtureBackdrop { fixtureBackdrop.ignoresSafeArea() }
            if camera.availability == .available { CameraPreview(session: camera.worker.session).ignoresSafeArea().accessibilityHidden(true) }
            VStack {
                LinearGradient(colors: [.black.opacity(0.6), .black.opacity(0.35), .clear], startPoint: .top, endPoint: .bottom)
                    .frame(height: 220)
                Spacer()
            }.ignoresSafeArea().allowsHitTesting(false).accessibilityHidden(true)
            GeometryReader { geometry in
                ScrollView {
                    scannerContent
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: max(0, geometry.size.height - 48))
                        .padding(24)
                }.scrollBounceBehavior(.basedOnSize).scrollClipDisabled()
                    .accessibilityIdentifier("scanner.content")
            }
        }
        .task { if fixtureBackdrop == nil { await camera.permission(); updateCamera() } }
        .onChange(of: cameraActive) { _, _ in updateCamera() }
        .onChange(of: detectionActive) { _, _ in updateCamera() }
        .onChange(of: camera.availability) { _, _ in updateCamera() }
        .onChange(of: scenePhase) { _, new in
            if new == .active { Task { await camera.permission(); updateCamera() } }
            else { camera.stop() }
        }
        .onDisappear { camera.stop() }
    }
    private var scanResolving: Bool { model.scanBusy && model.resolveOrigin == .scan }
    private var scannerContent: some View {
        VStack(spacing: 24) {
            Text("Produkt scannen").chaarlieHeading(28).padding(.top, 16)
                .shadow(color: .black.opacity(0.35), radius: 8, y: 1)
                .zIndex(1) // stays above the viewfinder's dimmed surround
            Spacer()
            if camera.availability == .available || fixtureBackdrop != nil {
                ScanReticle(resolving: scanResolving)
                    .frame(maxWidth: 260).frame(height: 170).accessibilityHidden(true)
                Group {
                    if scanResolving { BusyLabel(text: "Produkt wird geprüft …", onDark: true) }
                    else {
                        Label("Halte den Barcode in den Rahmen.", systemImage: "barcode")
                            .chaarlieSystemFont(14, weight: .medium).multilineTextAlignment(.center)
                            .padding(.horizontal, 16).padding(.vertical, 11)
                            .background { Capsule().fill(.ultraThinMaterial).environment(\.colorScheme, .dark) }
                    }
                }.chaarlieTransition(.opacity.combined(with: .scale(scale: 0.94)))
            } else {
                Image(systemName: "barcode.viewfinder").font(.system(size: 38, weight: .light))
                    .frame(width: 96, height: 96)
                    .background { Circle().fill(.ultraThinMaterial).environment(\.colorScheme, .dark) }
                    .overlay(Circle().strokeBorder(.white.opacity(0.16)))
                    .accessibilityHidden(true)
                Text(camera.availability == .denied ? "Kamera nicht freigegeben" : "Produkt per Suche finden")
                    .chaarlieHeading(24, relativeTo: .title2)
                Text(camera.availability == .denied ? "Du kannst Produkte weiterhin manuell suchen oder den Barcode eingeben." : "Die Kamera ist hier nicht verfügbar. Suche nach Produktname, Marke oder Barcode.")
                    .multilineTextAlignment(.center).foregroundStyle(.white.opacity(0.78))
                if camera.availability == .denied {
                    Button("Einstellungen öffnen") {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    }.buttonStyle(ChaarlieButton(outline: true))
                }
                if scanResolving { BusyLabel(text: "Produkt wird geprüft …", onDark: true) }
            }
            Spacer()
            if let error = model.scanError, model.resolveOrigin == .scan {
                VStack(spacing: 14) {
                    Text(error).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                    if let request = model.lastRequest {
                        Button("Erneut versuchen") { Task { await model.resolve(request) } }.buttonStyle(ChaarlieButton())
                    }
                    Button("Schließen") { model.dismissScan() }.frame(minHeight: 44)
                }.padding(18)
                    .background { RoundedRectangle(cornerRadius: 24, style: .continuous).fill(.ultraThinMaterial).environment(\.colorScheme, .dark) }
                    .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(.white.opacity(0.14)))
                    .chaarlieTransition(.move(edge: .bottom).combined(with: .opacity))
            }
        }.foregroundStyle(.white).multilineTextAlignment(.center)
            .animation(ChaarlieTheme.Motion.state, value: scanResolving)
            .animation(ChaarlieTheme.Motion.state, value: model.scanError)
            .sensoryFeedback(.impact(weight: .medium), trigger: scanResolving) { _, resolving in resolving }
            .sensoryFeedback(.error, trigger: model.scanError) { _, error in error != nil && model.resolveOrigin == .scan }
    }
    private func updateCamera() {
        let target = model
        camera.update(active: cameraActive, detecting: detectionActive) { [weak target] barcode in
            guard let target, target.admission == .ready, target.selectedTab == .scan,
                  target.scanResult == nil, !target.scanBusy, (target.scanError == nil || target.resolveOrigin != .scan) else { return }
            Task { await target.resolve(.barcode(barcode)) }
        }
    }
}
/// Viewfinder: dimmed surround, corner brackets and a slow sweep while waiting for a barcode.
/// Once a code is read the brackets tighten and the sweep stops. Decorative only.
private struct ScanReticle: View {
    let resolving: Bool
    @State private var sweeping = false
    @State private var breathing = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ReticleSurround(radius: 20).fill(.black.opacity(0.42), style: FillStyle(eoFill: true)).allowsHitTesting(false)
                RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(.white.opacity(0.22), lineWidth: 1)
                if !resolving && !reduceMotion {
                    Capsule().fill(LinearGradient(colors: [.clear, .white.opacity(0.95), .clear], startPoint: .leading, endPoint: .trailing))
                        .frame(height: 2).padding(.horizontal, 18)
                        .shadow(color: ChaarlieTheme.plumMid.opacity(0.9), radius: 8)
                        .offset(y: (sweeping ? 1 : -1) * (geometry.size.height / 2 - 22))
                        .transition(.opacity)
                }
                ReticleCorners(radius: 20, length: 30)
                    .stroke(resolving ? ChaarlieTheme.plumMid : .white, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .scaleEffect(reduceMotion ? 1 : resolving ? 0.95 : breathing ? 1.025 : 1)
                    .shadow(color: .black.opacity(0.25), radius: 4)
            }
        }
        .animation(ChaarlieTheme.Motion.state, value: resolving)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 2.1).repeatForever(autoreverses: true)) { sweeping = true }
            withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) { breathing = true }
        }
    }
}

/// Everything around the frame, far past the screen edges, with the frame cut out.
private struct ReticleSurround: Shape {
    let radius: CGFloat
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addRect(rect.insetBy(dx: -1500, dy: -1500))
        path.addRoundedRect(in: rect, cornerSize: CGSize(width: radius, height: radius), style: .continuous)
        return path
    }
}

private struct ReticleCorners: Shape {
    let radius: CGFloat
    let length: CGFloat
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let r = radius
        // top-left, top-right, bottom-right, bottom-left
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + length))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + r))
        path.addArc(center: CGPoint(x: rect.minX + r, y: rect.minY + r), radius: r, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
        path.addLine(to: CGPoint(x: rect.minX + length, y: rect.minY))
        path.move(to: CGPoint(x: rect.maxX - length, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - r, y: rect.minY))
        path.addArc(center: CGPoint(x: rect.maxX - r, y: rect.minY + r), radius: r, startAngle: .degrees(270), endAngle: .degrees(0), clockwise: false)
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + length))
        path.move(to: CGPoint(x: rect.maxX, y: rect.maxY - length))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - r))
        path.addArc(center: CGPoint(x: rect.maxX - r, y: rect.maxY - r), radius: r, startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false)
        path.addLine(to: CGPoint(x: rect.maxX - length, y: rect.maxY))
        path.move(to: CGPoint(x: rect.minX + length, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX + r, y: rect.maxY))
        path.addArc(center: CGPoint(x: rect.minX + r, y: rect.maxY - r), radius: r, startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false)
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY - length))
        return path
    }
}
struct ProductSearchView: View {
    @Bindable var model: AppModel
    @FocusState private var queryFocused: Bool
    @Environment(\.dynamicTypeSize) private var typeSize
    private var canSubmit: Bool { !model.searchBusy && model.searchText.count >= 2 }
    private var showsNoResults: Bool {
        model.searchSubmitted && !isBarcode && !model.searchBusy && model.searchError == nil && model.searchResults.isEmpty
    }
    private var showsIdleHint: Bool {
        !model.searchSubmitted && !model.searchBusy && model.searchError == nil && model.searchResults.isEmpty
            && model.resolveOrigin != .search
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Produkt suchen").chaarlieHeading(30).accessibilityAddTraits(.isHeader)
                    searchField
                    ResolveFeedback(model: model, origin: .search)
                    if model.searchBusy {
                        SkeletonProductRows(label: "Produkte werden gesucht …").transition(.opacity)
                    }
                    if let error = model.searchError {
                        NoticeCard(systemImage: "wifi.slash", message: error) {
                            Button("Erneut versuchen") { submit() }.buttonStyle(ChaarlieButton(outline: true))
                        }.transition(.opacity)
                    }
                    if !model.searchResults.isEmpty {
                        LazyVStack(spacing: 12) {
                            ForEach(Array(model.searchResults.enumerated()), id: \.element.id) { index, product in
                                Button { Task { await model.resolve(.product(product.id)) } } label: { resultRow(product) }
                                    .buttonStyle(ChaarliePressStyle())
                                    .accessibilityLabel([product.name, product.categoryLabel].compactMap { $0 }.joined(separator: ", "))
                                    .chaarlieReveal(index)
                            }
                        }
                    }
                    if showsNoResults {
                        EmptyStateView(systemImage: "magnifyingglass", title: "Keine Treffer",
                                       message: "Anderen Namen oder Barcode versuchen.") { EmptyView() }
                            .transition(.opacity)
                    }
                    if showsIdleHint {
                        EmptyStateView(systemImage: "sparkle.magnifyingglass", title: "Passt es zu deinem Haar?",
                                       message: "Suche nach Name oder Marke – oder tippe den Barcode ein.") { EmptyView() }
                            .transition(.opacity)
                    }
                }.padding(24)
                    .animation(ChaarlieTheme.Motion.state, value: model.searchBusy)
                    .animation(ChaarlieTheme.Motion.state, value: model.searchError)
                    .animation(ChaarlieTheme.Motion.state, value: showsNoResults)
                    .animation(ChaarlieTheme.Motion.state, value: showsIdleHint)
            }.background(ChaarlieTheme.background)
                .scrollDismissesKeyboard(.interactively)
                .chaarlieStatusBarBackground()
                .sensoryFeedback(.selection, trigger: model.searchResults.map(\.id)) { _, ids in !ids.isEmpty }
        }
        .onDisappear { queryFocused = false }
    }
    /// One pill: query, clear and submit. The keyboard's search key submits as well.
    private var searchField: some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        return HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").font(.system(size: 16, weight: .semibold))
                .foregroundStyle(queryFocused ? ChaarlieTheme.plum : ChaarlieTheme.muted).accessibilityHidden(true)
            TextField("Produktname, Marke oder Barcode", text: $model.searchText)
                .submitLabel(.search).autocorrectionDisabled()
                .accessibilityIdentifier("search.query")
                .focused($queryFocused)
                .onSubmit { submit() }
                .onChange(of: model.searchText) { _, _ in model.searchTextDidChange() }
                .frame(minHeight: 44)
            if !model.searchText.isEmpty && queryFocused {
                Button { model.searchText = "" } label: {
                    Image(systemName: "xmark.circle.fill").font(.system(size: 17)).foregroundStyle(ChaarlieTheme.border)
                        .frame(width: 32, height: 44).contentShape(Rectangle())
                }.buttonStyle(.plain).accessibilityLabel("Eingabe löschen").chaarlieTransition(.opacity.combined(with: .scale(scale: 0.7)))
            }
            Button { submit() } label: {
                Image(systemName: "arrow.right").font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .background(canSubmit ? ChaarlieTheme.coral : ChaarlieTheme.border, in: Circle())
                    .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
            }.buttonStyle(ChaarliePressStyle()).disabled(!canSubmit)
                .accessibilityLabel("Suchen").accessibilityIdentifier("search.submit")
        }.padding(.leading, 16).padding(.trailing, 6).padding(.vertical, 4)
            .background(.white, in: shape)
            .overlay(shape.strokeBorder(queryFocused ? ChaarlieTheme.plum : ChaarlieTheme.border, lineWidth: queryFocused ? 1.5 : 1))
            .shadow(color: (queryFocused ? ChaarlieTheme.plum : ChaarlieTheme.shadow).opacity(queryFocused ? 0.14 : 0.05), radius: 14, y: 5)
            .animation(ChaarlieTheme.Motion.state, value: queryFocused)
            .animation(ChaarlieTheme.Motion.state, value: canSubmit)
            .animation(ChaarlieTheme.Motion.state, value: model.searchText.isEmpty)
    }
    private func resultRow(_ product: ScanProduct) -> some View {
        Group {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top) {
                        ProductImage(product: product).frame(width: 88, height: 104)
                        Spacer()
                        rowChevron
                    }
                    productText(product)
                }
            } else {
                HStack(alignment: .center, spacing: 16) {
                    ProductImage(product: product).frame(width: 76, height: 92)
                    productText(product)
                    rowChevron
                }
            }
        }.padding(12).chaarlieCard().contentShape(Rectangle())
    }
    private var rowChevron: some View {
        Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold))
            .foregroundStyle(ChaarlieTheme.plumMid).accessibilityHidden(true)
    }
    private func productText(_ product: ScanProduct) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(GermanLineBreaks.text(product.name)).chaarlieSystemFont(15, weight: .bold)
                .lineLimit(typeSize.isAccessibilitySize ? nil : 3).truncationMode(.tail)
                .accessibilityLabel(product.name)
            Text(product.categoryLabel).chaarlieSystemFont(12, weight: .semibold, relativeTo: .caption)
                .foregroundStyle(ChaarlieTheme.plum)
                .padding(.horizontal, 9).padding(.vertical, 5)
                .background(ChaarlieTheme.plumIce, in: Capsule())
        }.multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
    private var isBarcode: Bool {
        let value = model.searchText.trimmingCharacters(in: .whitespaces)
        return [8, 12, 13, 14].contains(value.count) && value.allSatisfy(\.isNumber)
    }
    private func submit() {
        queryFocused = false
        model.searchSubmitted = true
        if isBarcode {
            Task { await model.resolve(.barcode(model.searchText.trimmingCharacters(in: .whitespacesAndNewlines))) }
        } else { Task { await model.search() } }
    }
}
