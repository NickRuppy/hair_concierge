import SwiftUI

@main
struct ChaarlieApp: App {
    private let model: AppModel?
    init() {
        #if DEBUG
        if DesignReviewScenario.current != nil { model = nil; return }
        #endif
        if let configuration = try? MobileConfiguration.current() {
            model = AppModel(client: MobileClient(configuration: configuration))
        } else { model = nil }
    }
    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if let scenario = DesignReviewScenario.current {
                DesignReviewFixture(scenario: scenario)
            } else if let fixture = Self.uiFixture {
                AssessmentFixtureView(result: fixture).preferredColorScheme(.dark)
            } else {
                application
            }
            #else
            application
            #endif
        }
    }
    @ViewBuilder private var application: some View {
            if let model {
                RootView(model: model)
                    .onOpenURL { url in Task { await model.receive(url) } }
            } else {
                ContentUnavailableView("Entwicklungsbuild nicht eingerichtet", systemImage: "gearshape",
                    description: Text("Für diesen Build fehlt eine freigegebene Serverkonfiguration."))
            }
    }
    #if DEBUG
    private static var uiFixture: ScanResult? {
        guard ProcessInfo.processInfo.arguments.contains("--ui-assessment-fixture"),
              let json = ProcessInfo.processInfo.environment["CHAARLIE_UI_FIXTURE_JSON"] else { return nil }
        return try? JSONDecoder().decode(ScanResult.self, from: Data(json.utf8))
    }
    #endif
}
#if DEBUG
/// Separate rendering harness: never creates a session or bypasses API admission.
private struct AssessmentFixtureView: View {
    let result: ScanResult
    @State private var presented = true
    var body: some View {
        ZStack(alignment: .top) {
            Color(hex: 0x17141b).ignoresSafeArea()
            Text("UI-Testdaten · keine Kamera").foregroundStyle(.white).padding(24)
            if !presented { Text("Ergebnis geschlossen").foregroundStyle(.white).padding(.top, 100) }
        }
        .sheet(isPresented: $presented) {
            AssessmentSheet(result: result, onDismiss: { presented = false })
                .preferredColorScheme(.light)
                .presentationDetents([.fraction(0.88)]).presentationDragIndicator(.visible).presentationCornerRadius(24)
        }
    }
}
#endif
struct RootView: View {
    @Bindable var model: AppModel
    var body: some View {
        Group {
            switch model.admission {
            case .signedOut: LoginView(model: model)
            case .loading:
                VStack(spacing: 20) {
                    ProgressView("Deine Haarangaben werden geladen …")
                    Button("Abmelden") { Task { await model.logout() } }
                }
            case .profileRequired:
                RecoveryView(title: "Uns fehlen noch deine Haarangaben.",
                    message: "Für dieses Konto ist kein vollständiger Haar-Check hinterlegt. Dieser Entwicklungsbuild benötigt ein bestehendes Testkonto mit vollständigen Angaben.", model: model, retry: false)
            case .unavailable:
                RecoveryView(title: "Deine Haarangaben konnten nicht geladen werden.",
                    message: "Du bist angemeldet. Bitte versuche es noch einmal.", model: model, retry: true)
            case .ready:
                TabView(selection: $model.selectedTab) {
                    ScannerView(model: model).tabItem { Label("Scan", systemImage: "barcode.viewfinder") }.tag(AppModel.Tab.scan)
                    ProfileView(model: model).tabItem { Label("Profil", systemImage: "person.crop.circle") }.tag(AppModel.Tab.profile)
                }
                .onChange(of: model.selectedTab) { _, newValue in if newValue != .scan { model.leaveScan() } }
            }
        }
        .font(ChaarlieTheme.body()).foregroundStyle(ChaarlieTheme.ink)
        .tint(ChaarlieTheme.plum).frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ChaarlieTheme.background).task {
            await model.restore()
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--connected-auth-mail"), let attempt = model.attempt {
                if let captured = try? await LocalTestMailbox.code(for: attempt) {
                    await model.verifyCapturedTestCode(captured)
                }
            }
            #endif
        }
        .preferredColorScheme(model.admission == .ready && model.selectedTab == .scan ? .dark : .light)
        .alert("Mit anderem Konto anmelden?", isPresented: Binding(get: { model.pendingAccountLink != nil }, set: { _ in })) {
            Button("Abmelden und Link öffnen") {
                let callback = model.pendingAccountLink
                model.declineAccountLink()
                if let callback { Task { await model.confirmAccountLink(callback) } }
            }
            Button("Angemeldet bleiben", role: .cancel) { model.declineAccountLink() }
        } message: {
            Text("Der Anmeldelink kann zu einem anderen Konto gehören. Du wirst zuerst abgemeldet. Deine Haarangaben bleiben gespeichert.")
        }
    }
}
struct RecoveryView: View {
    let title: String
    let message: String
    let model: AppModel
    let retry: Bool
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("chaarlie").font(ChaarlieTheme.display())
                Text(title).font(ChaarlieTheme.display(30))
                Text(message)
                if retry { Button("Erneut versuchen") { Task { await model.bootstrap() } }.buttonStyle(ChaarlieButton()) }
                Button("Abmelden") { Task { await model.logout() } }.buttonStyle(ChaarlieButton(outline: true))
            }.padding(24)
        }
    }
}

#if DEBUG
/// Connected QA only: no credential passes through launch arguments, environment or UI automation.
private enum LocalTestMailbox {
    static func code(for attempt: AuthAttempt) async throws -> String {
        let session = URLSession(configuration: .ephemeral)
        defer { session.invalidateAndCancel() }
        let base = URL(string: "http://127.0.0.1:54324/api/v1")!
        for _ in 0..<50 {
            let (data, _) = try await session.data(from: base.appendingPathComponent("messages"))
            let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            for message in object?["messages"] as? [[String: Any]] ?? [] {
                guard let id = message["ID"] as? String,
                      let to = message["To"] as? [[String: Any]],
                      to.contains(where: { $0["Address"] as? String == "scanner-free@example.test" }) else { continue }
                let (body, _) = try await session.data(from: base.appendingPathComponent("message").appendingPathComponent(id))
                let detail = try JSONSerialization.jsonObject(with: body) as? [String: Any]
                guard let html = detail?["HTML"] as? String, html.contains(attempt.attemptId) else { continue }
                let expression = try NSRegularExpression(pattern: "<strong>([0-9]{8})</strong>")
                if let match = expression.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
                   let range = Range(match.range(at: 1), in: html) { return String(html[range]) }
            }
            try await Task.sleep(for: .milliseconds(200))
        }
        throw MobileError.unavailable
    }
}
#endif
