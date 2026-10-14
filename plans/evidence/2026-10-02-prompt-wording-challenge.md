# Challenge: final-render prompt static assertions

## Boundary

`AGENTIC_TOOL_LOOP_PROMPT` and `AGENT_FINAL_RENDER_PROMPT` are fallback strings registered in `src/lib/langfuse/prompts.ts:37-47`, but no versioned prompt-byte specification or external protocol was found. Their use by an LLM does not make section headings and editorial phrasing immutable bytes. Executable counterparts include tool-loop behavior in `tests/agentic-tool-loop.spec.ts`, structured AnswerContext cases in `tests/agent-final-render-prompt.spec.ts:84-696`, and AgentV2 terminal validation/runtime suites. These do **not** prove every classic renderer instruction.

## D — high-confidence implementation/source-organization assertions

| Declaration | Exact fragments | Why low value | Keeper after deletion / mutation |
|---|---|---|---|
| `tests/agent-final-render-prompt.spec.ts:64` `agentic tool-loop prompt is organized by priority sections` | `# Rolle und Auftrag`, `# Prioritaet und Quellen`, `# Tool-Entscheidung`, `# Antwort-Komposition` | It asserts private `joinPromptSections` organization only. A behavior-preserving reordering/renaming fails. No documented byte authority. | No semantic transfer needed; tool/runtime behavior remains owned by `tests/agentic-tool-loop.spec.ts` and structured validators. Delete this declaration only. |
| `tests/agent-final-render-prompt.spec.ts:725` `final render prompt uses the rewritten section hierarchy` | seven `# ...` headings | Same private source layout assertion. It does not exercise renderer output, route packet, or a managed-prompt version. | No semantic transfer needed. Delete this declaration only. |

## R — static rows with meaningful remaining authority

* `:33` current-intent/state precedence; `:39` tool-sourced products/terminal answers; `:47` German/internal-label prohibition; `:52,:58,:71,:77` model-visible protocol fields and authority. These lack complete classic-runtime enforcement, so deleting them would drop fallback prompt protocol coverage.
* `:718,:735,:741,:746,:753,:767,:773,:784,:791,:798,:806,:817` retain: packet shape removal, secrecy, policy, medical/scalp/oil boundaries, tool-result ordering, profile deviation, split-end and dry-shampoo rules are substantive response constraints. They may be prompt bytes today, but no stronger classic final-render executor proves their presence.
* `:760` conceptual oil personalisation; `:779` spray-versus-cream distinction: low-level editorial wording, but still the only explicit classic-renderer behavior check. Mark R pending an output-level replacement, not D.

## F/C

No C: regrouping static assertions is excluded. No F beyond the two hierarchy declarations. A future stronger keeper would be a deterministic final-render packet contract or recorded eval, not more regexes.

## Focused validation after the two D removals

`node --import ./tests/server-only-register.cjs --import tsx --test tests/agent-final-render-prompt.spec.ts tests/agentic-tool-loop.spec.ts`
