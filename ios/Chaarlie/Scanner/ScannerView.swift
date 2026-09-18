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
                }.scrollBounceBehavior(.basedOnSize)
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
    private var scannerContent: some View {
        VStack(spacing: 24) {
            Text("Produkt scannen").chaarlieHeading(28).padding(.top, 16)
            Spacer()
            if camera.availability == .available || fixtureBackdrop != nil {
                RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.8), lineWidth: 3)
                    .frame(maxWidth: 260).frame(height: 170).accessibilityHidden(true)
                Text("Halte den Barcode in den Rahmen.").multilineTextAlignment(.center)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(.black.opacity(0.42), in: RoundedRectangle(cornerRadius: 10))
            } else {
                Image(systemName: "barcode.viewfinder").font(.system(size: 60)).accessibilityHidden(true)
                Text(camera.availability == .denied ? "Kamera nicht freigegeben" : "Produkt per Suche finden")
                    .chaarlieSystemFont(24, weight: .semibold, relativeTo: .title2)
                Text(camera.availability == .denied ? "Du kannst Produkte weiterhin manuell suchen oder den Barcode eingeben." : "Die Kamera ist hier nicht verfügbar. Suche nach Produktname, Marke oder Barcode.")
                    .multilineTextAlignment(.center)
                if camera.availability == .denied {
                    Button("Einstellungen öffnen") {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    }.buttonStyle(ChaarlieButton(outline: true))
                }
            }
            Spacer()
            if model.scanBusy, model.resolveOrigin == .scan { ProgressView("Produkt wird geprüft …").tint(.white) }
            if let error = model.scanError, model.resolveOrigin == .scan {
                Text(error).multilineTextAlignment(.center)
                if let request = model.lastRequest {
                    Button("Erneut versuchen") { Task { await model.resolve(request) } }.buttonStyle(ChaarlieButton())
                }
                Button("Schließen") { model.dismissScan() }.frame(minHeight: 44)
            }
        }.foregroundStyle(.white).multilineTextAlignment(.center)
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
struct ProductSearchView: View {
    @Bindable var model: AppModel
    @FocusState private var queryFocused: Bool
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Produkt suchen").chaarlieHeading(30)
                    TextField("Produktname, Marke oder Barcode", text: $model.searchText)
                        .textFieldStyle(ChaarlieField()).submitLabel(.search)
                        .accessibilityIdentifier("search.query")
                        .focused($queryFocused)
                        .onSubmit { submit() }
                        .onChange(of: model.searchText) { _, _ in model.searchTextDidChange() }
                    Button("Suchen") { submit() }.accessibilityIdentifier("search.submit").buttonStyle(ChaarlieButton()).disabled(model.searchBusy || model.searchText.count < 2)
                    if model.searchBusy { ProgressView("Produkte werden gesucht …") }
                    ResolveFeedback(model: model, origin: .search)
                    if let error = model.searchError {
                        Text(error)
                        Button("Erneut versuchen") { submit() }.buttonStyle(ChaarlieButton(outline: true))
                    }
                    ForEach(model.searchResults) { product in
                        Button { Task { await model.resolve(.product(product.id)) } } label: {
                            Group {
                                if typeSize.isAccessibilitySize {
                                    VStack(alignment: .leading, spacing: 14) {
                                        HStack {
                                            ProductImage(product: product).frame(width: 52, height: 64)
                                            Spacer()
                                            Image(systemName: "chevron.right").accessibilityHidden(true)
                                        }
                                        productText(product)
                                    }
                                } else {
                                    HStack(alignment: .top, spacing: 14) {
                                        ProductImage(product: product).frame(width: 52, height: 64)
                                        productText(product)
                                        Spacer()
                                        Image(systemName: "chevron.right").accessibilityHidden(true)
                                    }
                                }
                            }.padding(14).background(.white).clipShape(RoundedRectangle(cornerRadius: 14))
                        }.buttonStyle(.plain)
                    }
                    if model.searchSubmitted, !isBarcode, !model.searchBusy, model.searchError == nil, model.searchResults.isEmpty {
                        ContentUnavailableView("Keine Treffer", systemImage: "magnifyingglass", description: Text("Anderen Namen oder Barcode versuchen."))
                    }
                }.padding(24)
            }.background(ChaarlieTheme.background)
                .scrollDismissesKeyboard(.interactively)
                .chaarlieStatusBarBackground()
        }
        .onDisappear { queryFocused = false }
    }
    private func productText(_ product: ScanProduct) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(GermanLineBreaks.text(product.name)).chaarlieSystemFont(15, weight: .bold)
                .accessibilityLabel(product.name)
            Text([product.brand, product.categoryLabel].compactMap { $0 }.joined(separator: " · "))
                .chaarlieSystemFont(12).foregroundStyle(ChaarlieTheme.muted)
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
