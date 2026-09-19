import Foundation
import SwiftUI

@MainActor
@Observable
final class AppModel {
    enum Admission: Equatable { case signedOut, loading, ready, profileRequired, unavailable }
    enum Tab: Hashable { case scan, search, history, profile }
    let client: MobileClient
    let push: ResearchPushCoordinator
    private(set) var researchDeliveryEnabled = false
    private(set) var pendingResearchDestination: UUID?
    private(set) var researchDestinationBusy = false
    private(set) var researchDestinationError: String?
    private var researchDestinationOperation = UUID()
    var admission: Admission = .loading
    var selectedTab: Tab = .scan
    var session: MobileSession?
    var attempt: AuthAttempt?
    var email = ""
    var code = ""
    var authBusy = false
    var authError: String?
    var pendingAccountLink: LoginCallback?
    /// Opaque, one-purpose authority for profile completion after verified proof.
    /// It is never persisted and is not a scanner or ordinary-auth session.
    private(set) var completionAuthority: String?
    /// Installed only while the signed-out registration surface is visible.
    /// Keeping this separate prevents a registration callback from reaching normal auth.
    var registrationCallback: (@MainActor @Sendable (URL) async -> Bool)?
    var profile: HairProfile?
    var profileError: String?
    var profileEditPresented = false
    private(set) var profileEditPropertyID: String?
    private(set) var profileDraft: ProfileEditDraft?
    private(set) var profileEditLoading = false
    private(set) var profileSaving = false
    private(set) var profileEditConflict = false
    private(set) var profileEditError: String?
    var profileSavedMessage: String?
    var scanResult: ScanResult?
    var scanBusy = false
    var scanError: String?
    var lastRequest: ScanRequest?
    var searchText = ""
    var searchResults: [ScanProduct] = []
    var searchBusy = false
    var searchError: String?
    var searchSubmitted = false
    var resolveOrigin: Tab = .scan
    var historyEntries: [HistoryEntry] = []
    var historyFavoritesOnly = false
    var historyFavoriteBusy: Set<String> = []
    var historyFavoriteError: String?
    private var historyFavoriteRetryId: String?
    private var historyFavoriteRevisions: [String: UUID] = [:]
    private var historyFavoriteValues: [String: Bool] = [:]
    var historyBusy = false
    var historyError: String?
    var historyLoaded = false
    var historyNextCursor: String?
    var historyClearing = false
    var historySaveBusy = false
    var pendingHistorySaves: [ScanRequest] = []
    var pendingResearchSaves: [ResearchRequest] = []
    var researchBusy = false
    var researchChecking = false
    var researchChecked = false
    var researchPending = false
    var researchError: String?
    var researchRequest: ResearchRequest?
    var hasUnsavedHistory: Bool { !pendingHistorySaves.isEmpty || !pendingResearchSaves.isEmpty }
    #if DEBUG
    private var consumedCodeInjection = false
    func verifyCapturedTestCode(_ value: String) async {
        guard !consumedCodeInjection, admission == .signedOut, let attempt,
              value.count == attempt.codeLength, value.allSatisfy(\.isNumber) else { return }
        consumedCodeInjection = true
        await verify(attemptId: attempt.attemptId, code: value)
    }
    #endif
    private(set) var generation = UUID()
    private var authOperation = UUID()
    private var scanOperation = UUID()
    private var searchOperation = UUID()
    private var profileOperation = UUID()
    private var profileEditOperation = UUID()
    private var historyOperation = UUID()
    private var historySaveOperation = UUID()
    private var resolveFailures: [Tab: (request: ScanRequest, message: String)] = [:]
    private var restorationTask: Task<Void, Never>?

