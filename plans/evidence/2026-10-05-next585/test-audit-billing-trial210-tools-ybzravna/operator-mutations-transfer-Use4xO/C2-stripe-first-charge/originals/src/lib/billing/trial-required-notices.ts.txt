import { TRIAL_REQUIRED_NOTICE_TERMS_V1 } from "./trial-required-notices-terms"
import { paypalTrialCollectionStart } from "../paypal/trial-collection-start"

export type TrialRequiredNoticeKind =
  | "contract_confirmation"
  | "contract_change"
  | "cancellation_receipt"
  | "paid_cancellation_receipt"
  | "payment_receipt"
  | "annual_renewal"
export type TrialRequiredNoticeSnapshot = Readonly<{
  version: "trial_required_notices_v1"
  contractId: string
  provider: "stripe" | "paypal"
  termsVersion: "trial_launch_v1"
  interval: "month" | "year"
  currency: "EUR"
  firstAmountMinor: number
  renewalAmountMinor: number
  authorizedAt: string
  authorization_proof_kind?: "webhook" | "api_confirmation"
  authorization_clock_kind?: "provider_event" | "server_confirmation"
  authorization_confirmed_at?: string
  trialEndAt: string
  taxBehavior: "inclusive"
  cancelAtPeriodEnd?: boolean
  revision?: number
  operationId?: string
  changeKind?: "switch" | "restore"
  committedAt?: string
  declarationId?: string
  submittedAt?: string
  effectiveEndAt?: string
  providerStatus?: "pending"
  paymentEventId?: string
  phase?: "first_paid" | "renewal"
  occurredAt?: string
  amountMinor?: number
  paidThroughAt?: string
  renewalAt?: string
}>
export type TrialRequiredNoticeMessage = Readonly<{
  subject: string
  receipt_text: string
  requiredNotice?: RequiredNoticePresentation
  paymentReceipt?: Readonly<{
    phase: "first_paid" | "renewal"
    plan: string
    amount: string
    paidOn: string
    paidAt: string
    paidThroughOn: string
    paidThrough: string
    provider: string
    contractId: string
    paymentId: string
  }>
  confirmation?: Readonly<{
    plan: string
    trialEnd: string
    firstCharge: string
    price: string
    renewal: string
    canceled: boolean
  }>
}>
export type RequiredNoticePresentation = Readonly<{
  eyebrow: string
  title: string
  intro: string
  facts: ReadonlyArray<Readonly<{ label: string; value: string }>>
  status: string
  primaryAction: Readonly<{
    kind: "manage" | "contact"
    label: string
  }>
  secondaryAction?: Readonly<{
    kind: "cancel"
    label: string
  }>
  detailTitle: string
  details: ReadonlyArray<Readonly<{ label: string; value: string }>>
  appendReceiptTextLabel?: string
}>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const validDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))
export function parseTrialRequiredNoticeSnapshot(
  value: unknown,
  kind: TrialRequiredNoticeKind,
): TrialRequiredNoticeSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const s = value as Record<string, unknown>
  if (
    s.version !== "trial_required_notices_v1" ||
    s.termsVersion !== "trial_launch_v1" ||
    typeof s.contractId !== "string" ||
    !UUID.test(s.contractId) ||
    !["stripe", "paypal"].includes(String(s.provider)) ||
    !["month", "year"].includes(String(s.interval)) ||
    s.currency !== "EUR" ||
    s.taxBehavior !== "inclusive" ||
    !validDate(s.authorizedAt) ||
    !validDate(s.trialEndAt) ||
    // Stripe ends exactly seven days after authorization; a PayPal trial ends on
    // the collection midnight frozen at checkout (at least seven, at most ten days).
    (s.provider === "paypal"
      ? Date.parse(s.trialEndAt) - Date.parse(s.authorizedAt) < 604800000 ||
        Date.parse(s.trialEndAt) - Date.parse(s.authorizedAt) > 864000000
      : Date.parse(s.trialEndAt) - Date.parse(s.authorizedAt) !== 604800000) ||
    (s.interval === "month"
      ? s.firstAmountMinor !== 999 || s.renewalAmountMinor !== 999
      : ![6999, 9999].includes(Number(s.firstAmountMinor)) || s.renewalAmountMinor !== 9999) ||
    !Number.isInteger(s.firstAmountMinor)
  )
    return null
  // Historical snapshots have no provenance fields. New PayPal snapshots must
  // distinguish the provider's event time from our direct confirmation time.
  if (
    ["authorization_proof_kind", "authorization_clock_kind", "authorization_confirmed_at"].some(
      (key) => Object.prototype.hasOwnProperty.call(s, key),
    )
  ) {
    if (s.provider !== "paypal") return null
    if (s.authorization_proof_kind === "api_confirmation") {
      if (
        s.authorization_clock_kind !== "server_confirmation" ||
        !validDate(s.authorization_confirmed_at) ||
        Date.parse(s.authorization_confirmed_at) !== Date.parse(s.authorizedAt)
      )
        return null
    } else if (s.authorization_proof_kind === "webhook") {
      if (
        s.authorization_clock_kind !== "provider_event" ||
        Object.prototype.hasOwnProperty.call(s, "authorization_confirmed_at")
      )
        return null
    } else return null
  }
  if (
    kind === "contract_change" &&
    (typeof s.operationId !== "string" ||
      !UUID.test(s.operationId) ||
      !["switch", "restore"].includes(String(s.changeKind)) ||
      !validDate(s.committedAt) ||
      !Number.isInteger(s.revision) ||
      Number(s.revision) < 1 ||
      typeof s.cancelAtPeriodEnd !== "boolean" ||
      // The committed restore operation writes cancel_at_period_end=false before
      // the notice trigger reads the enrollment in the same database transaction.
      (s.changeKind === "restore" && s.cancelAtPeriodEnd !== false))
  )
    return null
  if (
    kind === "cancellation_receipt" &&
    (typeof s.declarationId !== "string" ||
      !UUID.test(s.declarationId) ||
      !validDate(s.submittedAt) ||
      !validDate(s.effectiveEndAt) ||
      Date.parse(s.effectiveEndAt) !== Date.parse(s.trialEndAt))
  )
    return null
  if (
    kind === "paid_cancellation_receipt" &&
    (typeof s.declarationId !== "string" ||
      !UUID.test(s.declarationId) ||
      !validDate(s.submittedAt) ||
      !validDate(s.effectiveEndAt) ||
      !validDate(s.paidThroughAt) ||
      s.providerStatus !== "pending" ||
      Date.parse(s.effectiveEndAt) !== Date.parse(s.paidThroughAt) ||
      Date.parse(s.effectiveEndAt) <= Date.parse(s.trialEndAt))
  )
    return null
  if (
    kind === "payment_receipt" &&
    (typeof s.paymentEventId !== "string" ||
      !UUID.test(s.paymentEventId) ||
      !["first_paid", "renewal"].includes(String(s.phase)) ||
      !validDate(s.occurredAt) ||
      !validDate(s.paidThroughAt) ||
      Date.parse(s.paidThroughAt) <= Date.parse(s.occurredAt) ||
      s.amountMinor !== (s.phase === "first_paid" ? s.firstAmountMinor : s.renewalAmountMinor))
  )
    return null
  if (
    kind === "annual_renewal" &&
    (s.interval !== "year" || !validDate(s.renewalAt) || s.amountMinor !== s.renewalAmountMinor)
  )
    return null
  return s as TrialRequiredNoticeSnapshot
}
const dateOnly = (value: string) =>
  new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
    timeZone: "Europe/Berlin",
  }).format(new Date(value))
