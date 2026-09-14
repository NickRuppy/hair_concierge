import type { Metadata } from "next"
import Link from "next/link"
import { SiteFooter } from "@/components/landing/site-footer"
import { LEGAL_PAGE_METADATA } from "@/lib/seo/site-identity"

export const metadata: Metadata = LEGAL_PAGE_METADATA.agb

export default function AgbPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center px-4 py-16">
        <div className="w-full max-w-2xl space-y-8">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Letzte Aktualisierung: September 2026
          </p>
          <h1 className="break-words text-3xl font-semibold tracking-tight text-foreground max-[359px]:text-2xl">
            Allgemeine Geschäftsbedingungen (AGB)
          </h1>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">§ 1 Geltungsbereich</h2>
              <p>
                Diese AGB gelten für alle Verträge zwischen der Haarmony LLC (nachfolgend
                „Anbieter&ldquo;) und ihren Kundinnen und Kunden (nachfolgend „Nutzer&ldquo;) über
                die Nutzung von Chaarlie und damit verbundener Dienste.
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
                Der Vertrag kommt zustande, wenn der Nutzer einen kostenpflichtigen Plan auswählt,
                die Zahlungsinformationen angibt und auf den entsprechenden Bestell-Button klickt.
                Der Anbieter bestätigt den Vertragsschluss umgehend per E-Mail.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">§ 4 Preise und Zahlung</h2>
              <p>
                Es gelten die zum Zeitpunkt des Vertragsschlusses auf der Website angegebenen
                Preise. Alle Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer, sofern
                anwendbar. Die Zahlung erfolgt per Kreditkarte oder anderen angebotenen
                Zahlungsmitteln über die sicheren Zahlungsdienstleister Stripe oder PayPal.
              </p>
              <p className="mt-2">
                Für neue Mitgliedschaften mit kostenlosem Test gelten folgende Konditionen:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>
                  <strong className="text-foreground">Test:</strong> 7 Tage kostenlos ab
                  erfolgreicher Autorisierung des Zahlungsmittels. Das genaue Testende und der
                  vorgesehene erste Zahlungstermin werden beim Abschluss und in der
                  Vertragsbestätigung genannt.
                </li>
                <li>
                  <strong className="text-foreground">Monatsplan:</strong> danach 9,99 € pro Monat.
                </li>
                <li>
                  <strong className="text-foreground">Jahresplan:</strong> 69,99 € für das erste
                  bezahlte Jahr, danach 99,99 € jährlich. Der Einführungspreis gilt nur für das
                  erste bezahlte Jahr.
                </li>
              </ul>
              <p className="mt-2">
                Der unmittelbar vor der verbindlichen Bestellung angezeigte Gesamtpreis ist
                maßgeblich. Die erste volle bezahlte Laufzeit beginnt erst mit erfolgreicher
                Zahlung. Ohne bestätigte Zahlung endet der Testzugang trotzdem zum ursprünglichen
                Testende. Das Testangebot gilt einmalig. Abgebrochene oder fehlgeschlagene Versuche
                ohne aktivierten Test verbrauchen es nicht. Eine Ablehnung des Tests löst keine
                Zahlung aus. Bei einer fehlerhaften Zuordnung hilft info@chaarlie.de.
              </p>
              <p className="mt-2">
                Für bereits bestehende Verträge bleiben die bei ihrem Abschluss vereinbarten Preise
                und Konditionen maßgeblich, einschließlich ausdrücklich bis zur Kündigung zugesagter
                Einführungspreise. Bereits gekaufte persönliche Haarpläne bleiben Einmalkäufe ohne
                automatische Verlängerung. Diese Bestimmungen bieten keinen neuen Quartalsplan oder
                Einmalkauf an und stellen bestehende Verträge nicht automatisch auf den kostenlosen
                Test um.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                § 5 Laufzeit und Kündigung
              </h2>
              <p>
                Während des kostenlosen Tests kannst du jederzeit bis zum angegebenen Testende
                kündigen. Dein Zugang bleibt bis dahin bestehen; anschließend beginnt kein
                kostenpflichtiger Zeitraum. Ohne Kündigung folgt die ausgewählte bezahlte
                Mitgliedschaft. Du kannst online über{" "}
                <Link href="/kuendigen" className="text-foreground underline">
                  Verträge hier kündigen
                </Link>
                , über dein Konto oder per E-Mail an{" "}
                <a href="mailto:info@chaarlie.de" className="text-foreground underline">
                  info@chaarlie.de
                </a>{" "}
                kündigen. Wir bestätigen den Eingang deiner Kündigung und das Vertragsende in
                Textform.
              </p>
              <p className="mt-2">
                Beim Monatsplan beträgt die erste bezahlte Laufzeit einen Monat. Danach läuft der
                Vertrag auf unbestimmte Zeit weiter und ist jederzeit mit einer Frist von höchstens
                einem Monat kündbar.
              </p>
              <p className="mt-2">
                Beim Jahresplan beträgt die erste bezahlte Laufzeit ein Jahr. Du kannst zum Ende
                dieses ersten Jahres kündigen. Danach läuft der Vertrag auf unbestimmte Zeit weiter;
                es entsteht keine neue feste Jahresbindung. Die Abrechnung erfolgt weiterhin
                jährlich im Voraus mit 99,99 €. Nach dem ersten Jahr kannst du jederzeit mit einer
                Frist von höchstens einem Monat kündigen. Für die Zeit nach dem wirksamen
                Vertragsende erstatten wir ungenutztes, im Voraus gezahltes Entgelt zeitanteilig.
              </p>
              <p className="mt-2">
                Gesetzliche Widerrufsrechte und das Recht zur außerordentlichen Kündigung bleiben
                unberührt. Für ältere Verträge gelten die jeweils vereinbarten Bedingungen, soweit
                sie mit zwingendem Verbraucherrecht vereinbar sind.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">§ 6 Widerrufsrecht</h2>
              <p>
                Verbraucher haben ein gesetzliches Widerrufsrecht von 14 Tagen ab Vertragsschluss.
                Der kostenlose Test ersetzt dieses Recht nicht. Die Nutzung des Tests bedeutet
                keinen Verzicht auf das Widerrufsrecht. Details siehe{" "}
                <Link href="/widerruf" className="text-foreground underline">
                  Widerrufsbelehrung
                </Link>
                .
              </p>
              <p className="mt-2">
                Für bereits abgeschlossene Einmalkäufe des persönlichen Haarplans gilt zusätzlich
                die bei Abschluss zugesagte 14-Tage-Geld-zurück-Garantie: Wenn Chaarlie für dich
                nicht hilfreich ist, erhältst du eine vollständige Rückerstattung. Gesetzliche
                Rechte werden dadurch nicht eingeschränkt.
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
                Alle Inhalte der App (Auswertungen, Routinen, Produktempfehlungen) sind
                urheberrechtlich geschützt. Für Mitgliedschaften erhält der Nutzer ein einfaches,
                nicht übertragbares Nutzungsrecht für die Dauer des Abonnements. Beim Einmalkauf des
                persönlichen Haarplans richtet sich der Zugang nach dem im Checkout beschriebenen
                Leistungsumfang.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                § 10 Änderungen der AGB
              </h2>
              <p>
                Der Anbieter kann diese AGB mit Wirkung für die Zukunft ändern. Die Nutzer werden
                über Änderungen mindestens 30 Tage im Voraus per E-Mail informiert. Widerspricht der
                Nutzer nicht innerhalb dieser Frist, gelten die neuen AGB als angenommen.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                § 11 Anwendbares Recht und Gerichtsstand
              </h2>
              <p>
                Für Verbraucher gilt das Recht ihres Wohnsitzlandes innerhalb der EU. Für
                Unternehmer gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
                UN-Kaufrechts. Gerichtsstand für Unternehmer ist der Sitz des Anbieters.
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
      <SiteFooter />
    </div>
  )
}
