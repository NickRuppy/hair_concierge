import "server-only"

import { createHash } from "node:crypto"
import type { ResearchAction, ResearchDetail, ResearchEvidence, ResearchStatus } from "./model"

export function sealDetail(detail: Omit<ResearchDetail, "displayFingerprint">): ResearchDetail {
  return {
    ...detail,
    displayFingerprint: createHash("sha256").update(JSON.stringify(detail)).digest("hex"),
  }
}

export function nativeStatus(status: string): ResearchStatus {
  if (status === "approved") return "approved"
  if (status === "excluded") return "excluded"
  if (status === "rework_open" || status === "rework_requested") return "rework"
  return "open"
}

export function compactName(name: string, brand: string): string {
  const withoutBrand = name.toLowerCase().startsWith(brand.toLowerCase())
    ? name.slice(brand.length).trim()
    : name
  return (
    withoutBrand
      .split(",")[0]
      ?.replace(/\s*\((?:official|current name)[\s\S]*$/i, "")
      .trim() || name
  )
}

export function compactPackSize(value: string): string {
  return value.length > 70 ? "Größe unbestätigt · siehe Produktakte" : value
}

export function shortOriginal(text: string | null | undefined, max = 260): string | null {
  if (!text?.trim()) return null
  const clean = text.replace(/^Re-derived under v[\s\S]{0,200}?[.!?](?=\s)/i, "").trim()
  const end = [...clean.matchAll(/[.!?](?=\s|$)/g)].find(
    (match) =>
      match.index >= 20 &&
      !/(?:\bbzw|\bca|\bggf|\bNr|\bvs|\bz|\bd|\bu|\bB|\bh|\ba)\.$/i.test(
        clean.slice(0, match.index + 1),
      ),
  )
  const sentence = end ? clean.slice(0, end.index + 1) : clean
  return sentence.length <= max ? sentence : `${sentence.slice(0, max).replace(/\s+\S*$/, "")}…`
}

export function evidence(title: string, original: unknown): ResearchEvidence {
  return { title, original: original ?? null }
}

export function propertyActions(input: {
  itemId: string
  propertyId: string
  approved: boolean
  enabled: boolean
  extra?: Record<string, unknown>
}): ResearchAction[] {
  const body = { itemId: input.itemId, propertyPath: input.propertyId, ...input.extra }
  return [
    {
      id: `approve:${input.propertyId}`,
      label: "Freigeben",
      kind: "approve",
      propertyId: input.propertyId,
      enabled: input.enabled && !input.approved,
      nativeBody: { ...body, action: "approve_property" },
    },
    {
      id: `rework:${input.propertyId}`,
      label: "Nacharbeit",
      kind: "rework",
      propertyId: input.propertyId,
      enabled: input.enabled,
      nativeBody: { ...body, action: "request_rework" },
    },
  ]
}

export function completionActions(input: {
  itemId: string
  canApprove: boolean
  canApproveBoundary: boolean
  excluded: boolean
  openCount: number
  extra?: Record<string, unknown>
}): ResearchAction[] {
  if (input.excluded)
    return [
      {
        id: "boundary",
        label: "G0-Ausschluss bestätigen",
        kind: "boundary",
        enabled: input.canApproveBoundary,
        confirmation: "Den Produktform-Ausschluss für diese Formelversion bestätigen?",
        nativeBody: { itemId: input.itemId, action: "approve_boundary", ...input.extra },
      },
    ]
  return [
    {
      id: "complete",
      label: input.openCount
        ? `Alle ${input.openCount} offenen Eigenschaften freigeben`
        : "Produktprüfung abschließen",
      kind: "complete",
      enabled: input.canApprove,
      confirmation: input.openCount
        ? `Alle ${input.openCount} verbleibenden Eigenschaften und diese Produktprüfung freigeben? Dies ist nur eine lokale Lab-Freigabe.`
        : "Diese Produktprüfung im lokalen Lab abschließen?",
      nativeBody: { itemId: input.itemId, action: "approve_product", ...input.extra },
    },
  ]
}
