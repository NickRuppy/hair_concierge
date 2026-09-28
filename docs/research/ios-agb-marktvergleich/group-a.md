# German ToS Comparison — Group A: Freeletics, Blinkist, Babbel

Method notes: All three sites are JavaScript-rendered SPAs; Freeletics and Babbel's `www.` French/English host blocked plain `curl` (served a homepage/FAQ shell or wrong-locale content), and Blinkist is behind a Cloudflare JS challenge that returns HTTP 403 to `curl`/WebFetch. Where noted, text below was retrieved by opening the real page in a browser (Claude Browser tool) and reading the rendered DOM text — this is the actual page content as served to a real visitor, not an LLM summary, so it is tagged **[raw-verified]**. Babbel's terms were retrievable directly via `curl` (grep-confirmed) once the correct German-locale host (`de.babbel.com`, not `www.babbel.com` which serves English at `/legal/terms`) was found — also tagged **[raw-verified]**. Nothing here is WebFetch-summarized text; anywhere WebFetch was used it failed (403) and was discarded in favor of the browser/curl retrieval described above.

---

## 1. Freeletics

- **URL (current German AGB):** https://www.freeletics.com/de/pages/terms/?country=de (page offers a version picker; the current default shown is "AGB 07.07.2025"; older versions 2015–2023 are also listed and superseded)
- **Version/"Stand":** `Version 07.07.2025` (stated verbatim at the foot of the document) [raw-verified]
- **Contracting entity / country:** "Freeletics GmbH, Berg-am-Laim-Straße 111, 81673 München" — Germany. Register: "Eingetragen beim Amtsgericht München: HRB 205346"; "Geschäftsführer: Assif Daniel Sobhani." [raw-verified]

