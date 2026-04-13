import Link from "next/link"

export const metadata = {
  title: "Datenschutzerklärung",
}

export default function DatenschutzPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Datenschutzerklärung
        </h1>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          {/* 1. Verantwortlicher */}
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">1. Verantwortlicher</h2>
            <p>
              Haarmony, LLC
              <br />
              1111B S Governors Ave Ste 84075
              <br />
              Dover, Delaware 19904, USA
              <br />
              E-Mail: info@haarmony.com
            </p>
          </section>

          {/* 2. Erhobene Daten */}
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              2. Welche Daten wir erheben
            </h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong>Kontodaten:</strong> E-Mail-Adresse, Name (bei Registrierung)
              </li>
              <li>
                <strong>Haarprofil:</strong> Haartyp, Textur, Pflegegewohnheiten, Anliegen und Ziele
                (über Quiz und Onboarding)
              </li>
              <li>
                <strong>Chat-Verlauf:</strong> Nachrichten an den KI-Berater sowie
                Produktempfehlungen
              </li>
              <li>
                <strong>Quiz-Daten:</strong> Antworten und KI-generierte Analyse (auch vor
                Registrierung)
              </li>
              <li>
                <strong>Nutzungsdaten:</strong> Seitenaufrufe, Interaktionen, Geräteinformationen
                (über Analytics)
              </li>
            </ul>
          </section>

          {/* 3. Zweck */}
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              3. Zweck der Datenverarbeitung
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

          {/* 4. Rechtsgrundlage */}
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">4. Rechtsgrundlage</h2>
            <p>Die Verarbeitung Ihrer Daten erfolgt auf Grundlage von:</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>
                <strong>Art. 6 Abs. 1 lit. a DSGVO</strong> (Einwilligung) — für die Quiz-Teilnahme
                und Analyse vor Registrierung
              </li>
              <li>
                <strong>Art. 6 Abs. 1 lit. b DSGVO</strong> (Vertragserfüllung) — für die
                Bereitstellung des KI-Beratungsdienstes nach Registrierung
              </li>
              <li>
                <strong>Art. 6 Abs. 1 lit. f DSGVO</strong> (berechtigtes Interesse) — für Analytics
                und Fehlerüberwachung
              </li>
            </ul>
          </section>

          {/* 5. Drittanbieter */}
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              5. Drittanbieter und Datenübermittlung
            </h2>
            <p>Wir nutzen folgende Drittanbieter zur Erbringung des Dienstes:</p>
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
                  Hosting der Webanwendung. Die Übermittlung in die USA erfolgt auf Grundlage von
                  Standardvertragsklauseln.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">PostHog (EU)</p>
                <p>Webanalyse zur Verbesserung des Dienstes. Daten werden in der EU verarbeitet.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Sentry (USA)</p>
                <p>
                  Fehlerüberwachung und Leistungsüberwachung. Übermittlung auf Grundlage von
                  Standardvertragsklauseln.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Cohere, Inc. (USA)</p>
                <p>
                  Verarbeitung von Suchanfragen zur Verbesserung der Empfehlungsqualität.
                  Übermittlung auf Grundlage von Standardvertragsklauseln.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Langfuse (EU)</p>
                <p>
                  Überwachung und Analyse der KI-Interaktionen zur Qualitätssicherung. Daten werden
                  in der EU verarbeitet.
                </p>
              </div>
            </div>
          </section>

          {/* 6. Cookies */}
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">6. Cookies und Tracking</h2>
            <p>Wir verwenden folgende Cookies:</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>
                <strong>Authentifizierungs-Cookies</strong> (Supabase) — notwendig für die
                Anmeldefunktion
              </li>
              <li>
                <strong>Analytics-Cookies</strong> (PostHog) — zur Analyse der Nutzung des Dienstes
              </li>
              <li>
                <strong>Wiederkennungs-Cookie</strong> (hc_returning) — zur Unterscheidung zwischen
                neuen und wiederkehrenden Besuchern
              </li>
            </ul>
          </section>

          {/* 7. Datensicherheit */}
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">7. Datensicherheit</h2>
            <p>
              Die Übertragung Ihrer Daten erfolgt verschlüsselt über TLS/HTTPS. Gespeicherte Daten
              werden durch Zugriffsbeschränkungen und Verschlüsselung geschützt. Der Zugriff auf
              personenbezogene Daten ist auf autorisiertes Personal beschränkt.
            </p>
          </section>

          {/* 8. Betroffenenrechte */}
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">8. Ihre Rechte</h2>
            <p>
              Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
              Verarbeitung, Datenübertragbarkeit und Widerspruch bezüglich Ihrer personenbezogenen
              Daten. Zur Ausübung Ihrer Rechte wenden Sie sich bitte an:{" "}
              <a href="mailto:info@haarmony.com" className="text-foreground underline">
                info@haarmony.com
              </a>
            </p>
            <p className="mt-2">
              Sie haben außerdem das Recht, sich bei einer Datenschutz- Aufsichtsbehörde zu
              beschweren.
            </p>
          </section>

          {/* 9. Änderungen */}
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              9. Änderungen dieser Datenschutzerklärung
            </h2>
            <p>
              Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an geänderte
              Rechtslagen oder bei Änderungen des Dienstes anzupassen. Die aktuelle Fassung finden
              Sie stets auf dieser Seite.
            </p>
            <p className="mt-2">Stand: April 2026</p>
          </section>
        </div>

        <Link href="/" className="inline-block text-sm text-muted-foreground hover:underline">
          ← Zurück zur Startseite
        </Link>
      </div>
    </div>
  )
}
