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

## Daily use

- The morning task writes `data/quizzes/YYYY-MM-DD-<concept>.md`.
- Read the primer, type answers after each `**Your answer:**`.
- In a Claude session, say **"grade me"**.

## Commands

| Command | What it does |
|---|---|
| `study next-topic` | Print the next category and concept as JSON |
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