    init(client: MobileClient, push: ResearchPushCoordinator? = nil) {
        self.client = client
        self.push = push ?? ResearchPushCoordinator()
    }
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
        if let destination = ResearchDestination.parse(url) {
            researchDestinationOperation = UUID()
            pendingResearchDestination = destination
            researchDestinationError = nil
            researchDestinationBusy = false
            if admission == .loading, session == nil { await restore() }
            await openResearchDestination()
            return
        }
        if let registrationCallback, await registrationCallback(url) { return }
        let expected = generation, operation = authOperation
        if session == nil, admission == .loading, !authBusy { await restore() }
        guard expected == generation, operation == authOperation else { return }
        guard let callback = LoginCallback.parse(url, pending: session == nil ? attempt : nil, signedIn: false) else { return }
        if session != nil { pendingAccountLink = callback; return }
        await verify(attemptId: callback.attemptId, tokenHash: callback.tokenHash)
    }
    func finishRegistration(_ response: RegistrationCompletion, expectedGeneration: UUID? = nil) async -> Bool {
        let account = expectedGeneration ?? generation
        guard account == generation, session == nil else { return false }
        let clientGeneration = await client.sessionGeneration()
        guard account == generation else { return false }
        do {
            if let session = response.session, response.bootstrap?.status == .ready {
                try await client.install(session, ifGeneration: clientGeneration)
                guard account == generation else { return false }
                resetPersonalState()
                self.session = session
                attempt = nil
                email = ""
                code = ""
                authError = nil
                admission = .ready
                await admitResearchDelivery(response.bootstrap)
                return true
            }
            guard response.session == nil, response.status == .profile_required, response.completionToken?.isEmpty == false,
                  response.profileRevision?.isEmpty == false else { return false }
            completionAuthority = response.completionToken
            attempt = nil
            email = ""
            code = ""
            authError = nil
            admission = .profileRequired
            return true
        } catch {
            guard account == generation else { return false }
            authError = "Deine Anmeldung konnte gerade nicht abgeschlossen werden. Bitte versuche es erneut."
            return false
        }
    }
    func finishMissingProfile(_ response: RegistrationCompletion, expectedAuthority: String? = nil) async -> Bool {
        let account = generation
        let authority = completionAuthority
        guard response.bootstrap?.status == .ready,
              expectedAuthority == nil || authority == expectedAuthority else { return false }
        let clientGeneration = await client.sessionGeneration()
        guard account == generation,
              expectedAuthority == nil || completionAuthority == authority else { return false }
        do {
            if let authority {
                guard session == nil, let session = response.session else { return false }
                try await client.install(session, ifGeneration: clientGeneration)
                guard account == generation, completionAuthority == authority else { return false }
                self.session = session
                self.completionAuthority = nil
            } else if session == nil { return false }
            guard account == generation else { return false }
            resetPersonalState()
            admission = .ready
            await admitResearchDelivery(response.bootstrap)
            return true
        } catch { return false }
    }
#if DEBUG
    func installCompletionFixtureAuthority() {
        guard session == nil else { return }
        completionAuthority = "synthetic-completion-authority"
        admission = .profileRequired
    }
