# study-sesh

A daily study loop over the Backend Engineering Core Learning Roadmap. Each morning a
scheduled task picks the next concept in rotation, researches it, and writes a short
primer plus a quiz. You answer in the file whenever you like; later you ask Claude to
grade it. A weekly review re-tests what you got wrong.

## Setup

```bash
git clone <this repo>
cd study-sesh
./bin/study init
```

`init` writes `config.json` (gitignored) and scaffolds your data directory. Pass
`--data-dir /some/path` to keep your data outside the repo.

Then install the scheduled tasks:

1. Copy the template in `runners/local-task.md` to
   `~/.claude/scheduled-tasks/study-daily/SKILL.md`, replacing `<KIT_ROOT>`.
2. Copy `runners/weekly-task.md` to `~/.claude/scheduled-tasks/study-weekly/SKILL.md`.
3. Schedule the daily task for weekday mornings and the weekly task once a week.

### Scheduling

Scheduled tasks are a Claude Desktop feature: ask Claude in the desktop app to create a
scheduled task pointing at the template, or use the app's own scheduled-tasks UI. Either
way, the task ends up stored as `~/.claude/scheduled-tasks/{taskId}/SKILL.md` — the exact
file the steps above tell you to write.

The schedule itself is a standard 5-field cron expression evaluated in **local** time, not
UTC. Weekday mornings at 6am is `0 6 * * 1-5`; a Saturday-morning weekly review at 9am is
`0 9 * * 6`.

Tasks only run while the desktop app is open. If the app is closed when one is due, it runs
on next launch instead — which is why a missed morning is a harmless no-op rather than a
lost day, and why the generator's idempotency check matters.

## Daily use

- The morning task writes `<dataDir>/quizzes/YYYY-MM-DD-<concept>.md`, where `<dataDir>` is
  whatever `config.json` points at (`data/` by default).
- Read the primer, type answers after each `**Your answer:**`.
- In a Claude session started in this repo, say **"grade my quiz — follow
  `skills/study-grade/SKILL.md`"**. Naming the path is what makes this work on a fresh
  clone; see below if you want a shorter trigger.

### Optional: enable `/grade`

Claude Code discovers skills at `.claude/skills/<name>/SKILL.md`. This kit ships its
skills at `skills/` instead, so that they travel with the repo rather than being written
into your Claude config. Nothing is installed for you.

If you want `grade me` and `/grade` to fire on their own, install them yourself — copy or
symlink both directories:

```bash
mkdir -p .claude/skills
ln -s ../../skills/study-grade    .claude/skills/study-grade
ln -s ../../skills/study-generate .claude/skills/study-generate
```

That is a local choice. Without it, referring to the skill by path (above) works
everywhere, including in the scheduled tasks, which name the path explicitly.

## Commands

| Command | What it does |
|---|---|
| `study next-topic` | Print the next category and concept as JSON. Read-only — safe to run just to look |
| `study next-topic --commit` | Same, and advance the rotation cursor. The generator runs this only after the quiz file exists |
| `study record-result` | Append a JSON array of graded results from stdin |
| `study review-set --count N` | Print a weighted retention sample |
| `study status` | Coverage report and weakest concepts |
| `study init` | Scaffold config and data directory |

## How rotation works

Categories are visited in `syllabus/concept-bank.json` order, one per day. Within a
category, the first concept with no results is chosen. After the last category, the round
increments and the cycle repeats with concepts you have not seen. When a category runs out
of concepts, the generator researches new ones and appends them to the bank.

## Your data

Everything personal lives in the gitignored data directory:

- `state.json` — rotation cursor only.
- `results.jsonl` — append-only, one line per graded question.
- `quizzes/` — one markdown file per quiz; answer keys in `quizzes/.keys/`.

Coverage and scores are always recomputed from `results.jsonl`, so there is no derived
state to drift. Nothing personal is ever committed to this repo.

## Development

```bash
npm test
```

No dependencies, no build step. Node 20 or newer.
