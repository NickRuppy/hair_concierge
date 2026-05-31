import Link from "next/link"

export const metadata = {
  title: "Allgemeine Geschäftsbedingungen (AGB)",
}

export default function AgbPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Letzte Aktualisierung: Mai 2026
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Allgemeine Geschäftsbedingungen (AGB)
        </h1>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">§ 1 Geltungsbereich</h2>
            <p>
              Diese AGB gelten für alle Verträge zwischen der Haarmony LLC (nachfolgend
              „Anbieter&ldquo;) und ihren Kundinnen und Kunden (nachfolgend „Nutzer&ldquo;) über die
              Nutzung von Chaarlie und damit verbundener Dienste.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">§ 2 Vertragsgegenstand</h2>
            <p>
              Chaarlie ist ein digitaler Beratungsservice für Haarpflege. Der Anbieter stellt eine
              Software zur Verfügung, die anhand eines Selbsttests eine individuelle
              Haarpflege-Empfehlung erstellt, ergänzt durch konkrete Produktvorschläge und eine
              persönliche Routine. Der Service ist als digitale Dienstleistung zu verstehen, nicht
              als medizinische Beratung.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">§ 3 Vertragsschluss</h2>
            <p>
              Der Vertrag kommt zustande, wenn der Nutzer einen kostenpflichtigen Plan auswählt, die
              Zahlungsinformationen angibt und auf den entsprechenden Bestell-Button klickt. Der
              Anbieter bestätigt den Vertragsschluss umgehend per E-Mail.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">§ 4 Preise und Zahlung</h2>
            <p>
              Es gelten die zum Zeitpunkt des Vertragsschlusses auf der Website angegebenen Preise.
              Alle Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer, sofern
              anwendbar. Die Zahlung erfolgt per Kreditkarte oder anderen angebotenen
              Zahlungsmitteln über die sicheren Zahlungsdienstleister Stripe oder PayPal.
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                <strong className="text-foreground">Monatsplan:</strong> 14,99 € pro Monat,
                monatliche Abrechnung
              </li>
              <li>
                <strong className="text-foreground">Quartalsplan:</strong> 34,99 € pro Quartal
                (entspricht ca. 11,66 € / Monat), quartalsweise Abrechnung
              </li>
              <li>
                <strong className="text-foreground">Jahresplan:</strong> 99,99 € pro Jahr
                (entspricht ca. 8,33 € / Monat), jährliche Abrechnung
              </li>
            </ul>
            <p className="mt-2">
              Aktions- oder Einführungsrabatte können den ersten Abrechnungsbetrag reduzieren; die
              jeweils angezeigten Konditionen im Checkout sind maßgeblich.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              § 5 Laufzeit und Kündigung
            </h2>
            <p>
              Alle Pläne sind Abonnements mit automatischer Verlängerung. Sie verlängern sich
              jeweils um die gewählte Laufzeit (1 Monat, 3 Monate oder 12 Monate), sofern sie nicht
              vor Ablauf der jeweiligen Abrechnungsperiode gekündigt werden. Die Kündigung kann
              jederzeit über das Konto des Nutzers oder formlos per E-Mail an{" "}
              <a href="mailto:info@chaarlie.de" className="text-foreground underline">
                info@chaarlie.de
              </a>{" "}
              erfolgen. Die Kündigung wird zum Ende der laufenden Abrechnungsperiode wirksam;
              bereits gezahlte Beträge werden nicht anteilig erstattet, vorbehaltlich des
              gesetzlichen Widerrufsrechts und der freiwilligen Geld-zurück-Garantie.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">§ 6 Widerrufsrecht</h2>
            <p>
              Verbraucher haben ein gesetzliches Widerrufsrecht. Details siehe{" "}
              <Link href="/widerruf" className="text-foreground underline">
                Widerrufsbelehrung
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              § 7 Pflichten des Nutzers
            </h2>
            <p>
              Der Nutzer ist verpflichtet, wahrheitsgemäße Angaben beim Selbsttest und bei der
              Anmeldung zu machen. Die Empfehlungen basieren auf den vom Nutzer angegebenen
              Informationen.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">§ 8 Haftung</h2>
            <p>
              Chaarlie ist kein medizinisches Produkt. Die Empfehlungen ersetzen keine ärztliche
              oder dermatologische Beratung. Der Anbieter haftet nicht für Schäden, die durch die
              unsachgemäße Anwendung der empfohlenen Produkte entstehen. Die Haftung des Anbieters
              für Schäden ist auf Vorsatz und grobe Fahrlässigkeit beschränkt, soweit gesetzlich
              zulässig.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">§ 9 Geistiges Eigentum</h2>
            <p>
              Alle Inhalte der App (Diagnosen, Routinen, Produktempfehlungen) sind urheberrechtlich
              geschützt. Der Nutzer erhält ein einfaches, nicht übertragbares Nutzungsrecht für die
              Dauer des Abonnements.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">§ 10 Änderungen der AGB</h2>
            <p>
              Der Anbieter kann diese AGB mit Wirkung für die Zukunft ändern. Die Nutzer werden über
              Änderungen mindestens 30 Tage im Voraus per E-Mail informiert. Widerspricht der Nutzer
              nicht innerhalb dieser Frist, gelten die neuen AGB als angenommen.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              § 11 Anwendbares Recht und Gerichtsstand
            </h2>
            <p>
              Für Verbraucher gilt das Recht ihres Wohnsitzlandes innerhalb der EU. Für Unternehmer
              gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
              Gerichtsstand für Unternehmer ist der Sitz des Anbieters.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              § 12 Salvatorische Klausel
            </h2>
            <p>
              Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die Wirksamkeit der
              übrigen Bestimmungen unberührt.
            </p>
          </section>
        </div>

        <Link href="/" className="inline-block text-sm text-muted-foreground hover:underline">
          ← Zurück zur Startseite
        </Link>
      </div>
    </div>
  )
}