### a) In-App Purchase / App Store / contract partner for IAP
§ 6.2: *"Bei Anmeldung über mobile Apps hängt das Zustandekommen des Nutzungsvertrages von den Regeln des jeweiligen Anbieters des Stores (z. B. Apple, Google, Sony etc.) ab."* [raw-verified]
§ 9: *"Sofern du Freeletics Leistungen entgeltlich über In-App Käufe erwirbst, erfolgt die Abrechnung über den Anbieter des jeweiligen Stores."* [raw-verified]
(Freeletics remains the contracting party for the use agreement itself; the App Store operator only handles billing — see § 6.3 on how the purchase contract is formed via the store's own "Jetzt kaufen"/password flow.)

### b) Auto-renewal, annual plans, trial conversion
§ 7.3: *"Unsere Abonnements werden mit unterschiedlichen Mindestlaufzeiten angeboten und verlängern sich automatisch jeweils um den Zeitraum der gewählten Mindestlaufzeit, bis eine Kündigung durch dich oder durch uns erfolgt."* [raw-verified]
§ 7.5 (Germany-specific): *"Wenn du als Nutzer mit regelmäßigen Wohnsitz in Deutschland, ab dem 1. März 2022 ein Abonnement abschließt, verlängert sich nach Ende der gewählten Laufzeit dein Abonnement automatisch auf unbestimmte Zeit. Du kannst aber das verlängerte Abonnement jederzeit mit einer Frist von höchstens einem Monat zum Ende des jeweiligen Abrechnungszeitraum kündigen."* [raw-verified]
Trial conversion, § 8.1: *"Soweit ein kostenloser Probezeitraum ('Trial') vereinbart worden ist, werden die Gebühren für das entgeltliche Abonnement direkt im Anschluss an den Probezeitraum eingezogen."* [raw-verified]

### c) Cancellation (Kündigung) — email/Textform accepted for App Store subs?
§ 16.2: *"Auf unseren Webseiten gekaufte Abonnements kannst du kündigen, indem du auf der Webseite in deinem Nutzerprofil die entsprechende Einstellung vornimmst. Alternativ kannst du auch per E-Mail an support@freeletics.com oder postalisch die Kündigung deines Abonnements erklären. In-App gekaufte Abonnements müssen in den Einstellungen des jeweiligen Stores gekündigt werden."* [raw-verified]
**Notable:** email/postal cancellation is explicitly offered for website-purchased subscriptions, but for **In-App-purchased subscriptions Freeletics does *not* accept email cancellation** — it requires cancellation directly in the App/Play Store settings.

### d) Refunds (Erstattung), especially App Store
No dedicated "refunds" section for App Store purchases; refund logic appears inside the withdrawal (Widerruf) and plan-change provisions. § 6.5 (plan upgrade via Apple): *"Hast du dein ursprüngliches Abonnement über Apple abgeschlossen, erstattet dir Apple den für die verbleibende Vertragslaufzeit dieses Abonnements bereits entrichteten Kaufpreis anteilig zurück."* [raw-verified] § 16.1: on account deletion with a running subscription, *"wird ein eventuell bereits von dir bezahlter Betrag nicht - auch nicht anteilig - zurückerstattet."* [raw-verified] General refund process for App-Store purchases outside of Widerruf/plan-change: **nicht geregelt** (routed to the store).

### e) Withdrawal right (Widerrufsrecht) — who handles it for IAP, waiver/expiry
§ 10.1 (statutory 14-day notice, standard EU text): *"Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen den Vertrag zu widerrufen. Die Widerrufsfrist beträgt grundsätzlich vierzehn Tage ab dem Tag des Vertragsschlusses."* [raw-verified]
§ 7.3: *"Wir möchten dich darauf hinweisen, dass das 14-tägige Widerrufsrecht nur bei Neuverträgen Anwendung findet und nicht für automatisch verlängerte Abonnements gilt."* [raw-verified]
§ 10.2 (expiry/waiver of the right for digital content): *"Das Widerrufsrecht erlischt bei einem Vertrag über die Lieferung von nicht auf einem körperlichen Datenträger befindlichen digitalen Inhalten auch dann, wenn wir mit der Ausführung des Vertrags begonnen haben, nachdem du dazu deine ausdrückliche Zustimmung gegeben hast und gleichzeitig deine Kenntnis davon bestätigt hast, dass du dein Widerrufsrecht mit Beginn der Vertragsausführung verlierst."* [raw-verified]
Withdrawal is directed to Freeletics itself (postal/email address given in § 10.1), not to the App Store, even for in-app purchases — Freeletics does not carve out a separate IAP withdrawal path here.

### f) Price changes (Preisänderungen)
No standalone "Preisänderung" clause governing unilateral mid-contract price increases was found; § 3.2 only points users to the current prices on the website, and § 11 covers promotional discounts lapsing after the minimum term. **Nicht geregelt** as a distinct unilateral price-increase mechanism.

### g) Liability (Haftung) — structure
§ 13.2 (free services): *"haften wir, unabhängig aus welchem Rechtsgrund, ausschließlich für Schäden aufgrund von Vorsatz und grober Fahrlässigkeit oder des Fehlens einer garantierten Eigenschaft... Im Übrigen ist unsere Haftung ausgeschlossen."* [raw-verified]
§ 13.3 (paid services): *"Verletzen wir eine wesentliche Vertragspflicht mit leichter Fahrlässigkeit, ist unsere Haftung auf den typischen, vorhersehbaren Schaden beschränkt... Unsere Haftung bei einer von uns verschuldeten Verletzung des Lebens, des Körpers oder der Gesundheit bleibt von den vorgenannten Beschränkungen unberührt."* [raw-verified]
Standard German Kardinalpflichten structure (intent/gross negligence unlimited; cardinal-duty slight negligence capped at foreseeable damage; life/body/health carve-out unaffected).

### h) Changes to terms (Änderung der AGB) — consent vs. silence, notice period
§ 19: *"Wir werden dich spätestens zwei (2) Wochen vor dem geplanten Inkrafttreten der neuen Fassung der Allgemeinen Geschäftsbedingungen per E-Mail auf die Änderungen hinweisen. Widersprichst du der Geltung der neuen Allgemeinen Geschäftsbedingungen nicht innerhalb dieser Frist und nutzt du Freeletics weiter, so gelten die neuen Allgemeinen Geschäftsbedingungen als akzeptiert."* [raw-verified]
**Notable:** this is a fiction-of-consent-by-silence mechanism with only a 2-week notice period.

### i) Minimum age (Mindestalter)
§ 2.2: *"Voraussetzung für die Eröffnung eines Nutzerkontos und die Nutzung der Freeletics Dienste ist, dass du bereits 18 Jahre und voll geschäftsfähig bist."* [raw-verified]

### j) Health/medical disclaimer, AI disclaimer
§ 4.1–4.2 extensive health disclaimer, e.g.: *"Die Nutzung der Freeletics Dienste erfolgt auf eigenes Risiko."* and *"Bei den im Rahmen von Freeletics und den Freeletics Diensten angebotenen Leistungen und Informationen handelt es sich weder um eine medizinische noch eine ärztliche Beratung. Sie stellen auch keinen Ersatz für eine ärztliche Untersuchung oder Behandlung dar."* [raw-verified]
No AI-specific disclaimer clause found anywhere in the document — **nicht geregelt**.

### k) Applicable law and venue (Rechtswahl, Gerichtsstand)
§ 20.1: *"Zwischen den Parteien findet ausschließlich deutsches Recht unter Ausschluss des UN-Kaufrechts (CISG) Anwendung."* [raw-verified]
§ 20.2: *"Hast du keinen allgemeinen Gerichtsstand in Deutschland oder in einem anderen EU-Mitgliedstaat oder hast du einen festen Wohnsitz nach Wirksamwerden dieser Allgemeinen Geschäftsbedingungen in ein Land außerhalb der EU verlegt... ist ausschließlicher Gerichtsstand für sämtliche Streitigkeiten aus diesem Vertrag unser Geschäftssitz."* [raw-verified]

### l) Dispute resolution (Verbraucherschlichtung/VSBG, OS platform)
§ 18: *"Verbraucherinformation: Nichtteilnahme an einem Streitbeilegungsverfahren. Wir sind weder bereit noch verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Unsere E-Mail-Adresse findest du im Impressum."* [raw-verified]
**Notable:** the current (07.07.2025) version does **not** mention the EU ODR platform link at all (an older 2022 PDF version of these AGB did include `ec.europa.eu/consumers/odr`) — the OS-platform reference appears to have been dropped in the current version.

---

## 2. Blinkist

- **URL:** https://www.blinkist.com/de/tos (retrieved via browser after a Cloudflare "Just a moment…" challenge blocked plain `curl`/WebFetch with HTTP 403)
- **Version/"Stand":** *"Gültig ab dem 5. November 2025"* (stated verbatim at the foot of the page) [raw-verified]
- **Contracting entity / country:** "Blinks Labs GmbH, Revaler Straße 31, 10245 Berlin" (company block); the Widerruf section separately lists "Blinks Labs GmbH, Sonnenallee 223, 12059 Berlin, Deutschland" as the withdrawal-notice address — Germany. [raw-verified]

### a) In-App Purchase / App Store / contract partner for IAP
§ 4: *"Du kannst den Vertrag über ein kostenpflichtiges Abonnement auch durch einen In-App-Purchase über unsere iOS- oder Android-Apps abschließen... Direkt nach dem Kauf solltest du eine Empfangsbestätigung von dem Drittanbieter-App-Store (und nicht direkt von Blinkist) erhalten."* [raw-verified]
§ 9: *"Bei Abschluss eines Abonnements über die iOS- oder Android-Apps von Blinkist erfolgt die Zahlung über den In-App-Purchase-Prozess von Apple oder Google."* [raw-verified]
Blinkist itself remains the contracting party (it separately sends the "Annahmeerklärung"/order confirmation by email even for in-app purchases); the store only handles payment/receipt.

### b) Auto-renewal, annual plans, trial conversion
Intro section: *"wenn du unsere Services für eine bestimmte Dauer abonnierst (die 'Anfangslaufzeit'), sich die Bedingungen deines Abonnements automatisch um weitere Zeiträume mit der gleichen Dauer wie die Anfangslaufzeit verlängern, es sei denn, du kündigst dein Abonnement in Übereinstimmung mit Abschnitt 10."* [raw-verified] (Note: page uses "Abschnitt 10" in the intro but the cancellation clause is numbered § 11 in the body — an internal cross-reference inconsistency in the live page.)
Trial conversion, § 5(2): *"benötigen wir zu Beginn des Probe-Abonnements deine Zustimmung dafür, dass sich dein kostenloser Zugang nach dem Ablauf des Probe-Abonnements... in ein kostenpflichtiges Abonnement... umwandelt."* [raw-verified]

### c) Cancellation (Kündigung) — email/Textform accepted for App Store subs?
§ 11(A): *"Abo-Zugänge, die du über unsere Web-App abgeschlossen hast, kannst du unter dem Menüpunkt 'Einstellungen' der Web-App kündigen... Einen über unsere iOS- oder Android-Apps abgeschlossener Abo-Zugang kannst du in deinen iTunes- oder Google-Play-Einstellungen kündigen."* [raw-verified]
**Notable: Blinkist does not offer email cancellation at all**, even for its own website subscriptions — cancellation is only via in-app/web-app account settings or (per the text) the "Abonnement kündigen" button on the website; App-Store-purchased subscriptions must be cancelled in the store's own settings, with no Blinkist-side email/Textform alternative mentioned.

### d) Refunds (Erstattung), especially App Store
§ 11(A): *"Kündigst du dein Abonnement während der Unbefristeten Laufzeit vor Ablauf von jeweils 12 Monaten, so erstatten wir dir die Kosten für die nicht mehr genutzten Monate anteilig auf die von dir gewählte Zahlungsmethode zurück... Einen über unsere iOS- oder Android-Apps abgeschlossener Abo-Zugang... Kündigst du deinen Abo-Zugang während der Unbefristeten Laufzeit vor Ablauf von jeweils 12 Monaten, so erstattet in diesem Fall direkt der jeweilige Drittanbieter-App-Store Anbieter deine Kosten für die nicht mehr genutzten Monate."* [raw-verified]
**Notable:** for App-Store purchases, Blinkist explicitly routes the pro-rata refund obligation to the App Store operator itself, not to Blinkist.

### e) Withdrawal right (Widerrufsrecht) — who handles it for IAP, waiver/expiry
§ 8(1): *"Bitte beachte, dass dir im Falle eines In-App-Kaufs ein Widerrufsrecht innerhalb des jeweiligen App-Stores, also z.B. Apple-App-Store oder Google Play Store, zusteht."* [raw-verified] — i.e., for IAP the withdrawal right is exercised via the App Store, not Blinkist directly. It also has an Apple-usage-data clause: *"indem du unsere App nutzt und In-App-Käufe tätigst, erklärst du dich damit einverstanden, dass wir Daten über deine Nutzung und den tatsächlichen Gebrauch der gekauften Inhalte an Apple weitergeben, um Rückerstattungsanträge zu bearbeiten."* [raw-verified]
Expiry/waiver, § 8: *"Dein Widerrufsrecht gemäß Ziff. 8.1 erlischt bei einem Vertrag über die entgeltliche Lieferung von digitalen Inhalten vorzeitig, wenn... du hast ausdrücklich zugestimmt, dass Blinkist bereits vor Ablauf der 14-tägigen Widerrufsfrist mit der Ausführung des Vertrags beginnen soll und anerkannt, dass du durch deine Zustimmung dein Widerrufsrecht vorzeitig verlierst."* [raw-verified]

### f) Price changes (Preisänderungen)
No standalone unilateral price-increase clause found; § 9 only addresses discount pricing lapsing after the "Anfangslaufzeit": *"dass dir angebotene Rabatte in der Regel nur für die Anfangslaufzeit gelten, und sich dein Abo-Zugang nach Ablauf der Anfangslaufzeit zum vollen Preis verlängert."* **Nicht geregelt** as a distinct mid-term price-change mechanism.

### g) Liability (Haftung) — structure
§ 13: *"Blinkist schließt Ansprüche von dir auf Schadensersatz aus. Hiervon ausgenommen sind Schadensersatzansprüche aus der Verletzung des Lebens, des Körpers, der Gesundheit oder aus der Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) sowie die Haftung für sonstige Schäden, die auf einer vorsätzlichen oder grob fahrlässigen Pflichtverletzung von Blinkist... beruhen."* [raw-verified] *"Bei der Verletzung wesentlicher Vertragspflichten haftet Blinkist nur auf den vertragstypischen, vorhersehbaren Schaden, wenn dieser einfach fahrlässig verursacht wurde."* [raw-verified]

### h) Changes to terms (Änderung der AGB) — consent vs. silence, notice period
§ 15: *"Sofern zu einer Änderung der AGB von dir keine ausdrückliche Einwilligung eingeholt wird, wirst du von Blinkist über jegliche Änderungen und/oder Ergänzungen der AGB rechtzeitig (mindestens vier Wochen vor Inkrafttreten der geänderten AGB) informiert... Falls du der Geltung der neuen AGB nicht innerhalb von vier Wochen nach Erhalt der Mitteilung... widersprichst, gilt die neue Version der AGB als von dir angenommen."* [raw-verified]
Fiction-of-consent-by-silence, 4-week notice — twice the notice period of Freeletics's 2 weeks.

### i) Minimum age (Mindestalter)
§ 3: *"Zur Registrierung berechtigt sind Personen ab einem Alter von 18 Jahren. Als Minderjähriger darfst du dich nur dann bei Blinkist registrieren, wenn du mindestens 14 Jahre als bist und deine gesetzlichen Vertreter ihre Einwilligung erteilt haben."* [raw-verified] (typo "als bist" appears verbatim on the live page)

### j) Health/medical disclaimer, AI disclaimer
No health/medical disclaimer clause found (Blinkist is a reading/audio-summary product, not fitness/health) — **nicht geregelt**. No AI-specific disclaimer found either — **nicht geregelt**.

### k) Applicable law and venue (Rechtswahl, Gerichtsstand)
§ 17: *"Sofern Du Unternehmer (im Sinne des § 14 BGB) bist, gilt folgendes: Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss der Regelungen des UN-Kaufrechts (CISG). Sofern kein ausschließlicher gesetzlicher Gerichtsstand gegeben ist, ist für alle Streitigkeiten aus oder im Zusammenhang mit der Vertragsbeziehung ausschließlich das Gericht am Sitz von Blinkist, mithin Berlin, zuständig."* [raw-verified]
**Notable:** this clause is explicitly scoped to *Unternehmer* (business customers) only — for consumers the document does not state an equivalent explicit venue/choice-of-law clause (statutory consumer-protective rules would apply by default) — **nicht geregelt for consumers specifically, beyond statutory default**.

### l) Dispute resolution (Verbraucherschlichtung/VSBG, OS platform)
§ 16: *"Informationen zu Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle (§ 36 VSBG... und Art. 14 der Verordnung (EU) Nr. 524/2013): Wir sind weder bereit noch verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."* [raw-verified]
No explicit OS-platform URL is given in this clause (only the legal citation to the EU regulation establishing it) — the direct ec.europa.eu/consumers/odr link is **nicht geregelt** as literal text, unlike Freeletics's older version.

---

## 3. Babbel

- **URL:** https://de.babbel.com/legal/terms (note: `www.babbel.com/legal/terms` serves the **English**-language version at that path — the German version lives on the `de.babbel.com` host) — retrieved directly via `curl` and grep-verified against the raw HTML.
- **Version/"Stand":** *"Babbel GmbH | Babbel Nutzungsbedingungen Juli 2026"* (page title/header shows "Juli 2026" as the version marker) [raw-verified]
- **Contracting entity / country:** § 1.1: *"Babbel GmbH, Andreasstraße 72, 10243 Berlin, Deutschland"* — Germany. [raw-verified]

### a) In-App Purchase / App Store / contract partner for IAP
§ 1.2: *"Falls und soweit Deine Berechtigung zur Nutzung der Babbel Dienste auf einem separaten Vertrag zwischen Babbel und einem Business-Partner... oder einem Vertrag zwischen Dir und einem Drittanbieter (insbesondere App Store Provider oder Vertriebsplattformen) beruht, finden diese Bedingungen Anwendung mit Ausnahme der Ziffern 4.3 (Bestellprozess), 10 (Preise und Zahlungsbedingungen), 12.1 bis 12.3 (Laufzeit und Kündigung) sowie 20 (Widerrufsrecht). In diesen Fällen richten sich der Bestellprozess, die Preise und Zahlungsbedingungen, die anwendbare Laufzeit und Kündigung und das Widerrufsrecht ausschließlich nach dem Hauptvertrag zwischen Babbel und dem Business-Partner."* [raw-verified]
**Notable:** for IAP/App-Store purchases, Babbel's own terms explicitly defer order process, pricing, term/termination, and withdrawal rights to the App Store's own terms rather than Babbel's — a materially different structure from Freeletics and Blinkist.

### b) Auto-renewal, annual plans, trial conversion
§ 12.3: *"Soweit nichts anderes vereinbart ist, bleibt jede Bestellung über Kostenpflichtige Dienste für die Dauer der in der Bestellung festgelegten ursprünglichen Laufzeit ('Anfängliche Laufzeit') in Kraft. Nach Ablauf der Anfänglichen Laufzeit verlängert sich die Laufzeit der Bestellung automatisch und fortlaufend auf unbestimmte Zeit ('Verlängerte Laufzeit')."* [raw-verified]
§ 2.4 (trial/Probenutzung): *"Nach Maßgabe der in der Bestellung vereinbarten Bedingungen kann die Probenutzung von Diensten enden und automatisch in reguläre Kostenpflichtige Dienste übergehen."* [raw-verified]

### c) Cancellation (Kündigung) — email/Textform accepted for App Store subs?
§ 1.7 (general form requirement): *"Soweit diese Bedingungen nichts anderes bestimmen, sind alle Mitteilungen und Erklärungen, die Du Babbel gegenüber abgibst, mindestens in Textform abzugeben (eine einfache E-Mail ist ausreichend)."* [raw-verified] — so for the direct Babbel contract relationship, email cancellation is accepted in principle. However, per § 1.2 quoted under (a), **for App-Store-purchased subscriptions cancellation is governed by the store's own terms, not Babbel's**, since Ziffer 12.1–12.3 are explicitly disapplied for that contract path.
§ 12.4 covers termination for cause with a 30-day cure period: *"Ein solcher wichtiger Grund besteht für beide Parteien insbesondere dann, wenn die andere Partei eine Bestellung oder diese Bedingungen in wesentlicher Weise verletzt und diese Verletzung nicht innerhalb von dreißig (30) Tagen nach Erhalt einer schriftlichen Anzeige (eine einfache E-Mail ist ausreichend) dieser Verletzung geheilt wird."* [raw-verified]

### d) Refunds (Erstattung), especially App Store
§ 12.3: *"Im Falle einer Kündigung vor dem Ende eines Abrechnungszeitraums wird Babbel Dir die auf den verbleibenden Abrechnungszeitraum entfallenden Gebühren anteilig erstatten."* [raw-verified] — this pro-rata refund sits inside the ordinary (non-App-Store) termination clause. For App-Store purchases specifically, refunds fall under the disapplied Ziffer 10/12 per § 1.2, i.e. **nicht geregelt in Babbel's own document — governed by the store**. (A country-specific "US" section found elsewhere in the document states the opposite — no refund on cancellation — but that clause is scoped to US residents, not Germany, per the document's "LÄNDERSPEZIFISCHE BESTIMMUNGEN" structure.)

