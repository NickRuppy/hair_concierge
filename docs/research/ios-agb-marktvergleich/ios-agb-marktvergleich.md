# iOS-App-AGB (`/agb/app`) — Marktvergleich und Änderungsvorschläge

- **Stand der Analyse:** 28.09.2026
- **Geprüfter Entwurf:** `src/app/agb/app/page.tsx` auf Branch `claude/admiring-hypatia-6gtp1h` (HEAD `040d1626`, der den Commit `dc4bdfa1` „Gesundheits- und KI-Hinweise nach Marktvergleich ergänzen" zurücknimmt)
- **Status:** Nur Analyse. Der Entwurf wurde **nicht** geändert. Alle Vorschläge brauchen Nicks Freigabe.
- **Rahmenbedingungen (von Nick):** Verkauf ausschließlich per In-App-Kauf im App Store; Apple wickelt Erstattungen ab; Kündigung per E-Mail muss möglich bleiben; wir zahlen selbst keine Erstattungen.

## Anleitung für das Review

Bitte prüfen:
1. Stimmt jede Aussage über die Marktbedingungen mit den Belegen in den Notizdateien überein (Abschnitt „Belege")?
2. Sind die rechtlichen Schlussfolgerungen tragfähig, vor allem Befunde 1, 2 und 4?
3. Sind die Formulierungsvorschläge in sich stimmig und mit den unveränderten Paragrafen des Entwurfs vereinbar (Querverweise wie § 3 Abs. 7, § 5 Abs. 4, § 6 Abs. 5)?
4. Die Nachprüfung der drei zunächst unbelegten Punkte steht unter „Verifikation gegen Primärquellen".

Das hier ist keine Rechtsberatung. Befunde 1, 2 und 4 sollte vor Veröffentlichung eine deutsche Anwältin oder ein deutscher Anwalt prüfen.

## Methode

- Für jede Quelle wurde die offizielle deutsche Seite auf der eigenen Domain des Anbieters geöffnet. Suchergebnisse wurden nur verwendet, um URLs zu finden, nie als Inhalt.
- WebFetch lieferte für Freeletics (JS-Shell), Blinkist (Cloudflare 403) und YAZIO (Zendesk 403) keinen Text. Diese Seiten wurden im Browser geöffnet und der gerenderte Seitentext gelesen.
- Jedes zitierte Klauselstück wurde gegen den Rohtext der Seite geprüft (curl + Tag-Stripping + Suche bzw. Browser-DOM-Text). In den Notizen ist jedes Zitat mit [raw-verified] oder [WebFetch only] markiert.
- Zusätzliche Stichprobe durch die Hauptsession am Rohtext: Apple (eingetragener Händler, sofortige Kündigung mit anteiliger Erstattung, „Transaktion widerrufen", Muster-Widerrufsformular an ADI, Preiserhöhung mit Zustimmung, Vermittlerrolle, „Stand: 14. September 2026") und 7Mind (Kündigung per E-Mail, Ziff. 3.8 und App-Teil 2.8) — alles bestätigt.

## Quellen

| Quelle | URL | Stand laut Seite | Vertragspartner |
|---|---|---|---|
| Apple Media Services | https://www.apple.com/de/legal/internet-services/itunes/de/terms.html | Stand: 14. September 2026 | Apple Distribution International Ltd., Cork (IE) |
| Freeletics | https://www.freeletics.com/de/pages/terms/?country=de | Version 07.07.2025 | Freeletics GmbH, München |
| Blinkist | https://www.blinkist.com/de/tos | Gültig ab dem 5. November 2025 | Blinks Labs GmbH, Berlin |
| Babbel | https://de.babbel.com/legal/terms | Juli 2026 | Babbel GmbH, Berlin |
| 7Mind | https://www.7mind.de/agb | Gültig ab 31. Juli 2026 | 7Mind GmbH, Berlin |
| YAZIO | https://help.yazio.com/hc/de/articles/203444951 | kein Datum auf der Seite | YAZIO GmbH, Erfurt |
| komoot | https://www.komoot.com/de-de/terms-of-service | kein Datum auf der Seite | komoot GmbH, Potsdam |
| Fastic | https://fastic.com/de/terms | Stand 2. Juni 2026 | Fastic GmbH, Berlin |
| Headspace (DE) | https://www.headspace.com/terms-and-conditions-de | Wirksam: 30. März 2026 | Headspace, Inc., San Francisco (US) |
| Flo (DE) | https://flo.health/de/nutzungsbedingungen | kein Datum auf der Seite | Flo Health UK Limited, London (UK) |

Zugangshinweise: Apples eigenständige deutsche Standard-EULA-Seite liefert 404. Die deutschen Apple-Bedingungen enthalten eine EU-angepasste Standard-EULA in Abschnitt P. Die deutsche Headspace-Fassung erklärt die englische Fassung für maßgeblich. Fastic § 1.1 beschränkt die Geltung auf Kunden mit Wohnsitz in der Schweiz; das passt nicht zum Rest des Dokuments und wurde nur festgehalten, nicht aufgelöst.

## Marktübersicht

| Quelle | Vertragspartner bei App-Store-Kauf | Kündigung App-Store-Abo | Änderung der AGB | Mindestalter | Verbraucherschlichtung |
|---|---|---|---|---|---|
| Apple | ADI ist „eingetragener Händler"; Kunde erwirbt von ADI | Einstellungen › Abonnements zum Periodenende; zusätzlich sofortige Kündigung mit anteiliger Erstattung über Apple Support | Wirksam mit Annahme; Ablehnung berührt bestehende Käufe/Abos nicht | Familienorganisator 18+ | Keine Teilnahme |
| Freeletics (§ 6.2, 9, 16.2, 19, 2.2, 18) | Richtet sich nach Store-Regeln; Store rechnet ab | Nur im Store (E-Mail/Post nur für Website-Abos) | Schweigen = Annahme, 2 Wochen | 18 | Keine Teilnahme |
| Blinkist (§ 4, 9, 11, 15, 3, 16) | Blinkist bleibt Partner; Store rechnet ab | Nur im Store; keine E-Mail-Kündigung | Schweigen = Annahme, 4 Wochen | 18 (ab 14 mit Einwilligung) | Keine Teilnahme |
| Babbel (§ 1.2, 1.7, 23, 4.2, 24.3) | Eigene Ziff. zu Bestellung, Preis, Laufzeit/Kündigung, Widerruf gelten bei Store-Kauf nicht | Store-Regeln (Textform/E-Mail nur im Direktverhältnis) | Schweigen = Annahme, 6 Wochen; für künftige Bestellungen ohne Vorankündigung | 13 (Babbel Speak unter 18 nur mit Erlaubnis) | Keine Teilnahme |
| 7Mind (Teil I 1.3, 3.8, 9.1/9.2; Teil II 1.7, 2.8) | Nicht geregelt; Store-Bedingungen gelten ergänzend | E-Mail oder Kündigungsfunktion, keine Store-Ausnahme | Wesentliche Änderungen nur mit ausdrücklicher Zustimmung; gesetzesbedingte Änderungen mit 2 Wochen Vorlauf | 18 | Keine Teilnahme |
| YAZIO (§ 4 Abs. 2b, 7 Abs. 6, 1 Abs. 8, 15) | Richtet sich nach Store-Regeln | Über die Abonnementverwaltung des Stores | Keine Klausel gefunden | 16 (jünger mit elterlicher Zustimmung) | Verweist auf OS-Plattform |
| komoot (Ziff. 18.2, 19.1) | Nicht geregelt | Profil oder schriftlich per E-Mail/Brief, keine Store-Ausnahme | Schweigen = Annahme, 6 Wochen | Nicht geregelt | Nicht geregelt |
| Fastic (§ 7.2.2, 7.6.2, 7.6.5, 16.6, 3.7, 15) | Richtet sich nach Store-Regeln | Nur im Store (E-Mail nur für Direkt-Abos) | Widerspruchsrecht, 14 Tage Vorlauf | 18 (Minderjährige mit Zustimmung) | Keine Teilnahme |
| Headspace DE (§ 2.3, 2.2, 14, 15) | Headspace Inc. | Über die Plattform; „keine Rückerstattung" | Keine klare Klausel gefunden | 18 (KI-Assistent Ebb 18+) | US-Schiedsverfahren (AAA), Verzicht auf Sammelklagen |
| Flo DE (§ 13.3, 13.8, 27, 4.1, 24) | „möglicherweise" separater Vertrag mit dem Store | Nur im Store (E-Mail nur für Web-Abos) | Verbindlich 30 Tage nach Veröffentlichung | 16 im EWR | EU-Wohnsitz: Heimatrecht/-gerichte; sonst Schiedsverfahren |

Weitere Themen im Markt:
- **Automatische Verlängerung und Testphase:** Apple rechnet frühestens 24 Stunden vor Beginn des nächsten Zeitraums ab; eine Testphase wird kostenpflichtig, wenn nicht mindestens 24 Stunden vor ihrem Ende gekündigt wird. Freeletics (§ 7.5) verlängert in Deutschland auf unbestimmte Zeit mit höchstens einem Monat Kündigungsfrist. Fastic verlangt 30 Tage Vorlauf (§ 7.6.3).
- **Erstattungen:** Blinkist leitet die anteilige Erstattung bei Store-Abos ausdrücklich an den Store weiter. Freeletics nennt Apple als Erstattenden bei Planwechseln. Headspace schließt Erstattungen aus. Apple: einziger Rechtsbehelf bei Fehlern ist erneute Bereitstellung oder Erstattung; bei Missbrauchsverdacht kann Apple Erstattungen verweigern.
- **Widerruf:** Apple — gegenüber ADI, über „Kaufhistorie" › „Transaktion widerrufen" oder Muster-Formular an rightofwithdrawal@apple.com; erlischt, wenn die Lieferung mit ausdrücklicher Zustimmung und Kenntnisnahme des Verlusts begonnen hat. Blinkist § 8: bei In-App-Kauf Widerruf im jeweiligen Store. Flo § 13.3: Widerruf ggf. beim Store. Fastic § 7.4: 14 Tage unabhängig vom Gratiszeitraum. Headspace: Widerruf nicht erwähnt.
- **Preisänderungen:** Apple — 30 Tage Ankündigung per E-Mail; wenn Zustimmung nötig und nicht erteilt, endet das Abo automatisch am letzten Tag vor der Änderung; sonst kostenlose Kündigung vorher möglich. YAZIO § 9 / Fastic § 9: wirksam ab nächster Laufzeit, 30 Tage Vorlauf. 7Mind: 6 Wochen Vorlauf plus Kündigungsrecht. Flo: Weiternutzung = Annahme. Freeletics, Blinkist, Babbel, komoot: keine eigene Klausel gefunden.
- **Haftung:** Deutsche Anbieter (Freeletics § 13, Blinkist § 13, Babbel § 19, Fastic § 14, YAZIO § 13, 7Mind, komoot Ziff. 15) nutzen die übliche Kardinalpflichten-Struktur. Headspace (10.000 USD) und Flo (100 USD) nutzen US-Haftungsobergrenzen und schließen Personenschäden aus — für deutsche Verbraucher kein Vorbild. YAZIO § 13 Abs. 2 schließt Haftung für ungeprüft übernommene, erkennbar falsche KI-Inhalte aus.
- **Gesundheit/KI:** Gesundheitshinweise bei Freeletics § 4, Fastic § 4.1, YAZIO § 5, Flo § 5.1, Headspace, 7Mind. KI-Hinweise nur bei YAZIO (§ 1 Abs. 9, § 5 Abs. 1, § 11: Kennzeichnung als KI-System, „Halluzinationen", Prüfpflicht) und Babbel (§ 3.2: Genauigkeit nicht geschuldet, keine Nutzung für Medizin u. a.; § 3.6: OpenAI genannt). Headspace: KI-Assistent 18+.
- **Recht und Gerichtsstand:** Deutsches Recht ohne UN-Kaufrecht mit Schutz zwingender Verbraucherregeln des Aufenthaltsstaats (YAZIO § 16, 7Mind, Fastic § 16.1, Freeletics § 20, Babbel § 24). Apple und Flo: Recht und Gerichte am gewöhnlichen Aufenthalt des Verbrauchers. Headspace: Kalifornien.

## Befunde zum Entwurf

### Schwächer oder widersprüchlich

1. **Vertragspartner (§ 1 Abs. 1, § 6 Abs. 2).** Apple nennt für deutsche Kunden ADI als eingetragenen Händler; der Kunde erwirbt die Inhalte von ADI. Der Entwurf lässt den Mitgliedschaftsvertrag mit uns im Apple-Kaufdialog zustande kommen. Das widerspricht Apples Konstruktion. Babbel, Fastic und YAZIO verweisen stattdessen auf die Store-Regeln. Dieser Punkt trägt die Folgeregeln zu E-Mail-Kündigung, Erstattung und Widerruf.
2. **Widerruf (§ 8).** Der Entwurf verweist auf reportaproblem.apple.com; Apples deutsche Bedingungen beschreiben „Kaufhistorie" › „Transaktion widerrufen" bzw. das Formular an ADI. „kannst du … gegenüber Apple erklären" legt nahe, der Widerruf ginge auch uns gegenüber. § 8 Abs. 3 („Wer die App nutzt oder testet, verzichtet damit nicht auf das Widerrufsrecht") kann irreführen, weil nach Apples Belehrung das Recht bei Lieferbeginn mit ausdrücklicher Zustimmung erlischt.
3. **Versionsdatum.** „September 2026" ist unpräzise; die datierten Vergleichsseiten nennen ein genaues Datum.

### Strenger zu unseren Lasten (verbraucherfreundlicher; Empfehlung: beibehalten)

4. **E-Mail-Kündigung bei App-Store-Abos (§ 7 Abs. 2).** Keine App mit Store-spezifischer Regel akzeptiert das (Freeletics, Blinkist, Fastic, Flo verweisen auf den Store); nur 7Mind und komoot akzeptieren E-Mail ohne Store-Ausnahme. Bleibt auf Nicks Wunsch. Restrisiko: Nach der E-Mail-Kündigung kann Apple trotzdem weiter abrechnen; das Geld geht an Apple. Der Entwurf fängt das schon ab; Vorschlag strafft nur die Formulierung.
5. **Preiserhöhungen (§ 6 Abs. 6).** Zustimmung für jede Erhöhung. Apple unterscheidet zustimmungspflichtige und nur kündbare Erhöhungen; YAZIO/Fastic: 30 Tage Vorlauf, wirksam ab nächster Laufzeit. Folge: In App Store Connect muss immer der zustimmungspflichtige Weg für Preiserhöhungen gewählt werden.
6. **Änderung der AGB (§ 12).** Ausdrückliche Zustimmung wie 7Mind; Freeletics, Blinkist, Babbel, komoot arbeiten mit Zustimmung durch Schweigen. Nach der deutschen Rechtsprechung zur Zustimmungsfiktion ist unsere Variante die sicherste.

### Im Markt

Erstattungen nur über Apple (§ 7 Abs. 3; vgl. Blinkist, Freeletics), Haftung (§ 10), Rechtswahl und Gerichtsstand (§ 13 Abs. 1–2), keine Teilnahme an Verbraucherschlichtung (§ 13 Abs. 3, marktübliche Formulierung), Gesundheitshinweis (§ 3 Abs. 2, präziser als die meisten), KI-Abschnitt (§ 4, etwa so vollständig wie YAZIO), Mindestalter 16 (wie YAZIO, Flo im EWR), Testphase und 24-Stunden-Frist (§ 6 Abs. 4–5, wie Apple).

**Bewusst nicht übernehmen:** YAZIOs Haftungsausschluss für ungeprüft übernommene KI-Inhalte; US-Haftungsobergrenzen (Headspace, Flo); den Link zur EU-OS-Plattform (eingestellt, siehe „Verifikation gegen Primärquellen").

## Formulierungsvorschläge (nicht angewendet)

**§ 1 Abs. 1, zweiter Halbsatz:**
> … und für die Leistungen von Mitgliedschaften, die du in der App über den App Store erwirbst.

**§ 6 Abs. 2 (neu):**
> (2) Den Kauf einer Mitgliedschaft schließt du im App Store nach den Bedingungen von Apple ab. Verkäufer ist dabei Apple (für Kundinnen und Kunden in Deutschland die Apple Distribution International Ltd., Irland). Mit uns besteht daneben der Nutzungsvertrag über die App und die Leistungen der Mitgliedschaft nach diesen Nutzungsbedingungen. Er beginnt, sobald du den Kauf im Kaufdialog von Apple bestätigt hast und wir die Mitgliedschaft in der App freischalten.

**§ 6 Abs. 6:**
> (6) Preiserhöhungen für eine laufende Mitgliedschaft kündigen wir mindestens 30 Tage vor ihrem Inkrafttreten an. Sie werden nur wirksam, wenn du ihnen zustimmst; Apple fragt dich dafür nach deiner Zustimmung. Stimmst du nicht zu, endet die Mitgliedschaft zum Ende des laufenden Zeitraums.

**§ 7 Abs. 2 (E-Mail-Kündigung bleibt):**
> (2) Du kannst deine Mitgliedschaft auch in Textform bei uns kündigen, zum Beispiel per E-Mail an info@chaarlie.de. Gib dabei bitte die E-Mail-Adresse deines Chaarlie-Kontos an. Wir bestätigen dir den Eingang und das Vertragsende unverzüglich in Textform. Die Abrechnung bei Apple können wir selbst nicht abschalten. Mit unserer Bestätigung schicken wir dir deshalb eine Anleitung, wie du die Verlängerung in deinen Apple-Einstellungen beendest. Berechnet Apple dir nach dem Vertragsende trotzdem einen weiteren Zeitraum, unterstützen wir dich bei der Erstattung durch Apple und bestätigen dir dein Kündigungsdatum schriftlich, damit du es Apple vorlegen kannst.

**§ 7 Abs. 3:**
> (3) Zahlungen für In-App-Käufe gehen an Apple. Erstattungen beantragst du deshalb bei Apple, zum Beispiel über reportaproblem.apple.com oder den Apple Support; Apple entscheidet darüber. Nach den Bedingungen von Apple kannst du ein Abonnement außerdem über den Apple Support mit sofortiger Wirkung kündigen und eine anteilige Erstattung erhalten. Wir selbst nehmen für In-App-Käufe keine Erstattungen vor. Deine gesetzlichen Rechte, insbesondere bei Mängeln, bleiben unberührt.

Hinweis: Von Apple gewährte Erstattungen werden von unseren App-Store-Auszahlungen abgezogen; das ändert die Formulierung nicht.

**§ 8:**
> (1) Als Verbraucherin oder Verbraucher hast du bei In-App-Käufen ein gesetzliches Widerrufsrecht von 14 Tagen. Da Apple Verkäufer ist, erklärst du den Widerruf gegenüber Apple, zum Beispiel in deinem Apple Account unter „Kaufhistorie" › „Transaktion widerrufen". Fristbeginn, Form und ein mögliches vorzeitiges Erlöschen richten sich nach der Widerrufsbelehrung, die Apple dir beim Kauf bereitstellt.
> (2) Brauchst du dabei Hilfe oder schickst du uns deinen Widerruf per E-Mail, zeigen wir dir unverzüglich, wie du ihn bei Apple einreichst.
> (3) Ein kostenloser Testzeitraum verkürzt dein Widerrufsrecht nicht.

**Versionsdatum:**
> Stand: [exaktes Veröffentlichungsdatum]

## Offene Entscheidungen

- **Altersgrenze KI-Berater:** Headspace erlaubt seinen KI-Assistenten erst ab 18, Babbel verlangt unter 18 elterliche Erlaubnis für Babbel Speak. Wir erlauben App inkl. KI-Berater ab 16. Unter 18 nur mit Zustimmung der Eltern? Vorher die Altersregeln in den Bedingungen unseres KI-Anbieters prüfen.
- **Anwaltliche Prüfung:** Befunde 1, 2 und 4.

## Verifikation gegen Primärquellen (28.09.2026)

Die drei zuvor unbelegten Punkte wurden direkt an den Primärquellen geprüft. Alle drei sind bestätigt.

1. **Entwickler können App-Store-Abos nicht für Kunden kündigen — bestätigt (indirekt).**
   - Die App Store Server API (https://developer.apple.com/documentation/appstoreserverapi, Endpunktliste per Doku-JSON abgerufen) enthält Endpunkte für Abfragen (Transaktionen, Abostatus, Erstattungshistorie), Verbrauchsinformationen und Verlängerung des Verlängerungsdatums, aber keinen Endpunkt zum Kündigen oder Abschalten der automatischen Verlängerung.
   - StoreKit `showManageSubscriptions(in:)` zeigt in der App nur Apples Verwaltungsblatt; kündigen kann dort die Kundin bzw. der Kunde selbst.
   - Apples Artikel „Handling Subscriptions Billing" (ältere Doku) beschreibt die Kündigung als Abschalten der automatischen Verlängerung durch den Nutzer; der Entwicklerserver erhält danach nur eine Benachrichtigung (DID_CHANGE_RENEWAL_STATUS). Laut demselben Artikel kann der Apple-Kundendienst ein Abo kündigen und ganz oder teilweise erstatten.
   - Grenze des Belegs: ein Negativbefund (kein Endpunkt dokumentiert), keine ausdrückliche Aussage von Apple. Die Formulierung in § 7 Abs. 2 („Die Abrechnung bei Apple können wir selbst nicht abschalten") ist damit gedeckt.

2. **EU-OS-Plattform eingestellt — bestätigt.**
   - Verordnung (EU) 2024/3228, deutscher Text auf EUR-Lex (https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=OJ:L_202403228), im Browser gelesen: Art. 1 hebt die Verordnung (EU) Nr. 524/2013 mit Wirkung vom 20. Juli 2025 auf; Art. 2 Abs. 1 stellt die OS-Plattform ein; Art. 2 Abs. 2 beendet die Einreichung von Beschwerden am 20. März 2025. Erwägungsgrund 3 nennt die bisherige Pflicht zum Link auf die OS-Plattform, die mit der Aufhebung entfällt.
   - Folge: Wir brauchen keinen OS-Link; YAZIOs Verweis (§ 15) ist veraltet. Die Angabe zur (Nicht-)Teilnahme an Verbraucherschlichtung in § 13 Abs. 3 bleibt davon unberührt.

3. **ADI ist für deutsche App-Store-Kunden eingetragener Händler — bestätigt.**
   - Apple Media Services DE (Stand: 14. September 2026), Abschnitt U „Definition von Apple": ausdrücklich eigene Gesellschaften für USA, Kanada, Lateinamerika/Karibik, einzelne asiatische Länder (Apple Services Pte. Ltd.), Japan und Australien/Neuseeland; Apple Distribution International Ltd., Cork, gilt „für alle anderen Nutzer:innen". Deutschland ist nicht gesondert genannt, fällt also unter ADI.
   - Abschnitt B und Abschnitt P: Für Kunden von ADI ist ADI der eingetragene Händler für App-Store-Inhalte; die Kundin bzw. der Kunde erwirbt die Inhalte von ADI.
   - Maßgeblich ist laut Abschnitt A das „Heimatland" des Apple-Accounts, nicht der Wohnsitz allein. Deutsche Kunden mit einem Account aus einem der gesondert genannten Länder fielen unter eine andere Apple-Gesellschaft; für den Entwurf ändert das nichts, weil § 6 Abs. 2 ADI nur als deutschen Regelfall nennt.

## Belege

Ausführliche Notizen mit Paragrafennummern und Wortlaut, jedes Zitat als [raw-verified] oder [WebFetch only] markiert:

- `apple.md` — Apple Media Services (DE), inkl. eingebetteter Standard-EULA (Abschnitt P). Hinweis: Diese Datei paraphrasiert überwiegend und zitiert nur kurze Fragmente; der Rohtext liegt in `apple-raw.txt`.
- `group-a.md` — Freeletics, Blinkist, Babbel
- `group-b.md` — 7Mind, komoot (YAZIO dort als nicht erreichbar vermerkt; siehe nächste Zeile)
- `yazio-raw.txt` — vollständiger Seitentext der YAZIO-AGB, per Browser gelesen
- `group-c.md` — Fastic, Headspace, Flo

Alle Dateien liegen im selben Ordner wie dieses Dokument.