const date = (value: string) =>
  new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
    timeStyle: "long",
    timeZone: "Europe/Berlin",
  }).format(new Date(value))
const money = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value / 100)
const management =
  "Online kündigen: https://chaarlie.de/kuendigen\nMitgliedschaft verwalten: https://chaarlie.de/profile\nKontakt: info@chaarlie.de"
// Durable text, frozen to the accepted v1 contract; do not change historic v1 terms.
const withdrawal = `Widerrufsbelehrung
Du hast das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsschlusses. Der kostenlose Test ersetzt dieses Recht nicht; durch die Nutzung verzichtest du nicht darauf.
Um dein Widerrufsrecht auszuüben, musst du Haarmony LLC, 1111B S Governors Ave # 84075, Dover, DE 19904, USA, E-Mail: info@chaarlie.de, mittels einer eindeutigen Erklärung (z. B. Brief oder E-Mail) über deinen Entschluss informieren. Online: https://chaarlie.de/widerruf/erklaeren. Zur Wahrung der Frist reicht es aus, dass du die Mitteilung vor Ablauf der Widerrufsfrist absendest.
Wenn du diesen Vertrag widerrufst, zahlen wir alle von dir erhaltenen Zahlungen unverzüglich und spätestens binnen 14 Tagen ab Eingang der Mitteilung zurück. Wir verwenden dasselbe Zahlungsmittel wie bei der ursprünglichen Transaktion, sofern nicht ausdrücklich etwas anderes vereinbart wurde.
Muster-Widerrufsformular (freiwillig):
An Haarmony LLC, 1111B S Governors Ave # 84075, Dover, DE 19904, USA, info@chaarlie.de
Hiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung:
Bestellt am:
Name und Anschrift des/der Verbraucher(s):
Unterschrift (nur bei Mitteilung auf Papier):
Datum:`