### e) Withdrawal right (Widerrufsrecht) — who handles it for IAP, waiver/expiry
§ 20.1 (statutory text): *"Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses."* [raw-verified]
Per § 1.2 (quoted above), Ziffer 20 (Widerrufsrecht) is explicitly disapplied when the purchase runs through an App Store/third-party platform contract — i.e., **Babbel's document defers withdrawal-right handling for IAP to the App Store's own terms**, structurally the same approach as Blinkist takes for IAP withdrawal.
Expiry wording appears elsewhere as "20. Widerrufsbelehrung │Zustimmung zur sofortigen Vertragsdurchführung" (heading only captured; the full waiver text for early service commencement is under this heading, following the same statutory pattern as Freeletics/Blinkist).

### f) Price changes (Preisänderungen)
No clause titled "Preisänderung" or equivalent unilateral price-increase mechanism was found anywhere in the document (searched explicitly) — **nicht geregelt**.

### g) Liability (Haftung) — structure
§ 19.1: *"Babbel haftet nicht für Schäden, die aus einer Verletzung nicht-wesentlicher Pflichten bei einfacher Fahrlässigkeit durch Babbel, Babbels gesetzliche Vertreter oder Erfüllungsgehilfen entstehen. Die Haftung von Babbel für einfache Fahrlässigkeit ist beschränkt auf (i) die Verletzung von wesentlichen Pflichten..."* [raw-verified]
§ 19.2: *"Im Falle der Verletzung einer solchen wesentlichen Pflicht haftet Babbel nur für den vorhersehbaren, vertragstypischen Schaden... Die persönliche Haftung Babbels gesetzlicher Vertreter, Erfüllungsgehilfen und Mitarbeiter für von ihnen durch leichte Fahrlässigkeit verursachte Schäden ist ausgeschlossen."* [raw-verified]
§ 19.6: *"Babbel übernimmt keine Garantie, Zusicherung oder Gewährleistung für einen bestimmten Sprachlernfortschritt oder Sprachlernerfolg, den Du durch die Nutzung der Dienste erzielst."* [raw-verified]
(Note: a separate, much harsher ALL-CAPS liability waiver — *"UNTER KEINEN UMSTÄNDEN HAFTET BABBEL..."* — appears in a country-specific section keyed to a non-German jurisdiction; that block replaces Ziffer 19 only for that country, not for Germany.)

