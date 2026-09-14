import SwiftUI

struct ScannerView: View {
    @Bindable var model: AppModel
    @State private var camera = CameraController()
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL
    private var cameraActive: Bool {
        model.selectedTab == .scan && model.admission == .ready && scenePhase == .active && !model.searchPresented
    }
    private var detectionActive: Bool { cameraActive && model.scanResult == nil && !model.scanBusy && model.scanError == nil }
    var body: some View {
        ZStack {
            Color(hex: 0x17141b).ignoresSafeArea()
            if camera.availability == .available { CameraPreview(session: camera.worker.session).ignoresSafeArea().accessibilityHidden(true) }
            GeometryReader { geometry in
                ScrollView {
                    scannerContent
                        .frame(minHeight: max(0, geometry.size.height - 48))
                        .padding(24)
                }.scrollBounceBehavior(.basedOnSize)
                    .accessibilityIdentifier("scanner.content")
            }
        }
        .onTapGesture { if model.scanResult != nil { model.dismissScan() } }
        .sheet(isPresented: Binding(get: { model.searchPresented || model.scanResult != nil }, set: { presented in
            if !presented { model.cancelSearch(); model.dismissScan() }
        }), onDismiss: { model.cancelSearch(); model.dismissScan() }) {
            Group {
                if let result = model.scanResult {
                    AssessmentSheet(result: result, onDismiss: { model.dismissScan() })
                } else {
                    ProductSearchView(model: model)
                }
            }
            .preferredColorScheme(.light)
            .presentationDetents([.fraction(0.88)])
            .presentationDragIndicator(.visible)
            .presentationBackgroundInteraction(.enabled)
            .presentationCornerRadius(24)
        }
        .task { await camera.permission(); updateCamera() }
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
            Text("Produkt scannen").font(ChaarlieTheme.display(28)).padding(.top, 16)
            Spacer()
            if camera.availability == .available {
                RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.8), lineWidth: 3)
                    .frame(maxWidth: 260).frame(height: 170).accessibilityHidden(true)
                Text("Halte den Barcode in den Rahmen.").multilineTextAlignment(.center)
            } else {
                Image(systemName: "barcode.viewfinder").font(.system(size: 60)).accessibilityHidden(true)
                Text(camera.availability == .denied ? "Kamera nicht freigegeben" : "Produkt per Suche finden")
                    .font(ChaarlieTheme.display(24))
                Text(camera.availability == .denied ? "Du kannst Produkte weiterhin manuell suchen oder den Barcode eingeben." : "Die Kamera ist hier nicht verfügbar. Suche nach Produktname, Marke oder Barcode.")
                    .multilineTextAlignment(.center)
                if camera.availability == .denied {
                    Button("Einstellungen öffnen") {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    }.buttonStyle(ChaarlieButton(outline: true))
                }
            }
            Spacer()
            if model.scanBusy { ProgressView("Produkt wird geprüft …").tint(.white) }
            if let error = model.scanError {
                Text(error).multilineTextAlignment(.center)
                if let request = model.lastRequest {
                    Button("Erneut versuchen") { Task { await model.resolve(request) } }.buttonStyle(ChaarlieButton())
                }
                Button("Schließen") { model.dismissScan() }.frame(minHeight: 44)
            }
            Button("Produkt manuell suchen") { model.dismissScan(); model.searchPresented = true }
                .buttonStyle(ChaarlieButton(outline: true)).accessibilityIdentifier("scanner.search")
        }.foregroundStyle(.white).multilineTextAlignment(.center)
    }
    private func updateCamera() {
        let target = model
        camera.update(active: cameraActive, detecting: detectionActive) { [weak target] barcode in
            guard let target, target.admission == .ready, target.selectedTab == .scan,
                  !target.searchPresented, target.scanResult == nil, !target.scanBusy, target.scanError == nil else { return }
            Task { await target.resolve(.barcode(barcode)) }
        }
    }
}
struct ProductSearchView: View {
    @Bindable var model: AppModel
    @State private var submitted = false
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Produkt suchen").font(ChaarlieTheme.display(30))
                    TextField("Produktname, Marke oder Barcode", text: $model.searchText)
                        .textFieldStyle(ChaarlieField()).submitLabel(.search)
                        .accessibilityIdentifier("search.query")
                        .onSubmit { submit() }
                        .onChange(of: model.searchText) { _, _ in submitted = false; model.searchTextDidChange() }
                    Button("Suchen") { submit() }.accessibilityIdentifier("search.submit").buttonStyle(ChaarlieButton()).disabled(model.searchBusy || model.searchText.count < 2)
                    if isBarcode {
                        Button("Barcode prüfen") { Task { await model.resolve(.barcode(model.searchText.trimmingCharacters(in: .whitespaces))) } }
                            .buttonStyle(ChaarlieButton(outline: true))
                    }
                    if model.searchBusy { ProgressView("Produkte werden gesucht …") }
                    if model.scanBusy { ProgressView("Produkt wird geprüft …") }
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
                    if submitted, !model.searchBusy, model.searchError == nil, model.searchResults.isEmpty {
                        Text("Keine Produkte gefunden. Prüfe den Suchbegriff oder gib den Barcode ein.")
                    }
                }.padding(24)
            }.background(ChaarlieTheme.background)
                .toolbar { ToolbarItem(placement: .topBarTrailing) { CloseButton(label: "Suche schließen") { model.cancelSearch() } } }
        }
    }
    private func productText(_ product: ScanProduct) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(GermanLineBreaks.text(product.name)).font(ChaarlieTheme.body(15, weight: .bold))
                .accessibilityLabel(product.name)
            Text([product.brand, product.categoryLabel].compactMap { $0 }.joined(separator: " · "))
                .font(ChaarlieTheme.body(12)).foregroundStyle(ChaarlieTheme.muted)
        }.multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
    private var isBarcode: Bool {
        let value = model.searchText.trimmingCharacters(in: .whitespaces)
        return [8, 12, 13, 14].contains(value.count) && value.allSatisfy(\.isNumber)
    }
    private func submit() { submitted = true; Task { await model.search() } }
}
