import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import "./helpers/browser-storage-shim"

import { SiteFooter } from "../src/components/landing/site-footer"

let MethodikContent: (typeof import("../src/app/methodik/page"))["MethodikContent"]
let NotFound: (typeof import("../src/app/not-found"))["default"]
let AgbPage: (typeof import("../src/app/agb/page"))["default"]
let WiderrufPage: (typeof import("../src/app/widerruf/page"))["default"]
let DatenschutzPage: (typeof import("../src/app/datenschutz/page"))["default"]

test.before(async () => {
  const methodikModule = await import("../src/app/methodik/page")
  const notFoundModule = await import("../src/app/not-found")
  MethodikContent = methodikModule.MethodikContent
  NotFound = notFoundModule.default
  const [agb, widerruf, datenschutz] = await Promise.all([
    import("../src/app/agb/page"),
    import("../src/app/widerruf/page"),
    import("../src/app/datenschutz/page"),
  ])
  AgbPage = agb.default
  WiderrufPage = widerruf.default
  DatenschutzPage = datenschutz.default
})

test("Methodik shows the required trust, commercial, ownership, and medical boundaries", () => {
  const html = renderToStaticMarkup(<MethodikContent />)

  assert.match(html, /kosmetische Pflegeeinschätzung auf Grundlage deiner Antworten/i)
  assert.match(html, /keine Diagnose/i)
  assert.match(html, /Selbsttests und Selbsteinschätzungen können ungenau sein/i)
  assert.match(html, /Produktangaben können aus Herstellerinformationen/i)
  assert.match(html, /Affiliate-Links/i)
  assert.match(html, /Provision erhalten/i)
  assert.match(html, /Quellen und Aktualisierung/i)
  assert.match(html, /Chaarlie Redaktion/i)
  assert.match(html, /Haarmony LLC/i)
  assert.match(html, /ärztlichen Rat/i)
  assert.match(html, /href="\/quiz"/i)
  assert.doesNotMatch(html, /wissenschaftlich validiert/i)
  assert.doesNotMatch(html, /ärztlich validiert/i)
})

test("the Methodik shell keeps the shared frame without exposing a premature Ratgeber", () => {
  const shellSource = readFileSync("src/components/editorial/editorial-shell.tsx", "utf8")
  const footerHtml = renderToStaticMarkup(<SiteFooter />)

  assert.match(shellSource, /<LandingHeader \/>/)
  assert.match(shellSource, /<main /)
  assert.match(shellSource, /<SiteFooter \/>/)
  // Ruling 2026-09-04: the unified footer is legal-only — no Methodik link, and still no Ratgeber.
  assert.match(footerHtml, /href="\/impressum"/)
  assert.doesNotMatch(footerHtml, /href="\/methodik"/)
  assert.doesNotMatch(footerHtml, /href="\/ratgeber"/)
})

test("Methodik bootstraps first-party funnel context without editorial vendor tracking", () => {
  const methodikSource = readFileSync("src/app/methodik/page.tsx", "utf8")
  const shellSource = readFileSync("src/components/editorial/editorial-shell.tsx", "utf8")
  const bootstrapSource = readFileSync("src/providers/public-funnel-context-bootstrap.tsx", "utf8")

  assert.match(methodikSource, /<EditorialShell bootstrapFunnelContext>/)
  assert.match(shellSource, /bootstrapFunnelContext = false/)
  assert.match(shellSource, /<PublicFunnelContextBootstrap \/>/)
  assert.doesNotMatch(shellSource, /LandingTracking|route-providers/)
  assert.match(bootstrapSource, /import \{ bootstrapFunnelContext \} from "@\/lib\/funnel\/client"/)
  assert.match(
    bootstrapSource,
    /useEffect\(\(\) => \{\s*void bootstrapFunnelContext\(\)\s*\}, \[\]\)/,
  )
  assert.doesNotMatch(bootstrapSource, /posthog|auth|provider|recordBrowserFunnelMilestone/i)
})

test("unknown routes render a branded German recovery page", () => {
  const html = renderToStaticMarkup(<NotFound />)

  assert.match(html, /Diese Seite gibt es nicht/)
  assert.match(html, /href="\/"/)
  assert.match(html, /href="\/quiz"/)
  assert.doesNotMatch(html, /This page could not be found/)
})

