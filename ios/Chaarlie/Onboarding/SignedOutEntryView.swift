import SwiftUI

/// Anonymous quiz and existing login are separate; switching never claims a local draft.
struct SignedOutEntryView: View {
    @Bindable var app: AppModel
    @State private var showingLogin: Bool
    @State private var onboarding: OnboardingModel?
    init(app: AppModel, prefersExistingLogin: Bool = false) {
        self.app = app
        // Existing pending attempts and established login QA keep their current entry.
        var login = prefersExistingLogin || app.attempt != nil
        #if DEBUG
        login = login || ProcessInfo.processInfo.arguments.contains("--connected-auth-mail")
        #endif
        _showingLogin = State(initialValue: login)
        _onboarding = State(initialValue: (try? OnboardingQuestions.bundled()).map { questions in
            let expectedGeneration = app.generation
            return OnboardingModel(questions: questions,
                                   gateway: MobileOnboardingGateway(client: app.client),
                                   ready: { response in await app.finishRegistration(response, expectedGeneration: expectedGeneration) })
        })
    }
    var body: some View {
        Group {
            if showingLogin {
                VStack(spacing: 0) {
                    LoginView(model: app)
                    if app.attempt == nil {
                        Button("Neu hier? Haar-Check starten") { showingLogin = false }
                            .buttonStyle(ChaarlieTextButton()).padding(.bottom, 16)
                    }
                }
            } else if let onboarding {
                OnboardingView(model: onboarding) { showingLogin = true }
            } else {
                VStack(spacing: 24) {
                    Text("Der Haar-Check konnte nicht geladen werden.")
                    Button("Schon dabei? Anmelden") { showingLogin = true }.buttonStyle(ChaarlieButton())
                }.padding(24)
            }
        }
        .onChange(of: app.attempt) { _, attempt in
            if attempt != nil { onboarding?.suspend(); showingLogin = true }
        }
        .onChange(of: showingLogin) { _, login in
            if login { app.registrationCallback = nil }
            else { installRegistrationCallback() }
        }
        .onAppear {
            if !showingLogin { installRegistrationCallback() }
        }
        .onDisappear {
            onboarding?.suspend()
            app.registrationCallback = nil
        }
    }
    private func installRegistrationCallback() {
        guard let onboarding else { return }
        app.registrationCallback = { url in await onboarding.receive(url) }
    }
}
