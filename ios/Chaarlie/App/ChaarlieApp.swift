import SwiftUI

@main
struct ChaarlieApp: App {
    private let model: AppModel?
    init() {
        #if DEBUG
        if DesignReviewScenario.current != nil || OnboardingFixtureView.enabled { model = nil; return }
        #endif
        if let configuration = try? MobileConfiguration.current() {
            model = AppModel(client: MobileClient(configuration: configuration))
        } else { model = nil }
    }
    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if OnboardingFixtureView.enabled {
                OnboardingFixtureView()
            } else if let scenario = DesignReviewScenario.current {
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
    var prefersExistingLogin = false
    var body: some View {
        Group {
            switch model.admission {
            case .signedOut: SignedOutEntryView(app: model, prefersExistingLogin: prefersExistingLogin)
            case .loading:
                VStack(spacing: 20) {
                    ProgressView("Deine Haarangaben werden geladen …")
                    Button("Abmelden") { Task { await model.logout() } }
                }
            case .profileRequired:
                MissingProfileCompletionView(app: model)
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
        .chaarlieSystemFont().foregroundStyle(ChaarlieTheme.ink)
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
struct MissingProfileCompletionView: View {
    @Bindable var app: AppModel
    @State private var model: MissingProfileCompletionModel
    init(app: AppModel) {
        self.app = app
        let expectedAuthority = app.completionAuthority
        _model = State(initialValue: MissingProfileCompletionModel(client: app.client,
                                                                     completionAuthority: expectedAuthority,
                                                                     ready: { await app.finishMissingProfile($0, expectedAuthority: expectedAuthority) }))
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("chaarlie").font(ChaarlieTheme.wordmark(30))
                switch model.stage {
                case .loading: ProgressView("Deine fehlenden Haarangaben werden geladen …")
                case .unavailable:
                    Text("Deine Haarangaben konnten nicht geladen werden.").chaarlieHeading(30)
                    Button("Erneut versuchen") { Task { await model.retry() } }.buttonStyle(ChaarlieButton())
                case .saving: ProgressView("Deine Haarangaben werden gespeichert …")
                case .questions:
                    if let question = model.question { questionContent(question) }
                }
                if let error = model.error { Text(error).foregroundStyle(ChaarlieTheme.coral) }
                Button("Abmelden") { Task { await app.logout() } }.buttonStyle(ChaarlieButton(outline: true))
            }.padding(24)
        }
        .task { await model.load() }
        .chaarlieSystemFont().foregroundStyle(ChaarlieTheme.ink).tint(ChaarlieTheme.plum)
        .background(ChaarlieTheme.background).chaarlieStatusBarBackground()
    }
    @ViewBuilder private func questionContent(_ question: EditQuestion) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Uns fehlt noch eine Angabe.").chaarlieHeading(30)
            if model.isScalpGate {
                Text("Hast du zusätzlich Kopfhaut-Beschwerden?").font(.title3.weight(.semibold))
                Text("Zum Beispiel Schuppen, Juckreiz oder Rötungen.").foregroundStyle(ChaarlieTheme.muted)
                QuizOptionButton(label: "Nein", selected: model.selected.isEmpty == false && model.isScalpGate == false) { model.setScalpIssue(false) }
                QuizOptionButton(label: "Ja", selected: false) { model.setScalpIssue(true) }
            } else if model.isScalpCondition {
                Text("Was ist aktuell dein Hauptproblem?").font(.title3.weight(.semibold))
                ForEach(question.conditionOptions ?? []) { option in
                    QuizOptionButton(label: option.label, description: option.description, selected: false) { model.selectScalpCondition(option.value) }
                }
            } else {
                Text(question.title).font(.title3.weight(.semibold))
                Text(question.instruction).foregroundStyle(ChaarlieTheme.muted)
                ForEach(model.currentOptions) { option in
                    QuizOptionButton(label: option.label, description: option.description,
                                     selected: model.selected.contains(option.value), multiple: question.selectionMode == .multi) {
                        model.select(option.value)
                    }
                }
            }
            HStack {
                if !model.isScalpGate && !model.isScalpCondition { Button("Zurück") { model.back() }.buttonStyle(ChaarlieTextButton()) }
                Spacer()
                Button("Weiter") { model.advance() }.buttonStyle(ChaarlieButton()).disabled(!model.canAdvance)
            }
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
                Text("chaarlie").font(ChaarlieTheme.wordmark())
                Text(title).chaarlieHeading(30)
                Text(message)
                if retry { Button("Erneut versuchen") { Task { await model.bootstrap() } }.buttonStyle(ChaarlieButton()) }
                Button("Abmelden") { Task { await model.logout() } }.buttonStyle(ChaarlieButton(outline: true))
            }.padding(24)
        }.chaarlieStatusBarBackground()
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
