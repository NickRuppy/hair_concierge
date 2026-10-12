import { semanticHash } from "@/lib/personal-plan/routine/canonicalize"

import type { ConsultInput } from "./input"
import type { ConsultSourcePart } from "./source-parts"
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

/**
 * The input split into the parts a consultant recognises (consult-brief-d item 3): stored with
 * the brief, so a stale brief can say WHAT changed. Every ConsultInput key belongs to exactly
 * one part (a test pins it); `version` carries the assembly and prompt versions.
 */

export const CONSULT_SOURCE_PART_KEYS: Readonly<
  Record<Exclude<ConsultSourcePart, "version">, ReadonlyArray<keyof ConsultInput>>
> = {
  produkte: ["products"],
  checkliste: ["checklist"],
  profil: ["profile", "mainConcern", "flags", "boundaryTriggers"],
  hitze: ["heat", "heatProtection"],
  waschen: ["washFrequency"],
  wissen: ["knowledge"],
  score: ["baselineScore"],
}

export function consultSourceParts(
  input: ConsultInput,
  promptVersion: string = CONSULT_BRIEF_PROMPT_VERSION,
): Record<ConsultSourcePart, string> {
  const parts = Object.fromEntries(
    Object.entries(CONSULT_SOURCE_PART_KEYS).map(([part, keys]) => [
      part,
      semanticHash(Object.fromEntries(keys.map((key) => [key, input[key]]))),
    ]),
  ) as Record<Exclude<ConsultSourcePart, "version">, string>
  return {
    ...parts,
    version: semanticHash({ v: CONSULT_INPUT_VERSION, prompt: promptVersion }),
  }
}
