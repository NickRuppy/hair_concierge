# Aktualisierte Footer-Dokumente — Redaktionsstatus

**Deferred by Nick for a later co-founder discussion. No immediate answer needed; independent scanner work can proceed. [Questions and affected scope](../cofounder-questions.md). Proposed policies remain unapproved.**

Arbeitsfassungen vom 11.09.2026. Nick hat die Erstellung aktualisierter Dokumente ausdrücklich autorisiert; kritische Entscheidungen werden gemeinsam geklärt. Diese Fassungen ersetzen die vorherigen ausgewählten Textvorschläge als aktuelle Redaktionsgrundlage. Keine Veröffentlichung, keine Änderung von Anmeldungen, Verträgen oder Provider-Konfiguration.

- [Datenschutzerklärung](datenschutz.md): vollständige Arbeitsfassung mit App, Scanner, Merkliste, Benachrichtigungen und gemeinsamer Kontolöschung.
- [AGB](agb.md): vollständige Arbeitsfassung mit kostenlosem Scanner; bestehende kostenpflichtige Angebote und Kaufrechte bleiben enthalten.
- Impressum, Widerrufsbelehrung und Kontakt bleiben für diesen iOS-Zuschnitt in ihrer bestehenden Fassung. Keine bestätigte neue Identität oder scannerbedingte Änderung der Widerrufsrechte. Sie werden nicht als umfassend rechtlich geprüft bezeichnet.
- [Darstellung im Seitenlayout](../evidence/footer-pages-review.html).

## Kritische offene Punkte

| ID | Punkt | Nächster Schritt / Zuständigkeit |
|---|---|---|
| R1 | EU-Vertretung | Nick bestätigt: weder EU-Niederlassung noch Vertretung eingerichtet. Tatsächliche Niederlassungskriterien und Art.-27-Anwendbarkeit prüfen; erforderlichenfalls schriftlich bestellen. Auswahl/Bestellung nicht durch Textbearbeitung autorisiert. |
| R2 | Gesetzliche Aufbewahrung | Anwendbare Steuer-/Nachweispflichten der LLC und konkrete Kategorien/Fristbeginne klären. Keine Abstimmung über eine willkürliche Acht-/Zehn-Jahres-Frist. E2 bleibt offen. |
| R3 | Marketing-DOI | Optionale separate Einwilligung ist belegt. Bestätigung, Nachweis und Zustellfreigabe bis Customer.io technisch verifizieren. Bestehende Zusage wird nicht abgeschwächt. |
| R4 | Tatsächliche Datenflüsse und Fristen | Providerrollen/Regionen, Kamera/APNs, Diagnose, Einwilligungsnachweise, Forschung, Geräte und Backups verifizieren. Bestehende Anbieterbeschreibungen sind keine neue Tatsachenbestätigung. |
| R5 | Rechtsgrundlagen | Haar-Check vor Registrierung, optionale Analyse und mögliche Gesundheitsangaben getrennt beurteilen. Vorschlag Art. 6(1)(b) für angefragte notwendige Leistung ist noch kein Beschluss einer neuen Quiz-/Einwilligungslogik. |
| R6 | Kostenlose Vertragsbeziehung | Exakte AGB-Einbeziehung und Vertragsschluss im Onboarding festlegen. Die geplante Freischaltung ist beschrieben; keine zusätzliche Zustimmungsstufe stillschweigend eingeführt. |

Bestätigt bleiben: kostenloser Scanner; Marketing freiwillig; gemeinsames Konto/Profil/Merkliste; keine Routineänderung durch Speichern; Löschung mit Ende künftiger Verlängerungen; minimaler offener Supportfall ohne Verzögerung der privaten App-Datenlöschung; keine automatische Erstattung.

## Änderungen und bewusst erhaltene Teile

Datenschutz: §§1–4, 8–9 und 11 überarbeitet, §5 um APNs ergänzt und pauschale Rollenbehauptung differenziert, §7 um App-Abgrenzung ergänzt. Rechte, Transfers und Änderungsinformation erhalten; Anbieter- und Sicherheitsbehauptungen vor Veröffentlichung belegen.

AGB: §§1–3, 5 und 9 um den kostenlosen Dienst ergänzt. §§4, 6–8 und 10–12 inhaltlich aus dem vorhandenen Text übernommen. Das ist keine rechtliche Bestätigung ihrer Wirksamkeit. Insbesondere vorhandene Haftungsbegrenzung und Zustimmungsfiktion bei AGB-Änderungen wurden nicht nebenbei neu verhandelt; bei abschließender juristischer Prüfung mit erfassen.

Keine Scheingenauigkeit: prüfungsbedürftige Tatsachen stehen sichtbar in eckigen Redaktionshinweisen. Alle Hinweise müssen vor Veröffentlichung durch geprüfte Angaben ersetzt oder durch eine geklärte rechtliche Beurteilung erledigt werden. App-Versprechen erst veröffentlichen, wenn die Umsetzung nachgewiesen ist.

## Quellen

- Ausgangstexte: `src/app/datenschutz/page.tsx`, `src/app/agb/page.tsx`, zuvor live abgeglichen; [Audit](../footer-pages-audit.md).
- [EDPB, Territorial Scope, finale Leitlinien](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_3_2018_territorial_scope_after_public_consultation_en.pdf): Niederlassung und EU-Vertretung; regelmäßige Kerntätigkeit ist nicht ohne Weiteres gelegentliche Verarbeitung. Keine Schlussfolgerung allein aus dem US-Registersitz.
- [§14b UStG](https://www.gesetze-im-internet.de/ustg_1980/__14b.html): Rechnungsfrist im deutschen Anwendungsbereich; keine automatische Anwendung auf jede LLC-Unterlage.

Offene Punkte sind Fakten-/Rechtsprüfungen oder ausdrücklich benannte Nutzerentscheidungen, keine pauschale Bitte um Freigabe. Der Autor bleibt für die konkrete Umsetzung und Prüfung verantwortlich.


## Research clarification — 2026-09-11

R1: Nick's answer establishes that no EU entity/representative was formally set up. It does not settle GDPR establishment: actual stable EU operations matter. Founder working locations are pending. [EDPB guidance](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_3_2018_territorial_scope_after_public_consultation_en_1.pdf).

R2: OSS records require ten years from the end of the transaction year if that scheme applies. This may explain a ten-year category, but Haarmony's OSS use and tax position are unverified. Do not replace the existing blanket statement with eight years, or retain all app data as tax evidence. [European Commission](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop/record-keeping-and-audits-oss_en).

Recommendation, not a new legal determination: obtain a bounded cross-border tax setup review covering actual owners/elections, management locations, filings, VAT and a record-specific retention schedule. A privacy representative appointment is a separate role and decision. No service booked, mandate executed or provider contacted.


## Concrete product-policy proposal

[App retention schedule](retention-proposal.md) contains proposed operational periods for confirmation. Nick confirms the LLC has two members and partnership taxation. Representative procurement and the new retention periods remain unapproved; no paid service or production change occurred.
