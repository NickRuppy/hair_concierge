/** Public declarations contain only the submitter's own assertions, never account facts. */
export type PublicDeclarationKind =
  | "ordinary_cancellation"
  | "extraordinary_cancellation"
  | "withdrawal"

export type PublicContractDeclarationInput = {
  requestId: string
  kind: PublicDeclarationKind
  name: string
  email: string
  contract: string
  requestedEnd: string | null
  reason: string | null
}

export type PublicContractDeclarationReceipt = {
  declarationId: string
  submittedAt: string
  declaration: PublicContractDeclarationInput
}

export function parsePublicContractDeclaration(
  value: unknown,
): PublicContractDeclarationInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const keys = ["requestId", "kind", "name", "email", "contract", "requestedEnd", "reason"]
  if (Object.keys(row).length !== keys.length || keys.some((key) => !Object.hasOwn(row, key)))
    return null
  if (
    typeof row.requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.requestId)
  )
    return null
  if (
    !["ordinary_cancellation", "extraordinary_cancellation", "withdrawal"].includes(
      String(row.kind),
    )
  )
    return null
  const text = (raw: unknown, max: number) =>
    typeof raw === "string" &&
    raw.trim().length > 0 &&
    raw.length <= max &&
    !/[\p{Cc}\p{Cf}]/u.test(raw)
      ? raw.trim()
      : null
  const name = text(row.name, 200),
    email = text(row.email, 254)?.toLowerCase(),
    contract = text(row.contract, 500)
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !contract) return null
  const kind = row.kind as PublicDeclarationKind
  const requestedEnd = row.requestedEnd === null ? null : text(row.requestedEnd, 200)
  const reason = row.reason === null ? null : text(row.reason, 2000)
  if (
    (row.reason !== null && reason === null) ||
    (row.requestedEnd !== null && requestedEnd === null)
  )
    return null
  if (kind === "withdrawal" ? requestedEnd !== null || reason !== null : requestedEnd === null)
    return null
  if (kind !== "extraordinary_cancellation" && reason !== null) return null
  return {
    requestId: row.requestId.toLowerCase(),
    kind,
    name,
    email,
    contract,
    requestedEnd,
    reason,
  }
}

export function publicDeclarationStatement(declaration: PublicContractDeclarationInput): string {
  if (declaration.kind === "withdrawal") return "Hiermit widerrufe ich den angegebenen Vertrag."
  const type = declaration.kind === "ordinary_cancellation" ? "ordentlich" : "außerordentlich"
  return `Hiermit kündige ich den angegebenen Vertrag ${type}. Gewünschtes Vertragsende: ${declaration.requestedEnd}.`
}

/** Exact durable plain-text snapshot used by download and transactional delivery. */
export function publicDeclarationReceiptText(receipt: PublicContractDeclarationReceipt): string {
  const d = receipt.declaration
  return [
    "Chaarlie · Haarmony LLC",
    "Eingangsbestätigung",
    `Erklärungsnummer: ${receipt.declarationId}`,
    `Eingang (UTC): ${receipt.submittedAt}`,
    `Name: ${d.name}`,
    `E-Mail für die Bestätigung: ${d.email}`,
    `Vertrag (deine Angabe): ${d.contract}`,
    publicDeclarationStatement(d),
    ...(d.reason ? [`Kündigungsgrund: ${d.reason}`] : []),
    d.kind === "withdrawal"
      ? "Diese Bestätigung dokumentiert den Eingang deines Widerrufs. Die Zuordnung und Abwicklung werden geprüft."
      : "Diese Bestätigung dokumentiert den Eingang deiner Kündigung. Nach sicherer Zuordnung bestätigen wir dir das Vertragsende.",
    "Kontakt: info@chaarlie.de",
  ].join("\n")
}
