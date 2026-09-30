import { semanticHash } from "@/lib/personal-plan/routine/canonicalize"

import type { ConsultInput } from "./input"
import { CONSULT_BRIEF_PROMPT_VERSION } from "./prompt"

/**
 * The consult brief's `source_hash` (consult-agent T2): sha256 over the key-sorted canonical
 * JSON of the assembled input — the same canonicalization the routine fingerprint uses. A
 * verdict change, a finished research, a new score or new knowledge move it; key order does
 * not. `v` versions the assembly: bump it when the input's meaning changes, so every stored
 * brief reads as stale once rather than silently matching. `prompt` does the same for the
 * OUTPUT contract (Codex review, consult-iteration-2): a prompt/schema bump makes every
 * stored brief stale, so a v3 brief without `mechanik`/buckets never reads as current.
 */
export const CONSULT_INPUT_VERSION = 1

export function consultSourceHash(
  input: ConsultInput,
  promptVersion: string = CONSULT_BRIEF_PROMPT_VERSION,
): string {
  return semanticHash({ v: CONSULT_INPUT_VERSION, prompt: promptVersion, input })
}
