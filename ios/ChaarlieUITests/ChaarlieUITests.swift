import XCTest

@MainActor
final class ChaarlieUITests: XCTestCase {
    private func fixtureApp(largeText: Bool = false, missingShop: Bool = false, longExplanation: Bool = false, reduceMotion: Bool = false, glossaryDimension: String? = nil) throws -> XCUIApplication {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "scan-v1", withExtension: "json"))
        var fixture = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        if let dimension = glossaryDimension {
            let row = try glossaryRow(dimension)
            fixture["rows"] = [row]
            fixture["alternatives"] = []
        }
        if missingShop {
            var product = fixture["product"] as! [String: Any]
            product["purchaseUrl"] = NSNull()
            fixture["product"] = product
        }
        if longExplanation {
            var rows = fixture["rows"] as! [[String: Any]]
            let definition = rows[0]["definition"] as! String
            rows[0]["definition"] = Array(repeating: definition, count: 4).joined(separator: " ")
            fixture["rows"] = rows
        }
        let app = XCUIApplication()
        app.launchArguments = ["--ui-assessment-fixture"]
        if reduceMotion { app.launchArguments += ["--ui-reduce-motion"] }
        if largeText { app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"] }
        app.launchEnvironment["CHAARLIE_UI_FIXTURE_JSON"] = String(data: try JSONSerialization.data(withJSONObject: fixture), encoding: .utf8)
        app.launch()
        XCTAssertTrue(app.staticTexts["assessment.verdict"].waitForExistence(timeout: 10))
        return app
    }
    private func screenshot(_ name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    private func bringIntoView(_ row: XCUIElement, app: XCUIApplication) {
        for _ in 0..<6 {
            if row.exists, row.isHittable, row.frame.minY >= 90, row.frame.maxY <= app.frame.maxY - 110 { return }
            let upper = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.40))
            let lower = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.65))
            if row.exists, row.frame.minY < 90 { upper.press(forDuration: 0.05, thenDragTo: lower) }
            else { lower.press(forDuration: 0.05, thenDragTo: upper) }
        }
        XCTAssertTrue(row.isHittable, "Comparison row must be reachable before opening its explanation")
    }
    private func checkStationaryExplanation(app: XCUIApplication, row: XCUIElement, name: String, scrollLongContent: Bool = false) throws {
        bringIntoView(row, app: app)
        let before = row.frame
        screenshot("\(name)-before", app: app)
        row.tap()
        let close = app.buttons["Erklärung schließen"]
        XCTAssertTrue(close.waitForExistence(timeout: 3))
        let during = row.exists ? row.frame : nil
        let panel = app.descendants(matching: .any).matching(identifier: "explanation.panel").firstMatch
        XCTAssertTrue(panel.waitForExistence(timeout: 3), "Panel must expose its actual accessible container bounds")
        let panelFrame = panel.exists ? panel.frame : .zero
        if !scrollLongContent {
            XCTAssertLessThan(panelFrame.height, app.frame.height * 0.65, "Short explanation should use natural content height, not fill the screen")
        }
        screenshot("\(name)-open", app: app)
        if scrollLongContent {
            let body = app.descendants(matching: .any).matching(identifier: "explanation.body").firstMatch
            let values = app.descendants(matching: .any).matching(identifier: "glossary.row.rich").firstMatch
            let title = app.staticTexts["explanation.title"]
            let titleBefore = title.frame
            XCTAssertTrue(body.exists)
            for _ in 0..<8 {
                if values.exists, values.isHittable, values.frame.minY >= panelFrame.minY, values.frame.maxY <= panelFrame.maxY { break }
                body.swipeUp()
            }
            XCTAssertTrue(values.isHittable, "Long glossary must scroll to its final entry")
            XCTAssertTrue(close.isHittable, "Close remains reachable after scrolling long explanation")
            XCTAssertTrue(title.isHittable, "Title remains reachable while glossary content scrolls")
            XCTAssertEqual(title.frame.minY, titleBefore.minY, accuracy: 1, "Title stays pinned")
            let heights = ["light", "medium", "rich"].map {
                app.descendants(matching: .any).matching(identifier: "glossary.row.\($0)").firstMatch.frame.height
            }
            XCTAssertGreaterThanOrEqual(heights[0], 48)
            for height in heights { XCTAssertEqual(height, heights[0], accuracy: 1, "Stacked accessibility rows remain equal-height") }
            let rowGeometry = XCTAttachment(string: "largestTextRowHeights=\(heights)")
            rowGeometry.name = "glossary-largest-text-row-geometry"
            rowGeometry.lifetime = .keepAlways
            add(rowGeometry)
            screenshot("\(name)-scrolled", app: app)
        }
        close.tap()
        XCTAssertTrue(row.waitForExistence(timeout: 3))
        let after = row.frame
        screenshot("\(name)-closed", app: app)
        let geometry = XCTAttachment(string: "before=\(before); during=\(String(describing: during)); after=\(after); panel=\(panelFrame); screen=\(app.frame)")
        geometry.name = "\(name)-geometry"
        geometry.lifetime = .keepAlways
        add(geometry)
        XCTAssertEqual(after.minY, before.minY, accuracy: 1, "Closing explanation must preserve result scroll position")
        XCTAssertEqual(after.height, before.height, accuracy: 1)
        if let during {
            XCTAssertEqual(during.minY, before.minY, accuracy: 1, "Opening explanation must not move result sheet")
            XCTAssertEqual(during.height, before.height, accuracy: 1)
        } else { XCTFail("Underlying result must remain observable for the stationary-frame regression") }
        XCTAssertEqual(panelFrame.midX, app.frame.midX, accuracy: 2, "Explanation is horizontally centered")
        // Safe-area centering differs from physical screen centering by about 14 points on this iPhone.
        XCTAssertEqual(panelFrame.midY, app.frame.midY, accuracy: 24, "Explanation is centered within the safe screen area")
    }
    private func glossaryRow(_ dimension: String) throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "glossary-v1", withExtension: "json"))
        let fixture = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        let rows = try XCTUnwrap(fixture["rows"] as? [[String: Any]])
        var row = try XCTUnwrap(rows.first { $0["dimensionId"] as? String == dimension })
        // Sentinel values distinguish comparison-only content from legitimate words in a definition.
        row["productValue"] = "PRODUCT_ONLY_SENTINEL"
        row["targetValue"] = "TARGET_ONLY_SENTINEL"
        row["categoryFit"] = "CATEGORY_ONLY_SENTINEL"
        return row
    }
    func testGlossaryEntriesAndEqualHeightAcrossAxes() throws {
        for dimension in ["conditioner.repair_support", "shampoo.cleansing_intensity", "shampoo.scalp_route", "leave_in.heat_protection"] {
            let expected = try glossaryRow(dimension)
            let app = try fixtureApp(glossaryDimension: dimension)
            let resultRow = app.buttons["comparison.\(dimension)"]
            let before = resultRow.frame
            let forbidden = ["PRODUCT_ONLY_SENTINEL", "TARGET_ONLY_SENTINEL", "CATEGORY_ONLY_SENTINEL", "WAS BEDEUTET", "DEIN ZIEL", "PRODUKT"]
            resultRow.tap()
            let close = app.buttons["Erklärung schließen"]
            XCTAssertTrue(close.waitForExistence(timeout: 3))
            let panel = app.descendants(matching: .any).matching(identifier: "explanation.panel").firstMatch
            XCTAssertTrue(panel.exists)
            for text in forbidden {
                XCTAssertEqual(panel.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", text)).count, 0, "Glossary excludes comparison field: \(text)")
            }
            XCTAssertFalse(app.descendants(matching: .any).matching(identifier: "explanation.values").firstMatch.exists)
            let stops = try XCTUnwrap(expected["stops"] as? [[String: Any]])
            var heights: [CGFloat] = []
            for stop in stops {
                let id = try XCTUnwrap(stop["id"] as? String)
                let label = try XCTUnwrap(stop["label"] as? String)
                let meaning = try XCTUnwrap(stop["meaning"] as? String)
                let entry = panel.descendants(matching: .any).matching(identifier: "glossary.row.\(id)").firstMatch
                XCTAssertTrue(entry.exists, "Every stop is exposed")
                XCTAssertEqual(entry.label, "\(label): \(meaning)")
                heights.append(entry.frame.height)
            }
            let first = try XCTUnwrap(heights.first)
            XCTAssertGreaterThanOrEqual(first, 48)
            for height in heights { XCTAssertEqual(height, first, accuracy: 1, "All glossary rows have equal height") }
            screenshot("glossary-\(dimension)", app: app)
            let geometry = XCTAttachment(string: "dimension=\(dimension); rowHeights=\(heights); panel=\(panel.frame)")
            geometry.name = "glossary-geometry-\(dimension)"; geometry.lifetime = .keepAlways; add(geometry)
            XCTAssertEqual(resultRow.frame.minY, before.minY, accuracy: 1)
            close.tap()
            XCTAssertEqual(resultRow.frame.minY, before.minY, accuracy: 1)
        }
    }
    func testMainExplanationKeepsResultStationary() throws {
        let app = try fixtureApp()
        for (index, dimension) in ["conditioner.weight", "conditioner.care_direction", "conditioner.repair_support", "conditioner.weight"].enumerated() {
            let row = app.buttons.matching(identifier: "comparison.\(dimension)").firstMatch
            try checkStationaryExplanation(app: app, row: row, name: "explanation-main-\(index + 1)-\(dimension)")
        }
    }
    func testAlternativeExplanationKeepsResultStationary() throws {
        let app = try fixtureApp()
        app.swipeUp()
        let row = app.buttons.matching(NSPredicate(format: "identifier == %@ AND label CONTAINS %@", "comparison.conditioner.weight", "Produkt: leicht, dein Ziel: leicht")).firstMatch
        try checkStationaryExplanation(app: app, row: row, name: "explanation-alternative")
    }
    func testLargestTextExplanationScrollPreservesResult() throws {
        let app = try fixtureApp(largeText: true, missingShop: true, longExplanation: true)
        try checkStationaryExplanation(app: app, row: app.buttons.matching(NSPredicate(format: "identifier == %@ AND label CONTAINS %@", "comparison.conditioner.weight", "Produkt: mittel, dein Ziel: leicht")).firstMatch, name: "explanation-largest-text", scrollLongContent: true)
    }
    func testReduceMotionExplanationKeepsResultStationary() throws {
        let app = try fixtureApp(reduceMotion: true)
        try checkStationaryExplanation(app: app, row: app.buttons.matching(NSPredicate(format: "identifier == %@ AND label CONTAINS %@", "comparison.conditioner.weight", "Produkt: mittel, dein Ziel: leicht")).firstMatch, name: "explanation-reduce-motion")
    }
    func testAssessmentTableExplanationAlternativesAndDismiss() throws {
        let app = try fixtureApp()
        XCTAssertTrue(app.buttons["assessment.buy"].exists)
        XCTAssertTrue(app.buttons["comparison.conditioner.weight"].label.contains("Produkt: mittel, dein Ziel: leicht"))
        XCTAssertEqual(app.buttons["assessment.buy"].label, "Feuchtigkeits-Conditioner kaufen, öffnet den Shop")
        try app.performAccessibilityAudit(for: [.elementDetection, .sufficientElementDescription, .trait])
        screenshot("assessment-standard", app: app)
        app.buttons["assessment.buy"].tap()
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        let safariOpened = XCTNSPredicateExpectation(predicate: NSPredicate(format: "state == %d", XCUIApplication.State.runningForeground.rawValue), object: safari)
        XCTAssertEqual(XCTWaiter.wait(for: [safariOpened], timeout: 10), .completed)
        app.activate()
        XCTAssertTrue(app.staticTexts["assessment.verdict"].waitForExistence(timeout: 5))
        screenshot("assessment-shop-return", app: app)
        let row = app.buttons["comparison.conditioner.weight"]
        XCTAssertTrue(row.exists)
        row.tap()
        XCTAssertTrue(app.buttons["Erklärung schließen"].waitForExistence(timeout: 3))
        screenshot("assessment-explanation", app: app)
        app.buttons["Erklärung schließen"].tap()
        app.swipeUp()
        screenshot("assessment-alternatives", app: app)
        app.buttons["Ergebnis schließen"].tap()
        XCTAssertTrue(app.staticTexts["Ergebnis geschlossen"].waitForExistence(timeout: 3))
    }
    func testLargeTextAndMissingShopFooter() throws {
        let app = try fixtureApp(largeText: true, missingShop: true)
        XCTAssertFalse(app.buttons["assessment.buy"].exists)
        screenshot("assessment-large-text-no-footer", app: app)
        app.swipeUp()
        screenshot("assessment-large-text-rows", app: app)
        XCTAssertFalse(app.buttons["Hinzufügen"].exists)
    }
    func testConnectedLocalAuthProfileSearchResultLogout() async throws {
        guard ProcessInfo.processInfo.environment["CHAARLIE_CONNECTED_TESTS"] == "1" else {
            throw XCTSkip("Enable CHAARLIE_CONNECTED_TESTS=1 only with the isolated synthetic product stack.")
        }
        continueAfterFailure = false
        let app = XCUIApplication()
        addUIInterruptionMonitor(withDescription: "System camera permission") { alert in
            for label in ["Allow", "Erlauben", "OK"] where alert.buttons[label].exists { alert.buttons[label].tap(); return true }
            return false
        }
        app.launch()
        if app.tabBars.buttons["Profil"].waitForExistence(timeout: 3) {
            app.tabBars.buttons["Profil"].tap()
            app.buttons["profile.logout"].tap()
        }
        if app.buttons["Andere E-Mail verwenden"].exists { app.buttons["Andere E-Mail verwenden"].tap() }
        XCTAssertTrue(app.textFields["login.email"].waitForExistence(timeout: 10))
        app.textFields["login.email"].tap()
        app.textFields["login.email"].typeText("scanner-free@example.test")
        app.buttons["Anmeldelink und Code senden"].tap()
        guard app.textFields["login.code"].waitForExistence(timeout: 20) else { throw NSError(domain: "Connected login prerequisite", code: 1) }
        app.terminate()
        app.launchArguments = ["--connected-auth-mail"]
        app.launch() // The native QA hook reads its exact pending local attempt; no credential is transferred by XCTest.
        guard app.tabBars.buttons["Profil"].waitForExistence(timeout: 25) else { throw NSError(domain: "Connected verify prerequisite", code: 2) }
        app.terminate()
        app.launchArguments = []
        app.launch() // Warm restore must use the persisted Keychain session.
        XCTAssertTrue(app.tabBars.buttons["Profil"].waitForExistence(timeout: 20))
        app.tabBars.buttons["Profil"].tap()
        XCTAssertTrue(app.staticTexts["Meine Haarangaben"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Haarstruktur"].waitForExistence(timeout: 10))
        screenshot("connected-profile", app: app)
        app.tabBars.buttons["Scan"].tap()
        app.tabBars.buttons["Suche"].tap()
        XCTAssertTrue(app.textFields["search.query"].waitForExistence(timeout: 5))
        app.textFields["search.query"].tap()
        app.textFields["search.query"].typeText("Chaarlie Local")
        app.buttons["search.submit"].tap()
        let product = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Sanftes Shampoo")).firstMatch
        guard product.waitForExistence(timeout: 20) else { throw NSError(domain: "Connected search prerequisite", code: 3) }
        product.tap()
        XCTAssertTrue(app.staticTexts["assessment.verdict"].waitForExistence(timeout: 25))
        screenshot("connected-assessment", app: app)
        app.swipeUp()
        screenshot("connected-alternatives", app: app)
        XCTAssertTrue(app.staticTexts["Alternativen"].exists)
        app.buttons["Ergebnis schließen"].tap()
        XCTAssertTrue(app.textFields["search.query"].waitForExistence(timeout: 5))
        app.tabBars.buttons["Profil"].tap()
        app.buttons["profile.logout"].tap()
        XCTAssertTrue(app.textFields["login.email"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["assessment.verdict"].exists)
    }
    func testSignedOutEntryHasExistingAccountFlowAndNoDeferredActions() {
        let app = XCUIApplication()
        app.launch()
        // New visitors land on the Haar-Check; the existing-account flow is one tap away.
        let existingAccount = app.buttons["onboarding.login"]
        if existingAccount.waitForExistence(timeout: 10) { existingAccount.tap() }
        XCTAssertTrue(app.textFields["login.email"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Anmeldelink und Code senden"].exists)
        XCTAssertFalse(app.buttons["Konto löschen"].exists)
        XCTAssertFalse(app.buttons["Haarangaben aktualisieren"].exists)
        XCTAssertFalse(app.buttons["Hinzufügen"].exists)
    }
    private func designApp(_ scenario: String, largeText: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-design-review"]
        if largeText { app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"] }
        app.launchEnvironment["CHAARLIE_DESIGN_SCENARIO"] = scenario
        app.launch()
        return app
    }
    func testFourTabsAndHistoryResearchJourney() {
        let app = designApp("history")
        for tab in ["Scan", "Suche", "Verlauf", "Profil"] {
            XCTAssertTrue(app.tabBars.buttons[tab].waitForExistence(timeout: 5))
        }
        let unknown = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Barcode 4006381333931")).firstMatch
        XCTAssertTrue(unknown.waitForExistence(timeout: 5))
        screenshot("history-mixed-states", app: app)
        unknown.tap()
        XCTAssertTrue(app.staticTexts["Noch nicht im Katalog"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Shampoo"].waitForExistence(timeout: 5))
        screenshot("history-unknown-category", app: app)
        app.buttons["Shampoo"].tap()
        XCTAssertTrue(app.staticTexts["In Prüfung"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Shampoo"].exists)
        screenshot("history-research-confirmed", app: app)
        app.buttons["Zum Verlauf"].tap()
        XCTAssertTrue(unknown.waitForExistence(timeout: 5))
        XCTAssertTrue(unknown.label.contains("In Prüfung"))
        app.buttons["Verlauf verwalten"].tap()
        app.buttons["Verlauf löschen"].tap()
        app.buttons["Verlauf löschen"].tap()
        XCTAssertTrue(app.staticTexts["Noch keine Produkte"].waitForExistence(timeout: 5))
        screenshot("history-cleared", app: app)
    }
    func testHistoryRecoveryAndNativeTabContrastFixtures() {
        for scenario in ["scan", "scan-bright", "history-empty", "history-error", "history-loading", "research-pending", "search-results"] {
            let app = designApp(scenario)
            XCTAssertTrue(app.tabBars.buttons["Suche"].waitForExistence(timeout: 5))
            if scenario == "history-empty" { XCTAssertTrue(app.staticTexts["Noch keine Produkte"].waitForExistence(timeout: 5)) }
            if scenario == "history-error" { XCTAssertTrue(app.staticTexts["Verlauf konnte nicht geladen werden."].waitForExistence(timeout: 5)) }
            if scenario == "research-pending" { XCTAssertTrue(app.staticTexts["In Prüfung"].waitForExistence(timeout: 5)) }
            screenshot("history-navigation-\(scenario)", app: app)
        }
    }
    func testScanTabContrastFixtures() {
        for scenario in ["scan", "scan-bright"] {
            let app = designApp(scenario)
            XCTAssertTrue(app.tabBars.buttons["Suche"].waitForExistence(timeout: 5))
            screenshot("tab-contrast-\(scenario)", app: app)
        }
    }
    func testSearchTabRetainsQueryAndReturnsFromAssessment() {
        let app = designApp("search-results")
        let field = app.textFields["search.query"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        let original = field.value as? String
        app.tabBars.buttons["Profil"].tap()
        app.tabBars.buttons["Suche"].tap()
        XCTAssertEqual(field.value as? String, original)
        let product = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Leichter Conditioner")).firstMatch
        XCTAssertTrue(product.waitForExistence(timeout: 5))
        product.tap()
        XCTAssertTrue(app.staticTexts["assessment.verdict"].waitForExistence(timeout: 5))
        app.buttons["Ergebnis schließen"].tap()
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        XCTAssertEqual(field.value as? String, original)
        XCTAssertTrue(product.exists)
    }
    func testSearchResultsShowCategoryWithoutRepeatingBrand() {
        let app = designApp("search-results")
        XCTAssertTrue(app.staticTexts["Shampoo"].waitForExistence(timeout: 5))
        let repeatedBrand = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS %@", "Synthetische Testmarke mit langem Namen")
        ).firstMatch
        XCTAssertFalse(repeatedBrand.exists)
    }
    func testDesignReviewAuthAndRecovery() {
        for scenario in ["login", "code", "code-error", "login-loading", "recovery-missing", "recovery-unavailable"] {
            let app = designApp(scenario)
            XCTAssertTrue(app.staticTexts["chaarlie"].waitForExistence(timeout: 5))
            screenshot("design-\(scenario)", app: app)
            if scenario == "code" {
                app.textFields["login.code"].tap()
                app.textFields["login.code"].typeText("123456")
                screenshot("design-code-keyboard", app: app)
            }
        }
    }
    func testDesignReviewEmptySearchAndLongEmail() {
        let search = designApp("search-empty")
        XCTAssertTrue(search.textFields["search.query"].waitForExistence(timeout: 5))
        search.buttons["search.submit"].tap()
        XCTAssertTrue(search.staticTexts["Keine Treffer"].waitForExistence(timeout: 5))
        screenshot("design-search-empty", app: search)
        search.tabBars.buttons["Scan"].tap()
        XCTAssertTrue(search.staticTexts["Produkt scannen"].waitForExistence(timeout: 5))
        let login = designApp("login-long-email")
        let email = login.textFields["login.email"]
        XCTAssertTrue(email.waitForExistence(timeout: 5))
        screenshot("design-login-long-email", app: login)
        email.tap()
        screenshot("design-login-long-email-focused", app: login)
    }

    func testDesignReviewSearchAndProfile() {
        for scenario in ["scan-error", "scan-loading", "search-results", "search-loading", "search-error", "profile", "profile-loading", "profile-error"] {
            let app = designApp(scenario)
            let title = scenario.hasPrefix("scan-") ? "Produkt scannen" : scenario.hasPrefix("search-") ? "Produkt suchen" : "Meine Haarangaben"
            XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 5))
            screenshot("design-\(scenario)", app: app)
            if scenario == "profile" {
                _ = revealEditButton("profile.logout", app: app)
                screenshot("design-profile-bottom", app: app)
                XCTAssertTrue(app.buttons["profile.logout"].isHittable)
                app.buttons["profile.logout"].tap()
                XCTAssertTrue(app.buttons["onboarding.login"].waitForExistence(timeout: 5))
                app.buttons["onboarding.login"].tap()
                XCTAssertTrue(app.textFields["login.email"].waitForExistence(timeout: 5))
                screenshot("design-profile-logout", app: app)
            }
        }
    }
    func testDesignReviewLargeText() {
        for scenario in ["code-error", "scan-error", "search-results", "profile", "recovery-unavailable"] {
            let app = designApp(scenario, largeText: true)
            screenshot("design-large-\(scenario)-top", app: app)
            app.swipeUp()
            if scenario == "search-results" { screenshot("design-large-search-results-middle", app: app) }
            app.swipeUp()
            if scenario == "profile" {
                let logout = app.buttons["profile.logout"]
                for _ in 0..<15 {
                    if logout.isHittable, logout.frame.maxY <= app.tabBars.firstMatch.frame.minY { break }
                    app.swipeUp()
                }
                XCTAssertTrue(logout.isHittable)
                XCTAssertLessThanOrEqual(logout.frame.maxY, app.tabBars.firstMatch.frame.minY + 1)
            }
            screenshot("design-large-\(scenario)-bottom", app: app)
        }
    }
    func testDesignReviewAppearanceTransitions() {
        let app = designApp("profile")
        XCTAssertTrue(app.staticTexts["Meine Haarangaben"].waitForExistence(timeout: 5))
        screenshot("design-appearance-profile", app: app)
        app.tabBars.buttons["Scan"].tap()
        XCTAssertTrue(app.staticTexts["Produkt scannen"].waitForExistence(timeout: 5))
        screenshot("design-appearance-scan", app: app)
        app.tabBars.buttons["Suche"].tap()
        XCTAssertTrue(app.textFields["search.query"].waitForExistence(timeout: 5))
        screenshot("design-appearance-search", app: app)
        app.tabBars.buttons["Scan"].tap()
        XCTAssertTrue(app.staticTexts["Produkt scannen"].waitForExistence(timeout: 5))
        screenshot("design-appearance-scan-return", app: app)
        app.tabBars.buttons["Profil"].tap()
        XCTAssertTrue(app.staticTexts["Meine Haarangaben"].waitForExistence(timeout: 5))
        screenshot("design-appearance-profile-return", app: app)
    }
    func testDesignReviewCompact() {
        for scenario in ["code", "scan-error", "search-results", "profile", "recovery-unavailable"] {
            let app = designApp(scenario)
            screenshot("design-compact-\(scenario)", app: app)
            if scenario == "code" {
                app.textFields["login.code"].tap()
                app.textFields["login.code"].typeText("123456")
                screenshot("design-compact-code-keyboard", app: app)
            }
        }
    }
    func testDesignReviewPolishGuards() {
        let codeApp = designApp("code")
        XCTAssertTrue(codeApp.textFields["login.code"].waitForExistence(timeout: 5))
        XCTAssertGreaterThanOrEqual(codeApp.textFields["login.code"].frame.height, 44)
        for name in ["Neue E-Mail senden", "Andere E-Mail verwenden"] {
            XCTAssertGreaterThanOrEqual(codeApp.buttons[name].frame.height, 44)
        }
        let app = designApp("scan-error", largeText: true)
        let heading = app.staticTexts["Produkt scannen"]
        XCTAssertTrue(heading.waitForExistence(timeout: 5))
        XCTAssertGreaterThan(heading.frame.height, 90, "Largest text heading wraps instead of ellipsizing")
        let search = app.tabBars.buttons["Suche"]
        XCTAssertTrue(search.isHittable)
        XCTAssertFalse(app.buttons["scanner.search"].exists, "Manual search belongs to its tab")
        screenshot("design-large-scan-actions-final", app: app)
        search.tap()
        XCTAssertTrue(app.textFields["search.query"].waitForExistence(timeout: 5))
    }
    func testDesignReviewLongProductAssessment() throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "scan-v1", withExtension: "json"))
        var fixture = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        var product = fixture["product"] as! [String: Any]
        product["name"] = "Ausgleichender Feuchtigkeits-Conditioner für strapazierte und colorierte Haarlängen"
        product["detail"] = "Chaarlie Test · Feuchtigkeitsspendender Conditioner · 250 ml · ca. 12,90 €"
        fixture["product"] = product
        var alternatives = fixture["alternatives"] as! [[String: Any]]
        var alternativeProduct = alternatives[0]["product"] as! [String: Any]
        alternativeProduct["name"] = "Leichter Feuchtigkeits-Conditioner für besonders schnell beschwerte Haarlängen"
        alternatives[0]["product"] = alternativeProduct
        fixture["alternatives"] = alternatives
        let app = XCUIApplication()
        app.launchArguments = ["--ui-assessment-fixture"]
        app.launchEnvironment["CHAARLIE_UI_FIXTURE_JSON"] = String(data: try JSONSerialization.data(withJSONObject: fixture), encoding: .utf8)
        app.launch()
        XCTAssertTrue(app.staticTexts["assessment.verdict"].waitForExistence(timeout: 5))
        screenshot("design-long-product-assessment", app: app)
        app.swipeUp()
        app.swipeUp()
        screenshot("design-long-product-alternatives", app: app)
        XCTAssertTrue(app.buttons["assessment.buy"].isHittable)
    }

    private func revealEditButton(_ identifier: String, app: XCUIApplication) -> XCUIElement {
        let button = app.buttons[identifier]
        let usableFrame: (CGRect) -> Bool = { frame in
            !frame.isEmpty && frame.minX.isFinite && frame.minY.isFinite && frame.maxX.isFinite && frame.maxY.isFinite
        }
        let geometry = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            button.exists && usableFrame(button.frame)
        }, object: nil)
        guard XCTWaiter.wait(for: [geometry], timeout: 3) == .completed else {
            XCTFail("Editor control must have usable geometry: \(identifier)")
            return button
        }
        var reached = false
        var lastScrolledUp: Bool?
        var fine = false
        for _ in 0..<16 {
            guard button.exists else { break }
            let frame = button.frame
            guard usableFrame(frame) else { break }
            let screen = app.frame
            let visible = frame.minX >= screen.minX && frame.maxX <= screen.maxX
                && frame.minY >= screen.minY + 80 && frame.maxY < screen.maxY - 25
            // XCTest can throw for offscreen activation points, before returning false.
            if visible, button.isHittable { reached = true; break }
            let scrollUp = frame.minY >= screen.minY + 80
            // Full swipes can overshoot a tall row in both directions; after the first
            // reversal, approach it with short controlled drags instead.
            if let lastScrolledUp, lastScrolledUp != scrollUp { fine = true }
            lastScrolledUp = scrollUp
            if fine {
                let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
                let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: scrollUp ? 0.3 : 0.7))
                start.press(forDuration: 0.05, thenDragTo: end)
            } else if scrollUp { app.swipeUp() } else { app.swipeDown() }
        }
        XCTAssertTrue(reached, "Editor control must remain reachable: \(identifier)")
        return button
    }
    private func openProfileEditor(_ scenario: String, largeText: Bool = false) -> XCUIApplication {
        let app = designApp(scenario, largeText: largeText)
        XCTAssertTrue(app.staticTexts["Meine Haarangaben"].waitForExistence(timeout: 5))
        revealEditButton("profile.edit", app: app).tap()
        return app
    }
    private func completePrefilledEditor(_ app: XCUIApplication, changeStructure: Bool = false) {
        XCTAssertTrue(app.buttons["profile.edit.start"].waitForExistence(timeout: 5))
        revealEditButton("profile.edit.start", app: app).tap()
        // Ten question groups plus the scalp-issue gate. All values are prefilled.
        if changeStructure { revealEditButton("profile.edit.option.straight", app: app).tap() }
        for _ in 0..<(changeStructure ? 10 : 11) {
            revealEditButton("profile.edit.next", app: app).tap()
        }
        XCTAssertTrue(app.buttons["profile.edit.save"].waitForExistence(timeout: 3))
    }
    func testProfileEditPrefillBackAndCancel() {
        let app = openProfileEditor("profile-edit")
        XCTAssertTrue(app.buttons["profile.edit.start"].waitForExistence(timeout: 5))
        app.buttons["profile.edit.start"].tap()
        let selected = app.buttons["profile.edit.option.wavy"]
        XCTAssertTrue(selected.waitForExistence(timeout: 3))
        XCTAssertTrue(selected.isSelected)
        screenshot("profile-edit-prefill", app: app)
        revealEditButton("profile.edit.option.straight", app: app).tap()
        XCTAssertTrue(app.buttons["profile.edit.option.fine"].waitForExistence(timeout: 3))
        app.buttons["profile.edit.back"].tap()
        XCTAssertTrue(app.buttons["profile.edit.option.straight"].isSelected)
        app.buttons["profile.edit.cancel"].tap()
        XCTAssertTrue(app.alerts.buttons.matching(identifier: "Entwurf verwerfen").firstMatch.waitForExistence(timeout: 3))
        app.alerts.buttons.matching(identifier: "Entwurf verwerfen").firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Meine Haarangaben"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.staticTexts["profile.saved"].exists)
    }
    func testProfileEditFullPrefilledSave() {
        let app = openProfileEditor("profile-edit")
        completePrefilledEditor(app, changeStructure: true)
        screenshot("profile-edit-review", app: app)
        revealEditButton("profile.edit.save", app: app).tap()
        XCTAssertTrue(app.staticTexts["Meine Haarangaben"].waitForExistence(timeout: 3))
        for _ in 0..<10 { if app.staticTexts["profile.saved"].isHittable { break }; app.swipeUp() }
        XCTAssertTrue(app.staticTexts["profile.saved"].exists)
        XCTAssertTrue(app.buttons["profile.property.structure"].label.contains("Glatt"))
        screenshot("profile-edit-saved", app: app)
    }
    func testProfileEditSaveFailureKeepsReviewAndConflictRequiresReload() {
        let errorApp = openProfileEditor("profile-edit-error")
        completePrefilledEditor(errorApp)
        revealEditButton("profile.edit.save", app: errorApp).tap()
        XCTAssertTrue(errorApp.staticTexts["profile.edit.error"].waitForExistence(timeout: 3))
        screenshot("profile-edit-save-error", app: errorApp)
        XCTAssertTrue(errorApp.staticTexts["profile.edit.error"].label.contains("nicht bestätigen"))
        revealEditButton("profile.edit.save", app: errorApp).tap()
        XCTAssertTrue(errorApp.staticTexts["Meine Haarangaben"].waitForExistence(timeout: 3))

        let app = openProfileEditor("profile-edit-conflict")
        completePrefilledEditor(app)
        revealEditButton("profile.edit.save", app: app).tap()
        XCTAssertTrue(app.staticTexts["profile.edit.error"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.buttons["profile.edit.save"].isEnabled)
        screenshot("profile-edit-conflict", app: app)
        revealEditButton("profile.edit.reload", app: app).tap()
        XCTAssertTrue(app.buttons["profile.edit.start"].waitForExistence(timeout: 3))
    }
    func testProfileEditLargestTextAndLoadingRecovery() {
        let app = openProfileEditor("profile-edit", largeText: true)
        XCTAssertTrue(app.buttons["profile.edit.start"].waitForExistence(timeout: 5))
        screenshot("profile-edit-large-introduction", app: app)
        revealEditButton("profile.edit.start", app: app).tap()
        XCTAssertTrue(app.staticTexts["profile.edit.title"].waitForExistence(timeout: 3))
        XCTAssertGreaterThan(app.staticTexts["profile.edit.title"].frame.height, 100)
        screenshot("profile-edit-large-question", app: app)
        revealEditButton("profile.edit.next", app: app).tap()
        XCTAssertTrue(app.buttons["profile.edit.cancel"].isHittable)
        app.buttons["profile.edit.cancel"].tap()

        let loadError = openProfileEditor("profile-edit-load-error")
        XCTAssertTrue(loadError.staticTexts["profile.edit.error"].waitForExistence(timeout: 5))
        screenshot("profile-edit-load-error", app: loadError)
        XCTAssertTrue(loadError.buttons["Erneut versuchen"].exists)
        loadError.buttons["profile.edit.cancel"].tap()
        XCTAssertTrue(loadError.staticTexts["Meine Haarangaben"].waitForExistence(timeout: 3))
    }
    func testProfileEditSavingDisablesCancel() {
        let app = openProfileEditor("profile-edit-saving")
        completePrefilledEditor(app)
        revealEditButton("profile.edit.save", app: app).tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "profile.edit.saving").firstMatch.waitForExistence(timeout: 3))
        XCTAssertFalse(app.buttons["profile.edit.cancel"].isEnabled)
        XCTAssertFalse(app.buttons["profile.edit.save"].isEnabled)
        screenshot("profile-edit-saving", app: app)
    }

    private func openSingleProperty(_ id: String, scenario: String = "profile-edit", largeText: Bool = false) -> XCUIApplication {
        let app = designApp(scenario, largeText: largeText)
        XCTAssertTrue(app.staticTexts["Meine Haarangaben"].waitForExistence(timeout: 5))
        revealEditButton("profile.property.\(id)", app: app).tap()
        XCTAssertTrue(app.staticTexts["profile.edit.title"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["profile.edit.next"].exists)
        XCTAssertFalse(app.buttons["profile.edit.start"].exists)
        return app
    }
    private func toggleProfileHelp(_ app: XCUIApplication) {
        let label = app.staticTexts["profile.edit.help"]
        if label.exists { label.tap() }
        else { app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Wie erkenne ich das?")).firstMatch.tap() }
    }
    func testSingleProfileSimpleSaveHelpAndCleanDismiss() {
        let app = openSingleProperty("thickness")
        XCTAssertEqual(app.staticTexts["profile.edit.title"].label, "Haardicke")
        XCTAssertTrue(app.buttons["profile.edit.option.fine"].isSelected)
        XCTAssertFalse(app.buttons["profile.edit.save"].isEnabled)
        screenshot("profile-single-thickness", app: app)
        toggleProfileHelp(app)
        XCTAssertTrue(app.staticTexts["profile.edit.instruction"].waitForExistence(timeout: 3))
        screenshot("profile-single-thickness-help", app: app)
        revealEditButton("profile.edit.option.normal", app: app).tap()
        XCTAssertTrue(app.buttons["profile.edit.save"].isEnabled)
        XCTAssertTrue(app.staticTexts["profile.edit.instruction"].exists)
        revealEditButton("profile.edit.option.fine", app: app).tap()
        XCTAssertFalse(app.buttons["profile.edit.save"].isEnabled)
        revealEditButton("profile.edit.option.normal", app: app).tap()
        app.buttons["profile.edit.save"].tap()
        XCTAssertTrue(app.buttons["profile.property.thickness"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["profile.property.thickness"].label.contains("Mittel"))
        XCTAssertTrue(app.buttons["profile.property.structure"].label.contains("Wellig"))
        screenshot("profile-single-saved-overview", app: app)
        revealEditButton("profile.property.thickness", app: app).tap()
        XCTAssertTrue(app.staticTexts["profile.edit.title"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.staticTexts["profile.edit.instruction"].exists, "New sheets reset help")
        XCTAssertTrue(app.buttons["profile.edit.option.normal"].isSelected)
        app.buttons["profile.edit.cancel"].tap()
        XCTAssertFalse(app.alerts.firstMatch.exists)
        XCTAssertTrue(app.buttons["profile.property.thickness"].waitForExistence(timeout: 3))
    }
    func testSingleProfileMultiSelectionAndExplicitDiscard() {
        let app = openSingleProperty("goals")
        revealEditButton("profile.edit.option.shine", app: app).tap()
        XCTAssertTrue(app.buttons["profile.edit.option.shine"].isSelected)
        XCTAssertTrue(app.buttons["profile.edit.save"].isEnabled)
        screenshot("profile-single-goals", app: app)
        app.buttons["profile.edit.cancel"].tap()
        XCTAssertTrue(app.buttons["Weiter bearbeiten"].waitForExistence(timeout: 3))
        screenshot("profile-single-discard", app: app)
        app.buttons["Weiter bearbeiten"].tap()
        XCTAssertTrue(app.buttons["profile.edit.option.shine"].isSelected)
        app.buttons["profile.edit.cancel"].tap()
        XCTAssertTrue(app.alerts.buttons.matching(identifier: "Entwurf verwerfen").firstMatch.waitForExistence(timeout: 3))
        app.alerts.buttons.matching(identifier: "Entwurf verwerfen").firstMatch.tap()
        XCTAssertTrue(app.buttons["profile.property.goals"].waitForExistence(timeout: 3))
        revealEditButton("profile.property.goals", app: app).tap()
        XCTAssertTrue(app.staticTexts["profile.edit.title"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.buttons["profile.edit.option.shine"].isSelected)
        XCTAssertFalse(app.buttons["profile.edit.save"].isEnabled)
    }
    func testSingleProfileScalpKeepsDependentAnswersInSheet() {
        let app = openSingleProperty("scalp_type")
        revealEditButton("profile.edit.option.yes", app: app).tap()
        XCTAssertFalse(app.buttons["profile.edit.save"].isEnabled, "A new complaint requires an explicit choice")
        revealEditButton("profile.edit.option.gereizt", app: app).tap()
        XCTAssertTrue(app.buttons["profile.edit.save"].isEnabled)
        XCTAssertEqual(app.staticTexts["profile.edit.title"].label, "Kopfhaut")
        screenshot("profile-single-scalp", app: app)
        app.buttons["profile.edit.save"].tap()
        XCTAssertTrue(app.buttons["profile.property.scalp_type"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["profile.property.scalp_type"].label.contains("Gereizte Kopfhaut"))
        revealEditButton("profile.property.scalp_type", app: app).tap()
        XCTAssertTrue(app.staticTexts["profile.edit.title"].waitForExistence(timeout: 3))
        revealEditButton("profile.edit.option.no", app: app).tap()
        XCTAssertFalse(app.buttons["profile.edit.option.gereizt"].exists)
        XCTAssertTrue(app.buttons["profile.edit.save"].isEnabled)
    }
    func testSingleProfileRetryAndConflictReloadKeepPropertyAndHelp() {
        let app = openSingleProperty("thickness", scenario: "profile-edit-error")
        toggleProfileHelp(app)
        revealEditButton("profile.edit.option.coarse", app: app).tap()
        app.buttons["profile.edit.save"].tap()
        XCTAssertTrue(app.staticTexts["profile.edit.error"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["profile.edit.option.coarse"].isSelected)
        XCTAssertTrue(app.staticTexts["profile.edit.instruction"].exists)
        screenshot("profile-single-save-error", app: app)
        app.buttons["profile.edit.save"].tap()
        XCTAssertTrue(app.buttons["profile.property.thickness"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["profile.property.thickness"].label.contains("Dick"))

        let conflict = openSingleProperty("thickness", scenario: "profile-edit-conflict")
        toggleProfileHelp(conflict)
        revealEditButton("profile.edit.option.normal", app: conflict).tap()
        conflict.buttons["profile.edit.save"].tap()
        XCTAssertTrue(conflict.staticTexts["profile.edit.error"].waitForExistence(timeout: 3))
        XCTAssertFalse(conflict.buttons["profile.edit.save"].isEnabled)
        screenshot("profile-single-conflict", app: conflict)
        revealEditButton("profile.edit.reload", app: conflict).tap()
        XCTAssertTrue(conflict.staticTexts["profile.edit.title"].waitForExistence(timeout: 3))
        XCTAssertEqual(conflict.staticTexts["profile.edit.title"].label, "Haardicke")
        XCTAssertTrue(conflict.staticTexts["profile.edit.instruction"].exists)
        XCTAssertTrue(conflict.buttons["profile.edit.option.fine"].isSelected)
        XCTAssertFalse(conflict.buttons["profile.edit.save"].isEnabled)
    }
    func testSingleProfileEssentialInstructionsAndLargestText() {
        let surface = openSingleProperty("fingertest")
        XCTAssertTrue(surface.staticTexts["profile.edit.instruction"].exists)
        XCTAssertTrue(surface.staticTexts["profile.edit.instruction"].label.contains("sauberes, trockenes Haar"))
        screenshot("profile-single-surface-test", app: surface)
        let app = openSingleProperty("pulltest", largeText: true)
        XCTAssertTrue(app.staticTexts["profile.edit.instruction"].exists)
        XCTAssertFalse(app.staticTexts["profile.edit.instruction"].label.contains("dasselbe Haar"))
        screenshot("profile-single-elasticity-large", app: app)
        revealEditButton("profile.edit.option.snaps", app: app).tap()
        XCTAssertTrue(app.buttons["profile.edit.save"].isEnabled)
        XCTAssertTrue(app.buttons["profile.edit.save"].isHittable)
        XCTAssertTrue(app.buttons["profile.edit.cancel"].isHittable)
        screenshot("profile-single-elasticity-large-actions", app: app)
    }
    func testSingleProfileMissingLengthRecoveryPreservesOriginalEdit() {
        let app = openSingleProperty("thickness", scenario: "profile-edit-missing-length")
        revealEditButton("profile.edit.option.normal", app: app).tap()
        XCTAssertFalse(app.buttons["profile.edit.save"].isEnabled)
        let required = app.staticTexts["profile.edit.missing-length"]
        XCTAssertTrue(required.exists)
        revealEditButton("profile.edit.option.length.long", app: app).tap()
        XCTAssertTrue(app.buttons["profile.edit.option.length.long"].isSelected)
        XCTAssertTrue(app.buttons["profile.edit.option.normal"].isSelected)
        XCTAssertTrue(app.buttons["profile.edit.save"].isEnabled)
        screenshot("profile-single-missing-length-recovery", app: app)
        app.buttons["profile.edit.save"].tap()
        XCTAssertTrue(app.buttons["profile.property.thickness"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["profile.property.thickness"].label.contains("Mittel"))
        XCTAssertFalse(app.buttons["profile.property.hair_length"].label.contains("Noch nicht angegeben"))

        let length = openSingleProperty("hair_length", scenario: "profile-edit-missing-length")
        XCTAssertFalse(length.staticTexts["profile.edit.missing-length"].exists)
        revealEditButton("profile.edit.option.long", app: length).tap()
        XCTAssertTrue(length.buttons["profile.edit.save"].isEnabled)
    }

}
