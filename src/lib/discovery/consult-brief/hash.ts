import { semanticHash } from "@/lib/personal-plan/routine/canonicalize"

import type { ConsultInput } from "./input"

/**
 * The consult brief's `source_hash` (consult-agent T2): sha256 over the key-sorted canonical
 * JSON of the assembled input — the same canonicalization the routine fingerprint uses. A
 * verdict change, a finished research, a new score or new knowledge move it; key order does
 * not. `v` versions the assembly: bump it when the input's meaning changes, so every stored
 * brief reads as stale once rather than silently matching.
 */
export const CONSULT_INPUT_VERSION = 1

export function consultSourceHash(input: ConsultInput): string {
  return semanticHash({ v: CONSULT_INPUT_VERSION, input })
}
