# Group B — German ToS comparison: 7Mind, YAZIO, komoot

Method note: quotes are tagged `[raw-verified]` when confirmed against the raw HTML fetched via `curl` (script: strip tags, unescape entities, collapse whitespace, then `grep -o`), or `[WebFetch only]` when only the WebFetch summarizer saw them. Untagged statements are my own observations about page structure, not quotes.

---

## 1. 7Mind

- **URL:** https://www.7mind.de/agb
- **Stand:** "Gültig ab 31. Juli 2026" `[raw-verified]`
- **Contracting entity:** "Die 7Mind GmbH, Ritterstr. 12, 10969 Berlin ('7Mind')" `[raw-verified]`. Document is split into **Teil I – Web-AGB**, **Teil II – App-AGB**, **Teil III – Widerrufsbelehrungen für Verbraucher**.

### a) In-App Purchase / App Store — contract partner
- Teil I, 1.3: "Für den Download der App und für Käufe, die über einen App-Store abgewickelt werden, gelten zusätzlich die Bedingungen des jeweiligen App-Store-Betreibers." `[raw-verified]`
- Teil II, 1.3 (parallel wording): "Für den Download der App sowie für Käufe, die über eine App-Vertriebsplattform abgewickelt werden, gelten zusätzlich die Bedingungen des jeweiligen Betreibers der App-Vertriebsplattform." `[WebFetch only — not separately grepped, phrasing pattern matches Teil I hit]`
- No sentence states who the *contracting party* is for an App-Store purchase (i.e., does not explicitly say "Apple/Google is your contract partner" or "7Mind is your contract partner") — this specific question is **nicht geregelt** in the visible text.

### b) Auto-renewal, annual plans, trial conversion
- Teil I, 3.7(ii)/context: "Bei Kursen mit einer unbefristeten Laufzeit können 7Mind und der Nutzer den Vertrag über den jeweiligen Kurs jederzeit mit einer Frist von einem Monat kündigen." `[WebFetch only]`
- Trial → paid conversion, Teil I, 3.9: "7Mind kann Nutzern kostenpflichtige Kurse für einen bestimmten Zeitraum kostenfrei anbieten. Nach Ablauf der kostenfreien Zeit ist der Nutzer verpfl[ichtet, den auf der Website angegebenen Preis für den Kurs zu zahlen, es sei denn, der Nutzer kündigt den Vertrag...]" `[raw-verified for the lead-in through "verpfl"; remainder as summarized by WebFetch, not independently re-grepped]`

### c) Cancellation (Kündigung)
- Website, Teil I, 3.6: "Sowohl 7Mind als auch der Nutzer können den Vertrag über die unentgeltliche Nutzung der Website und des Nutzerkontos jederzeit mit einer Frist von 14 Tagen kündigen." `[raw-verified]`
- App, Teil II, 2.8 (parallel clause): "...können den Vertrag über die unentgeltliche Nutzung der App und des Nutzerkontos jederzeit mit einer Frist von 14 Tagen kündigen. Die Kündigung durch den Nutzer kann über die Kon[taktfunktion/-formular...]" `[raw-verified up to "Kon"]`
- Teil I, 3.8 — **method of cancellation accepted**: "Die Kündigung durch den Nutzer kann per E-Mail an [email] oder über die Kündigungsfunktion im persönlichen Nutzerbereich unter www.7mind.de/abo-verwalten erklärt werden." `[raw-verified]` — i.e. 7Mind explicitly accepts **email cancellation**, not just an in-app cancel button.