test("unknown routes keep the default tracking-free editorial shell", () => {
  const notFoundSource = readFileSync("src/app/not-found.tsx", "utf8")

  assert.match(notFoundSource, /<EditorialShell>/)
  assert.doesNotMatch(notFoundSource, /bootstrapFunnelContext|funnel\/session|LandingTracking/)
})

test("approved public copy uses serious, non-medical product framing", () => {
  const heroSource = readFileSync("src/components/landing/hero.tsx", "utf8")
  const finalCtaSource = readFileSync("src/components/landing/final-cta.tsx", "utf8")
  const valueSource = readFileSync("src/components/landing/what-you-get.tsx", "utf8")
  const footerSource = readFileSync("src/components/landing/site-footer.tsx", "utf8")
  const faqSource = readFileSync("src/components/landing/faq.tsx", "utf8")
  const analysisSource = readFileSync("src/components/quiz/quiz-analysis.tsx", "utf8")
  // The default-package commit/loading copy asserted below now lives in the
  // funnel copy map (src/lib/quiz/funnel-copy.ts) — quiz-analysis.tsx renders
  // it via `getQuizFunnelCopy`, but the organic literals themselves moved.
  const funnelCopySource = readFileSync("src/lib/quiz/funnel-copy.ts", "utf8")
  const resultsSource = readFileSync("src/components/quiz/quiz-results.tsx", "utf8")
  const pricingSource = readFileSync("src/components/quiz/result-offer-pricing.tsx", "utf8")
  const planSelectorSource = readFileSync(
    "src/components/checkout/subscription-plan-selector.tsx",
    "utf8",
  )
  const socialImageSource = readFileSync("src/app/opengraph-image.tsx", "utf8")
  const privacySource = readFileSync("src/app/datenschutz/page.tsx", "utf8")
  const termsSource = readFileSync("src/app/agb/page.tsx", "utf8")

  assert.match(heroSource, /In 2 Minuten verstehst du besser/)
  assert.match(finalCtaSource, /Bereit für eine Pflege, die besser zu deinen/)
  assert.match(valueSource, /Keine eigenen Produkte\. Eine persönliche Auswertung/)
  assert.match(valueSource, /Transparente Datennutzung/)
  assert.match(footerSource, /Haarmony LLC/)
  assert.match(faqSource, /Chaarlie sicher bereitzustellen und zu verbessern/)
  assert.match(funnelCopySource, /bereit für den nächsten Schritt mit deinem Haar\?/)
  assert.match(funnelCopySource, /Ja, zeig mir meine Analyse/)
  assert.match(funnelCopySource, /Deine Haaranalyse wird erstellt\./)
  assert.doesNotMatch(analysisSource, /Meine Haaranalyse ansehen/)
  assert.doesNotMatch(analysisSource, /DEIN PROFIL WIRD ERSTELLT/)
  assert.doesNotMatch(analysisSource, /Deine Angaben zur Haarstruktur werden ausgewertet/)
  assert.doesNotMatch(analysisSource, /Deine Pflegebedürfnisse werden eingeordnet/)
  assert.doesNotMatch(analysisSource, /Dein persönliches Profil wird erstellt/)
  assert.doesNotMatch(analysisSource, /MEIN HAARPROFIL ANSEHEN/)
  assert.doesNotMatch(resultsSource, /Wir prüfen deinen Zugang/)
  assert.doesNotMatch(resultsSource, /Dein Ergebnis wird geöffnet/)
  assert.match(planSelectorSource, /14 Tage Geld-zurück-Garantie · Jederzeit kündbar/)
  assert.match(planSelectorSource, /Zahlungsdaten verarbeitet dein gewählter Anbieter/)
  assert.match(socialImageSource, /MÖGLICHES PFLEGEZIEL/)
  assert.match(privacySource, /persönliche Auswertung und Routine/)
  assert.match(termsSource, /Auswertungen, Routinen, Produktempfehlungen/)
  assert.doesNotMatch(heroSource, /was deine Haare[\s\S]*wirklich[\s\S]*brauchen/)
  assert.doesNotMatch(finalCtaSource, /was deine Haare[\s\S]*wirklich[\s\S]*brauchen/)
  assert.doesNotMatch(valueSource, /Eine Diagnose/)
  assert.doesNotMatch(footerSource, /Wissenschaftliche Haaranalyse/)
  assert.doesNotMatch(faqSource, /ausschließlich verwendet/)
  assert.doesNotMatch(analysisSource, /Protein-Feuchtigkeits-Balance wird berechnet/)
  assert.doesNotMatch(pricingSource, /Kein Risiko/)
  assert.doesNotMatch(planSelectorSource, /Kein Risiko/)
  assert.doesNotMatch(socialImageSource, /IN 4 WOCHEN/)
  assert.doesNotMatch(privacySource, /persönliche Diagnose und Routine/)
  assert.doesNotMatch(termsSource, /Diagnosen, Routinen, Produktempfehlungen/)
})

