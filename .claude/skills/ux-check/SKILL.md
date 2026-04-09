---
name: ux-check
description: UX audit of a live user flow using Playwright — evaluates against Nielsen's heuristics, German UI quality, and interaction quality. Produces a severity-rated issue list with annotated screenshots.
---

# UX Check

You are performing a structured UX audit of a live web application using Playwright MCP tools.

## Input

The user provides:
- **URL** — the starting page (e.g. `http://localhost:3000/quiz`)
- **Flow description** — a natural-language description of what to walk through (e.g. "Complete the 7-step hair quiz from landing to result")

If the user only provides a URL, ask what flow to test before proceeding.

## Procedure

### 1. Set up output directory

Create the output folder using Bash:
```
./ux-audits/{YYYY-MM-DD}-{flow-slug}/screenshots/
```
Use today's date. Derive `flow-slug` from the flow description (lowercase, hyphens, max 30 chars).

### 2. Run the audit at both viewports

Perform **two full passes** of the flow:

| Pass | Viewport | Label |
|------|----------|-------|
| 1 | 375 x 812 | mobile |
| 2 | 1440 x 900 | desktop |

For each pass:

1. **Navigate** — Use `browser_navigate` to open the start URL
2. **Resize** — Use `browser_resize` to set the viewport
3. **For each step in the flow:**
   a. `browser_snapshot` — read the DOM to understand the page state
   b. `browser_take_screenshot` — capture visual evidence, save to `screenshots/{NN}-{viewport}-{step-name}.png`
   c. **Evaluate** the current state against the checklist (Section 3)
   d. **Interact** — use `browser_click`, `browser_fill_form`, `browser_press_key`, `browser_select_option` as needed to advance the flow
   e. `browser_wait_for` — wait for navigation or content changes to settle
4. After completing the flow, `browser_close`

**Interaction rules:**
- Fill forms with realistic German test data (e.g. "Maria Schneider", "maria@test.de")
- Click through all steps; do not skip
- If a step requires authentication, note it as a finding and stop that pass
- If an element is unresponsive, wait up to 5 seconds, retry once, then log as Critical

### 3. Evaluation checklist

At every step, evaluate against these three categories:

#### A. Nielsen's 10 Usability Heuristics

| # | Heuristic | What to check |
|---|-----------|--------------|
| 1 | Visibility of system status | Loading indicators, progress bars, active states, step counters |
| 2 | Match between system and real world | Natural language, familiar concepts, logical order |
| 3 | User control and freedom | Back button, undo, cancel, skip options |
| 4 | Consistency and standards | Same patterns for same actions, platform conventions |
| 5 | Error prevention | Disabled invalid actions, confirmation for destructive ops, clear constraints |
| 6 | Recognition rather than recall | Visible options, contextual help, no memory burden |
| 7 | Flexibility and efficiency | Shortcuts for experts, sensible defaults |
| 8 | Aesthetic and minimalist design | No irrelevant info, clear hierarchy, breathing room |
| 9 | Error recovery | Clear error messages, how to fix, no dead ends |
| 10 | Help and documentation | Tooltips, labels, instructions where needed |

#### B. German UI / Copy Quality

- **All visible text must be in German** — flag any English strings, placeholder text, or untranslated UI framework defaults
- **Terminology** — the project uses specific German vocabulary defined in `src/lib/vocabulary/`:
  - hair_texture (pattern): Glatt / Wellig / Lockig / Kraus
  - thickness (diameter): Fein / Mittel / Dick
  - Haarstruktur, Haardurchmesser, Haardichte, Kopfhaut
- **Consistent tone** — the app uses informal "du" throughout. Flag any "Sie" usage.
- **CTAs** — must be clear, action-oriented German (e.g. "Weiter", "Ergebnis anzeigen", not vague labels)
- **No lorem ipsum, TODO placeholders, or developer-facing text visible to users**

#### C. Interaction Quality

- **Loading states** — any operation > 500ms must show a loading indicator
- **Tap targets** — interactive elements must be >= 44x44px on mobile
- **Form validation** — errors appear inline, immediately, with clear German messages
- **Error recovery** — every error state has a path forward (retry, go back, contact)
- **Layout stability** — no content layout shift (CLS) during navigation or loading
- **Navigation** — back button / browser back works correctly at every step
- **Focus management** — after navigation, focus moves to a logical element (not lost)

### 4. Compile the report

After both passes, write `./ux-audits/{date}-{flow-slug}/report.md` with this structure:

```markdown
# UX Check: {flow name}

**Date:** {YYYY-MM-DD}
**URL:** {start URL}
**Viewports:** 375x812 (mobile), 1440x900 (desktop)
**Flow:** {user's flow description}

## Summary

| Severity | Count |
|----------|-------|
| Critical | N |
| Major | N |
| Minor | N |
| Cosmetic | N |

## Findings

### [CRITICAL] {short title}
- **Category:** {Nielsen #N / German UI / Interaction}
- **Heuristic:** {specific heuristic violated}
- **Viewport:** Mobile / Desktop / Both
- **Step:** {which step in the flow}
- **Screenshot:** `screenshots/{filename}`
- **Description:** {what's wrong and why it matters}
- **Suggested fix:** {specific, actionable recommendation}

---

### [MAJOR] {short title}
...

(repeat for all findings, ordered by severity: Critical > Major > Minor > Cosmetic)
```

### 5. Present results

After saving the report, print a summary to the conversation:
- Total findings by severity
- Top 3 most impactful issues with one-line descriptions
- Path to the full report file

## Severity definitions

| Level | Definition | Example |
|-------|-----------|---------|
| **Critical** | Blocks the user from completing the flow | Button unresponsive, form can't submit, dead-end page |
| **Major** | Significant confusion or frustration | No loading state on 3s+ operation, unclear error, missing back navigation |
| **Minor** | Noticeable but doesn't block task completion | Inconsistent spacing, slightly unclear label, minor copy issue |
| **Cosmetic** | Polish issue, low user impact | Alignment off by pixels, suboptimal word choice, minor visual inconsistency |

## Rules

- Be specific — "The 'Weiter' button on step 3" not "a button"
- Be actionable — every finding needs a suggested fix
- No false positives — only flag issues you are confident about based on what you observed
- Do not invent issues you didn't actually see in the DOM snapshot or screenshot
- If the flow works perfectly, say so — an empty findings list is a valid outcome
