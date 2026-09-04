import type { Metadata } from "next"
import Link from "next/link"
import { SiteFooter } from "@/components/landing/site-footer"
import { LEGAL_PAGE_METADATA } from "@/lib/seo/site-identity"

export const metadata: Metadata = LEGAL_PAGE_METADATA.datenschutz

export default function DatenschutzPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center px-4 py-16">
        <div className="w-full max-w-2xl space-y-8">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Letzte Aktualisierung: Mai 2026
          </p>
          <h1 className="break-words text-3xl font-semibold tracking-tight text-foreground max-[359px]:text-2xl">
            Datenschutzerklärung
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Wir nehmen den Schutz deiner persönlichen Daten ernst und behandeln deine
            personenbezogenen Daten vertraulich entsprechend der gesetzlichen
            Datenschutzvorschriften, insbesondere der EU-Datenschutz-Grundverordnung (DSGVO) und dem
            Bundesdatenschutzgesetz (BDSG).
          </p>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">1. Verantwortlicher</h2>
              <p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
              <address className="mt-2 not-italic">
                Haarmony LLC
                <br />
                1111B S Governors Ave # 84075
                <br />
                Dover, DE 19904, USA
                <br />
                E-Mail:{" "}
                <a href="mailto:info@chaarlie.de" className="text-foreground underline">
                  info@chaarlie.de
                </a>
              </address>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">2. EU-Vertretung</h2>
              <p>
                Da der Verantwortliche seinen Sitz außerhalb der EU hat, gilt Art. 27 DSGVO. Eine
                EU-Vertretung wird zum Zeitpunkt der Inbetriebnahme der Verarbeitung
                personenbezogener EU-Daten benannt und in dieser Erklärung ergänzt.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                3. Welche Daten wir erheben
              </h2>
              <p>
                <strong className="text-foreground">
                  a) Beim Besuch der Website (Server-Logfiles):
                </strong>{" "}
                Beim Aufruf unserer Website werden automatisch Informationen übermittelt, die vom
                Browser an den Server gesendet werden (IP-Adresse, Datum/Uhrzeit, aufgerufene URL,
                Referer-URL, Browser- und Betriebssystem-Info). Diese Daten werden temporär
                verarbeitet, um die Sicherheit und Funktionsfähigkeit der Website zu gewährleisten
                (Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO, berechtigtes Interesse). Die Daten
                werden nach 7 Tagen gelöscht oder anonymisiert.
              </p>
              <p className="mt-2">
                <strong className="text-foreground">b) Beim Quiz / der Haaranalyse:</strong> Deine
                Antworten zu Haarstruktur, Kopfhaut, Pflegegewohnheiten und Zielen sowie deine
                E-Mail-Adresse, sofern du sie angibst. Diese Daten verwenden wir, um dir deine
                persönliche Auswertung und Routine zu erstellen (Rechtsgrundlage: Art. 6 Abs. 1 lit.
                b DSGVO, Vertragserfüllung).
              </p>
              <p className="mt-2">
                <strong className="text-foreground">c) Beim Konto und Chat:</strong> E-Mail-Adresse,
                Name (bei Registrierung), Nachrichten an den KI-Berater sowie generierte
                Produktempfehlungen. Verwendung zur Kontoverwaltung und Bereitstellung des
                personalisierten Dienstes (Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO).
              </p>
              <p className="mt-2">
                <strong className="text-foreground">
                  d) Bei Kauf einer Mitgliedschaft oder eines Einmalkaufs:
                </strong>{" "}
                Name, E-Mail-Adresse, Rechnungsadresse und Zahlungsdaten. Diese verarbeiten wir zur
                Abwicklung des Vertrags (Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO).
              </p>
              <p className="mt-2">
                <strong className="text-foreground">e) Nutzungsdaten:</strong> Seitenaufrufe,
                Interaktionen und Geräteinformationen, soweit erforderlich für Analyse und
                Fehlerüberwachung (Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO).
              </p>
              <p className="mt-2">
                <strong className="text-foreground">f) Bei gemeldeten Zahlungsproblemen:</strong>{" "}
                Vorgangskennung, Zahlungsstatus und Fehlerkategorie. Wir nutzen diese Angaben, um
                den Vorgang zu prüfen und dir Service-E-Mails zum Ergebnis zu senden. Wir speichern
                dabei keine Kartendaten oder Fehlermeldungen des Zahlungsanbieters.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                4. Zweck der Datenverarbeitung
              </h2>
              <ul className="list-inside list-disc space-y-1">
                <li>Bereitstellung und Personalisierung der KI-Haaranalyse</li>
                <li>Durchführung des Haar-Quiz und Erstellung der Ergebnisseite</li>
                <li>Kontoverwaltung und Anmeldefunktion</li>
                <li>Produktempfehlungen auf Basis des Haarprofils</li>
                <li>Verbesserung und Weiterentwicklung des Dienstes</li>
                <li>Fehlererkennung und technische Überwachung</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                5. Empfänger / Auftragsverarbeiter
              </h2>
              <p>
                Wir nutzen folgende Dienstleister, die im Rahmen einer Auftragsverarbeitung gem.
                Art. 28 DSGVO tätig werden:
              </p>
              <div className="mt-2 space-y-3">
                <div>
                  <p className="font-medium text-foreground">Supabase (AWS, Region eu-central-1)</p>
                  <p>Datenbank, Authentifizierung. Daten werden in der EU gespeichert.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">OpenAI, Inc. (USA)</p>
                  <p>
                    Verarbeitung von Chat-Nachrichten und Quiz-Analysen durch KI-Modelle. Die
                    Übermittlung in die USA erfolgt auf Grundlage von Standardvertragsklauseln (Art.
                    46 Abs. 2 lit. c DSGVO).
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Vercel, Inc. (USA)</p>
                  <p>
                    Hosting der Webanwendung. Übermittlung in die USA auf Grundlage von
                    Standardvertragsklauseln.
                  </p>
                  <p className="mt-2">
                    Für die technische Leistungsüberwachung nutzen wir Vercel Speed Insights. Dabei
                    werden anonyme Messwerte zu einer auf sieben App-Bereiche begrenzten, von
                    Parametern und Kennungen bereinigten Route und URL, Netzwerkgeschwindigkeit,
                    Browser, Gerätetyp und Betriebssystem, Land sowie Web Vitals einschließlich der
                    Elementzuordnung verarbeitet. Andere Bereiche werden nicht erfasst. Die
                    Messpunkte werden weder einer einzelnen Person noch einer IP-Adresse oder
                    Sitzung zugeordnet und erlauben keine Rekonstruktion des Nutzungsverhaltens über
                    Seiten hinweg. Die Verarbeitung erfolgt bereits vor einer Cookie-Auswahl auf
                    Grundlage unseres berechtigten Interesses nach Art. 6 Abs. 1 lit. f DSGVO, die
                    Verfügbarkeit und Geschwindigkeit der Website zu überwachen und zu verbessern.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Stripe Payments Europe Ltd. (Irland)
                  </p>
                  <p>Zahlungsabwicklung für Mitgliedschaften und Einmalkäufe.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburg)
                  </p>
                  <p>
                    Zahlungsabwicklung für Mitgliedschaften und Einmalkäufe bei Auswahl von PayPal.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Customer.io (USA)</p>
                  <p>
                    Versand transaktionaler und marketingbezogener E-Mails sowie
                    Lifecycle-Messaging. Übermittlung auf Grundlage von Standardvertragsklauseln.
                    Marketing-Mails nur nach Einwilligung im Double-Opt-In-Verfahren.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">PostHog (EU)</p>
                  <p>
                    Webanalyse zur Verbesserung des Dienstes. Daten werden in der EU verarbeitet.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Meta Platforms Ireland Ltd. (Meta Pixel)
                  </p>
                  <p>
                    Reichweitenmessung und personalisierte Werbung auf Facebook und Instagram. Wird
                    ausschließlich nach deiner Einwilligung geladen (Art. 6 Abs. 1 lit. a DSGVO, §
                    25 TDDDG). Datenübermittlung an Meta Platforms, Inc. (USA) auf Grundlage von
                    Standardvertragsklauseln.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Sentry (USA)</p>
                  <p>
                    Fehlerüberwachung und Leistungsüberwachung. Übermittlung auf Grundlage von
                    Standardvertragsklauseln.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Langfuse (EU)</p>
                  <p>
                    Überwachung und Analyse der KI-Interaktionen zur Qualitätssicherung. Daten
                    werden in der EU verarbeitet.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                6. Datenübermittlung in Drittländer
              </h2>
              <p>
                Einige unserer Dienstleister haben ihren Sitz in den USA. Wir stellen sicher, dass
                eine Übermittlung dorthin nur auf Grundlage von Standardvertragsklauseln (SCC) der
                EU-Kommission oder einem anderen geeigneten Schutzmechanismus gem. Art. 44 ff. DSGVO
                erfolgt.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                7. Cookies und Tracking
              </h2>
              <p>
                Wir nutzen Cookies und vergleichbare Technologien. Über das Cookie-Banner kannst du
                deine Einwilligung für die Kategorien „Analyse&ldquo; und „Marketing&ldquo; einzeln
                erteilen oder ablehnen. Deine Auswahl kannst du jederzeit über{" "}
                <button
                  type="button"
                  data-cookie-settings-trigger
                  className="text-foreground underline"
                >
                  Cookie-Einstellungen
                </button>{" "}
                anpassen.
              </p>
              <ul className="mt-3 list-inside list-disc space-y-1">
                <li>
                  <strong className="text-foreground">Essenziell:</strong> Authentifizierung
                  (Supabase), Speicherung deiner Cookie-Auswahl, Wiedererkennungs-Cookie
                  (hc_returning). Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
                </li>
                <li>
                  <strong className="text-foreground">Analyse:</strong> PostHog und Customer.io.
                  Hilft uns zu verstehen, wie Besucher die Website nutzen und Kampagnen sauber
                  auszuwerten. Nur mit Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 TDDDG).
                </li>
                <li>
                  <strong className="text-foreground">Marketing:</strong> Meta Pixel (Facebook /
                  Instagram). Für personalisierte Werbung auf Drittplattformen. Nur mit
                  Einwilligung.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">8. Speicherdauer</h2>
              <p>
                Wir speichern personenbezogene Daten nur so lange, wie es für die jeweiligen Zwecke
                erforderlich ist oder gesetzliche Aufbewahrungsfristen es vorschreiben.
                Quiz-Antworten ohne Account werden nach 90 Tagen gelöscht. Rechnungsdaten 10 Jahre
                (Aufbewahrungspflicht). Gelöste Zahlungs-Supportfälle werden nach 90 Tagen gelöscht;
                offene Fälle bleiben bis zur Klärung gespeichert. Marketing-E-Mail-Daten bis zum
                Widerruf der Einwilligung.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">9. Rechtsgrundlagen</h2>
              <ul className="mt-1 list-inside list-disc space-y-1">
                <li>
                  <strong className="text-foreground">Art. 6 Abs. 1 lit. a DSGVO</strong>{" "}
                  (Einwilligung) — für die Quiz-Teilnahme und Analyse vor Registrierung
                </li>
                <li>
                  <strong className="text-foreground">Art. 6 Abs. 1 lit. b DSGVO</strong>{" "}
                  (Vertragserfüllung) — für die Bereitstellung des KI-Beratungsdienstes nach
                  Registrierung
                </li>
                <li>
                  <strong className="text-foreground">Art. 6 Abs. 1 lit. f DSGVO</strong>{" "}
                  (berechtigtes Interesse) — für Analytics und Fehlerüberwachung
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">10. Deine Rechte</h2>
              <p>Du hast jederzeit das Recht auf:</p>
              <ul className="mt-1 list-inside list-disc space-y-1">
                <li>Auskunft über deine gespeicherten Daten (Art. 15 DSGVO)</li>
                <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
                <li>Löschung (Art. 17 DSGVO)</li>
                <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
                <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
                <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
                <li>Widerruf erteilter Einwilligungen (Art. 7 Abs. 3 DSGVO)</li>
                <li>Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
              </ul>
              <p className="mt-2">
                Wende dich für diese Anfragen formlos an:{" "}
                <a href="mailto:info@chaarlie.de" className="text-foreground underline">
                  info@chaarlie.de
                </a>
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                11. SSL-Verschlüsselung
              </h2>
              <p>
                Diese Website nutzt SSL-Verschlüsselung. Erkennbar an „https://&ldquo; in der
                Adressleiste deines Browsers.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                12. Änderungen dieser Datenschutzerklärung
              </h2>
              <p>
                Wir behalten uns vor, diese Datenschutzerklärung anzupassen, wenn rechtliche oder
                technische Änderungen es erforderlich machen. Die jeweils aktuelle Version findest
                du immer auf dieser Seite.
              </p>
            </section>
          </div>

          <Link href="/" className="inline-block text-sm text-muted-foreground hover:underline">
            ← Zurück zur Startseite
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