### h) Changes to terms (Änderung der AGB) — consent vs. silence, notice period
§ 23.1: *"Jede Änderung dieser Bedingungen wird Dir in einer den Umständen angemessenen Weise, z. B. durch einen deutlichen Hinweis, die Bitte um Deine Zustimmung innerhalb der Dienste oder durch Zusendung einer E-Mail mindestens sechs (6) Wochen vor ihrem beabsichtigten Inkrafttreten angekündigt. Du kannst der Änderung vor dem Tag ihres beabsichtigten Inkrafttretens zustimmen oder widersprechen. Die Änderung gilt als von Dir angenommen, wenn Du der Änderung nicht vor dem Tag ihres beabsichtigten Inkrafttretens widersprichst."* [raw-verified]
§ 23.2: *"Babbel kann diese Bedingungen gelegentlich für künftige Bestellungen ändern und/oder aktualisieren, und zwar jederzeit und ohne Angabe von Gründen ohne Vorankündigung."* [raw-verified]
**Notable:** fiction-of-consent-by-silence again, with the longest notice period of the three (6 weeks) for changes affecting *existing* orders — but § 23.2 allows Babbel to change terms for *future* orders with **no notice at all**.

### i) Minimum age (Mindestalter)
§ 4.2: *"Wenn Du jünger als dreizehn (13) Jahre bist, darfst Du kein Nutzerkonto anlegen, keine Bestellung aufgeben oder die Dienste anderweitig nutzen, soweit dies nicht ausdrücklich in diesen Bedingungen oder der Bestellung festgelegt ist."* [raw-verified] — the lowest minimum age of the three (13, vs. Freeletics 18 and Blinkist 14/18).
§ 3.7 (for the AI voice feature specifically): *"Wenn Du unter 18 Jahre alt bist, benötigst Du die Erlaubnis Deiner Eltern oder Deines gesetzlichen Vertreters, um Babbel Speak nutzen zu können."* [raw-verified]

