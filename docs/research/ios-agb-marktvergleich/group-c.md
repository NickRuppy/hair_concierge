# Legal market comparison — Group C (Fastic, Headspace, Flo Health)

Method note: All three pages were fetched with `curl -sL -A "Mozilla/5.0" <url>`, stripped of HTML tags with a small Python script, and quotes below were located and copied directly from that raw text (not from the WebFetch/summarizer output). All quotes are therefore tagged **[raw-verified]** unless stated otherwise. WebFetch was used only as a first pass to locate topics; every kept quote was re-located in the raw curl text before being included here.

---

## 1. Fastic

- **URL:** https://fastic.com/de/terms
- **Stand / last-updated date (verbatim):** "Stand 2. Juni 2026" (shown at the very bottom of the page)
- **Contracting entity:** "Fastic GmbH, Pappelallee 78/79, 10437 Berlin, Deutschland" (§1.1)
- **Note on scope (unusual, flagged):** §1.1 states verbatim: *"Diese AGB gelten ausschließlich für Verträge mit Kunden, deren gewöhnlicher Aufenthalt oder Wohnsitz sich in der Schweiz befindet."* — i.e. the `/de/terms` page as currently published declares itself applicable only to customers resident in Switzerland, even though the entity is a Berlin GmbH and §16.1 elsewhere chooses German law with an EU/Switzerland consumer-protection carve-out. This looks like a possible drafting/localization inconsistency on Fastic's own page — worth noting as-is rather than corrected. [raw-verified]

### a) In-App-Kauf / App Store / contract partner for IAP
§7.2.2: *"Beim Erwerb eines PLUS-Abonnements über eine Vertriebsplattform richtet sich der Ablauf nach den Bedingungen des jeweiligen Plattform-Betreibers. Der Kaufvertrag erfolgt gemäß den Bestimmungen der jeweiligen Vertriebsplattform, die auch regeln, ob der Vertrag zwischen dem Nutzer und der Vertriebsplattform oder zwischen dem Nutzer und dem Anbieter zustande kommt."* [raw-verified]

### b) Auto-renewal / annual plans / trial conversion
§7.6.3: *"Sofern das Abonnement nicht spätestens 30 Tage vor Ablauf der jeweiligen Vertragsperiode gekündigt wird, verlängert es sich automatisch um die ursprünglich vereinbarte Vertragslaufzeit zu den zum Zeitpunkt der Verlängerung geltenden Konditionen."* [raw-verified]
§7.3 (trial): *"Wandelt sich das Probe-Abonnement nach Ablauf der Testphase in ein kostenpflichtiges Abonnement um, erfolgt dies nur nach vorheriger Information und ausdrücklicher Zustimmung des Nutzers."* [raw-verified]

### c) Kündigung (incl. email / App Store cancellation)
§7.6.5: *"Die Kündigung kann über die App oder per E-Mail an info@fastic.com erfolgen. Eine Kündigungsmöglichkeit besteht auch auf der Webseite. ... Wurde das Abonnement über eine Vertriebsplattform abgeschlossen, erfolgt die Kündigung gemäß den in den jeweiligen App-Stores beschriebenen Prozessen."* — i.e. email cancellation IS accepted for direct Fastic subscriptions, but App Store subscriptions must be cancelled through the store, not by email. [raw-verified]
§7.6.2 (third-party/App Store subs): *"Möchte der Kunde seine In-App gekaufte PLUS-Mitgliedschaft beenden, ist es erforderlich, dies über sein Konto beim Drittanbieter vorzunehmen, sich dort einzuloggen und den Anweisungen des Drittanbieters zur Beendigung zu befolgen."* [raw-verified]

### d) Erstattung / refunds (incl. App Store)
§12.2: *"Macht der Nutzer von seinem Kündigungsrecht Gebrauch, hat er unter Umständen einen Anspruch auf eine anteilige Rückerstattung für den ungenutzten Teil seines gekündigten Abonnements. Der Anbieter ist ausschließlich für Rückerstattungen, die gemäß diesen Bedingungen gewährt werden, verantwortlich."* [raw-verified]
§7.6.3: *"Etwaige Erstattungen richten sich nach den anwendbaren gesetzlichen Vorschriften sowie den im jeweiligen Vertragsverhältnis maßgeblichen Bedingungen."* No separate clause specifically addressing App-Store-purchase refunds beyond the general third-party/platform-conditions references above — "nicht gesondert geregelt" for App-Store-specific refunds.