export function buildTrialRequiredNoticeMessage(
  kind: TrialRequiredNoticeKind,
  value: unknown,
): TrialRequiredNoticeMessage {
  const s = parseTrialRequiredNoticeSnapshot(value, kind)
  if (!s) throw new Error("Invalid required notice snapshot")
  const plan = s.interval === "year" ? "Jahresmitgliedschaft" : "Monatsmitgliedschaft"
  const contract = `Chaarlie ${plan}\nVertragskennung: ${s.contractId}`
  if (kind === "cancellation_receipt")
    return {
      subject: "Deine Kündigung bei Chaarlie ist eingegangen",
      requiredNotice: {
        eyebrow: "Kündigung eingegangen",
        title: "Nach dem Test entstehen keine Kosten.",
        intro: "Wir haben deine Kündigung erhalten. Du musst nicht erneut kündigen.",
        facts: [
          { label: "Zugang bis", value: dateOnly(s.effectiveEndAt!) },
          { label: "Danach berechnet", value: money(0) },
          { label: "Mitgliedschaft", value: plan },
        ],
        status:
          "Dein Testzugang bleibt bis zum Ende bestehen. Diese Eingangsbestätigung bleibt gültig, auch wenn die technische Bearbeitung beim Zahlungsanbieter noch läuft.",
        primaryAction: { kind: "manage", label: "Mitgliedschaft ansehen" },
        detailTitle: "Kündigungsbeleg",
        details: [
          { label: "Kündigungskennung", value: s.declarationId! },
          { label: "Vertragskennung", value: s.contractId },
          { label: "Eingegangen", value: date(s.submittedAt!) },
          { label: "Zugang endet", value: date(s.effectiveEndAt!) },
        ],
      },
      receipt_text: `${contract}\nKündigungskennung: ${s.declarationId}\nEingegangen am: ${date(s.submittedAt!)}\nWir bestätigen den Eingang deiner Kündigung. Deine Mitgliedschaft endet am ${date(s.effectiveEndAt!)}. Bis dahin bleibt dein Testzugang bestehen; danach beginnt kein kostenpflichtiger Zeitraum. Du musst nicht erneut kündigen. Diese Bestätigung gilt auch, wenn die technische Bearbeitung beim Zahlungsanbieter noch läuft.\n\n${management}`,
    }
  if (kind === "paid_cancellation_receipt")
    return {
      subject: "Deine Kündigung bei Chaarlie ist eingegangen",
      requiredNotice: {
        eyebrow: "Kündigung eingegangen",
        title: `Dein Zugang bleibt bis zum ${dateOnly(s.paidThroughAt!)} bestehen.`,
        intro: "Wir haben deine Kündigung erhalten. Du musst nicht erneut kündigen.",
        facts: [
          { label: "Bezahlter Zugang bis", value: dateOnly(s.paidThroughAt!) },
          { label: "Wirksames Vertragsende", value: dateOnly(s.effectiveEndAt!) },
          { label: "Mitgliedschaft", value: plan },
        ],
        status:
          "Die technische Bearbeitung beim Zahlungsanbieter läuft noch. Diese Eingangsbestätigung bleibt gültig.",
        primaryAction: { kind: "manage", label: "Mitgliedschaft ansehen" },
        detailTitle: "Kündigungsbeleg",
        details: [
          { label: "Kündigungskennung", value: s.declarationId! },
          { label: "Vertragskennung", value: s.contractId },
          { label: "Eingegangen", value: date(s.submittedAt!) },
          { label: "Wirksames Vertragsende", value: date(s.effectiveEndAt!) },
        ],
      },
      receipt_text: `${contract}\nKündigungskennung: ${s.declarationId}\nEingegangen am: ${date(s.submittedAt!)}\nWir bestätigen den Eingang deiner Kündigung zum ${date(s.effectiveEndAt!)}. Dein bereits bezahlter Zugang bleibt bis zum ${date(s.paidThroughAt!)} bestehen. Die technische Bearbeitung beim Zahlungsanbieter läuft noch. Du musst nicht erneut kündigen.\n\n${management}`,
    }
  if (kind === "payment_receipt")
    return {
      subject: "Deine Zahlungsbestätigung von Chaarlie",
      paymentReceipt: {
        phase: s.phase!,
        plan,
        amount: money(s.amountMinor!),
        paidOn: dateOnly(s.occurredAt!),
        paidAt: date(s.occurredAt!),
        paidThroughOn: dateOnly(s.paidThroughAt!),
        paidThrough: date(s.paidThroughAt!),
        provider: s.provider === "stripe" ? "Stripe" : "PayPal",
        contractId: s.contractId,
        paymentId: s.paymentEventId!,
      },
      receipt_text: `${contract}\nZahlungskennung: ${s.paymentEventId}\nErfolgreiche Zahlung: ${money(s.amountMinor!)} am ${date(s.occurredAt!)} über ${s.provider === "stripe" ? "Stripe" : "PayPal"}.\n${s.phase === "first_paid" ? "Dein erster bezahlter Zeitraum beginnt mit dieser erfolgreichen Zahlung." : "Die Zahlung für die Fortsetzung deiner Mitgliedschaft ist eingegangen."}\nBezahlter Zugang bis: ${date(s.paidThroughAt!)}.\nDer Betrag ist der Gesamtpreis einschließlich anwendbarer Steuern. Dies ist eine Zahlungsbestätigung.\n\n${management}`,
    }
  if (kind === "annual_renewal")
    return {
      subject: "Deine nächste jährliche Chaarlie-Zahlung",
      requiredNotice: {
        eyebrow: "Jährliche Zahlung",
        title: `Deine nächste Zahlung ist für den ${dateOnly(s.renewalAt!)} vorgesehen.`,
        intro:
          "Eine kurze Erinnerung vor der nächsten jährlichen Zahlung deiner Chaarlie-Mitgliedschaft.",
        facts: [
          { label: "Betrag", value: `${money(s.amountMinor!)} inkl. Steuern` },
          { label: "Vorgesehen am", value: dateOnly(s.renewalAt!) },
          { label: "Mitgliedschaft", value: plan },
        ],
        status:
          "Es beginnt keine neue feste Jahresbindung. Nach dem ersten bezahlten Jahr kannst du mit höchstens einem Monat Frist kündigen.",
        primaryAction: { kind: "manage", label: "Mitgliedschaft verwalten" },
        secondaryAction: { kind: "cancel", label: "Online kündigen" },
        detailTitle: "Vertragsdetails",
        details: [
          { label: "Vertragskennung", value: s.contractId },
          { label: "Zahlungsanbieter", value: s.provider === "stripe" ? "Stripe" : "PayPal" },
          { label: "Vorgesehen", value: date(s.renewalAt!) },
          {
            label: "Nach Vertragsende",
            value: "Ungenutztes vorausgezahltes Entgelt wird zeitanteilig erstattet.",
          },
        ],
      },
      receipt_text: `${contract}\nDie nächste jährliche Zahlung von ${money(s.amountMinor!)} einschließlich anwendbarer Steuern ist für den ${date(s.renewalAt!)} vorgesehen.\nNach dem ersten bezahlten Jahr läuft deine Mitgliedschaft auf unbestimmte Zeit weiter. Du kannst jederzeit mit einer Frist von höchstens einem Monat kündigen. Für die Zeit nach dem wirksamen Vertragsende erstatten wir ungenutztes, im Voraus gezahltes Entgelt zeitanteilig. Es beginnt keine neue feste Jahresbindung.\n\n${management}`,
    }
  const paymentTerms =
    s.interval === "year"
      ? `Für das erste bezahlte Jahr werden ${money(s.firstAmountMinor)} fällig; danach ${money(s.renewalAmountMinor)} jährlich im Voraus. Nach dem ersten bezahlten Jahr läuft der Vertrag auf unbestimmte Zeit weiter. Eine Kündigung ist dann jederzeit mit einer Frist von höchstens einem Monat möglich; ungenutztes vorausgezahltes Entgelt nach dem wirksamen Vertragsende wird zeitanteilig erstattet. Es entsteht keine neue feste Jahresbindung.`
      : `Nach dem Test werden ${money(s.firstAmountMinor)} monatlich fällig. Nach dem ersten bezahlten Monat läuft der Vertrag auf unbestimmte Zeit weiter und ist jederzeit mit einer Frist von höchstens einem Monat kündbar.`
  return {
    ...(kind === "contract_confirmation"
      ? {
          confirmation: {
            plan,
            trialEnd: date(s.trialEndAt),
            firstCharge:
              s.provider === "paypal"
                ? dateOnly(paypalTrialCollectionStart(s.trialEndAt))
                : date(s.trialEndAt),
            price: `${money(s.firstAmountMinor)} ${s.interval === "year" ? "für das erste Jahr" : "monatlich"}`,
            renewal:
              s.interval === "year"
                ? `Danach ${money(s.renewalAmountMinor)} jährlich im Voraus.`
                : "",
            canceled: s.cancelAtPeriodEnd === true,
          },
        }
      : {}),
    ...(kind === "contract_change"
      ? {
          requiredNotice: {
            eyebrow: "Änderung bestätigt",
            title:
              s.changeKind === "restore"
                ? "Deine Kündigung wurde aufgehoben."
                : "Deine Laufzeit wurde geändert.",
            intro:
              s.changeKind === "restore"
                ? "Wie von dir gewünscht wird deine Mitgliedschaft fortgesetzt. Dein ursprünglicher Test läuft unverändert weiter."
                : "Dein kostenloser Test läuft unverändert weiter. Für diese Änderung wurde keine Zahlung ausgelöst.",
            facts: [
              {
                label: s.changeKind === "restore" ? "Mitgliedschaft" : "Neue Laufzeit",
                value: plan,
              },
              { label: "Test endet", value: dateOnly(s.trialEndAt) },
              s.cancelAtPeriodEnd
                ? { label: "Danach berechnet", value: money(0) }
                : {
                    label: "Erste Zahlung",
                    value: `${money(s.firstAmountMinor)} am ${dateOnly(s.provider === "paypal" ? paypalTrialCollectionStart(s.trialEndAt) : s.trialEndAt)}`,
                  },
            ],
            status: s.cancelAtPeriodEnd
              ? "Deine Kündigung bleibt wirksam. Dein Zugang endet zum ursprünglichen Testende."
              : `Für diese Änderung wurden ${money(0)} berechnet. Es beginnt kein neuer Test.`,
            primaryAction: { kind: "manage" as const, label: "Mitgliedschaft verwalten" },
            ...(!s.cancelAtPeriodEnd
              ? {
                  secondaryAction: { kind: "cancel" as const, label: "Online kündigen" },
                }
              : {}),
            detailTitle: "Änderungsdetails",
            details: [
              { label: "Änderungskennung", value: s.operationId! },
              { label: "Vertragskennung", value: s.contractId },
              { label: "Bestätigt", value: date(s.committedAt!) },
            ],
            appendReceiptTextLabel: "Vollständige Vertragsbedingungen",
          },
        }
      : {}),
    subject:
      kind === "contract_change"
        ? s.changeKind === "restore"
          ? "Deine Chaarlie-Mitgliedschaft wird fortgesetzt"
          : "Deine geänderte Chaarlie-Mitgliedschaft"
        : "Dein Chaarlie-Test ist gestartet",
    receipt_text: `${contract}\n${kind === "contract_change" ? `Änderung bestätigt am: ${date(s.committedAt!)}\n${s.changeKind === "restore" ? "Deine Kündigung wurde auf deinen Wunsch aufgehoben." : "Deine gewählte Laufzeit wurde geändert."} Es beginnt kein neuer Test; das ursprüngliche Testende bleibt unverändert. Für diese Änderung wurde keine Zahlung ausgelöst.\nÄnderungskennung: ${s.operationId}\n` : ""}Vertragsbestätigung / Konditionen ${s.termsVersion}\nAutorisierung bestätigt am: ${date(s.authorizedAt)}\nDein kostenloser Test dauert ${s.provider === "paypal" ? "mindestens " : ""}7 Tage und endet am ${date(s.trialEndAt)}. ${s.cancelAtPeriodEnd ? "Deine Kündigung bleibt wirksam. Dein Zugang endet zum ursprünglichen Testende, ohne dass ein bezahlter Zeitraum beginnt." : s.provider === "paypal" ? `Die erste Zahlung ist für den ${dateOnly(paypalTrialCollectionStart(s.trialEndAt))} vorgesehen, sofern du nicht vorher kündigst.` : "Die erste Zahlung ist zu diesem Zeitpunkt vorgesehen, sofern du nicht vorher kündigst."} Jetzt wurden 0,00 € berechnet.\n${s.cancelAtPeriodEnd ? "Vereinbarte Preise, falls du deine Mitgliedschaft später ausdrücklich fortsetzt: " : ""}${paymentTerms}\nAlle genannten Beträge sind Gesamtpreise einschließlich anwendbarer Steuern. Zahlungsanbieter: ${s.provider === "stripe" ? "Stripe" : "PayPal"}. Die erste volle bezahlte Laufzeit beginnt erst nach erfolgreicher Zahlung. Während die erste Zahlung eingezogen wird, bleibt dein Zugang zunächst bestehen; bei fehlgeschlagener Zahlung endet der Zugang spätestens drei Tage nach dem oben genannten Testende und der Mitgliederinhalt bleibt bis zum bestätigten Zahlungserfolg gesperrt.\n\nKündigung während des Tests: jederzeit bis zum oben genannten Testende. Der Zugang bleibt bis dahin bestehen; es beginnt kein bezahlter Zeitraum. ${s.interval === "year" ? "Du kannst vor der ersten jährlichen Fortsetzung zum Ende des ersten bezahlten Jahres kündigen." : "Nach dem ersten bezahlten Monat kannst du jederzeit mit einer Frist von höchstens einem Monat kündigen."}\n${management}\n\nLeistung und weitere Vertragsbedingungen\nAnbieter: Haarmony LLC, 1111B S Governors Ave # 84075, Dover, DE 19904, USA, info@chaarlie.de.\nChaarlie ist ein digitaler Beratungsservice für Haarpflege. Auf Grundlage deines Selbsttests erhältst du individuelle Haarpflege-Empfehlungen, konkrete Produktempfehlungen und einen KI-Berater. Die Empfehlungen basieren auf deinen Angaben; mache beim Selbsttest und bei der Anmeldung wahrheitsgemäße Angaben. Chaarlie ist kein medizinisches Produkt und ersetzt keine ärztliche oder dermatologische Beratung.\nDer Vertrag wird über den verbindlichen Bestellschritt beim Zahlungsanbieter geschlossen. Das kostenlose Testangebot gilt einmalig; ein fehlgeschlagener oder abgebrochener Versuch ohne aktivierten Test verbraucht es nicht. Eine Ablehnung des Tests löst keinen kostenpflichtigen Vertrag aus.\nDie Inhalte sind urheberrechtlich geschützt. Du erhältst ein einfaches, nicht übertragbares Nutzungsrecht für die Vertragsdauer. Die vereinbarten Konditionen anderer, bereits bestehender Verträge bleiben unverändert.\n\n${withdrawal}\n\nAllgemeine Geschäftsbedingungen (Stand September 2026)\n${TRIAL_REQUIRED_NOTICE_TERMS_V1}\n\nWeitere Informationen: https://chaarlie.de/agb und https://chaarlie.de/datenschutz. Bewahre diese E-Mail als dauerhafte Bestätigung deiner vereinbarten Konditionen auf.`,
  }
}
