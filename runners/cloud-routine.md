# Cloud routine template (documented, not wired)

The kit resolves every path from `config.json`, so the same code runs from a cloud
routine. This is not set up by default — the local task is the supported path today.

To run in the cloud you need two repositories:

1. **The kit** — this repository, public or private.
2. **A private data repository** — holds `state.json`, `results.jsonl`, and `quizzes/`.
   Never the same repo as the kit, because the kit is shareable and this is not.

The routine:

1. Clone both repositories.
2. Write a `config.json` in the kit whose `dataDir` points at the data clone.
3. Invoke `skills/study-generate/SKILL.md` exactly as the local task does.
4. Commit and push the new quiz file, key, and any `concept-bank.json` additions.

Because `results.jsonl` is append-only and quizzes are one file per day, a data repo
synced across a laptop and a cloud runner merges without conflicts.

Grading stays interactive and therefore local — a cloud routine cannot wait for answers.
Pull the data repo before grading and push after.