### j) Health/medical disclaimer, AI disclaimer
No health/medical disclaimer found (language-learning product) — **nicht geregelt**.
AI disclaimer, § 3.2: *"Da KI-Funktionen auf Algorithmen und Vorhersagen basieren, sind die Genauigkeit, Wahrhaftigkeit, Vollständigkeit, Rechtmäßigkeit und Praktikabilität aller von KI-Funktionen erzeugten Ergebnisse nicht Teil des Dienstes und vertraglich nicht geschuldet. Du solltest Dich nicht ausschließlich auf den Output der KI-Funktionen als Quelle der Wahrheit oder tatsächlicher Informationen oder als Ersatz für professionelle Beratung verlassen... Du darfst den Output nicht für Zwecke verwenden, die rechtliche oder materielle Auswirkungen haben könnten, wie z. B. Entscheidungen in Bezug auf Kredite, Bildung, Beschäftigung, Wohnen, Versicherungen, Recht, Medizin oder andere wichtige Entscheidungen."* [raw-verified]
§ 3.6 names the AI sub-processor: *"Babbel Speak wird von OpenAI, L.L.C. unterstützt... oder, falls Du Deinen Wohnsitz im EWR oder in der Schweiz hast, OpenAI Ireland Ltd..."* [raw-verified]

