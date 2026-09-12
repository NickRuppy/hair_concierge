import Foundation
import SwiftUI

@MainActor
@Observable
final class AppModel {
    enum Admission: Equatable { case signedOut, loading, ready, profileRequired, unavailable }
    enum Tab: Hashable { case scan, profile }
    let client: MobileClient
    var admission: Admission = .loading
    var selectedTab: Tab = .scan
    var session: MobileSession?
    var attempt: AuthAttempt?
    var email = ""
    var code = ""
    var authBusy = false
    var authError: String?
    var pendingAccountLink: LoginCallback?
    var profile: HairProfile?
    var profileError: String?
    var scanResult: ScanResult?
    var scanBusy = false
    var scanError: String?
    var lastRequest: ScanRequest?
    var searchText = ""
    var searchResults: [ScanProduct] = []
    var searchBusy = false
    var searchError: String?
    var searchPresented = false
    #if DEBUG
    private var consumedCodeInjection = false
    func verifyCapturedTestCode(_ value: String) async {
        guard !consumedCodeInjection, admission == .signedOut, let attempt,
              value.count == attempt.codeLength, value.allSatisfy(\.isNumber) else { return }
        consumedCodeInjection = true
        await verify(attemptId: attempt.attemptId, code: value)
    }
    #endif
    private var generation = UUID()
    private var authOperation = UUID()
    private var scanOperation = UUID()
    private var searchOperation = UUID()
    private var profileOperation = UUID()
    private var restorationTask: Task<Void, Never>?

