Daily check-in: review priorities, plan today's work.

## Context
Read the current priorities file:
!`cat "/Users/nickrupprechter/.claude/projects/-Users-nickrupprechter-Desktop-AI-work-hair-conscierge/memory/PRIORITIES.md" 2>/dev/null || echo "No priorities file found."`

Today's date: !`date +%Y-%m-%d`

## Instructions

1. **Show current state** — Display a clean summary of the priorities file:
   - What was completed last session
   - What's still open / in progress
   - Any items that have been sitting for a while

2. **Ask for today's input** — Ask the user:
   - What tasks are on your plate today?
   - Any new items to add?
   - Anything to drop or deprioritize?

   If the user provided $ARGUMENTS, treat that as their initial task list for today instead of asking.

3. **Prioritize together** — Once you have the tasks:
   - Suggest a priority order (considering dependencies, quick wins, blockers)
   - Discuss briefly if anything seems off
   - Agree on the final order

4. **Update the file** — Write the updated PRIORITIES.md to the memory directory with this structure:
   ```
   # Hair Concierge - Priorities

   *Last check-in: YYYY-MM-DD*

   ## Today's Focus
   - [ ] Priority 1 (highest impact)
   - [ ] Priority 2
   - [ ] ...

   ## Backlog
   - Items not planned for today but worth tracking

   ## Recently Completed
   - [x] Item (completed YYYY-MM-DD)
   ```

   Keep "Recently Completed" trimmed to the last ~10 items.

5. **Wrap up** — Give a short, motivating summary of the plan. Keep it natural.

## Rules
- Be concise. This is a quick morning ritual, not a planning marathon.
- If there are no carried-over priorities, just ask what's on the plate today.
- Respect the user's judgment on priority — suggest, don't insist.
- Use the TaskCreate tool to create tasks for today's focus items so progress is visible during the session.