#endif
    func confirmAccountLink(_ callback: LoginCallback) async {
        pendingAccountLink = nil
        completionAuthority = nil
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
            let clientGeneration = await client.sessionGeneration()
            guard account == generation, operation == authOperation else { return }
            let value = try await client.verify(attemptId: attemptId, code: code, tokenHash: tokenHash)
            guard account == generation, operation == authOperation else { return }
            if let verifiedSession = value.session {
                try await client.install(verifiedSession, ifGeneration: clientGeneration)
                guard account == generation, operation == authOperation else { return }
                resetPersonalState()
                session = verifiedSession
                attempt = nil
                self.code = ""
                authBusy = false
                await bootstrap()
            } else if let completionToken = value.completionToken, !completionToken.isEmpty,
                      value.profileRevision?.isEmpty == false {
                completionAuthority = completionToken
                await client.clearPendingAttempt()
                attempt = nil
                self.code = ""
                authBusy = false
                admission = .profileRequired
            } else { throw MobileError.invalidResponse }
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
            await admitResearchDelivery(response)
        } catch {
            guard account == generation else { return }
            if error as? MobileError == .unauthorized { await expired() }
            else { admission = .unavailable }
        }
    }
    private func admitResearchDelivery(_ response: Bootstrap?) async {
        let account = generation
        researchDeliveryEnabled = admission == .ready && response?.researchDeliveryEnabled == true
        await push.activate(client: client, enabled: researchDeliveryEnabled)
        guard account == generation else { return }
        if admission == .ready { await openResearchDestination() }
    }
    func refreshPushRegistration() async {
        guard admission == .ready else { return }
        await push.activate(client: client, enabled: researchDeliveryEnabled)
    }
    func openResearchDestination() async {
        guard admission == .ready, let destination = pendingResearchDestination, !researchDestinationBusy else { return }
        let account = generation, operation = UUID()
        researchDestinationOperation = operation
        researchDestinationBusy = true; researchDestinationError = nil
        dismissScan()
        selectedTab = .history
        resolveOrigin = .history
        do {
            let result = try await client.researchResult(destination)
            guard account == generation, operation == researchDestinationOperation, admission == .ready else { return }
            pendingResearchDestination = nil
            scanResult = result
        } catch {
            guard account == generation, operation == researchDestinationOperation else { return }
            switch error as? MobileError {
            case .unauthorized:
                await expired(preservingResearchDestination: destination)
                return
            case .researchNotReady: researchDestinationError = "Die Einschätzung ist noch nicht verfügbar."
            case .researchNotFound: researchDestinationError = "Dieses Ergebnis gehört nicht zu diesem Konto oder ist nicht mehr verfügbar."
            default: researchDestinationError = "Ergebnis konnte nicht geladen werden. Bitte erneut versuchen."
            }
        }
        guard account == generation, operation == researchDestinationOperation else { return }
        researchDestinationBusy = false
    }
    func dismissResearchDestination() {
        researchDestinationOperation = UUID()
        pendingResearchDestination = nil; researchDestinationBusy = false; researchDestinationError = nil
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
    func beginProfileEdit(propertyID: String? = nil) async {
        guard admission == .ready, !profileEditPresented, !profileSaving, !profileEditLoading else { return }
        if let propertyID, !ProfileEditSnapshot.questionIDs.contains(propertyID) { return }
        profileEditPropertyID = propertyID
        profileEditPresented = true
        profileSavedMessage = nil
        await reloadProfileEdit()
    }
    /// Explicitly reloads the authoritative snapshot; conflicts never silently overwrite it.
    func reloadProfileEdit() async {
        guard admission == .ready, !profileSaving, !profileEditLoading else { return }
        let account = generation, operation = UUID()
        profileEditOperation = operation
        profileEditLoading = true
        profileEditError = nil
        do {
            let snapshot = try await client.editableProfile()
            guard account == generation, operation == profileEditOperation, profileEditPresented else { return }
            profileDraft = ProfileEditDraft(snapshot: snapshot, propertyID: profileEditPropertyID)
            profileEditConflict = false
        } catch {
            guard account == generation, operation == profileEditOperation else { return }
            if error as? MobileError == .unauthorized { await expired(); return }
            profileEditError = error as? MobileError == .profileRequired
                ? "Für dieses Konto fehlen vollständige Haarangaben."
                : "Deine Haarangaben konnten nicht geladen werden. Bitte versuche es erneut."
        }
        guard account == generation, operation == profileEditOperation else { return }
        profileEditLoading = false
    }
    func changeProfileDraft(_ change: (inout ProfileEditDraft) -> Void) {
        guard !profileSaving, !profileEditLoading, !profileEditConflict, profileDraft != nil else { return }
        change(&profileDraft!)
        profileEditError = nil
    }
    func cancelProfileEdit() {
        guard !profileSaving else { return }
        clearProfileEdit()
    }
    private func clearProfileEdit() {
        profileEditOperation = UUID()
        profileEditPresented = false
        profileEditPropertyID = nil
        profileDraft = nil
        profileEditLoading = false
        profileSaving = false
        profileEditConflict = false
        profileEditError = nil
    }
    func saveProfileEdit() async {
        guard admission == .ready, !profileSaving, !profileEditLoading, !profileEditConflict,
              profileDraft?.canSave == true else { return }
        let account = generation, operation = UUID()
        profileEditOperation = operation
        let request = profileDraft!.saveRequest()
        profileSaving = true
        profileEditError = nil
        do {
            let saved = try await client.saveProfile(request)
            guard account == generation, operation == profileEditOperation else { return }
            // Reject any profile/scan/search load that started against the previous context.
            profileOperation = UUID()
            profile = HairProfile(profileRevision: saved.profileRevision, answers: saved.answers)
            profileError = nil
            dismissScan()
            resolveFailures.removeAll()
            cancelSearch()
            searchText = ""
            searchError = nil
            clearProfileEdit()
            profileSavedMessage = "Deine Haarangaben wurden aktualisiert."
        } catch {
            guard account == generation, operation == profileEditOperation else { return }
            if error as? MobileError == .unauthorized { await expired(); return }
            profileSaving = false
            switch error as? MobileError {
            case .profileConflict:
                profileEditConflict = true
                profileEditError = "Deine Haarangaben wurden inzwischen geändert. Dein Entwurf bleibt hier erhalten. Lade die aktuellen Angaben neu, um weiterzumachen. Dabei wird dieser Entwurf verworfen."
            case .invalidProfile:
                profileEditError = "Bitte prüfe deine Antworten. Die Änderungen konnten nicht gespeichert werden."
            case .profileRequired:
                profileEditConflict = true
                profileEditError = "Deine gespeicherten Haarangaben sind nicht mehr vollständig. Lade die aktuellen Angaben neu."
            default:
                // A lost response may follow a committed save. Retry the identical operation.
                profileEditError = "Wir konnten das Speichern nicht bestätigen. Dein Entwurf bleibt erhalten. Versuche es erneut, um den Speicherstatus zu bestätigen."
            }
        }
    }
    func resolve(_ request: ScanRequest, replacingPresentedResult: Bool = false) async {
        guard admission == .ready, !scanBusy, scanResult == nil || replacingPresentedResult else { return }
        if researchDestinationBusy { dismissResearchDestination() }
        let account = generation, operation = UUID()
        scanOperation = operation
        resolveOrigin = selectedTab
        resolveFailures[selectedTab] = nil
        resetResearch()
        lastRequest = request
        scanBusy = true
        scanError = nil
        do {
            let result = try await client.resolve(request)
            guard account == generation, operation == scanOperation, admission == .ready else { return }
            trackHistorySave(request, saved: result.historySaved)
            if result.kind == .profile_required { admission = .profileRequired }
            else if result.kind == .retryable_error || (result.kind == .authority_unavailable && result.reason != "personal_target_unavailable") {
                scanError = "Die Einschätzung konnte nicht geladen werden. Dein Barcode bleibt für einen neuen Versuch erhalten."
            } else { scanResult = result }
        } catch {
            guard account == generation, operation == scanOperation else { return }
            if error as? MobileError == .unauthorized { await expired() }
            else if error as? MobileError == .invalidBarcode { scanError = "Barcode ungültig. Prüfe die 8 oder 13 Ziffern." }
            else { scanError = "Die Verbindung ist gerade nicht verfügbar. Versuche es erneut." }
        }
        guard account == generation, operation == scanOperation else { return }
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
            guard account == generation, operation == searchOperation else { return }
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
        searchSubmitted = false
        searchOperation = UUID()
        searchBusy = false
        searchError = nil
        searchResults = []
    }
    func cancelSearch() {
        searchOperation = UUID()
        searchBusy = false
        searchResults = []
        searchSubmitted = false
    }
    func dismissScan() {
        resolveFailures[resolveOrigin] = nil
        scanOperation = UUID()
        scanBusy = false
        scanResult = nil
        scanError = nil
        lastRequest = nil
        resetResearch()
    }
    func changeTab(from previous: Tab) {
        if previous == .history, selectedTab != .history, researchDestinationBusy { dismissResearchDestination() }
        // Invalidate only the request belonging to the page being left.
        if scanBusy, resolveOrigin == previous { dismissScan() }
        if previous == .search, searchBusy {
            searchOperation = UUID(); searchBusy = false; searchSubmitted = false
        }
        if let request = lastRequest, let message = scanError {
            resolveFailures[resolveOrigin] = (request, message)
        }
        resolveOrigin = selectedTab
        lastRequest = resolveFailures[selectedTab]?.request
        scanError = resolveFailures[selectedTab]?.message
    }

    private func trackHistorySave(_ request: ScanRequest, saved: Bool?) {
        guard request.recordHistory != false else { return }
        if saved == false {
            if !pendingHistorySaves.contains(request) { pendingHistorySaves.append(request) }
        } else if saved == true { pendingHistorySaves.removeAll { $0 == request } }
    }
    func loadHistory(more: Bool = false) async {
        guard admission == .ready, !historyClearing else { return }
        if more, historyBusy || historyNextCursor == nil { return }
        let account = generation, operation = UUID()
        let favoriteRevisions = historyFavoriteRevisions
        historyOperation = operation
        historyBusy = true; historyError = nil
        do {
            let response = try await client.history(cursor: more ? historyNextCursor : nil, favoritesOnly: historyFavoritesOnly)
            guard account == generation, operation == historyOperation else { return }
            var entries = response.entries.map { entry in
                var current = entry
                if historyFavoriteBusy.contains(entry.id) || favoriteRevisions[entry.id] != historyFavoriteRevisions[entry.id],
                   let favorite = historyFavoriteValues[entry.id] { current.isFavorite = favorite }
                return current
            }.filter { !historyFavoritesOnly || $0.isFavorite || historyFavoriteBusy.contains($0.id) }
            // A filtered read may finish before the PATCH acknowledgement. Keep
            // the optimistic row available for rollback until that write settles.
            let returnedIDs = Set(entries.map(\.id))
            entries.append(contentsOf: historyEntries.filter { historyFavoriteBusy.contains($0.id) && !returnedIDs.contains($0.id) })
            entries.sort { $0.lastSeenAt == $1.lastSeenAt ? $0.id > $1.id : $0.lastSeenAt > $1.lastSeenAt }
            if more {
                let existingIDs = Set(historyEntries.map(\.id))
                historyEntries.append(contentsOf: entries.filter { !existingIDs.contains($0.id) })
            } else { historyEntries = entries }
            historyNextCursor = response.nextCursor
            historyLoaded = true
        } catch {
            guard account == generation, operation == historyOperation else { return }
            if error as? MobileError == .unauthorized { await expired(); return }
            historyError = "Verlauf konnte nicht geladen werden."
        }
        guard account == generation, operation == historyOperation else { return }
        historyBusy = false
    }
    func setHistoryFilter(favoritesOnly: Bool) async {
        guard historyFavoritesOnly != favoritesOnly, !historyClearing, historyFavoriteBusy.isEmpty else { return }
        historyFavoritesOnly = favoritesOnly
        historyEntries = []; historyNextCursor = nil; historyLoaded = false
        await loadHistory()
    }
    func toggleHistoryFavorite(_ entry: HistoryEntry) async {
        guard admission == .ready, !historyClearing, !historyFavoriteBusy.contains(entry.id) else { return }
        let account = generation
        let original = historyEntries.first { $0.id == entry.id }?.isFavorite ?? entry.isFavorite
        let desired = !original
        historyFavoriteBusy.insert(entry.id)
        historyFavoriteError = nil; historyFavoriteRetryId = nil
        updateHistoryFavorite(entry.id, value: desired)
        do {
            _ = try await client.setHistoryFavorite(entryId: entry.id, isFavorite: desired)
            guard account == generation else { return }
            updateHistoryFavorite(entry.id, value: desired)
            if historyFavoritesOnly, !desired { historyEntries.removeAll { $0.id == entry.id } }
        } catch {
            guard account == generation else { return }
            if error as? MobileError == .unauthorized { await expired(); return }
            updateHistoryFavorite(entry.id, value: original)
            historyFavoriteRetryId = entry.id
            historyFavoriteError = "Favorit konnte nicht gespeichert werden. Bitte erneut versuchen."
        }
        historyFavoriteBusy.remove(entry.id)
    }
    func retryHistoryFavorite() async {
        guard let id = historyFavoriteRetryId, let entry = historyEntries.first(where: { $0.id == id }) else {
            historyFavoriteError = nil; return
        }
        await toggleHistoryFavorite(entry)
    }
    private func updateHistoryFavorite(_ id: String, value: Bool) {
        historyFavoriteRevisions[id] = UUID(); historyFavoriteValues[id] = value
        if let index = historyEntries.firstIndex(where: { $0.id == id }) { historyEntries[index].isFavorite = value }
    }
    func clearHistory() async {
        guard admission == .ready, !historyClearing, !historySaveBusy, historyFavoriteBusy.isEmpty else { return }
        let account = generation, operation = UUID()
        historyOperation = operation
        historySaveOperation = UUID()
        historyClearing = true; historyBusy = false; historyError = nil
        do {
            try await client.clearHistory()
            guard account == generation, operation == historyOperation else { return }
            historyEntries.removeAll { !$0.isFavorite }; historyLoaded = true; historyNextCursor = nil
            pendingHistorySaves = []; pendingResearchSaves = []
        } catch {
            guard account == generation, operation == historyOperation else { return }
            if error as? MobileError == .unauthorized { await expired(); return }
            historyError = "Verlauf konnte nicht gelöscht werden."
        }
        guard account == generation, operation == historyOperation else { return }
        historyClearing = false
        if historyError == nil { await loadHistory() }
    }
    func retryHistorySaving() async {
        guard !historySaveBusy, !historyClearing else { return }
        let account = generation, operation = UUID()
        historySaveOperation = operation; historySaveBusy = true
        do {
            for request in pendingHistorySaves {
                let result = try await client.resolve(request)
                guard account == generation, operation == historySaveOperation else { return }
                trackHistorySave(request, saved: result.historySaved)
            }
            for request in pendingResearchSaves {
                let result = try await client.submitResearch(request)
                guard account == generation, operation == historySaveOperation else { return }
                if result.historySaved { pendingResearchSaves.removeAll { $0 == request } }
            }
        } catch {
            guard account == generation, operation == historySaveOperation else { return }
            if error as? MobileError == .unauthorized { await expired(); return }
        }
        guard account == generation, operation == historySaveOperation else { return }
        historySaveBusy = false
        if selectedTab == .history { await loadHistory() }
    }
    func checkResearchStatus() async {
        guard let barcode = lastRequest?.identifier?.value, !researchChecking, !researchBusy else { return }
        let account = generation, operation = scanOperation
        researchChecking = true; researchError = nil
        do {
            let response = try await client.history(barcode: barcode)
            guard account == generation, operation == scanOperation else { return }
            researchPending = response.entries.contains {
                $0.barcodeGtin?.drop(while: { $0 == "0" }) == barcode.drop(while: { $0 == "0" }) && $0.status == .in_research
            }
            researchChecked = true
        } catch {
            guard account == generation, operation == scanOperation else { return }
            if error as? MobileError == .unauthorized { await expired(); return }
            researchChecked = false
            researchError = "Prüfstatus konnte nicht geladen werden. Bitte erneut versuchen."
        }
        guard account == generation, operation == scanOperation else { return }
        researchChecking = false
    }
    func submitResearch(category: String, retailerMatchDecision: ResearchRequest.RetailerMatchDecision? = nil) async {
        guard let identifier = lastRequest?.identifier, !researchBusy, !researchChecking, !researchPending, researchChecked else { return }
        let request = researchRequest ?? ResearchRequest(identifier: identifier, category: category,
                                                          retailerMatchDecision: retailerMatchDecision)
        researchRequest = request
        let account = generation, operation = scanOperation
        researchBusy = true; researchError = nil
        do {
            let result = try await client.submitResearch(request)
            guard account == generation, operation == scanOperation else { return }
            if result.historySaved {
                pendingResearchSaves.removeAll { $0 == request }
                pendingHistorySaves.removeAll { $0.identifier == request.identifier }
            }
            else if !pendingResearchSaves.contains(request) { pendingResearchSaves.append(request) }
            if result.kind == .pending_submission {
                researchPending = true
                if researchDeliveryEnabled { push.confirmedResearch() }
            }
            else if let productId = result.productId {
                // Keep the sheet mounted while loading a product that became
                // available between lookup and submission.
                await resolve(.product(productId).withoutHistory(), replacingPresentedResult: true)
            }
        } catch {
            guard account == generation, operation == scanOperation else { return }
            if error as? MobileError == .unauthorized { await expired(); return }
            researchError = "Einreichung noch nicht bestätigt. Bitte erneut versuchen."
        }
        guard account == generation, operation == scanOperation else { return }
        researchBusy = false
    }
    private func resetResearch() {
        researchBusy = false; researchChecking = false; researchChecked = false
        researchPending = false; researchError = nil; researchRequest = nil
    }
    func logout(preservingResearchDestination destination: UUID? = nil) async {
        let pushInstallationId = push.installationToRevoke
        generation = UUID()
        authOperation = UUID()
        completionAuthority = nil
        dismissResearchDestination()
        pendingResearchDestination = destination
        researchDeliveryEnabled = false
        push.endSession()
        resetPersonalState()
        session = nil
        attempt = nil
        email = ""
        code = ""
        authBusy = false
        authError = nil
        pendingAccountLink = nil
        admission = .signedOut
        await client.logout(pushInstallationId: pushInstallationId)
    }
    private func expired(preservingResearchDestination destination: UUID? = nil) async {
        await logout(preservingResearchDestination: destination)
        if admission == .signedOut { authError = "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an." }
    }
    private func resetPersonalState() {
        completionAuthority = nil
        clearProfileEdit()
        profileSavedMessage = nil
        dismissScan()
        cancelSearch()
        profileOperation = UUID()
        profile = nil
        profileError = nil
        searchText = ""
        searchError = nil
        searchSubmitted = false
        historyOperation = UUID(); historySaveOperation = UUID()
        historyEntries = []; historyBusy = false; historyLoaded = false; historyError = nil; historyNextCursor = nil
        historyFavoritesOnly = false; historyFavoriteBusy = []; historyFavoriteError = nil; historyFavoriteRetryId = nil
        historyFavoriteRevisions = [:]; historyFavoriteValues = [:]
        historyClearing = false; historySaveBusy = false; pendingHistorySaves = []; pendingResearchSaves = []
        resolveFailures.removeAll()
        selectedTab = .scan
    }
}