### e) Widerrufsrecht (withdrawal right)
§7.4: *"Die gesetzliche Widerrufsfrist bleibt hiervon unberührt und beträgt 14 Tage ab Vertragsschluss, unabhängig von der Dauer eines etwaigen Gratiszeitraums."* [raw-verified]
No explicit clause on who exercises/handles withdrawal for IAP purchases specifically, nor an expiry/waiver wording distinct from the general 14-day right — "nicht geregelt" beyond the general statement above.

### f) Preisänderungen
§9: *"Der Anbieter behält sich das Recht vor, das Nutzungsentgelt für Abonnement-Optionen zu ändern. Preisanpassungen werden jedoch erst nach Ablauf der aktuellen Abonnement-Laufzeit wirksam ... Bei bevorstehenden Preiserhöhungen wird der Anbieter den Nutzer mindestens 30 Tage vor der geplanten Änderung des Nutzungsentgelts informieren."* [raw-verified]

### g) Haftung
§14.1: *"Ansprüche des Nutzers auf Schadensersatz sind ausgeschlossen. Ausgenommen hiervon sind Schadensersatzansprüche des Nutzers wegen Verletzung des Lebens, des Körpers, der Gesundheit oder aufgrund der Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) sowie Ansprüche für sonstige Schäden, die auf einer vorsätzlichen oder grob fahrlässigen Pflichtverletzung ... beruhen."* [raw-verified]
§14.2: *"Bei der Verletzung wesentlicher Vertragspflichten haftet der Anbieter nur für den vertragstypischen, vorhersehbaren Schaden, sofern dieser durch einfache Fahrlässigkeit verursacht wurde."* — standard German-law-style tiered liability structure (full exclusion except for life/body/health and cardinal-duty breaches; capped to foreseeable damage for simple negligence on cardinal duties). [raw-verified]

### h) Changes to the terms
§16.6: *"Der Anbieter ist berechtigt, diese AGB jederzeit mit Wirkung für die Zukunft zu ändern, wenn sachliche Gründe ... dies erfordern und der Nutzer dadurch nicht unangemessen benachteiligt wird. Änderungen der AGB werden dem Nutzer rechtzeitig, mindestens 14 Tage vor Inkrafttreten, an geeigneter Stelle oder per E-Mail mitgeteilt. Jeder Nutzer hat das Recht, den neuen AGB zu widersprechen."* — explicit objection right, not silent "deemed consent by continued use." [raw-verified]

### i) Mindestalter
§3.7: *"Die Nutzung der App ist nur Personen ab 18 Jahren gestattet. Minderjährige dürfen die App nur mit Zustimmung eines Elternteils oder Erziehungsberechtigten nutzen."* [raw-verified]

### j) Health / medical disclaimer, AI disclaimer
§4.1: *"Fastic ist keine medizinische Organisation, und die über die Fastic-Dienste bereitgestellten Inhalte und Empfehlungen stellen keine medizinische Beratung dar. Die Nutzung der Fastic-Dienste erfolgt auf eigene Verantwortung."* [raw-verified]
No AI-specific disclaimer clause found — "nicht geregelt."

### k) Anwendbares Recht / Gerichtsstand
§16.1: *"Für sämtliche Rechtsgeschäfte oder andere rechtliche Beziehungen mit uns gilt das Recht der Bundesrepublik Deutschland. Das UN-Kaufrecht (CISG) ... findet keine Anwendung. Diese Rechtswahl schließt ein, dass dem Kunden mit gewöhnlichem Aufenthalt in einem der Staaten der EU oder der Schweiz der gewährte Schutz, der sich durch zwingende Bestimmungen des Rechts dieses Staates ergibt, nicht entzogen wird."* [raw-verified]
§16.2: *"Soweit gesetzlich zulässig, ist Berlin, Deutschland, ausschließlicher Gerichtsstand für sämtliche Streitigkeiten..."* [raw-verified]