### k) Applicable law and venue (Rechtswahl, Gerichtsstand)
§ 24.1: *"Alle (vertraglichen oder außervertraglichen) Streitigkeiten oder Ansprüche, die durch oder in Verbindung mit der Bestellung oder deren Gegenstand oder deren Abschluss entstehen, unterliegen dem Recht der Bundesrepublik Deutschland unter Ausschluss der kollisionsrechtlichen Bestimmungen. Zwingende Gesetze des Staates, in dem Du Deinen gewöhnlichen Aufenthalt hast... bleiben hiervon unberührt."* [raw-verified]
§ 24.2: *"Das Übereinkommen der Vereinten Nationen über Verträge über den internationalen Warenkauf (CISG) findet keine Anwendung."* [raw-verified]
No explicit consumer venue (Gerichtsstand) clause was found in the general (non-country-specific) body of the document — **nicht geregelt beyond the choice-of-law statement**; a US-specific section elsewhere names New York courts, but that is scoped to US residents only.

### l) Dispute resolution (Verbraucherschlichtung/VSBG, OS platform)
§ 24.3: *"Babbel ist nicht dazu verpflichtet, an einem Streitbeilegungsverfahren vor der Schiedsstelle der Europäischen Kommission oder vor einer anderen Verbraucherschlichtungsstelle teilzunehmen und ist dazu auch nicht bereit."* [raw-verified]
No literal OS-platform URL given (similar to Blinkist) — **nicht geregelt** as literal text.

