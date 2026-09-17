# Daily scheduled task template

Install to `~/.claude/scheduled-tasks/study-daily/SKILL.md`, replacing `<KIT_ROOT>` with
the absolute path to your kit (for example `/Users/mk/Development/MWI/study-sesh`).

Schedule: weekday mornings — suggested cron `0 6 * * 1-5` (6am, local time; see the
README's Scheduling section for how this maps to a Claude Desktop scheduled task).

```markdown
---
name: study-daily
description: Generate today's backend study quiz
---

Generate today's backend engineering study quiz.

1. Change to the kit at <KIT_ROOT>.
2. Invoke the `study-generate` skill at `skills/study-generate/SKILL.md` and follow it
   exactly.
3. Report only the concept name and the quiz file path.

If the skill reports that today's quiz already exists, say so and stop. Do not generate a
second quiz for the same day.
```

This template is deliberately thin. All real logic lives in the kit, so improving the
generator never means editing a file under `~/.claude`.
