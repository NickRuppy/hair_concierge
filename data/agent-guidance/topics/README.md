# Topic Guidance

This folder is the runtime-facing topic layer for the bounded-agent experiment.

Each topic is split into small modules:
- `core-fit.md`
- `response-playbook.md`
- `guardrails.md`
- optional `confusions.md`

These files are distilled from the human-editable source docs in:
- `docs/human-summaries/<topic>.md`

Important:
- this folder is the right place for runtime-safe topic guidance
- a file living here does not make it live automatically
- a topic only becomes loadable after it is registered in the bounded-agent code path

Current use:
- groundwork only
- not yet wired for `bond-builder` or `hair-oiling`
