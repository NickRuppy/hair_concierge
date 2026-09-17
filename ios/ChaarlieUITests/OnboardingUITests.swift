import XCTest

/// The same native view/model used by the app, with an explicitly local synthetic gateway.
/// These checks never send email, create a real account, or install a real session.
@MainActor
final class OnboardingUITests: XCTestCase {
    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    private func launch(_ scenario: String = "fresh", largeText: Bool = false, question: Int? = nil, texture: String = "wavy", startQuiz: Bool = true) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-onboarding-fixture"]
        if largeText {
            app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        }
        app.launchEnvironment["CHAARLIE_ONBOARDING_SCENARIO"] = question == nil ? scenario : "quiz"
        if let question {
            app.launchEnvironment["CHAARLIE_QUIZ_QUESTION"] = String(question)
            app.launchEnvironment["CHAARLIE_QUIZ_TEXTURE"] = texture
        }
        app.launch()
        XCTAssertTrue(app.staticTexts["onboarding.title"].waitForExistence(timeout: 10))
        if startQuiz, app.buttons["onboarding.start"].exists { tap("onboarding.start", app: app) }
        return app
    }

    private func screenshot(_ name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "onboarding-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func keyboardObstructionTop(app: XCUIApplication) -> CGFloat? {
        let keyboard = app.keyboards.firstMatch
        guard keyboard.exists else { return nil }
        // XCTest's Keyboard frame can exclude the suggestion/accessory strip.
        // Measure the visible system input surfaces instead of assuming a height.
        let surfaces = [keyboard, app.otherElements["inputView"].firstMatch,
                        app.otherElements["SystemInputAssistantView"].firstMatch]
        return surfaces.compactMap { surface -> CGFloat? in
            guard surface.exists else { return nil }
            let frame = surface.frame
            guard !frame.isEmpty, frame.minY.isFinite, frame.maxY.isFinite,
                  frame.intersects(app.frame) else { return nil }
            return max(frame.minY, app.frame.minY)
        }.min()
    }

    private func reach(_ element: XCUIElement, app: XCUIApplication, readableContent: Bool = false, focusedField: Bool = false,
                       file: StaticString = #filePath, line: UInt = #line) {
        if focusedField {
            XCTAssertTrue(element.elementType == .textField || element.elementType == .textView, file: file, line: line)
            XCTAssertTrue(app.keyboards.firstMatch.exists, file: file, line: line)
        }
        let scroll = app.scrollViews.firstMatch
        let usableFrame: (CGRect) -> Bool = { frame in
            !frame.isEmpty && frame.minX.isFinite && frame.minY.isFinite
                && frame.maxX.isFinite && frame.maxY.isFinite
        }
        let geometry = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            element.exists && usableFrame(element.frame)
        }, object: nil)
        guard XCTWaiter.wait(for: [geometry], timeout: 3) == .completed else {
            XCTFail("Control must have usable geometry: \(element.identifier)", file: file, line: line)
            return
        }
        var reached = false
        var observations: [String] = []
        // The complete concerns list exceeds 5,000 points at Accessibility XXXL.
        // Keep controlled drags and allow enough of them to reach its final field.
        for _ in 0..<64 {
            guard element.exists else { break }
            let bounds = element.frame
            guard usableFrame(bounds) else { break }
            let screen = app.frame
            let footer = app.descendants(matching: .any).matching(identifier: "onboarding.quiz-footer").firstMatch
            let isPinnedAction = element.identifier == "onboarding.next" && footer.exists
            let scrollFrame = isPinnedAction ? screen : scroll.frame.intersection(screen)
            let status = app.statusBars.firstMatch
            let safeTop = status.exists && usableFrame(status.frame) ? status.frame.maxY + 8 : screen.minY + 28
            let top = max(safeTop, scrollFrame.minY + 8)
            var bottom = min(screen.maxY - (isPinnedAction ? 8 : 45), scrollFrame.maxY - 8)
            // A focused multiline field can settle 7pt above the footer on SE.
            // Test its complete frame against real obstructions; retain the extra
            // clearance margin for every other control and pre-focus reach.
            if footer.exists, !isPinnedAction { bottom = min(bottom, footer.frame.minY - (focusedField ? 0 : 8)) }
            if let keyboardTop = keyboardObstructionTop(app: app) {
                bottom = min(bottom, keyboardTop - (focusedField ? 0 : 12))
            }
            guard bottom > top + 60 else { break }
            let viewport = CGRect(x: scrollFrame.minX, y: top, width: scrollFrame.width, height: bottom - top)
            observations.append("target=\(bounds); viewport=\(viewport)")
            let visible = bounds.minX >= viewport.minX && bounds.maxX <= viewport.maxX
                && bounds.minY >= viewport.minY && bounds.maxY <= viewport.maxY
            // XCTest can throw for offscreen activation points before returning false.
            if visible, element.isHittable { reached = true; break }
            // Markdown can be exposed as a text container. Read-only captures of a
            // paragraph taller than the viewport need visible geometry, not a tap target.
            if readableContent, bounds.height > viewport.height,
               bounds.minX >= viewport.minX, bounds.maxX <= viewport.maxX,
               viewport.contains(CGPoint(x: bounds.midX, y: bounds.midY)) {
                reached = true
                break
            }
            let displacement: CGFloat
            if bounds.height > viewport.height {
                displacement = bounds.midY - viewport.midY
            } else if bounds.minY < viewport.minY {
                displacement = bounds.minY - viewport.minY - 12
            } else if bounds.maxY > viewport.maxY {
                displacement = bounds.maxY - viewport.maxY + 12
            } else { break } // Fully visible but not hittable is not a scrolling problem.
            let distance = min(max(abs(displacement), 24), min(160, viewport.height * 0.3))
            let direction: CGFloat = displacement >= 0 ? 1 : -1
            let origin = app.coordinate(withNormalizedOffset: .zero)
            let start = origin.withOffset(CGVector(dx: viewport.midX - screen.minX,
                dy: viewport.midY + direction * distance / 2 - screen.minY))
            let end = origin.withOffset(CGVector(dx: viewport.midX - screen.minX,
                dy: viewport.midY - direction * distance / 2 - screen.minY))
            // Hold the endpoint to stop inertial overshoot on compact simulators.
            // Geometry assertions remain unchanged; swipes must converge on the visible target.
            start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.2)
        }
        if !reached {
            let attachment = XCTAttachment(string: observations.joined(separator: "\n") + "\n" + app.debugDescription)
            attachment.name = "onboarding-unreachable-\(element.identifier)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
        XCTAssertTrue(reached, "Control must remain reachable: \(element.identifier)", file: file, line: line)
    }

    private func tap(_ id: String, app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        let element = app.buttons[id]
        reach(element, app: app, file: file, line: line)
        XCTAssertTrue(element.isEnabled, "\(id) should be enabled", file: file, line: line)
        element.tap()
    }

    private func assertQuestion(_ number: Int, app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        let progress = app.staticTexts["onboarding.progress"]
        XCTAssertTrue(progress.waitForExistence(timeout: 3), file: file, line: line)
        XCTAssertEqual(progress.label, "\(number) / 10", file: file, line: line)
        let header = app.descendants(matching: .any).matching(identifier: "onboarding.quiz-header").firstMatch
        XCTAssertTrue(header.waitForExistence(timeout: 3), file: file, line: line)
        XCTAssertLessThanOrEqual(header.frame.height, number == 1 ? 120 : 100, file: file, line: line)
        let title = app.staticTexts["onboarding.title"]
        XCTAssertLessThanOrEqual(title.frame.minY, app.frame.minY + 240, file: file, line: line)
        if number >= 1 {
            XCTAssertFalse(app.staticTexts["onboarding.brand"].exists, file: file, line: line)
            XCTAssertFalse(app.buttons["onboarding.login"].exists, file: file, line: line)
            // CGRect arithmetic can report 43.99999999999999 for the exact44pt target.
            XCTAssertGreaterThanOrEqual(app.buttons["onboarding.back"].frame.height + 0.000001, 44, file: file, line: line)
        }
    }

    private func completeQuiz(app: XCUIApplication, scalpIssue: Bool = false) {
        let singleAnswers = ["wavy", "fine", "medium", "long", "glatt", "stretches_bounces"]
        for (index, answer) in singleAnswers.enumerated() {
            assertQuestion(index + 1, app: app)
            tap("onboarding.option.\(answer)", app: app)
        }
        assertQuestion(7, app: app)
        tap("onboarding.option.natur", app: app)
        assertQuestion(7, app: app) // Multiple choice waits for explicit Weiter.
        tap("onboarding.next", app: app)
        assertQuestion(8, app: app)
        tap("onboarding.option.ausgeglichen", app: app)
        assertQuestion(8, app: app)
        tap("onboarding.option.\(scalpIssue ? "yes" : "no")", app: app)
        if scalpIssue {
            assertQuestion(8, app: app)
            screenshot("scalp-condition", app: app)
            tap("onboarding.option.gereizt", app: app)
        }
        assertQuestion(9, app: app)
        tap("onboarding.option.no-concerns", app: app)
        tap("onboarding.next", app: app)
        assertQuestion(10, app: app)
        tap("onboarding.option.shine", app: app)
        tap("onboarding.next", app: app)
        XCTAssertTrue(app.textFields["onboarding.first-name"].waitForExistence(timeout: 3))
    }

    private func enterAccount(app: XCUIApplication) {
        let name = app.textFields["onboarding.first-name"]
        reach(name, app: app)
        name.tap()
        name.typeText("Lea")
        let email = app.textFields["onboarding.email"]
        reach(email, app: app)
        let suggestions = app.otherElements["SystemInputAssistantView"].firstMatch
        if suggestions.exists {
            XCTAssertLessThanOrEqual(email.frame.maxY, suggestions.frame.minY - 12)
        }
        screenshot("account-email-visible", app: app)
        email.tap()
        email.typeText("lea@example.test\n")
        XCTAssertEqual(name.value as? String, "Lea")
        XCTAssertEqual(email.value as? String, "lea@example.test")
    }

    private func submitAccount(app: XCUIApplication) {
        enterAccount(app: app)
        tap("onboarding.submit", app: app)
        XCTAssertTrue(app.textFields["onboarding.code"].waitForExistence(timeout: 3))
    }

    private func verifyCode(_ value: String, app: XCUIApplication) {
        let code = app.textFields["onboarding.code"]
        reach(code, app: app)
        code.tap()
        code.typeText(value)
        tap("onboarding.verify", app: app)
    }

    private func assertScanner(app: XCUIApplication) {
        XCTAssertTrue(app.buttons["Produkt manuell suchen"].waitForExistence(timeout: 5),
                      "Only acknowledged synthetic completion may enter the real scanner view")
        screenshot("scanner-after-fixture-completion", app: app)
    }

    func testTenQuestionsAccountNoticeAndCodeCompletion() {
        let app = launch()
        screenshot("question-one", app: app)
        completeQuiz(app: app, scalpIssue: true)
        XCTAssertFalse(app.buttons["onboarding.submit"].isEnabled)
        enterAccount(app: app)
        let marketing = app.buttons["onboarding.marketing"]
        reach(marketing, app: app)
        XCTAssertEqual(marketing.value as? String, "Nicht ausgewählt")
        screenshot("account-unchecked-marketing", app: app)
        let notice = app.descendants(matching: .any).matching(identifier: "onboarding.legal-notice").firstMatch
        reach(notice, app: app, readableContent: true)
        let noticeText = ([notice.label] + notice.descendants(matching: .staticText).allElementsBoundByIndex.map(\.label)).joined(separator: " ")
        XCTAssertTrue(noticeText.contains("beantragst du dein kostenloses Konto"))
        XCTAssertTrue(noticeText.contains("AGB"))
        XCTAssertTrue(noticeText.contains("Datenschutzerklärung"))
        screenshot("account-legal-notice", app: app)
        tap("onboarding.submit", app: app)
        XCTAssertTrue(app.textFields["onboarding.code"].waitForExistence(timeout: 3))
        screenshot("verification", app: app)
        verifyCode("12345678", app: app)
        assertScanner(app: app)
    }

    func testCompletedOnboardingSearchSelectionShowsAssessment() {
        let app = launch("registration")
        submitAccount(app: app)
        tap("onboarding.simulate-link", app: app)
        assertScanner(app: app)
        app.buttons["scanner.search"].tap()
        let query = app.textFields["search.query"]
        XCTAssertTrue(query.waitForExistence(timeout: 3))
        query.tap(); query.typeText("Chaarlie")
        app.buttons["search.submit"].tap()
        let product = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Leichter Conditioner")).firstMatch
        XCTAssertTrue(product.waitForExistence(timeout: 3))
        product.tap()
        XCTAssertTrue(app.staticTexts["assessment.verdict"].waitForExistence(timeout: 5))
        screenshot("search-assessment", app: app)
        app.buttons["Ergebnis schließen"].tap()
        XCTAssertTrue(app.buttons["scanner.search"].waitForExistence(timeout: 3))
    }

    func testSearchResolveFailureKeepsRetryAfterSheetDismissal() {
        let app = launch("scan-retry")
        submitAccount(app: app)
        tap("onboarding.simulate-link", app: app)
        assertScanner(app: app)
        app.buttons["scanner.search"].tap()
        let query = app.textFields["search.query"]
        XCTAssertTrue(query.waitForExistence(timeout: 3))
        query.tap(); query.typeText("Chaarlie")
        app.buttons["search.submit"].tap()
        let product = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Leichter Conditioner")).firstMatch
        XCTAssertTrue(product.waitForExistence(timeout: 3)); product.tap()
        XCTAssertTrue(query.waitForNonExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Erneut versuchen"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Die Verbindung ist gerade nicht verfügbar. Versuche es erneut."].exists)
        screenshot("search-error-retained", app: app)
        app.buttons["Erneut versuchen"].tap()
        XCTAssertTrue(app.staticTexts["assessment.verdict"].waitForExistence(timeout: 5))
        screenshot("search-retry-assessment", app: app)
    }

    func testCompactQuizHeaderAtDefaultAndLargestTextPreservesAnswers() {
        for largeText in [false, true] {
            let app = launch(largeText: largeText)
            let size = largeText ? "largest-text" : "default-text"
            screenshot("compact-entry-\(size)", app: app)
            for (index, answer) in ["wavy", "fine", "medium", "long", "glatt", "stretches_bounces"].enumerated() {
                assertQuestion(index + 1, app: app)
                tap("onboarding.option.\(answer)", app: app)
            }
            assertQuestion(7, app: app)
            XCTAssertFalse(app.staticTexts["onboarding.brand"].exists)
            XCTAssertFalse(app.buttons["onboarding.login"].exists)
            let header = app.descendants(matching: .any).matching(identifier: "onboarding.quiz-header").firstMatch
            XCTAssertTrue(header.waitForExistence(timeout: 3))
            let heading = app.staticTexts["onboarding.title"]
            XCTAssertEqual(heading.label, "Sind deine Haare chemisch behandelt?")
            // The accessibility label is deliberately plain text. Natural visual wrapping
            // is checked in the retained Q7 screenshot, not inferred from this label.
            XCTAssertLessThanOrEqual(header.frame.height, 100, "Quiz navigation must remain compact at both text sizes")
            XCTAssertLessThanOrEqual(heading.frame.minY, app.frame.minY + 240, "Question starts high on the screen")
            XCTAssertGreaterThanOrEqual(heading.frame.minY, header.frame.maxY)
            XCTAssertLessThanOrEqual(heading.frame.minY - header.frame.maxY, 30)
            XCTAssertGreaterThanOrEqual(heading.frame.minX, app.frame.minX + 20)
            XCTAssertLessThanOrEqual(heading.frame.maxX, app.frame.maxX - 20)
            XCTAssertGreaterThanOrEqual(app.buttons["onboarding.back"].frame.height + 0.000001, 44)
            XCTAssertTrue(app.staticTexts["onboarding.instruction"].exists)
            screenshot("compact-question-seven-\(size)", app: app)
            tap("onboarding.option.gefaerbt", app: app)
            tap("onboarding.back", app: app)
            assertQuestion(6, app: app)
            XCTAssertTrue(app.buttons["onboarding.option.stretches_bounces"].isSelected)
            tap("onboarding.option.stretches_bounces", app: app)
            assertQuestion(7, app: app)
            XCTAssertTrue(app.buttons["onboarding.option.gefaerbt"].isSelected,
                          "Back and return must preserve the selected treatment")
            app.terminate()
        }
    }

    func testWelcomeStartBackAndExistingLogin() {
        for largeText in [false, true] {
            let app = launch(largeText: largeText, startQuiz: false)
            XCTAssertEqual(app.staticTexts["onboarding.title"].label, "Gutes Produkt. Aber für dich?")
            XCTAssertTrue(app.staticTexts["onboarding.brand"].exists)
            XCTAssertTrue(app.buttons["onboarding.login"].exists)
            screenshot("native-welcome-\(largeText ? "largest" : "default")", app: app)
            let start = app.buttons["onboarding.start"]
            if !largeText, app.frame.height >= 800 {
                XCTAssertTrue(start.isHittable)
                XCTAssertLessThanOrEqual(start.frame.maxY, app.frame.maxY - 30,
                                         "Standard screen should show the CTA without scrolling")
            }
            reach(start, app: app)
            screenshot("native-welcome-action-\(largeText ? "largest" : "default")", app: app)
            tap("onboarding.start", app: app)
            assertQuestion(1, app: app)
            screenshot("native-question-one-\(largeText ? "largest" : "default")", app: app)
            XCTAssertFalse(app.buttons["onboarding.login"].exists)
            tap("onboarding.option.curly", app: app)
            assertQuestion(2, app: app)
            tap("onboarding.back", app: app)
            assertQuestion(1, app: app)
            XCTAssertTrue(app.buttons["onboarding.option.curly"].isSelected)
            tap("onboarding.back", app: app)
            XCTAssertTrue(start.waitForExistence(timeout: 3))
            tap("onboarding.start", app: app)
            assertQuestion(1, app: app)
            XCTAssertTrue(app.buttons["onboarding.option.curly"].isSelected)
            tap("onboarding.back", app: app)
            tap("onboarding.login", app: app)
            XCTAssertTrue(app.textFields["login.email"].waitForExistence(timeout: 3))
            app.terminate()
        }
    }

    func testSignedInFixtureOpensScannerWithoutWelcome() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-design-review"]
        app.launchEnvironment["CHAARLIE_DESIGN_SCENARIO"] = "scan"
        app.launch()
        XCTAssertTrue(app.buttons["scanner.search"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["onboarding.start"].exists)
        XCTAssertFalse(app.staticTexts["onboarding.title"].exists)
        screenshot("native-existing-session-scanner", app: app)
    }

    func testQuizTreatmentFooterStaysVisibleWithLastOptionAndHelp() {
        let app = launch(question: 7)
        assertQuestion(7, app: app)
        let next = app.buttons["onboarding.next"]
        XCTAssertTrue(next.exists)
        XCTAssertFalse(next.isEnabled)
        XCTAssertGreaterThan(next.frame.minY, app.frame.midY)
        XCTAssertLessThanOrEqual(next.frame.maxY, app.frame.maxY - 8)
        XCTAssertTrue(next.isHittable, "Continue must be visible before scrolling the treatment list")
        let originalY = next.frame.minY
        let last = app.buttons["onboarding.option.chemisch_geglaettet"]
        reach(last, app: app)
        XCTAssertLessThanOrEqual(last.frame.maxY, next.frame.minY - 8)
        last.tap()
        XCTAssertTrue(last.isSelected)
        XCTAssertEqual(next.frame.minY, originalY, accuracy: 2)
        screenshot("native-treatment-selected", app: app)
        let help = app.buttons["onboarding.help"]
        reach(help, app: app); help.tap()
        let details = app.staticTexts["onboarding.help-content"]
        XCTAssertTrue(details.waitForExistence(timeout: 3))
        XCTAssertTrue(details.label.contains("kein Aufhellen"))
        XCTAssertTrue(details.label.contains("Keratin"))
        reach(details, app: app, readableContent: true)
        XCTAssertEqual(next.frame.minY, originalY, accuracy: 2)
        XCTAssertTrue(next.isHittable)
        screenshot("native-treatment-help", app: app)
        next.tap()
        assertQuestion(8, app: app)
    }

    func testCriticalQuestionHeadingsAndPinnedChoicesAtLargestText() {
        for largeText in [false, true] {
            for question in [1, 7, 10] {
                let app = launch(largeText: largeText, question: question)
                assertQuestion(question, app: app)
                let heading = app.staticTexts["onboarding.title"]
                XCTAssertGreaterThanOrEqual(heading.frame.minX, app.frame.minX + 20)
                XCTAssertLessThanOrEqual(heading.frame.maxX, app.frame.maxX - 20)
                screenshot("critical-question-\(question)-\(largeText ? "largest" : "default")", app: app)
                if question != 1 {
                    let next = app.buttons["onboarding.next"]
                    XCTAssertTrue(next.isHittable)
                    XCTAssertFalse(next.isEnabled)
                    let originalY = next.frame.minY
                    let value = question == 7 ? "natur" : "shine"
                    tap("onboarding.option.\(value)", app: app)
                    XCTAssertTrue(app.buttons["onboarding.option.\(value)"].isSelected)
                    XCTAssertTrue(next.isEnabled)
                    XCTAssertTrue(next.isHittable)
                    XCTAssertEqual(next.frame.minY, originalY, accuracy: 2)
                    screenshot("critical-question-\(question)-selected-\(largeText ? "largest" : "default")", app: app)
                }
                app.terminate()
            }
        }
    }

    func testNativeQuizAllQuestionsAndScalpHelp() {
        let app = launch()
        let answers = ["coily", "coarse", "high", "very_long", "rau", "snaps"]
        for (index, value) in answers.enumerated() {
            assertQuestion(index + 1, app: app)
            screenshot("native-question-\(index + 1)", app: app)
            let help = app.buttons["onboarding.help"]
            if help.exists {
                reach(help, app: app); help.tap()
                let details = app.staticTexts["onboarding.help-content"]
                XCTAssertTrue(details.waitForExistence(timeout: 3))
                if index == 5 {
                    XCTAssertTrue(details.label.contains("Ringfinger"))
                    XCTAssertTrue(details.label.contains("Mittelfinger"))
                    XCTAssertTrue(app.staticTexts["onboarding.instruction"].label.contains("vorsichtig"))
                }
                reach(details, app: app, readableContent: true)
                screenshot("native-question-\(index + 1)-help", app: app)
                reach(help, app: app); help.tap()
                XCTAssertFalse(details.exists)
            }
            tap("onboarding.option.\(value)", app: app)
        }
        assertQuestion(7, app: app)
        tap("onboarding.option.gefaerbt", app: app)
        tap("onboarding.option.blondiert", app: app)
        screenshot("native-question-7", app: app)
        tap("onboarding.next", app: app)
        assertQuestion(8, app: app)
        screenshot("native-question-8", app: app)
        tap("onboarding.option.trocken", app: app)
        assertQuestion(8, app: app)
        screenshot("native-scalp-gate", app: app)
        tap("onboarding.option.yes", app: app)
        assertQuestion(8, app: app)
        for value in ["schuppen", "trockene_schuppen", "gereizt"] {
            XCTAssertTrue(app.buttons["onboarding.option.\(value)"].exists)
        }
        screenshot("native-scalp-condition", app: app)
        tap("onboarding.option.trockene_schuppen", app: app)
        assertQuestion(9, app: app)
        screenshot("native-question-9", app: app)
        tap("onboarding.option.no-concerns", app: app)
        tap("onboarding.next", app: app)
        assertQuestion(10, app: app)
        screenshot("native-question-10", app: app)
        tap("onboarding.option.volume_balance", app: app)
        tap("onboarding.next", app: app)
        XCTAssertTrue(app.textFields["onboarding.first-name"].waitForExistence(timeout: 3))
    }

    func testNativeQuizTextureVariantsKeepFinalOptionsReachable() {
        let variants = [
            ("straight", "Mein Haar verliert schnell Form und Halt", "Mehr Form und Halt"),
            ("wavy", "Meine Wellen verlieren schnell ihre Form", "Mehr Wellen-Definition"),
            ("curly", "Meine Locken verlieren schnell ihre Definition", "Mehr Locken-Definition"),
            ("coily", "Meine Definition hält nicht so, wie ich es möchte", "Mehr Definition")
        ]
        for (texture, concern, goal) in variants {
            let app = launch(question: 9, texture: texture)
            assertQuestion(9, app: app)
            XCTAssertTrue(app.buttons["onboarding.option.lost_shape"].label.contains(concern))
            for value in ["hair_loss_or_thinning", "breakage", "split_ends"] {
                XCTAssertTrue(app.buttons["onboarding.option.\(value)"].exists)
            }
            let next = app.buttons["onboarding.next"]
            XCTAssertTrue(next.isHittable)
            XCTAssertTrue(next.isEnabled, "No concerns is valid")
            let originalY = next.frame.minY
            tap("onboarding.option.low_volume_or_weighed_down", app: app)
            let last = app.buttons["onboarding.option.low_volume_or_weighed_down"]
            XCTAssertTrue(last.isSelected)
            XCTAssertLessThanOrEqual(last.frame.maxY, next.frame.minY - 8)
            XCTAssertEqual(next.frame.minY, originalY, accuracy: 2)
            screenshot("native-concerns-\(texture)", app: app)
            tap("onboarding.next", app: app)
            assertQuestion(10, app: app)
            XCTAssertTrue(app.buttons["onboarding.option.shape_definition"].label.contains(goal))
            XCTAssertFalse(next.isEnabled)
            tap("onboarding.option.volume_balance", app: app)
            XCTAssertTrue(next.isEnabled)
            XCTAssertLessThanOrEqual(app.buttons["onboarding.option.volume_balance"].frame.maxY, next.frame.minY - 8)
            screenshot("native-goals-\(texture)", app: app)
            tap("onboarding.back", app: app)
            assertQuestion(9, app: app)
            XCTAssertTrue(app.buttons["onboarding.option.low_volume_or_weighed_down"].isSelected)
            app.terminate()
        }
    }

    func testNativeQuizLargestTextHelpAndKeyboardKeepContinueReachable() throws {
        let elasticity = launch(largeText: true, question: 6)
        let help = elasticity.buttons["onboarding.help"]
        reach(help, app: elasticity); help.tap()
        let detail = elasticity.staticTexts["onboarding.help-content"]
        reach(detail, app: elasticity, readableContent: true)
        screenshot("native-elasticity-help-largest", app: elasticity)
        tap("onboarding.option.snaps", app: elasticity)
        assertQuestion(7, app: elasticity)
        tap("onboarding.option.chemisch_geglaettet", app: elasticity)
        let next = elasticity.buttons["onboarding.next"]
        XCTAssertTrue(next.isHittable)
        XCTAssertLessThanOrEqual(elasticity.buttons["onboarding.option.chemisch_geglaettet"].frame.maxY, next.frame.minY - 8)
        screenshot("native-treatment-largest", app: elasticity)
        elasticity.terminate()

        for largeText in [false, true] {
            let app = launch(largeText: largeText, question: 9, texture: "coily")
            let text = app.textFields["onboarding.other"]
            // Multi-line SwiftUI fields may be exposed as text views.
            let field = text.exists ? text : app.textViews["onboarding.other"]
            reach(field, app: app); field.tap(); field.typeText("Trockene Spitzen")
            XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 3))
            screenshot("native-concerns-post-type-\(largeText ? "largest" : "default")", app: app)
            // Read the complete multiline answer after typing, including its editing end.
            reach(field, app: app, focusedField: true)
            XCTAssertEqual(field.value as? String, "Trockene Spitzen")
            XCTAssertTrue(field.isHittable)
            let next = app.buttons["onboarding.next"]
            XCTAssertLessThanOrEqual(field.frame.maxY, next.frame.minY - 8)
            XCTAssertTrue(next.isHittable)
            XCTAssertLessThanOrEqual(next.frame.maxY, try XCTUnwrap(keyboardObstructionTop(app: app)))
            screenshot("native-concerns-keyboard-\(largeText ? "largest" : "default")", app: app)
            next.tap()
            assertQuestion(10, app: app)
            XCTAssertFalse(app.keyboards.firstMatch.exists)
            tap("onboarding.option.volume_balance", app: app)
            XCTAssertTrue(app.buttons["onboarding.option.volume_balance"].isSelected)
            screenshot("native-goals-\(largeText ? "largest" : "default")", app: app)
            tap("onboarding.back", app: app)
            let retained = app.textFields["onboarding.other"].exists ? app.textFields["onboarding.other"] : app.textViews["onboarding.other"]
            XCTAssertEqual(retained.value as? String, "Trockene Spitzen")
            app.terminate()
        }
    }

    func testResumePreservesAnswersAndExplicitRestartStartsFirstQuestion() {
        let app = launch("resume")
        screenshot("resume", app: app)
        tap("onboarding.resume", app: app)
        assertQuestion(3, app: app)
        tap("onboarding.back", app: app)
        assertQuestion(2, app: app)
        XCTAssertTrue(app.buttons["onboarding.option.fine"].isSelected)
        app.terminate()

        // The deterministic resume fixture is separately launched for the destructive branch.
        let restarted = launch("resume")
        tap("onboarding.restart", app: restarted)
        assertQuestion(1, app: restarted)
        screenshot("restarted-empty-question", app: restarted)
        XCTAssertFalse(restarted.buttons["onboarding.option.wavy"].isSelected)
    }

    func testWrongCodeResendAndLinkRecovery() {
        let app = launch("registration")
        submitAccount(app: app)
        verifyCode("00000000", app: app)
        XCTAssertTrue(app.staticTexts["onboarding.error"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.textFields["onboarding.code"].exists)
        screenshot("invalid-code", app: app)
        tap("onboarding.resend", app: app)
        XCTAssertTrue(app.textFields["onboarding.code"].waitForExistence(timeout: 3))
        XCTAssertEqual(app.textFields["onboarding.code"].value as? String, "Code aus der E-Mail")
        tap("onboarding.simulate-link", app: app)
        assertScanner(app: app)
    }

    func testExistingProfileRequiresExplicitKeepOrReplace() {
        for choice in ["keep", "replace"] {
            let app = launch("conflict")
            submitAccount(app: app)
            tap("onboarding.simulate-link", app: app)
            XCTAssertTrue(app.buttons["onboarding.profile.keep"].waitForExistence(timeout: 3))
            XCTAssertFalse(app.buttons["Produkt manuell suchen"].exists)
            screenshot("existing-profile-\(choice)", app: app)
            tap("onboarding.profile.\(choice)", app: app)
            assertScanner(app: app)
            app.terminate()
        }
    }

    func testCompletionFailureCanRetryWithoutRepeatingQuiz() {
        let app = launch("completion-failure")
        submitAccount(app: app)
        tap("onboarding.simulate-link", app: app)
        XCTAssertTrue(app.buttons["onboarding.retry-completion"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["onboarding.error"].exists)
        XCTAssertFalse(app.buttons["Produkt manuell suchen"].exists)
        let heading = app.staticTexts["onboarding.title"]
        XCTAssertGreaterThanOrEqual(heading.frame.minX, app.frame.minX + 20)
        XCTAssertLessThanOrEqual(heading.frame.maxX, app.frame.maxX - 20)
        screenshot("completion-failure", app: app)
        tap("onboarding.retry-completion", app: app)
        assertScanner(app: app)
    }

    func testUnavailableGatewayKeepsAccountAndAnswers() {
        let app = launch("unavailable")
        enterAccount(app: app)
        tap("onboarding.submit", app: app)
        XCTAssertTrue(app.staticTexts["onboarding.error"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.textFields["onboarding.code"].exists)
        XCTAssertFalse(app.buttons["Produkt manuell suchen"].exists)
        screenshot("registration-unavailable", app: app)
        tap("onboarding.back", app: app)
        assertQuestion(10, app: app)
        XCTAssertTrue(app.buttons["onboarding.option.shine"].isSelected)
    }

    private func assertNativeAccountHeader(app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertFalse(app.staticTexts["onboarding.brand"].exists, file: file, line: line)
        let header = app.descendants(matching: .any).matching(identifier: "onboarding.account-header").firstMatch
        XCTAssertTrue(header.exists, file: file, line: line)
        XCTAssertLessThanOrEqual(header.frame.height, 80, file: file, line: line)
        let back = app.buttons["onboarding.back"]
        let login = app.buttons["onboarding.login"]
        XCTAssertGreaterThanOrEqual(back.frame.height, 44, file: file, line: line)
        XCTAssertGreaterThanOrEqual(login.frame.height, 44, file: file, line: line)
        XCTAssertLessThanOrEqual(back.frame.maxX, login.frame.minX, file: file, line: line)
        XCTAssertEqual(app.staticTexts["onboarding.title"].label, "Dein Haar-Check ist fertig.", file: file, line: line)
    }

    func testLengthQuestionKeepsBoundariesAndExpandableMethod() {
        let expected = [
            ("very_short", "Etwa bis zu den Ohren."),
            ("short", "Unter den Ohren bis knapp über die Schultern."),
            ("medium", "Schulterlänge bis Brusthöhe oder untere Schulterblätter."),
            ("long", "Unter Brust oder Schulterblättern bis ungefähr zur Taille."),
            ("very_long", "Taille oder länger.")
        ]
        for largeText in [false, true] {
            let app = launch(largeText: largeText, question: 4)
            assertQuestion(4, app: app)
            XCTAssertEqual(app.staticTexts["onboarding.instruction"].label,
                           "Locken sanft strecken. Im Zweifel die längere Option wählen.")
            for (value, boundary) in expected {
                XCTAssertTrue(app.buttons["onboarding.option.\(value)"].label.contains(boundary))
            }
            XCTAssertFalse(app.buttons["onboarding.option.very_short"].label.contains("Pixie"))
            XCTAssertFalse(app.buttons["onboarding.option.short"].label.contains("Bob"))
            screenshot("length-\(largeText ? "largest" : "default")", app: app)
            tap("onboarding.help", app: app)
            let help = app.staticTexts["onboarding.help-content"]
            XCTAssertTrue(help.label.contains("Coils"))
            XCTAssertTrue(help.label.contains("Pixie"))
            XCTAssertTrue(help.label.contains("untere Schulterblätter"))
            reach(help, app: app, readableContent: true)
            screenshot("length-help-\(largeText ? "largest" : "default")", app: app)
            tap("onboarding.help", app: app)
            tap("onboarding.option.very_long", app: app)
            assertQuestion(5, app: app)
            tap("onboarding.back", app: app)
            assertQuestion(4, app: app)
            XCTAssertTrue(app.buttons["onboarding.option.very_long"].isSelected)
            app.terminate()
        }
    }

    func testNativeAccountGroupingPreservesConsentAndVerification() {
        let app = launch("registration")
        assertNativeAccountHeader(app: app)
        XCTAssertFalse(app.buttons["onboarding.submit"].isEnabled)
        let marketing = app.buttons["onboarding.marketing"]
        XCTAssertEqual(marketing.value as? String, "Nicht ausgewählt")
        XCTAssertEqual(marketing.label, "Ich möchte Produkt-News und Angebote per E-Mail erhalten. Optional, jederzeit abbestellbar.")
        screenshot("account-native-default", app: app)
        enterAccount(app: app)
        let notice = app.descendants(matching: .any).matching(identifier: "onboarding.legal-notice").firstMatch
        reach(notice, app: app, readableContent: true)
        let noticeText = ([notice.label] + notice.descendants(matching: .staticText).allElementsBoundByIndex.map(\.label)).joined(separator: " ")
        XCTAssertTrue(noticeText.contains("beantragst du dein kostenloses Konto"))
        XCTAssertTrue(app.links.matching(identifier: "https://chaarlie.de/agb").firstMatch.exists)
        XCTAssertTrue(app.links.matching(identifier: "https://chaarlie.de/datenschutz").firstMatch.exists)
        XCTAssertLessThan(notice.frame.maxY, app.buttons["onboarding.submit"].frame.minY)
        screenshot("account-native-notice", app: app)
        tap("onboarding.submit", app: app)
        XCTAssertTrue(app.textFields["onboarding.code"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.staticTexts["onboarding.brand"].exists)
        XCTAssertEqual(app.staticTexts["onboarding.title"].label, "Einmal kurz bestätigen.")
        XCTAssertEqual(app.staticTexts["onboarding.instruction"].label,
                       "Öffne den Anmeldelink in der E-Mail an lea@example.test oder gib den Code hier ein.")
        XCTAssertFalse(app.buttons["onboarding.verify"].isEnabled)
        screenshot("verification-native-default", app: app)
        tap("onboarding.edit-account", app: app)
        assertNativeAccountHeader(app: app)
        XCTAssertEqual(app.textFields["onboarding.first-name"].value as? String, "Lea")
        XCTAssertEqual(app.textFields["onboarding.email"].value as? String, "lea@example.test")
        XCTAssertEqual(marketing.value as? String, "Nicht ausgewählt")
        tap("onboarding.back", app: app)
        assertQuestion(10, app: app)
        XCTAssertTrue(app.buttons["onboarding.option.shine"].isSelected)
    }

    func testAccountAndVerificationReachableAtLargestDynamicType() {
        let app = launch("registration", largeText: true)
        assertNativeAccountHeader(app: app)
        screenshot("account-largest-text-top", app: app)
        enterAccount(app: app)
        let marketing = app.buttons["onboarding.marketing"]
        reach(marketing, app: app, readableContent: true)
        screenshot("account-largest-text-marketing", app: app)
        XCTAssertEqual(marketing.value as? String, "Nicht ausgewählt")
        // At maximum text on SE, the complete label is taller than the viewport.
        // Reach centers it; prove the visible center accepts a real tap and toggles.
        XCTAssertTrue(marketing.isHittable)
        let statusBar = app.statusBars.firstMatch
        let safeTop = statusBar.exists ? statusBar.frame.maxY : app.frame.minY + 28
        XCTAssertGreaterThan(marketing.frame.midY, safeTop)
        XCTAssertLessThan(marketing.frame.midY, app.frame.maxY - 45)
        marketing.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertEqual(marketing.value as? String, "Ausgewählt")
        let notice = app.descendants(matching: .any).matching(identifier: "onboarding.legal-notice").firstMatch
        reach(notice, app: app, readableContent: true)
        screenshot("account-largest-text-notice", app: app)
        tap("onboarding.submit", app: app)
        XCTAssertTrue(app.textFields["onboarding.code"].waitForExistence(timeout: 3))
        screenshot("verification-largest-text", app: app)
        tap("onboarding.edit-account", app: app)
        reach(marketing, app: app, readableContent: true)
        screenshot("account-largest-text-marketing", app: app)
        XCTAssertEqual(marketing.value as? String, "Ausgewählt", "Verification must not change the optional choice")
        tap("onboarding.login", app: app)
        XCTAssertTrue(app.textFields["login.email"].waitForExistence(timeout: 3))
    }
}
