import type { CustomerIoTransactionalEmailPayload } from "./transactional"

export const SCANNER_RESULT_ARTIFACT_MESSAGE_ID_ENV =
  "CUSTOMERIO_SCANNER_RESULT_TRANSACTIONAL_MESSAGE_ID"

export type ResultArtifactEmailKind = "organic" | "scanner"

export interface ScannerResultArtifactEmailInput {
  leadId: string
  email: string
  siteUrl: string
}

function resultUrl(siteUrl: string, leadId: string): string {
  const url = new URL(`/result/${encodeURIComponent(leadId)}`, siteUrl)
  url.searchParams.set("entry", "result_email")
  return url.toString()
}

export function getScannerResultArtifactMessageId(): string | number {
  const configured = process.env[SCANNER_RESULT_ARTIFACT_MESSAGE_ID_ENV]?.trim()
  if (!configured) {
    throw new Error(`${SCANNER_RESULT_ARTIFACT_MESSAGE_ID_ENV} must be configured`)
  }
  return /^\d+$/.test(configured) ? Number(configured) : configured
}

export function buildScannerResultArtifactEmailPayload(
  input: ScannerResultArtifactEmailInput,
): CustomerIoTransactionalEmailPayload {
  return {
    to: input.email.trim(),
    transactionalMessageId: getScannerResultArtifactMessageId(),
    messageData: {
      lead_id: input.leadId,
      result_url: resultUrl(input.siteUrl, input.leadId),
    },
  }
}
