# Case Template

## Investigation packet

- Original report: verbatim text and attachment references
- Observed / expected behavior
- Route, environment, device or viewport, timestamp, release or commit
- User state, transcript or payload needed to reproduce
- Impact, frequency, workaround, and severity
- Known facts, unknowns, and expected-behavior authority
- Privacy/redaction check
- Linear issue and related evidence links

For LLM reports, include the full ordered transcript plus trace/request ID, model, prompt/tool/RAG state, and user context when available.

## Linear issue body

```markdown
## Report
<verbatim sanitized report and attachments>

## Expected / observed
<expected>
<observed>

## Context and impact
<environment, frequency, affected users, severity>

## Reproduction and evidence
<status, steps or oracle, links>

## Investigation outcome
<pending | confirmed defect | needs evidence | mitigation required | expected behavior / improvement | duplicate>
```

Add milestone comments for diagnosis, decisions/plan, PR, and final verification rather than repeatedly replacing the source report.

## Evidence ledger

Ledger states describe individual claims and are independent of the issue-level investigation outcome.

| Claim or hypothesis | State | Probe or evidence | Result |
| --- | --- | --- | --- |
| ... | reported / reproduced / inferred / confirmed / disproven | ... | ... |

## Decision brief

For each of the five fixed headings, record:

- Status: resolved by evidence / not applicable / needs user decision
- Recommendation and why
- Options and tradeoffs only when a real fork remains
- Acceptance evidence affected by the choice