### l) Dispute resolution (arbitration / class action / Verbraucherschlichtung / OS)
§15: *"Wir sind nicht bereit und nicht verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."* [raw-verified]
No arbitration clause, no class-action waiver, no mention of the OS (Online-Streitbeilegung/EU ODR) platform anywhere on the page — "nicht geregelt" for arbitration/class-action/OS-platform.

---

## 2. Headspace (German version)

- **URL:** https://www.headspace.com/terms-and-conditions-de
- **Stand / last-updated date (verbatim):** "Wirksam: 30. März 2026"
- **Language note (on the page itself):** *"These Terms & Conditions has been prepared in English and translated into the following languages. The English version is the official version, and the other versions are provided for reference. In the event of any inconsistency or conflict between the two versions, the English version shall prevail."* — so the German text is explicitly a non-binding translation. [raw-verified]
- **Contracting entity:** "Headspace, Inc. und seine Tochtergesellschaften und verbundenen Unternehmen ('Headspace', 'wir' oder 'uns')" — postal address given later as "Headspace, z. Hd.: Legal, 595 Market Street, Floor 7, San Francisco, CA 94105" (US entity, not a German/EU entity). [raw-verified]

### a) In-App-Kauf / App Store / contract partner for IAP
§2.3(d): *"Der Kauf eines Abonnements über den Apple iTunes Store oder unsere iPhone-Anwendung ist unwiderruflich und wir gewähren keine Rückerstattung. Ihr Kauf fällt unter die geltenden Zahlungsrichtlinien von Apple, die unter Umständen ebenfalls keine Rückerstattung vorsehen. Wenn Sie ein Abonnement über den Google Play Store abschließen, ist der Verkauf unwiderruflich und wir gewähren keine Rückerstattung."* [raw-verified]

### b) Auto-renewal / annual plans / trial conversion
§2.3(a): *"Kostenlose Testversionen werden nach einer bestimmten Zeit automatisch in ein kostenpflichtiges Jahres- oder Monatsabonnement umgewandelt. Diese automatische Umwandlung können Sie deaktivieren, indem Sie vor dem Datum der Umwandlung die nachfolgend aufgeführten Anweisungen zur Kündigung befolgen."* [raw-verified]
§3.2(a): *"Sie können Ihr Abonnement jederzeit kündigen. Allerdings müssen Sie Ihr Abonnement kündigen, bevor es sich verlängert, um zu vermeiden, dass Ihr Konto mit der nächsten regelmäßigen Abonnementgebühr belastet wird."* [raw-verified]