### d) Refunds (Erstattung)
- Teil III, 2: "Im Falle eines Widerrufs erstatten wir Ihnen alle erhaltenen Zahlungen unverzüglich und spätestens binnen vierzehn Tagen nach Eingang des Widerrufs." `[WebFetch only]`
- No separate refund clause specific to App-Store purchases was found (App Store purchases are routed to the store operator's own refund process per the App-Store-Betreiber clause above) — **nicht geregelt separately**.

### e) Withdrawal right (Widerrufsrecht)
- Teil III, 1: "Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Frist beginnt mit dem Tag des Vertragsabschlusses." `[raw-verified]`
- Expiry/waiver, Teil III, 3 (paraphrased by WebFetch as): "Bei kostenpflichtigen digitalen Inhalten...erlischt das Widerrufsrecht mit Beginn der Bereitstellung, wenn Sie zuvor ausdrücklich zugestimmt und bestätigt haben..." `[WebFetch only]`
- Teil III, 4: "Bei Tickets für 7Mind Events besteht kein Widerrufsrecht, wenn für das Event ein bestimmter Termin oder Zeitraum vorgesehen ist." `[WebFetch only]`
- Nothing found stating who handles withdrawal specifically for App-Store IAP (i.e., no explicit "for App Store purchases, Apple/Google handles withdrawal" carve-out) — **nicht geregelt**.

### f) Price changes (Preisänderungen)
- Teil I, 3.5: "7Mind informiert den Nutzer spätestens sechs Wochen vor der geplanten Preisänderung in Textform über die Preisänderung und den Zeitpunkt ihres Inkrafttretens. Der Nutzer hat das Recht, den Vertrag innerhalb einer Frist von 30 Tagen nach Zugang der Mitteil[ung über die Preisänderung in Textform zu kündigen]." `[raw-verified up to "Mitteil"]`

### g) Liability (Haftung)
- Teil I, 8.1(i) / Teil II, 5.1(i) (parallel): "...der Höhe nach begrenzt auf den bei Vertragsschluss typischerweise vorhersehbaren Schaden; (ii) 7Mind-Personal haftet im Übrigen nicht wegen einfacher Fahrlässigkeit." `[raw-verified]`
- Teil I, 8.3 / Teil II, 5.3: "7Mind haftet nicht für Schäden, die dem Nutzer ausschließlich aufgrund der mangelnden persönlichen Eignung des Nutzers für die Teilnahme an einem Kurs entstehen." `[WebFetch only]`

### h) Changes to terms (Änderung der AGB)
- Teil I, 9.1: "7Mind ist berechtigt, Bestimmungen dieser Web-AGB mit einer Frist von mindestens zwei Wochen im Voraus zu ändern, wenn dies notwendig ist, (i) aufgrund einer Änderung der geltenden Gesetzgebung oder höchstrichterlichen Rechtsprechung, oder (ii) zu Klärungszwecken zur Beseitigung von in den Web-AGB exi[stierenden Unklarheiten/Widersprüchen]." `[raw-verified up to "exi"]` (parallel clause exists for App-AGB, "diese App-AGB" — `[raw-verified]`)
- Teil I, 9.2: "Änderungen, die wesentliche Vertragspflichten...betreffen, werden nur wirksam, wenn der Nutzer der geänderten Fassung der Web-AGB ausdrücklich zustimmt." `[WebFetch only]` — **note: this is real-consent, not silence-based fiction of consent** (contrast with komoot below).

### i) Minimum age (Mindestalter)
- Teil II, 1.7 (App): "Die App darf von Personen ab 18 Jahren genutzt werden. Die Berechtigung zur Nutzung der Dienste kann weiteren persönlichen Voraussetzungen unterliegen (z. B. körperliche/geistige Belastbarkeit etc.), auf die der Nutzer gesondert in der App hingewiesen wird." `[raw-verified]`
- Teil I, 1.4 (Website/Kurse): "Die Teilnahme an einzelnen Kursen kann besondere persönliche Voraussetzungen erfordern, insbesondere ein bestimmtes Mindestalter..." `[WebFetch only]`
- Events, Teil I, 6.3: "Teilnehmer müssen mindestens 18 Jahre alt sein." `[WebFetch only]`

### j) Health/medical disclaimer, AI disclaimer
- Teil I, 3.2 / Teil II, 2.5 (parallel): "Die Übungen, die im Rahmen der Kurse vorgestellt werden, sind für durchschnittlich gesunde und körperlich und geistig durchschnittlich belastbare Nutzer ausgelegt... Der Nutzer ist dafür verantwortlich, zu überprüfen, dass er die körperlichen und geistigen Fähigkeiten hat bzw. die gesundheitlichen Voraussetzungen erfüllt, um an den Kursen teilnehmen zu können. Im Zweifel hat der Nutzer einen Arzt zu konsultieren und/oder die Teilnahme zu unterlassen." `[raw-verified]`
- No distinct "KI-Begleiter" (AI companion) disclaimer text was captured from this page — 7Mind has a **separate** AGB document for its AI companion feature at `https://www.7mind.de/ki-begleiter-agb` (found via search, not opened in this pass — flag for follow-up if the AI-disclaimer comparison needs it specifically).

### k) Applicable law & venue
- Teil I, 9.4 / Teil II, 6.4: "Die mit diesen Web-AGB geregelten Vertragsverhältnisse sowie diese Web-AGB selbst unterliegen dem Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Für Verbraucher gilt diese Rechtswahl nur insoweit, als ihnen dadurch nicht der Schutz zwingender [Verbraucherschutzvorschriften ihres gewöhnlichen Aufenthaltsstaates entzogen wird]." `[raw-verified up to "zwingender"]`
- No explicit Gerichtsstand (venue) clause text was captured — likely absent for consumer contracts (standard, since German law bars agreeing exclusive venue against consumers) — **nicht geregelt / not found**.

### l) Consumer dispute resolution (VSBG) / OS platform
- Teil I, 9.6 / Teil II, 6.6 (parallel): "7Mind ist weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen." `[raw-verified]`
- No OS-platform (ec.europa.eu/consumers/odr) link found on the page.

---

## 2. komoot

- **URL:** https://www.komoot.com/de-de/terms-of-service
- **Stand/last-updated date:** not shown anywhere on the rendered page — **nicht geregelt / not found** (checked for "Stand:" and "zuletzt aktualisiert", no hits).
- **Contracting entity:** "Der Nutzer schließt den Vertrag über die Nutzung der Dienste von komoot mit der komoot GmbH, Friedrich-Wilhelm-Boelcke-Straße 2, 14473 Potsdam." `[raw-verified]`

### a) In-App Purchase / App Store — contract partner
- The page only shows a marketing blurb ("Besuche den App Store, Google Play oder scanne den QR-Code..."), not a legal clause naming Apple/Google as contract partner for IAP. **nicht geregelt** on this page (komoot's payment clause below speaks generically of "Kaufprozess" and "Debitv[karte]", not store billing specifically).

### b) Auto-renewal, annual plans, trial conversion
- Ziffer 18(.2): "...über den vom Nutzer gebuchten Mindestnutzungszeitraum. Danach verlängern sich die kostenpflichtigen Dienste jeweils um Verlängerungszeiträume der gleichen Dauer, wenn sie nicht vom Nutzer oder komoot gekündigt werden." `[raw-verified]`

### c) Cancellation (Kündigung)
- Ziffer 18.2 continued: "Der Nutzer kann die kostenpflichtigen Dienste ohne Angabe von Gründen ohne Frist, jedoch unter Beachtung der technischen Möglichkeiten, zum Ablauf des im Registrierungsprozess gebuchten Mindestnutzungszeitraums oder anschließend zum Ablauf eines Verlängerungszeitraums kündigen." `[raw-verified]`
- Method: "Die Kündigung kann unter 'Profil' oder schriftlich per Email oder Brief an komoot bzw. den Nutzer. Bei der Kündigung in Textform sind der Benutzername und ei[ne eindeutige Identifizierung erforderlich]." `[raw-verified up to "ei"]` — i.e. komoot explicitly accepts email/Textform cancellation, in addition to an in-app control. No separate carve-out for App-Store-billed subscriptions (i.e., the clause does not say App Store subscribers must cancel via the store instead) — **not distinguished / nicht geregelt separately**.

### d) Refunds (Erstattung)
- Ziffer 18.7: "In folgenden Fällen ist der Anspruch des Nutzers auf Rückzahlung bereits im Voraus bezahlter Entgelte ausgeschlossen: a) komoot kündigt den Vertrag gemäß Ziffer 18.3 aus wichtigem Grund, b) komoot sperrt den Zugang des Nutzers gemäß Ziffer 17 oder c) der Nutzer kündigt den Vertrag; der Anspruch des Nut[zers auf Rückzahlung ist im Übrigen ausgeschlossen/eingeschränkt]." `[raw-verified up to "Nut"]`
- No App-Store-specific refund carve-out found — **nicht geregelt separately**.

### e) Withdrawal right (Widerrufsrecht)
- "Der Nutzer kann seine Vertragserklärung innerhalb von 14 Tagen ohne Angabe von Gründen in Textform (z. B. Brief, E-Mail) widerrufen. Die Frist beginnt nach Erhalt dieser Belehrung in Textform, jedoch nicht vor Vertragsschluss und auch nicht vor Erfüllung unserer Informationspflichten Artik[el 246 ... EGBGB]." `[raw-verified up to "Artik"]`
- Expiry: "Die Frist beginnt für den Nutzer mit der Absendung der Widerrufserklärung, für komoot mit deren Empfang. Das Widerrufsrecht des Nutzers erlischt vorzeitig, wenn der Vertrag von beiden Seiten auf dem ausdrücklichen Wunsch des Nutzers vollständig erfüllt ist, bevor er sein Widerrufsrecht ausgeübt hat." `[raw-verified]`
- No mention of who handles withdrawal for IAP specifically — **nicht geregelt**.

### f) Price changes (Preisänderungen)
- No dedicated price-change clause was found; the pricing section only says: "Die jeweiligen Preise findet der Nutzer auf der aktuellen Paketübersicht. Einzelheiten zu den Entgelten der kostenpflichtigen Dienste sind auf den komoot-Websites im Bereich 'Profil' geregelt. Die dort genannten Preise sind bindend." `[raw-verified]` — this describes current pricing being binding, not a change/notice mechanism. **A dedicated Preisänderungs-Klausel is nicht geregelt** on this page.

### g) Liability (Haftung)
- Ziffer 15.1: "Für Schäden, die einem Nutzer durch eine leicht fahrlässige, komoot zurechenbare Pflichtverletzung entstehen, haftet komoot nur insoweit, als es sich dabei um einen nach Art der Leistung vorhersehbaren und vertragstypischen Schaden handelt, der unmittelbar durch die Pflichtverletzung herbeigeführt wurde. Insbesondere wird die Haftung für Datenverlust auf den typischen Wiederherstellungsaufwand beschränkt, der bei regelmäßiger und gef[ahrentsprechender Datensicherung eingetreten wäre]." `[raw-verified up to "gef"]`
- Ziffer 15.4: "Soweit sich aus den vorstehenden Regelungen dieser Ziffer 15. nichts anderes ergibt, ist jede Haftung von komoot — gleich aus welchem Rechtsgrund — ausgeschlossen." `[raw-verified]`
- Separately, komoot has a detailed **tour-safety / outdoor-risk disclaimer** near "Gesundheit": "...eine Begehung bzw. ein Befahren der vom Nutzer ausgewählten Tour ohne eine erhebliche, d.h. ohne eine über das allgemeine Lebensrisiko hinausgehende Gefährdung für das Leben, den Körper und die Gesundheit des Nutzers zulassen." `[raw-verified]` — this is an outdoor/route-safety disclaimer, not a medical disclaimer in the clinical sense.

### h) Changes to terms (Änderung der AGB)
- Ziffer 19.1: "Komoot behält sich vor, diese AGB jederzeit ohne Nennung von Gründen zu ändern... [komoot wird] den Nutzer über Änderungen der AGB rechtzeitig benachrichtigen. Widerspricht der Nutzer der Geltung der neuen AGB nicht innerhalb von sechs (6) Wochen nach der Benachrichtigung, gelten die geänderten AGB als vom Nutzer angenommen. Komoot wird den Nutzer in der Benachrichtigung auf sein Widerspruchsrecht und die Bedeutung der Widerspruchsfrist hinweisen." `[raw-verified for the "den Nutzer über Änderungen..." sentence onward]` — **this is a fiction-of-consent-via-silence model** (6-week objection window), unlike 7Mind's explicit-consent model for material changes.

### i) Minimum age (Mindestalter)
- No "Mindestalter" / "Jahre alt" / "minderjährig" text found anywhere on the page — **nicht geregelt / not found**.

### j) Health/medical, AI disclaimer
- No clinical health/medical disclaimer or AI disclaimer found. The only "Gesundheit" hit is the outdoor-route-risk disclaimer quoted above under (g). **nicht geregelt** for medical/AI specifically.

### k) Applicable law & venue
- "Erfüllungsort ist der Sitz von komoot. Gerichtsstand für Kaufleute im Sinne des Handelsgesetzbuches (HGB) ist der Sitz von komoot. Es gilt deutsches Recht unter Ausschluss des Internationalen Privatrechts und des ins deutsche Recht übernommenen UN-Kaufrechts." `[raw-verified]` — note venue is only fixed for merchants (Kaufleute), not consumers, consistent with German consumer-protection law.

### l) Consumer dispute resolution (VSBG) / OS platform
- No "Schlichtung", "VSBG", "Streitbeilegung", or OS-platform link found anywhere on the page — **nicht geregelt / not found**.

---

## 3. YAZIO — NOT ACCESSIBLE

Could not obtain YAZIO's actual consumer Terms of Use / AGB text in this pass. Details:

- YAZIO's public marketing site (`www.yazio.com/de`) has **no footer link** to AGB/Nutzungsbedingungen/Terms — only Datenschutzerklärung (`/de/privacy`), Kontakt, and a subscription-cancellation page (`/de/app/account/cancel`). Confirmed by direct WebFetch listing of all page hyperlinks.
- The App Store listing for YAZIO points to Apple's own standard EULA for "Nutzungsbedingungen" (`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` — i.e., YAZIO uses Apple's default EULA rather than a custom one for the iOS app), and its privacy-policy link points to a Zendesk Help Center article: `https://help.yazio.com/hc/en-us/articles/203444951-Terms-of-Use-Privacy-Policy`. This appears to be the page hosting YAZIO's actual Terms of Use text.
- That Zendesk page returned **HTTP 403 Forbidden** on every attempt — both direct `curl` (with a browser User-Agent) and WebFetch — consistent with Zendesk-side bot protection. Tried multiple URL variants (`hc/en-us/...`, `hc/de/...`, `hc/de-de/...`) and multiple fetch attempts; all blocked.
- A PDF found via web search at `https://filecontent.yazio.com/press/terms_and_conditions_de.pdf` is **not** YAZIO's consumer app terms — it is the terms for YAZIO's **Affiliate-Programm** (run via the Awin network), a different document. Confirmed via WebFetch (titled "Awin Terms DE" per the PDF's internal structure) — did not use this as a source for the app's consumer ToS.
- Tried a range of guessed URL paths on `www.yazio.com` (`/de/terms`, `/de/agb`, `/de/nutzungsbedingungen`, `/terms`, `/de/gtc`, `/de/legal`, `/de/legal/terms`, `/de/agb-de`, `/de/tos`, `/de/eula`) and on `filecontent.yazio.com` — all returned 404.
- Third-party cancellation-service pages (aboalarm.de, volders.de) paraphrase some YAZIO terms (e.g., 48-hour cancellation cutoff, cancellation address "YAZIO GmbH, Kundenservice, Kartäuserstr. 13a, 99084 Erfurt") but these are **not the company's own page** and were explicitly excluded per the method (no content taken from search snippets/third parties as verbatim quotes).

**Conclusion for YAZIO: could not access the official German ToS page — no verbatim quotes are reported for this app.** If this is needed, the likely next step is fetching the Zendesk article through a tool/session that isn't blocked by its bot protection, or asking YAZIO support directly for the current AGB PDF.