    init(client: MobileClient) { self.client = client }
    func restore() async {
        if let active = restorationTask { await active.value; return }
        let active = Task { await self.performRestore() }
        restorationTask = active
        await active.value
        restorationTask = nil
    }
    private func performRestore() async {
        guard !authBusy else { return }
        let expected = generation, operation = authOperation
        let saved = await client.currentSession()
        let pending = await client.pendingAttempt()
        guard expected == generation, operation == authOperation, !authBusy else { return }
        session = saved
        attempt = pending
        if saved == nil { admission = .signedOut }
        else { await bootstrap() }
    }
    func startLogin() async {
        let account = generation, operation = UUID()
        authOperation = operation
        authBusy = true
        authError = nil
        do {
            let value = try await client.start(email: email.trimmingCharacters(in: .whitespacesAndNewlines))
            guard account == generation, operation == authOperation else { return }
            attempt = value
            code = ""
        } catch {
            guard account == generation, operation == authOperation else { return }
            authError = "Die E-Mail konnte gerade nicht angefordert werden. Bitte versuche es erneut."
        }
        guard account == generation, operation == authOperation else { return }
        authBusy = false
    }
    func changeEmail() async {
        guard session == nil else { return }
        authOperation = UUID()
        attempt = nil
        code = ""
        authBusy = false
        authError = nil
        await client.clear()
    }
    func verifyCode() async {
        guard let attempt else { return }
        await verify(attemptId: attempt.attemptId, code: code.trimmingCharacters(in: .whitespacesAndNewlines))
    }
    func receive(_ url: URL) async {
        let expected = generation, operation = authOperation
        if session == nil, admission == .loading, !authBusy { await restore() }
        guard expected == generation, operation == authOperation else { return }
        guard let callback = LoginCallback.parse(url, pending: session == nil ? attempt : nil, signedIn: false) else { return }
        if session != nil { pendingAccountLink = callback; return }
        await verify(attemptId: callback.attemptId, tokenHash: callback.tokenHash)
    }
    func confirmAccountLink(_ callback: LoginCallback) async {
        pendingAccountLink = nil
        await logout()
        guard session == nil, attempt == nil, !authBusy else { return }
        await verify(attemptId: callback.attemptId, tokenHash: callback.tokenHash)
    }
    func declineAccountLink() { pendingAccountLink = nil }
    private func verify(attemptId: String, code: String? = nil, tokenHash: String? = nil) async {
        guard !authBusy else { return }
        let account = generation, operation = UUID()
        authOperation = operation
        authBusy = true
        authError = nil
        do {
            let value = try await client.verify(attemptId: attemptId, code: code, tokenHash: tokenHash)
            guard account == generation, operation == authOperation else { return }
            resetPersonalState()
            session = value
            attempt = nil
            self.code = ""
            authBusy = false
            await bootstrap()
        } catch {
            guard account == generation, operation == authOperation else { return }
            if error as? MobileError == .unauthorized || error as? MobileError == .invalidCode {
                authError = "Der Code oder Link ist ungültig oder abgelaufen. Prüfe den Code oder fordere eine neue E-Mail an."
            } else {
                authError = "Die Anmeldung konnte gerade nicht abgeschlossen werden. Bitte versuche es erneut."
            }
            authBusy = false
        }
    }
    func bootstrap() async {
        let account = generation
        admission = .loading
        do {
            let response = try await client.bootstrap()
            guard account == generation else { return }
            switch response.status {
            case .ready: admission = .ready
            case .profile_required: admission = .profileRequired
            case .temporarily_unavailable: admission = .unavailable
            }
        } catch {
            guard account == generation else { return }
            if error as? MobileError == .unauthorized { await expired() }
            else { admission = .unavailable }
        }
    }
    func loadProfile() async {
        let account = generation, operation = UUID()
        profileOperation = operation
        profileError = nil
        do {
            let value = try await client.profile()
            guard account == generation, operation == profileOperation else { return }
            profile = value
        } catch {
            guard account == generation, operation == profileOperation else { return }
            if error as? MobileError == .unauthorized { await expired() }
            else { profileError = "Deine Haarangaben konnten nicht geladen werden. Bitte versuche es erneut." }
        }
    }
    func resolve(_ request: ScanRequest) async {
        guard admission == .ready, !scanBusy, scanResult == nil else { return }
        let account = generation, operation = UUID()
        scanOperation = operation
        searchOperation = UUID()
        searchBusy = false
        lastRequest = request
        scanBusy = true
        scanError = nil
        do {
            let result = try await client.resolve(request)
            guard account == generation, operation == scanOperation, admission == .ready else { return }
            if result.kind == .profile_required { admission = .profileRequired }
            else if result.kind == .retryable_error || (result.kind == .authority_unavailable && result.reason != "personal_target_unavailable") {
                scanError = "Die Einschätzung konnte nicht geladen werden. Dein Barcode bleibt für einen neuen Versuch erhalten."
            } else { scanResult = result }
        } catch {
            guard account == generation, operation == scanOperation else { return }
            if error as? MobileError == .unauthorized { await expired() }
            else { scanError = "Die Verbindung ist gerade nicht verfügbar. Versuche es erneut." }
        }
        guard account == generation, operation == scanOperation else { return }
        searchPresented = false
        scanBusy = false
    }
    func search() async {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let account = generation, operation = UUID()
        searchOperation = operation
        searchResults = []
        searchError = nil
        guard query.count >= 2 else { searchBusy = false; return }
        searchBusy = true
        do {
            let response = try await client.search(query)
            guard account == generation, operation == searchOperation, searchPresented else { return }
            searchResults = response.results
        } catch {
            guard account == generation, operation == searchOperation else { return }
            if error as? MobileError == .unauthorized { await expired() }
            else { searchError = "Die Suche ist gerade nicht verfügbar. Bitte versuche es erneut." }
        }
        guard account == generation, operation == searchOperation else { return }
        searchBusy = false
    }
    func searchTextDidChange() {
        searchOperation = UUID()
        searchBusy = false
        searchError = nil
        searchResults = []
    }
    func cancelSearch() {
        searchOperation = UUID()
        searchBusy = false
        searchResults = []
        searchPresented = false
    }
    func dismissScan() {
        scanOperation = UUID()
        scanBusy = false
        scanResult = nil
        scanError = nil
        lastRequest = nil
    }
    func leaveScan() {
        if scanBusy { dismissScan() }
        cancelSearch()
    }
    func logout() async {
        generation = UUID()
        authOperation = UUID()
        resetPersonalState()
        session = nil
        attempt = nil
        email = ""
        code = ""
        authBusy = false
        authError = nil
        pendingAccountLink = nil
        admission = .signedOut
        await client.logout()
    }
    private func expired() async {
        await logout()
        authError = "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an."
    }
    private func resetPersonalState() {
        dismissScan()
        cancelSearch()
        profileOperation = UUID()
        profile = nil
        profileError = nil
        searchText = ""
        searchError = nil
        selectedTab = .scan
    }
}
