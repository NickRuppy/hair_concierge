import SwiftUI

struct LoginView: View {
    @Bindable var model: AppModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("chaarlie").font(ChaarlieTheme.display(32)).padding(.bottom, 25)
                Text(model.attempt == nil ? "Schön, dass du wieder da bist." : "Einmal kurz bestätigen.")
                    .font(ChaarlieTheme.display(32)).accessibilityAddTraits(.isHeader)
                if let attempt = model.attempt {
                    Text(model.email.isEmpty ? "Öffne deinen Anmeldelink oder gib den Code aus der E-Mail ein." : "Öffne den Anmeldelink für \(model.email) oder gib den Code ein.")
                    TextField("Code aus der E-Mail", text: $model.code)
                        .keyboardType(.numberPad).textContentType(.oneTimeCode)
                        .textFieldStyle(ChaarlieField()).accessibilityIdentifier("login.code")
                        .onChange(of: model.code) { _, value in
                            model.code = String(value.filter { $0.isASCII && $0.isNumber }.prefix(attempt.codeLength))
                        }
                    Button("Bestätigen und weiter") { Task { await model.verifyCode() } }
                        .buttonStyle(ChaarlieButton())
                        .disabled(model.authBusy || model.code.count != attempt.codeLength)
                    Button("Neue E-Mail senden") { Task { await model.startLogin() } }
                        .buttonStyle(ChaarlieTextButton())
                        .disabled(model.authBusy || model.email.isEmpty)
                    Button("Andere E-Mail verwenden") { Task { await model.changeEmail() } }
                        .buttonStyle(ChaarlieTextButton())
                } else {
                    Text("Melde dich mit deinem bestehenden Chaarlie-Konto an.")
                    TextField("E-Mail-Adresse", text: $model.email)
                        .keyboardType(.emailAddress).textContentType(.emailAddress)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                        .textFieldStyle(ChaarlieField()).accessibilityIdentifier("login.email")
                    Button("Anmeldelink und Code senden") { Task { await model.startLogin() } }
                        .buttonStyle(ChaarlieButton()).disabled(model.authBusy || !model.email.contains("@"))
                }
                if model.authBusy { ProgressView("Einen Moment …") }
                if let error = model.authError { Text(error).foregroundStyle(Color(hex: 0x9a3f48)).accessibilityIdentifier("login.error") }
                #if DEBUG
                Text("Entwicklungsbuild · bestehende lokale Testkonten")
                    .font(ChaarlieTheme.body(12)).foregroundStyle(ChaarlieTheme.muted).padding(.top, 16)
                #endif
            }.padding(24)
        }
    }
}