/// Authenticated, missing-only completion. It accepts only server-listed question
/// IDs and serializes only those values; existing profile fields cannot be edited here.
@MainActor @Observable
final class MissingProfileCompletionModel {
    enum Stage: Equatable { case loading, questions, saving, unavailable }
    private let client: MobileClient
    private let completionAuthority: String?
    private let ready: @MainActor (RegistrationCompletion) async -> Bool
    private var snapshot: MissingProfileCompletion?
    private var index = 0
    private var values: [String: [String]] = [:]
    private var scalpIssue: Bool?
    private var scalpCondition: String?
    private var requestID = UUID()
    private var requiresReload = false
    var stage: Stage = .loading
    var error: String?

    init(client: MobileClient, completionAuthority: String? = nil,
         ready: @escaping @MainActor (RegistrationCompletion) async -> Bool) {
        self.client = client; self.completionAuthority = completionAuthority; self.ready = ready
    }
    var question: EditQuestion? { snapshot?.questions.indices.contains(index) == true ? snapshot?.questions[index] : nil }
    var isScalpGate: Bool { question?.id == "scalp_type" && values["scalp_type"]?.first != nil && scalpIssue == nil }
    var isScalpCondition: Bool { question?.id == "scalp_type" && scalpIssue == true && scalpCondition == nil }
    var selected: [String] { question.flatMap { values[$0.id] } ?? [] }
    var currentOptions: [EditQuestion.Option] {
        guard let question else { return [] }
        return question.options(for: values["structure"]?.first ?? snapshot?.answers.structure ?? "")
    }
    var canAdvance: Bool {
        guard let question else { return false }
        if question.id == "scalp_type" {
            return !isScalpGate && !isScalpCondition && values["scalp_type"]?.first != nil && scalpIssue != nil
        }
        return question.id == "concerns" || !(values[question.id] ?? []).isEmpty
    }
    func load() async {
        guard stage != .saving else { return }
        stage = .loading; error = nil
        do {
            let response = try await client.missingProfileCompletion(completionToken: completionAuthority)
            guard !response.profileRevision.isEmpty else { throw MobileError.invalidResponse }
            snapshot = response; index = 0; values = [:]; scalpIssue = nil; scalpCondition = nil; requestID = UUID(); requiresReload = false
            if response.questions.isEmpty { await save() }
            else { stage = .questions }
        } catch {
            stage = .unavailable
            self.error = "Die fehlenden Haarangaben konnten nicht geladen werden. Bitte versuche es erneut."
        }
    }
    func select(_ value: String) {
        guard stage == .questions, let question, !isScalpGate, !isScalpCondition,
              currentOptions.contains(where: { $0.value == value }) else { return }
        var selected = values[question.id] ?? []
        if question.selectionMode == .single { selected = [value] }
        else if selected.contains(value) { selected.removeAll { $0 == value } }
        else {
            if question.id == "treatment" { selected = value == "natur" ? [] : selected.filter { $0 != "natur" } }
            if question.id == "goals" { selected.removeAll { value == "volume" ? $0 == "less_volume" : value == "less_volume" && $0 == "volume" } }
            if question.maxSelections.map({ selected.count >= $0 }) == true { return }
            selected.append(value)
        }
        values[question.id] = selected
    }
    func setScalpIssue(_ value: Bool) { guard isScalpGate else { return }; scalpIssue = value; if !value { scalpCondition = nil } }
    func selectScalpCondition(_ value: String) {
        guard isScalpCondition, question?.conditionOptions?.contains(where: { $0.value == value }) == true else { return }
        scalpCondition = value
    }
    func advance() {
        guard canAdvance else { return }
        if let snapshot, index + 1 < snapshot.questions.count { index += 1 }
        else { Task { await save() } }
    }
    func back() { guard stage == .questions, index > 0 else { return }; index -= 1 }
    func retry() async {
        if requiresReload || snapshot == nil { await load() }
        else { await save() }
    }
    private func save() async {
        guard let snapshot else { return }
        stage = .saving; error = nil
        var answers = PartialQuizAnswers()
        for question in snapshot.questions { answers.set(values[question.id] ?? [], for: question.id) }
        if values["scalp_type"] != nil { answers.has_scalp_issue = scalpIssue; answers.scalp_condition = scalpCondition }
        do {
            let response = try await client.completeMissingProfile(.init(requestId: requestID,
                                                                          expectedProfileRevision: snapshot.profileRevision,
                                                                          answers: answers),
                                                           completionToken: completionAuthority)
            guard await ready(response) else { throw MobileError.invalidResponse }
        } catch {
            if error as? MobileError == .profileConflict {
                requiresReload = true
                stage = .unavailable
                self.error = "Dein Haarprofil wurde geändert. Bitte lade die fehlenden Angaben erneut."
            } else if snapshot.questions.isEmpty {
                stage = .unavailable
                self.error = "Deine Haarangaben konnten noch nicht gespeichert werden. Bitte versuche es erneut."
            } else {
                stage = .questions
                self.error = "Deine Haarangaben konnten noch nicht gespeichert werden. Deine Antworten bleiben hier. Bitte versuche es erneut."
            }
        }
    }
}