### c) Kündigung (email / Textform / App Store)
Kündigung durch Sie is covered under §3.2. Cancellation instructions reference the help portal and account settings; for Apple/Google purchases cancellation must go through the platform account (consistent with §2.3(d)'s "unwiderruflich" language). The page does list "help@headspace.com" as a general contact address for support (found in the informal-dispute-resolution section, §14.3), but no clause explicitly states that emailing that address cancels an App-Store-billed subscription — for platform purchases the terms point to Apple/Google account settings instead. [raw-verified]

### d) Erstattung / refunds (esp. App Store)
§2.3(c): *"Keine Rückerstattung für Abonnements. Sie haben keinen Anspruch auf eine Rückerstattung für ein Abonnement, es sei denn, dies ist nach geltendem Recht erforderlich."* [raw-verified]
(See also §2.3(d) quoted above for the App-Store-specific "unwiderruflich... keine Rückerstattung" language.)

### e) Widerrufsrecht
**Nicht erwähnt.** No occurrence of "Widerruf" anywhere in the German text. No clause frames a 14-day EU-style withdrawal right, no waiver/expiry wording — the topic is simply absent, superseded instead by the blanket "no refunds unless legally required" language above.

### f) Preisänderungen
Found in the subscription section (just before §3, KÜNDIGUNG): *"Vorbehaltlich ausdrücklicher anderslautender Bestimmungen in diesen Bedingungen werden Preisänderungen oder Änderungen an Ihrem Abonnementplan nach einem Hinweis an Sie wirksam."* [raw-verified] — no specific notice-period number (e.g. "30 Tage") given, unlike Fastic/Flo.

### g) Haftung
§15.3 HAFTUNGSBESCHRÄNKUNG: *"IM GRÖSSTMÖGLICHEN GESETZLICH ZULÄSSIGEN UMFANG HAFTEN DIE HEADSPACE-EINHEITEN IHNEN GEGENÜBER IN KEINEM FALL FÜR INDIREKTE, ZUFÄLLIGE, BESONDERE, FOLGE- ODER STRAFSCHÄDEN ... IST DIE GESAMTE HAFTUNG DER HEADSPACE-UNTERNEHMEN IHNEN GEGENÜBER ... AUF DEN HÖCHSTEN DER FOLGENDEN BETRÄGE BESCHRÄNKT: (A) DEN BETRAG, DEN SIE IN DEN LETZTEN 12 MONATEN ... GEZAHLT HABEN, ODER (B) 10.000 USD."* [raw-verified] — a hard USD cap, not a German-law "Kardinalpflichten" structure like Fastic's or Flo's.
Separately, on health-related liability: *"Die Headspace-Unternehmen haften in keinem Fall für Todesfälle oder Körperverletzungen, die Sie erleiden ... in Verbindung mit der Nutzung der Produkte oder Dienstleistungen."* [raw-verified] (this is a broader exclusion than German law would typically permit for a German consumer contract — flagged as notable).

### h) Changes to the terms
No clause explicitly titled "Änderungen der Bedingungen" was found with a notice-period/consent mechanism comparable to Fastic's or Flo's (no hits for "Änderungen dieser Bedingungen", "diese Bedingungen zu ändern", or "AKTUALISIER" as a heading). The one located mechanism is the general "Vorbehaltlich ausdrücklicher anderslautender Bestimmungen ... werden Preisänderungen oder Änderungen an Ihrem Abonnementplan nach einem Hinweis an Sie wirksam" quoted in (f) — narrower in scope than a general terms-amendment clause. Treat broader terms-amendment mechanics as "nicht klar geregelt" in the parts fetched.

### i) Mindestalter
§2.2 KINDER (a): *"Unsere Produkte und Dienstleistungen sind für Personen bestimmt, die mindestens 18 Jahre alt sind. Es gibt begrenzte Ausnahmen: Wenn Sie sich in den USA oder im Vereinigten Königreich befinden und zwischen 13 und 17 Jahre alt sind oder wenn Sie sich in der EU befinden und..."* (sentence continues into further EU-specific age exception text not fully captured). [raw-verified]
(b): *"Unser KI-Assistent Ebb ist nur für Personen ab 18 Jahren bestimmt."* [raw-verified]
(c): *"Mitglieder unter 13 Jahren werden von Headspace nicht unterstützt."* [raw-verified]

### j) Health / medical disclaimer, AI disclaimer
*"Die Inhalte von Headspace zu Meditation, Achtsamkeit, Schlaf und Bewegung sowie das Coaching für psychische Gesundheit sollten nicht als medizinische Versorgung, medizinisches Gerät oder medizinische Beratung angesehen werden. Nur Ihr Arzt oder ein anderer Gesundheitsdienstleister kann medizinischen Rat ert[eilen]..."* [raw-verified]
Crisis-line disclaimer: *"WENN SIE DEN GEDANKEN HABEN, SICH SELBST ZU VERLETZEN ODER ZU TÖTEN, RUFEN SIE BITTE DIE 988, DIE HILFE FÜR SUIZID UND KRISEN, AN ... UND WENN SIE EINEN GESUNDHEITLICHEN ODER PSYCHISCHEN NOTFALL HABEN, KONTAKTIEREN SIE BITTE DIE 911..."* [raw-verified] — note this references US emergency numbers (988/911), not German ones, despite being the "German" version of the terms.
AI disclaimer: §2.2(b) above (Ebb, 18+); the "Ebb ist KI, kein Mensch" framing is implied by context ("Unser KI-Assistent Ebb") though the exact standalone disclaimer sentence beyond age-gating was not separately located.

### k) Anwendbares Recht / Gerichtsstand
§15.10 RECHTSWAHL: *"Die Gesetze von Kalifornien, ausgenommen die Grundsätze des Kollisionsrechts, regeln diese Bedingungen und alle Streitigkeiten... Das Übereinkommen der Vereinten Nationen über Verträge über den internationalen Warenkauf ist nicht anwendbar."* [raw-verified]
§15.9 (referenced from §14.2): disputes not subject to arbitration go to *"ausschließlich vor dem US-Bezirksgericht für den Zentralbezirk Kalifornien (United States District Court for the Central District of California)"* or, absent jurisdiction, other California state/federal courts. [raw-verified]

### l) Dispute resolution (arbitration / class action / Verbraucherschlichtung / OS)
§14 STREITBEILEGUNG UND VERBINDLICHES SCHIEDSGERICHTSVERFAHREN — binding arbitration, with jury/court-trial waiver: *"Sie und Headspace entscheiden sich stattdessen dafür, Ansprüche und Streitigkeiten durch ein Schiedsverfahren zu lösen."* [raw-verified]
Class-action waiver: *"...ED IN EINER ANGEBLICHEN GRUPPEN- ODER KONSOLIDIERTEN KLAGE. Falls dieser Verzicht auf Gruppen- oder Sammelklagen jedoch als ungültig oder nicht durchsetzbar erachtet wird, haben weder Sie noch Headspace einen Anspruch auf ein Schiedsverfahren..."* [raw-verified]
§14.5 SCHIEDSORDNUNG: *"Das Bundesschiedsgerichtsgesetz regelt die Auslegung und Durchsetzung dieser Streitbeilegungsklausel. Das Schiedsverfahren wird durch die American Arbitration Association ('AAA') eingeleitet."* [raw-verified]
Informal resolution first: *"Bevor Sie eine Klage gegen Headspace einreichen, stimmen Sie zu, zu versuchen, den Streit informell beizulegen"* via help@headspace.com or the San Francisco postal address; if unresolved within 30 days, formal proceedings may start. [raw-verified]
**Verbraucherschlichtung (German consumer-arbitration-board) and OS-Plattform (EU ODR):** **Nicht erwähnt** — no hits for either term anywhere on the page. This is notable for a page nominally addressed to German users, since German TMG/§36 VSBG-type notices are typically expected.

---

## 3. Flo Health (German version)

- **URL:** https://flo.health/de/nutzungsbedingungen
- **Stand / last-updated date:** **Not shown on the page.** No "Stand", "Zuletzt aktualisiert", "gültig ab", or version-date string was found anywhere in the fetched text (checked explicitly — none of "Datum" as a heading, "gültig ab", "wirksam" [as a heading], "aktualisiert" [as a heading], or "Zuletzt" produced a dated match). The footer only shows "© 2026 Flo Health Inc., Flo Health UK Limited" with no revision date.
- **Contracting entity:** §1.1: *"Diese Vereinbarung ist ein rechtsverbindlicher Vertrag zwischen Ihnen und Flo Health UK Limited mit Sitz in Fourth Floor, International House, 1 St Katharine's Way, London, England, E1W 1UN."* (UK entity; footer also names "Flo Health Inc." as a co-listed company without further detail on its role.) [raw-verified]

### a) In-App-Kauf / App Store / contract partner for IAP
§13.3: *"Die Flo-App ist über die externen Plattformbetreiber Apple App Store und Google Play Store erhältlich. Bei einem Kauf schließen Sie daher möglicherweise einen separaten Vertrag mit dem entsprechenden Drittanbieter ab, der Ihren App-Store betreibt und dessen Nutzungsbedingungen dann gelten. Je nach den Nutzungsbedingungen des entsprechenden Drittanbieters müssen Sie möglicherweise Ihre Widerrufs- und Rücktrittsrechte bei diesen Anbietern geltend machen."* [raw-verified]

### b) Auto-renewal / annual plans / trial conversion
§13.7 Verlängerung: *"Ihre Zahlung an Flo bzw. an den Drittanbieter, über den Sie das Abonnement erworben haben, wird automatisch am Ende des jeweiligen Abonnementzeitraums wiederholt, es sei denn, Sie kündigen Ihr Abonnement vor Ablauf des laufenden Abonnementzeitraums."* [raw-verified]
§13.5 Testzeitraum: *"Nach dem Testzeitraum beginnt automatisch ein zahlungspflichtiges Abonnement. Damit Ihnen keine Kosten anfallen, müssen Sie Ihr Abonnement vor Ablauf des Testzeitraums kündigen."* [raw-verified]
§13.9 Sonderangebote: *"Nach dem Aktionszeitraum läuft das Abonnement automatisch zum zu diesem Zeitpunkt geltenden Normalpreis (der Änderungen unterliegt) zuzüglich der entsprechenden Steuern weiter, bis es gekündigt wird."* [raw-verified]

### c) Kündigung (email / Textform / App Store)
§13.8 Kündigung: *"Wenn Sie Ihr Abonnement über app.flo.health erworben haben, können Sie die Verlängerung Ihres Abonnements jederzeit kündigen, indem Sie eine E-Mail an help@flo.health schreiben und darin die E-Mail-Adresse angeben, die Sie für die Registrierung Ihres Kontos bei app.flo.health verwendet haben."* — a ready-made cancellation email template is even provided in the clause. [raw-verified]
Same clause, for App-Store subscriptions: *"Wenn Sie Ihr Abonnement über einen Drittanbieter abgeschlossen haben, wenden Sie sich für Informationen zu Abrechnung, Kündigung und Rückerstattungen an diesen."* — i.e. email cancellation to Flo is accepted only for direct web-purchased subscriptions; App Store subscriptions must be cancelled via Apple/Google, not by emailing Flo. [raw-verified]

### d) Erstattung / refunds (esp. App Store)
No dedicated "Rückerstattungen" clause with Flo's own refund terms was found beyond the App-Store redirect quoted in (c) ("wenden Sie sich ... an diesen" for billing/cancellation/refunds on third-party-purchased subscriptions). For direct purchases, no explicit refund policy text was located either — **nicht ausdrücklich geregelt** in the fetched clauses beyond that redirect and the general liability-cap language in §17.

### e) Widerrufsrecht
No section titled "Widerrufsrecht" was found. The only occurrence of "Widerruf" is in §13.3, redirecting users to the third-party platform's own terms for "Widerrufs- und Rücktrittsrechte" on IAP purchases (quoted in (a) above). §13.6 also contains an unrelated seller-side "widerrufen" (Flo may cancel an order priced in error) — not a consumer withdrawal-right clause. No standalone 14-day EU withdrawal-right clause, waiver, or expiry wording was located — **nicht geregelt** as a distinct clause.

### f) Preisänderungen
§13.6 Preis- und Steueränderungen: *"Flo kann die Bedingungen des Abonnements von Zeit zu Zeit ändern, wie z. B. die anfallenden Abonnementgebühren, und wird Ihnen alle Preisänderungen im Voraus mitteilen. Preisänderungen treten zu Beginn des nächsten Abonnementzeitraums in Kraft, der auf das Datum der Preisänderung folgt. Wenn Sie das Abonnement nach Inkrafttreten der Preisänderung weiter nutzen, haben Sie den neuen Preis akzeptiert. Wenn Sie mit einer Preisänderung nicht einverstanden sind, können Sie die Änderung ablehnen, indem Sie das betreffende Abonnement kündigen, bevor die Preisänderung in Kraft tritt."* — note the "weiternutzen = Akzeptanz" (continued-use-as-acceptance) mechanic. [raw-verified]

### g) Haftung
§17.1 Haftungsbeschränkung: *"IN KEINEM FALL HAFTEN DAS UNTERNEHMEN ODER SEINE FÜHRUNGSKRÄFTE, DIREKTOREN, VERTRETER, TOCHTERGESELLSCHAFTEN, MITARBEITENDEN, BEVOLLMÄCHTIGTEN, LIEFERANTEN, PARTNER, WERBETREIBENDEN ODER DATENANBIETER FÜR INDIREKTE, BESONDERE, BEILÄUFIG ENTSTANDENE SCHÄDEN UND FOLGESCHÄDEN ... IN KEINEM FALL ÜBERSTEIGT DIE GESAMTHAFTUNG DES UNTERNEHMENS ... DIE BETRÄGE, DIE SIE AN DAS UNTERNEHMEN FÜR DIE NUTZUNG DER APP GEZAHLT HABEN, ODER GEGEBENENFALLS EINHUNDERT DOLLAR (100 $), FALLS SIE GEGENÜBER DEM UNTERNEHMEN KEINE ZAHLUNGSVERPFLICHTUNGEN HATTEN."* [raw-verified] — a flat USD 100 fallback cap, US-style drafting, not a German "Kardinalpflichten" structure.
Related disclaimer: *"WEDER DAS UNTERNEHMEN NOCH SEINE FÜHRUNGSKRÄFTE ... HAFTEN FÜR PERSONENSCHÄDEN, EINSCHLIESSLICH TOD, DIE DURCH IHRE NUTZUNG BZW. IHREN MISSBRAUCH DER APP VERURSACHT WERDEN."* with a savings clause: *"WENN EINE BESTIMMUNG IN EINEM GRÖSSEREN AUSMASS ALS NACH GELTENDEM RECHT ZULÄSSIG EINEN AUSSCHLUSS ODER EINE BESCHRÄNKUNG DER HAFTUNG AUSDRÜCKT, GILT DIESE BESTIMMUNG NUR ALS AUSSCHLUSS ODER BESCHRÄNKUNG UNSERER HAFTUNG IN..."* (sentence continues, likely "...im nach geltendem Recht zulässigen Umfang" — cut off in extraction). [raw-verified, partial sentence]

### h) Changes to the terms
§27.1: *"Wir können diese Vereinbarung von Zeit zu Zeit ändern, wenn wir dies für notwendig erachten (z. B. aus rechtlichen Gründen oder um Änderungen an der App oder der Website zu berücksichtigen). Bei wesentlichen Änderungen an dieser Vereinbarung stellen wir die aktualisierte Vereinbarung online zur Verfügung und bemühen uns in angemessener Weise, Sie darüber zu informieren."* [raw-verified]
§27.2: *"Nachdem wir die Vereinbarung geändert haben, wird sie dreißig (30) Tage nach ihrer Veröffentlichung im Internet für Sie rechtsverbindlich. In diesem Zeitraum können Sie sich ... an uns wenden, wenn Sie spezifische Fragen zu den Änderungen haben."* — i.e. a 30-day notice period, with the changed terms becoming binding automatically after that window elapses (a "deemed consent" style mechanic) rather than requiring active opt-in. [raw-verified]

### i) Mindestalter
§4.1: *"Um die App nutzen und auf die Inhalte von Flo zugreifen zu können, müssen Sie mindestens 13 Jahre alt sein (Einwohner des Europäischen Wirtschaftsraumes und des Vereinigten Königreichs müssen mindestens 16 Jahre alt sein)."* [raw-verified]
§4.4: *"Einige Funktionen der App sind für Nutzer, die jünger als 18 Jahre sind, eingeschränkt."* [raw-verified]

### j) Health / medical disclaimer, AI disclaimer
§5.1: *"DAS UNTERNEHMEN IST KEIN ZUGELASSENER ERBRINGER VON GESUNDHEITSLEISTUNGEN UND DIE APP IST NICHT DAZU GEDACHT, PROFESSIONELLE MEDIZINISCHE BERATUNG ZU ERSETZEN ODER KRANKHEITEN ODER BESCHWERDEN ZU DIAGNOSTIZIEREN, ZU BEHANDELN ODER ZU BEGLEITEN, ODER ALS METHODE DER FAMILIENPLANUNG ODER VERHÜTUNG. BITTE KONSULTIEREN SIE EINEN APPROBIERTEN ARZT ODER EINEN ANDEREN QUALIFIZIERTEN ERBRINGER VON GESUNDHEITSLEISTUNGEN, BEVOR SIE ENTSCHEIDUNGEN TREFFEN ODER MASSNAHMEN ERGREIFEN, DIE IHRE GESUNDHEIT UND SICHERHEIT ODER DIE IHRER FAMILIE ODER IHRES FÖTUS BEEINTRÄCHTIGEN KÖNNTEN."* [raw-verified]
**AI disclaimer: nicht gefunden** — no occurrence of "Künstliche Intelligenz", "künstlicher Intelligenz", or "KI" anywhere in the fetched text.

### k) Anwendbares Recht / Gerichtsstand
§24.b: *"Wenn Sie Ihren Wohnsitz in einem Land der Europäischen Union oder im Vereinigten Königreich, in der Schweiz, in Norwegen oder Island haben, gelten die Gesetze und Gerichte Ihres gewöhnlichen Wohnsitzes als anwendbares Recht und Gerichtsstand."* — i.e. for German users, German law/courts apply by this carve-out. [raw-verified]
For non-EEA/UK/CH/NO/IS users, §24.a/d point instead to AAA arbitration seated in the user's home state or New Castle County, Delaware, governed by the Federal Arbitration Act.

### l) Dispute resolution (arbitration / class action / Verbraucherschlichtung / OS)
§24 STREITBEILEGUNG UND SCHIEDSVERFAHREN (heading capitalized in bold in source): *"LESEN SIE BITTE DIESEN ABSCHNITT GENAU DURCH. ER VERPFLICHTET SIE DAZU, BESTIMMTE FORDERUNGEN UND STREITFÄLLE IN EINEM SCHIEDSVERFAHREN ZU KLÄREN UND SCHRÄNKT DIE ART UND WEISE EIN, IN DER SIE VON UNS ENTSCHÄDIGT WERDEN KÖNNEN."* [raw-verified]
§24.a: *"...vereinbaren Sie und das Unternehmen, dass alle Streitigkeiten, Ansprüche oder Meinungsverschiedenheiten ... durch ein verbindliches individuelles Schiedsverfahren gemäß den zu diesem Zeitpunkt geltenden Verbraucher-Schiedsregeln der American Arbitration Association ('AAA-Regeln') beigelegt werden, sofern in dieser Vereinbarung nichts anderes festgelegt ist."* — but note §24.b (quoted under (k)) carves EU/UK/CH/NO/IS residents out of arbitration into their home courts instead. [raw-verified]
§24.c: *"GERICHTSVERFAHREN FÜR GERINGFÜGIGE FORDERUNGEN: Alternativ zum Schiedsverfahren haben sowohl Sie als auch das Unternehmen das Recht, an einem zuständigen Gericht ein Gerichtsverfahren für geringfügige Forderungen anzustrengen."* [raw-verified]
An opt-out-of-arbitration mechanism exists (users may reject the arbitration clause by writing to Flo Health UK Limited's London address; rejecting it does not revoke consent to prior arbitration agreements for pre-existing disputes) — quoted context: *"Die Ablehnung einer Änderung widerruft oder ändert jedoch nicht Ihr vorheriges Einverständnis mit früheren Vereinbarungen zur Schlichtung von Streitigkeiten..."* [raw-verified]
**Verbraucherschlichtung (VSBG) and OS-Plattform (EU ODR):** **Nicht erwähnt** — no hits for either term anywhere on the fetched page, despite the page being served in German for EU users.

---

## Summary of what could not be accessed / notable gaps

- All three pages (Fastic, Headspace, Flo) were successfully reached in German via direct `curl` fetches — none were blocked or required JS-only rendering for the legal text itself (Flo's page is JS-heavy for navigation but the terms text itself was present in server-rendered HTML).
- **No app's German terms mention Verbraucherschlichtung (VSBG) or the EU OS/ODR platform** — a notable common gap across all three for pages served to German consumers.
- **Headspace's German page explicitly states English governs over German** in case of conflict, and its crisis-disclaimer keeps US emergency numbers (988/911) even in the German version — a legal-and-localization quality flag.
- **Flo's page shows no visible "Stand"/version date anywhere** — unusual compared to Fastic (dated) and Headspace (dated "Wirksam: 30. März 2026").
- **Fastic's own `/de/terms` page's §1.1 scope clause says it applies "ausschließlich" to Swiss-resident customers**, which appears inconsistent with the rest of the document (German-entity, German-law, Berlin-jurisdiction) — flagged, not resolved, since only verbatim text was to be recorded.
- Widerrufsrecht is explicit and detailed only for Fastic (14-day EU-style right with clear applicability to trial/gratis periods); Headspace omits it entirely; Flo only cross-references it for App-Store purchases without a standalone clause.