---

## Summary of notable findings

1. **App-Store contract routing differs materially.** Freeletics and Blinkist keep the underlying use/subscription contract with themselves even for in-app purchases (the store only handles billing/receipts); Babbel instead explicitly *disapplies* its own clauses on ordering, pricing, term/termination and withdrawal (§ 1.2) whenever the purchase runs through an App Store/third-party platform, deferring entirely to that platform's terms.
2. **Cancellation by email is not universal.** Freeletics accepts email/postal cancellation for website-bought subscriptions but requires in-store cancellation for in-app subscriptions. Blinkist does not offer an email cancellation path at all — only in-app/web-app account settings or its website's cancel button. Babbel's general terms accept "Textform" (a simple email suffices, § 1.7) for the direct relationship, but this is moot for IAP subscriptions per point 1.
3. **All three use fiction-of-consent-by-silence for AGB changes**, but with different notice periods: Freeletics 2 weeks, Blinkist 4 weeks, Babbel 6 weeks for existing orders — though Babbel can change terms for *future* orders with no notice at all (§ 23.2).
4. **Minimum ages differ widely**: Freeletics 18 (strict), Blinkist 18 generally but 14 with parental consent, Babbel 13 (lowest), with an extra 18-and-parental-consent gate specifically for its AI voice feature (Babbel Speak).
5. **Only Babbel has an AI-specific disclaimer** (§ 3, "KI-Funktion / Babbel Speak", naming OpenAI as sub-processor and disclaiming accuracy of AI output). Neither Freeletics nor Blinkist has any AI disclaimer text. Only Freeletics has an extensive health/medical disclaimer (fitness product); Blinkist and Babbel have none (not applicable to their products).
6. **None of the three literally quotes the EU ODR platform URL** in their current version, though all three explicitly refuse to participate in Verbraucherschlichtung (consumer arbitration board) proceedings. An older (2022) Freeletics version did include the `ec.europa.eu/consumers/odr` link — it was dropped from the current 07.07.2025 version.

## Access notes
All three apps' current German AGB were successfully accessed and quoted above. Plain `curl`/WebFetch failed for Freeletics (JS SPA served homepage/FAQ shell instead of the terms route) and for Blinkist (Cloudflare "Just a moment…" JS challenge, HTTP 403 on every attempt including via WebFetch). Both were retrieved by opening the real page in a headless/interactive browser tool and reading the rendered DOM text, which is the actual served page content (tagged [raw-verified] above), not an LLM summary of a fetch. Babbel required finding the correct locale host (`de.babbel.com`, not `www.babbel.com`, which silently serves the English terms at the same `/legal/terms` path) — once found, it was retrieved and grep-verified via plain `curl`.
