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
                            .buttonStyle(ChaarlieTextButton()).chaarlieSystemFont(15, weight: .semibold)
                            .foregroundStyle(ChaarlieTheme.plum).padding(.horizontal, 24).padding(.bottom, 16)
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
        .safeAreaInset(edge: .top, spacing: 0) {
            if let notice = app.signedOutNotice {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill").accessibilityHidden(true)
                    Text(notice).chaarlieSystemFont(14, weight: .medium).accessibilityIdentifier("signedOut.notice")
                }.foregroundStyle(ChaarlieTheme.plum).padding(.horizontal, 14).padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(ChaarlieTheme.plumIce, in: RoundedRectangle(cornerRadius: ChaarlieTheme.Radius.control, style: .continuous))
                    .padding(.horizontal, 24).padding(.top, 8)
                    .chaarlieTransition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(ChaarlieTheme.Motion.state, value: app.signedOutNotice)
        // The notice greets the screen once; the next step moves on without it.
        .onChange(of: onboarding?.stage) { _, _ in app.dismissSignedOutNotice() }
        .onChange(of: app.attempt) { _, attempt in
            if attempt != nil { onboarding?.suspend(); showingLogin = true }
        }
        .onChange(of: showingLogin) { _, login in
            app.dismissSignedOutNotice()
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
