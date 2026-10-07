import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  parsePublicContractDeclaration,
  type PublicContractDeclarationReceipt,
} from "./public-contract-declaration"

export type PublicDeclarationClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

/** Only records assertions and queues a receipt. Matching and provider changes require a separate trusted workflow. */
export async function submitPublicContractDeclaration(
  input: unknown,
  client: PublicDeclarationClient = createAdminClient(),
): Promise<PublicContractDeclarationReceipt> {
  const declaration = parsePublicContractDeclaration(input)
  if (!declaration) throw new Error("Invalid public declaration")
  const { requestId, ...payload } = declaration
  const { data, error } = await client.rpc("submit_public_contract_declaration", {
    p_request_id: requestId,
    p_payload: payload,
  })
  if (error) throw new Error("Public declaration persistence unavailable")
  const row = Array.isArray(data) && data.length === 1 ? (data[0] as Record<string, unknown>) : null
  if (
    !row ||
    typeof row.declaration_id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(row.declaration_id) ||
    typeof row.submitted_at !== "string" ||
    !Number.isFinite(Date.parse(row.submitted_at))
  ) {
    throw new Error("Invalid public declaration receipt")
  }
  return { declarationId: row.declaration_id, submittedAt: row.submitted_at, declaration }
}