function renderedText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

test("legal pages preserve existing one-time purchases without offering new ones in the trial launch", () => {
  const terms = renderedText(renderToStaticMarkup(<AgbPage />))
  const withdrawal = renderedText(renderToStaticMarkup(<WiderrufPage />))
  const privacy = renderedText(renderToStaticMarkup(<DatenschutzPage />))

  assert.match(
    terms,
    /Bereits gekaufte persönliche Haarpläne bleiben Einmalkäufe ohne automatische Verlängerung/,
  )
  assert.match(terms, /Diese Bestimmungen bieten keinen neuen Quartalsplan oder Einmalkauf an/)
  assert.match(
    terms,
    /Für bereits abgeschlossene Einmalkäufe des persönlichen Haarplans gilt zusätzlich die bei Abschluss zugesagte 14-Tage-Geld-zurück-Garantie/,
  )
  assert.match(
    terms,
    /vollständige Rückerstattung\. Gesetzliche Rechte werden dadurch nicht eingeschränkt/,
  )
  assert.match(
    terms,
    /Beim Einmalkauf des persönlichen Haarplans richtet sich der Zugang nach dem im Checkout beschriebenen Leistungsumfang/,
  )
  assert.match(withdrawal, /14-Tage-Geld-zurück-Garantie/)
  assert.match(privacy, /Mitgliedschaft oder eines Einmalkaufs/)
  assert.match(privacy, /Mitgliedschaften und Einmalkäufe/)
})

test("rendered membership terms disclose approved trial prices and preserve legacy price promises", () => {
  const termsHtml = renderToStaticMarkup(<AgbPage />)
  const terms = renderedText(termsHtml)

  // Approved trial contract supersedes the old amount-neutral/current-quarter
  // offering assertion; grandfathered contracts retain their actual promises.
  assert.match(terms, /Test: 7 Tage kostenlos ab erfolgreicher Autorisierung des Zahlungsmittels/)
  assert.match(terms, /Monatsplan: danach 9,99 € pro Monat/)
  assert.match(terms, /Jahresplan: 69,99 € für das erste bezahlte Jahr, danach 99,99 € jährlich/)
  assert.match(terms, /Der Einführungspreis gilt nur für das erste bezahlte Jahr/)
  assert.match(terms, /Die erste volle bezahlte Laufzeit beginnt erst mit erfolgreicher Zahlung/)
  assert.match(
    terms,
    /Für bereits bestehende Verträge bleiben die bei ihrem Abschluss vereinbarten Preise und Konditionen maßgeblich, einschließlich ausdrücklich bis zur Kündigung zugesagter Einführungspreise/,
  )
  assert.match(terms, /stellen bestehende Verträge nicht automatisch auf den kostenlosen Test um/)
  assert.doesNotMatch(termsHtml, /<strong[^>]*>Quartalsplan:/)

  assert.match(
    terms,
    /Danach läuft der Vertrag auf unbestimmte Zeit weiter; es entsteht keine neue feste Jahresbindung/,
  )
  assert.match(
    terms,
    /Nach dem ersten Jahr kannst du jederzeit mit einer Frist von höchstens einem Monat kündigen/,
  )
  assert.match(
    terms,
    /nach dem wirksamen Vertragsende erstatten wir ungenutztes, im Voraus gezahltes Entgelt zeitanteilig/,
  )
  assert.match(terms, /Widerrufsrecht von 14 Tagen ab Vertragsschluss/)
  assert.match(terms, /Die Nutzung des Tests bedeutet keinen Verzicht auf das Widerrufsrecht/)
})
