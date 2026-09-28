import type { Metadata } from "next"
import Link from "next/link"
import { SiteFooter } from "@/components/landing/site-footer"
import { LEGAL_PAGE_METADATA } from "@/lib/seo/site-identity"

export const metadata: Metadata = LEGAL_PAGE_METADATA.agbApp

const linkClass = "text-foreground underline"

export default function AgbAppPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center px-4 py-16">
        <div className="w-full max-w-2xl space-y-8">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Letzte Aktualisierung: September 2026
          </p>
          <h1 className="break-words text-3xl font-semibold tracking-tight text-foreground max-[359px]:text-2xl">
            Nutzungsbedingungen (AGB) der Chaarlie iOS-App
          </h1>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                § 1 Geltungsbereich und Vertragspartner
              </h2>
              <p>
                (1) Diese Nutzungsbedingungen gelten für die Nutzung der iOS-App „Chaarlie&ldquo;
                (nachfolgend „App&ldquo;) und für Mitgliedschaften, die du in der App über den App
                Store abschließt. Vertragspartner ist die Haarmony LLC, 1111B S Governors Ave #
                84075, Dover, DE 19904, Vereinigte Staaten von Amerika, vertreten durch den
                Geschäftsführer Jonas Eidenschink (nachfolgend „wir&ldquo;).
              </p>
              <p className="mt-2">
                (2) Fragen, Beanstandungen und Ansprüche zur App richtest du bitte an{" "}
                <a href="mailto:info@chaarlie.de" className={linkClass}>
                  info@chaarlie.de
                </a>{" "}
                oder an die oben genannte Anschrift.
              </p>
              <p className="mt-2">
                (3) Für Mitgliedschaften, die über unsere Website abgeschlossen wurden, gelten die{" "}
                <Link href="/agb" className={linkClass}>
                  AGB der Website
                </Link>
                .
              </p>
              <p className="mt-2">
                (4) Abweichende Bedingungen von Nutzern gelten nicht. Der Vertrag wird in deutscher
                Sprache geschlossen.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                § 2 Verhältnis zu Apple
              </h2>
              <p>
                (1) Diese Nutzungsbedingungen werden ausschließlich zwischen dir und uns
                geschlossen, nicht mit Apple Inc. oder deren verbundenen Unternehmen (nachfolgend
                „Apple&ldquo;). Für die App und ihre Inhalte sind allein wir verantwortlich, nicht
                Apple.
              </p>
              <p className="mt-2">
                (2) Ergänzend gelten die Nutzungsregeln der Apple Media Services-Bedingungen
                (nachfolgend „Nutzungsregeln&ldquo;). Diese Nutzungsbedingungen sollen keine
                abweichenden Regeln zur Nutzung der App aufstellen. Im Fall eines Widerspruchs gehen
                die Nutzungsregeln vor.
              </p>
              <p className="mt-2">
                (3) Apple ist nicht verpflichtet, Wartungs- oder Supportleistungen für die App zu
                erbringen.
              </p>
              <p className="mt-2">
                (4) Für die Vertragsmäßigkeit der App und für Mängel sind wir verantwortlich, nicht
                Apple. Entspricht die App nicht einer anwendbaren Gewährleistung, kannst du Apple
                darüber informieren. Apple erstattet dir dann einen für die App gezahlten Kaufpreis.
                Im gesetzlich zulässigen Umfang hat Apple keine weiteren Gewährleistungspflichten in
                Bezug auf die App. Deine gesetzlichen Rechte uns gegenüber bleiben unberührt.
              </p>
              <p className="mt-2">
                (5) Wir, nicht Apple, sind zuständig für Ansprüche von dir oder Dritten im
                Zusammenhang mit der App oder ihrer Nutzung. Das gilt insbesondere für
                Produkthaftungsansprüche, für Ansprüche, die App erfülle gesetzliche oder
                behördliche Anforderungen nicht, und für Ansprüche aus Verbraucherschutz-,
                Datenschutz- oder vergleichbaren Vorschriften.
              </p>
              <p className="mt-2">
                (6) Macht ein Dritter geltend, dass die App oder deren Besitz und Nutzung seine
                Rechte an geistigem Eigentum verletzt, sind allein wir, nicht Apple, für die
                Prüfung, Abwehr, Beilegung und Erledigung dieses Anspruchs verantwortlich.
              </p>
              <p className="mt-2">
                (7) Die Nutzung der App ist nicht gestattet, wenn du dich in einem Land aufhältst,
                das einem Embargo der US-Regierung unterliegt oder von der US-Regierung als Land
                eingestuft ist, das Terrorismus unterstützt, oder wenn du auf einer Liste verbotener
                oder eingeschränkter Personen der US-Regierung geführt wirst.
              </p>
              <p className="mt-2">
                (8) Bei der Nutzung der App musst du die für dich geltenden Bedingungen Dritter
                einhalten, zum Beispiel die deines Mobilfunk- oder Internetanbieters.
              </p>
              <p className="mt-2">
                (9) Apple und ihre Tochtergesellschaften sind Drittbegünstigte dieser
                Nutzungsbedingungen. Mit deiner Annahme dieser Bedingungen erhält Apple das Recht,
                sie dir gegenüber als Drittbegünstigte durchzusetzen.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">§ 3 Leistungen der App</h2>
              <p>
                (1) Chaarlie ist ein digitaler Beratungsservice für Haarpflege. Die App erstellt
                anhand deiner Angaben ein Haarprofil, schätzt Pflegeprodukte ein (zum Beispiel über
                den Produktscanner), schlägt Produkte und eine Pflegeroutine vor und bietet einen
                KI-Berater. Einige Funktionen sind kostenlos. Andere setzen eine kostenpflichtige
                Mitgliedschaft voraus. Welche Funktionen dazugehören, wird dir in der App vor dem
                Kauf angezeigt.
              </p>
              <p className="mt-2">
                (2) Chaarlie gibt kosmetische Pflegeempfehlungen. Die App ist kein Medizinprodukt,
                stellt keine Diagnosen und ersetzt keine ärztliche oder dermatologische Beratung.
                Bei Haarausfall, Kopfhautproblemen, Reizungen, Entzündungen oder Allergien wende
                dich bitte an eine Ärztin oder einen Arzt. Hast du bekannte Allergien oder Haut-
                oder Kopfhauterkrankungen, oder bist du schwanger oder stillst, kläre die Anwendung
                neuer Produkte bitte vorher ärztlich ab. Wir empfehlen, neue Produkte zuerst an
                einer kleinen Hautstelle zu testen.
              </p>
              <p className="mt-2">
                (3) Produktangaben wie Inhaltsstoffe stammen von Herstellern, Händlern oder aus
                anderen Quellen. Wir prüfen sie sorgfältig, Hersteller können Rezepturen aber
                ändern. Maßgeblich sind die Angaben auf der Verpackung. Das gilt besonders bei
                Allergien und Unverträglichkeiten.
              </p>
              <p className="mt-2">
                (4) Wir verkaufen keine Pflegeprodukte. Führt ein Link zu einem Händler, kommt ein
                Kaufvertrag nur mit diesem Händler zu dessen Bedingungen zustande. Kommerzielle
                Links kennzeichnen wir.
              </p>
              <p className="mt-2">
                (5) Die App benötigt eine Internetverbindung. Wir bemühen uns um eine möglichst
                unterbrechungsfreie Verfügbarkeit. Wegen Wartung, Sicherheitsmaßnahmen oder
                Störungen außerhalb unseres Einflussbereichs kann es jedoch zu vorübergehenden
                Einschränkungen kommen. Geplante Wartungen kündigen wir nach Möglichkeit vorher an.
                Deine gesetzlichen Rechte bei Mängeln bleiben unberührt.
              </p>
              <p className="mt-2">
                (6) Wir stellen dir die Aktualisierungen bereit, die nötig sind, damit die App
                vertragsgemäß bleibt, einschließlich Sicherheitsaktualisierungen, und informieren
                dich darüber. Installierst du eine solche Aktualisierung nicht innerhalb einer
                angemessenen Frist, haften wir nicht für Mängel, die allein darauf beruhen. Das gilt
                nur, wenn wir dich über die Aktualisierung und die Folgen einer unterlassenen
                Installation informiert haben.
              </p>
              <p className="mt-2">
                (7) Über Aktualisierungen hinaus dürfen wir die App nur aus einem triftigen Grund
                ändern, zum Beispiel wegen neuer Funktionen, technischer Weiterentwicklung,
                Sicherheit oder geänderter rechtlicher Vorgaben. Dir entstehen dadurch keine
                zusätzlichen Kosten, und wir informieren dich klar und verständlich darüber.
                Beeinträchtigt eine Änderung deinen Zugang zur App oder ihre Nutzbarkeit mehr als
                nur unerheblich, informieren wir dich rechtzeitig vorher in Textform. Du kannst den
                Vertrag dann innerhalb von 30 Tagen nach dieser Information oder nach der Änderung,
                je nachdem, was später eintritt, unentgeltlich beenden. Deine gesetzlichen Rechte
                bleiben unberührt.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">§ 4 KI-Funktionen</h2>
              <p>
                (1) Einige Inhalte der App, insbesondere die Antworten des KI-Beraters und Teile der
                Auswertungen, werden automatisch mit KI-Modellen erzeugt. Dabei setzen wir
                KI-Dienste von Drittanbietern ein. Welche Anbieter das sind und welche Daten dabei
                verarbeitet werden, erfährst du in der{" "}
                <Link href="/datenschutz" className={linkClass}>
                  Datenschutzerklärung
                </Link>
                . Im Chat antwortet dir ein KI-System, kein Mensch.
              </p>
              <p className="mt-2">
                (2) Bevor du KI-Funktionen zum ersten Mal nutzt, informieren wir dich in der App
                darüber, welche Daten an KI-Dienste von Drittanbietern übermittelt werden. Soweit
                erforderlich, holen wir dafür deine Einwilligung ein.
              </p>
              <p className="mt-2">
                (3) KI-generierte Inhalte können unvollständig, veraltet oder falsch sein. Bitte
                prüfe sie, bevor du danach handelst, besonders bei Inhaltsstoffen und
                Unverträglichkeiten. Die Grenzen aus § 3 Abs. 2 gelten auch hier. Nutze KI-Antworten
                nicht als alleinige Grundlage für Entscheidungen über deine Gesundheit. Der
                KI-Berater ist nicht für Notfälle gedacht.
              </p>
              <p className="mt-2">
                (4) Gib im Chat keine Daten über andere Personen und keine Gesundheitsdaten ein, die
                für deine Haarpflegefrage nicht nötig sind.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                § 5 Mindestalter und Konto
              </h2>
              <p>
                (1) Die App darf ab 16 Jahren genutzt werden. Wer noch nicht volljährig ist, darf
                eine kostenpflichtige Mitgliedschaft nur mit Zustimmung der gesetzlichen Vertreter
                abschließen.
              </p>
              <p className="mt-2">
                (2) Bitte mache bei der Registrierung und im Selbsttest wahrheitsgemäße Angaben.
                Unsere Empfehlungen beruhen auf diesen Angaben. Halte deine Zugangsdaten geheim.
                Dein Konto ist persönlich und nicht übertragbar.
              </p>
              <p className="mt-2">
                (3) Du kannst dein Konto jederzeit direkt in der App in den Kontoeinstellungen
                löschen. Was wir aufgrund gesetzlicher Aufbewahrungspflichten weiter speichern,
                steht in der{" "}
                <Link href="/datenschutz" className={linkClass}>
                  Datenschutzerklärung
                </Link>
                .
              </p>
              <p className="mt-2">
                (4) Wichtig: Wenn du dein Konto löschst oder die App entfernst, wird eine über den
                App Store abgeschlossene Mitgliedschaft nicht automatisch beendet. Bitte kündige sie
                nach § 7.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                § 6 Mitgliedschaft und In-App-Käufe
              </h2>
              <p>
                (1) Kostenpflichtige Mitgliedschaften in der App werden als sich automatisch
                verlängernde Abonnements ausschließlich über den In-App-Kauf von Apple angeboten.
                Kauf, Zahlung, Abrechnung und Verlängerung wickelt Apple über deine Apple-ID ab.
                Ergänzend gelten dafür die Bedingungen von Apple, die dir im App Store angezeigt
                werden. Deine Zahlungsdaten erhalten wir nicht.
              </p>
              <p className="mt-2">
                (2) Die Darstellung der Mitgliedschaften in der App ist noch kein verbindliches
                Angebot. Der Vertrag kommt zustande, wenn du den Kauf im Kaufdialog von Apple
                bestätigst, zum Beispiel mit Face ID, Touch ID oder deinem Passwort. Apple bestätigt
                dir den Kauf per E-Mail. Danach schalten wir die Mitgliedschaft in der App frei.
              </p>
              <p className="mt-2">
                (3) Preis, Währung, Laufzeit und ein eventueller kostenloser Testzeitraum werden dir
                in der App und im Kaufdialog von Apple vor der Bestätigung angezeigt. Verbindlich
                ist der im Kaufdialog angezeigte Preis. Alle Preise enthalten die gesetzliche
                Umsatzsteuer. Preise können je nach Land abweichen.
              </p>
              <p className="mt-2">
                (4) Wird ein kostenloser Testzeitraum angeboten, geht er in die gewählte
                kostenpflichtige Mitgliedschaft über, wenn du nicht spätestens 24 Stunden vor seinem
                Ende kündigst. Ob du für einen Testzeitraum berechtigt bist, entscheidet Apple nach
                den Regeln des App Store. Schließt du während des Tests eine andere kostenpflichtige
                Mitgliedschaft ab, endet der verbleibende Testzeitraum.
              </p>
              <p className="mt-2">
                (5) Die Mitgliedschaft verlängert sich automatisch um die gewählte Laufzeit, wenn du
                nicht spätestens 24 Stunden vor Ende des laufenden Zeitraums kündigst. Die
                Verlängerung wird innerhalb von 24 Stunden vor Ende des laufenden Zeitraums über
                deine Apple-ID abgerechnet.
              </p>
              <p className="mt-2">
                (6) Preiserhöhungen für eine laufende Mitgliedschaft werden nur wirksam, wenn du
                ihnen zustimmst. Stimmst du nicht zu, endet die Mitgliedschaft zum Ende des
                laufenden Zeitraums.
              </p>
              <p className="mt-2">
                (7) Deine Mitgliedschaft ist an deine Apple-ID und dein Chaarlie-Konto gebunden. Auf
                einem anderen Gerät kannst du sie über „Käufe wiederherstellen&ldquo; in der App
                erneut aktivieren. Familienfreigabe ist nur möglich, wenn der App Store sie für die
                Mitgliedschaft ausweist.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                § 7 Kündigung und Erstattungen
              </h2>
              <p>
                (1) Du kannst deine Mitgliedschaft jederzeit in den Einstellungen deines iPhones
                unter deinem Namen › Abonnements oder im App Store kündigen. Die App führt dich über
                „Abo verwalten&ldquo; dorthin. Dein Zugang bleibt bis zum Ende des bezahlten
                Zeitraums bestehen.
              </p>
              <p className="mt-2">
                (2) Du kannst deine Kündigung auch in Textform an uns richten, zum Beispiel per
                E-Mail an{" "}
                <a href="mailto:info@chaarlie.de" className={linkClass}>
                  info@chaarlie.de
                </a>
                . Gib dabei bitte die E-Mail-Adresse deines Chaarlie-Kontos an. Wir bestätigen dir
                den Eingang und das Vertragsende in Textform. Da nur Apple die Abrechnung steuert,
                zeigen wir dir in unserer Antwort außerdem, wie du die Verlängerung in deinen
                Apple-Einstellungen abschaltest. Wird dir nach dem Vertragsende trotzdem ein
                weiterer Zeitraum berechnet, helfen wir dir, die Erstattung bei Apple zu beantragen.
              </p>
              <p className="mt-2">
                (3) Erstattungen für In-App-Käufe kannst du bei Apple beantragen, zum Beispiel über{" "}
                <a
                  href="https://reportaproblem.apple.com"
                  className={linkClass}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  reportaproblem.apple.com
                </a>
                . Da Apple die Zahlung abwickelt, entscheidet Apple über Erstattungen. Wir selbst
                können für In-App-Käufe keine Erstattungen vornehmen. Deine gesetzlichen Rechte
                bleiben unberührt.
              </p>
              <p className="mt-2">
                (4) Die kostenlose Nutzung der App können wir mit einer Frist von vier Wochen
                beenden. Das Recht beider Seiten zur außerordentlichen Kündigung aus wichtigem Grund
                bleibt unberührt, zum Beispiel bei schwerem Missbrauch der App.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">§ 8 Widerrufsrecht</h2>
              <p>
                (1) Als Verbraucherin oder Verbraucher hast du bei In-App-Käufen ein gesetzliches
                Widerrufsrecht von 14 Tagen. Da der Kauf über den App Store abgewickelt wird, kannst
                du den Widerruf gegenüber Apple erklären, zum Beispiel über{" "}
                <a
                  href="https://reportaproblem.apple.com"
                  className={linkClass}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  reportaproblem.apple.com
                </a>
                . Einzelheiten stehen in der Widerrufsbelehrung, die Apple dir beim Kauf
                bereitstellt.
              </p>
              <p className="mt-2">
                (2) Brauchst du dabei Hilfe, schreib uns an{" "}
                <a href="mailto:info@chaarlie.de" className={linkClass}>
                  info@chaarlie.de
                </a>
                . Wir zeigen dir, wie du den Widerruf bei Apple einreichst.
              </p>
              <p className="mt-2">
                (3) Ein kostenloser Testzeitraum ersetzt das Widerrufsrecht nicht. Wer die App nutzt
                oder testet, verzichtet damit nicht auf das Widerrufsrecht.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                § 9 Nutzungsrechte und deine Inhalte
              </h2>
              <p>
                (1) Die App und ihre Inhalte sind urheberrechtlich geschützt. Du erhältst ein
                einfaches, nicht übertragbares Recht, die App für persönliche Zwecke auf
                Apple-Geräten zu nutzen, die dir gehören oder die du kontrollierst, soweit die
                Nutzungsregeln es erlauben. Kostenpflichtige Funktionen kannst du für die Dauer
                deiner Mitgliedschaft nutzen.
              </p>
              <p className="mt-2">
                (2) Nicht gestattet sind insbesondere: automatisiertes Auslesen von Inhalten, das
                Umgehen von Zugangsbeschränkungen, der Weiterverkauf von Inhalten der App und das
                Dekompilieren der App, soweit das Gesetz es nicht ausdrücklich erlaubt.
              </p>
              <p className="mt-2">
                (3) Die Rechte an deinen Inhalten (zum Beispiel Chat-Nachrichten oder Fotos von
                Produktverpackungen) behältst du. Du räumst uns ein einfaches, nicht übertragbares
                Recht ein, diese Inhalte zu speichern und zu verarbeiten, soweit das für die
                Bereitstellung der App nötig ist. Schickst du uns Angaben zu einem Produkt, das noch
                nicht in unserer Datenbank ist, dürfen wir die Produktangaben (zum Beispiel Marke,
                Name und Inhaltsstoffe) in unsere Produktdatenbank übernehmen. Deine Fotos
                veröffentlichen wir nicht ohne deine gesonderte Zustimmung.
              </p>
              <p className="mt-2">
                (4) Lade nur Inhalte hoch, an denen du die nötigen Rechte hast. Bitte lade keine
                Fotos hoch, auf denen andere Personen erkennbar sind.
              </p>
              <p className="mt-2">
                (5) Die Kamera nutzt die App nur mit deiner Erlaubnis. Du kannst die Erlaubnis
                jederzeit in den iOS-Einstellungen widerrufen. Einige Funktionen wie der
                Produktscanner stehen dann nicht zur Verfügung.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">§ 10 Haftung</h2>
              <p>
                (1) Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung
                des Lebens, des Körpers oder der Gesundheit, nach dem Produkthaftungsgesetz, im
                Umfang einer übernommenen Garantie und bei arglistig verschwiegenen Mängeln.
              </p>
              <p className="mt-2">
                (2) Bei leichter Fahrlässigkeit haften wir nur, wenn wir eine wesentliche
                Vertragspflicht verletzen. Wesentlich sind Pflichten, deren Erfüllung die
                ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren
                Einhaltung du regelmäßig vertrauen darfst. In diesem Fall ist unsere Haftung auf den
                vertragstypischen, vorhersehbaren Schaden begrenzt.
              </p>
              <p className="mt-2">
                (3) Im Übrigen ist unsere Haftung auf Schadensersatz ausgeschlossen. Diese
                Haftungsregeln gelten auch für unsere gesetzlichen Vertreter, Mitarbeitenden und
                Erfüllungsgehilfen.
              </p>
              <p className="mt-2">
                (4) Deine gesetzlichen Rechte bei Mängeln digitaler Produkte bleiben unberührt.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">§ 11 Datenschutz</h2>
              <p>
                Wie wir personenbezogene Daten in der App verarbeiten, steht in unserer{" "}
                <Link href="/datenschutz" className={linkClass}>
                  Datenschutzerklärung
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                § 12 Änderungen dieser Nutzungsbedingungen
              </h2>
              <p>
                (1) Änderungen, die dich nicht benachteiligen, sowie rein sprachliche Klarstellungen
                teilen wir dir vorab in der App oder per E-Mail mit.
              </p>
              <p className="mt-2">
                (2) Alle anderen Änderungen, insbesondere zu Leistungsumfang, Preis oder Laufzeit,
                werden nur wirksam, wenn du ihnen ausdrücklich zustimmst, zum Beispiel durch eine
                Bestätigung in der App. Dein Schweigen gilt nicht als Zustimmung. Stimmst du nicht
                zu, gelten die bisherigen Bedingungen weiter. Die Kündigungsrechte nach § 7 bleiben
                unberührt.
              </p>
              <p className="mt-2">(3) Änderungen der App selbst richten sich nach § 3 Abs. 7.</p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                § 13 Anwendbares Recht und Streitbeilegung
              </h2>
              <p>
                (1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
                UN-Kaufrechts. Hast du deinen gewöhnlichen Aufenthalt als Verbraucherin oder
                Verbraucher in einem anderen Staat, bleibt dir der Schutz der zwingenden
                Verbraucherschutzvorschriften dieses Staates erhalten.
              </p>
              <p className="mt-2">
                (2) Für Verbraucherinnen und Verbraucher gelten die gesetzlichen Gerichtsstände.
              </p>
              <p className="mt-2">
                (3) Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
                Verbraucherschlichtungsstelle teilzunehmen.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-medium text-foreground">
                § 14 Schlussbestimmungen
              </h2>
              <p>
                (1) Diese Nutzungsbedingungen kannst du jederzeit unter chaarlie.de/agb/app abrufen,
                speichern und ausdrucken.
              </p>
              <p className="mt-2">
                (2) Ist eine Bestimmung dieser Nutzungsbedingungen unwirksam, bleibt der Vertrag im
                Übrigen wirksam. An die Stelle der unwirksamen Bestimmung treten die gesetzlichen
                Vorschriften.
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
