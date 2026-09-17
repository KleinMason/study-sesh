---
name: study-grade
description: Grade a completed backend study quiz — score answers against the key, explain every miss, and record results. Use when the user asks to grade a quiz, or points at this file by path. (Only fires on "grade me" or /grade if the user has installed this directory under .claude/skills/; the kit does not install itself.)
---

# Grade a study quiz

## Step 1 — Find the work

The kit root is the parent directory of this skill's `skills/` folder. A human invokes
this skill from wherever they happen to be, so resolve that path before reading anything
else — do not assume the current working directory is the kit.

Read `config.json` at the kit root for `dataDir`.

A quiz is **ungraded** when `results.jsonl` contains no entries whose `quiz` field matches
its id. Collect every quiz file in `<dataDir>/quizzes/` that is ungraded and has at least
one non-empty `**Your answer:**` line.

- None found: say so and stop. Do not invent work.
- One found: grade it.
- Several found: say how many are waiting, then grade the **oldest** first.

## Step 2 — Read the quiz and its key

Load the quiz markdown and the matching `<dataDir>/quizzes/.keys/<id>.json`.

Extract the user's answer for each question from the text after `**Your answer:**`.

## Step 3 — Score

**Multiple choice** is mechanical. The answer matches the key's `correct` option or it
does not. `score` is `1` or `0`, `correct` is `true` or `false`. Do not award partial
credit because the reasoning was close. Do not reinterpret a clearly wrong letter.

Normalize before comparing, so that formatting never decides a grade:

1. Trim leading and trailing whitespace.
2. Lowercase.
3. Strip one trailing `)` if present.

`a`, `A`, `a)`, `A)` and ` a ` all normalize to `a`. If the result is not one of the
option letters, try to match it against the full option **text** under the same
normalization — a user who typed the option out instead of its letter answered the
question. If after all that the answer still does not resolve to exactly one option —
it is blank, it names two options, or it matches none — treat it as **unanswered**, per
the rule below. Never guess which option was meant, and never mark it wrong for being
unparseable: a silent mis-grade permanently poisons the retention weighting.

**Short answer** is scored against the rubric. Award `hitPoints / totalPoints`, rounded to
two decimals — two of three rubric points is `0.67`. Set `correct` to `null` and `type` to
`"short"`.

**Unanswered** questions are recorded as skipped, not wrong, so retention weighting can
tell "did not get to it" apart from "does not understand it". Record exactly:

- `"score": 0`
- `"correct": false` — for **both** `mc` and `short` questions. `correct: null` is
  rejected by `record-result` for `mc` entries, and a blank multiple-choice question is
  the common case, so the whole batch would fail. `false` here means "no correct answer
  was given", and is not what marks the question wrong.
- `"note": "skipped"` — the exact string, lowercase, nothing appended. `lib/results.js`
  matches it literally; `"skipped - ran out of time"` is read as an ordinary wrong answer.

A skipped question is excluded from the concept's mean score and from its `misses`, and a
concept whose every question was skipped is never drawn into a weekly review.

## Step 4 — Give feedback

For each **miss**, three short parts:
1. The correct answer.
2. Why the chosen option is wrong — the key stores the misconception behind each
   distractor, so name it specifically rather than generically.
3. The primer paragraph to re-read, plus the relevant "Go deeper" link.

For each **correct** answer, one line of confirmation. No lecture.

For each **skipped** question, give the correct answer and the primer paragraph, and say
it was not scored against the concept. "Excluded from `misses`" is a retention-weighting
rule, not a reason to withhold the explanation.

For the **short answer**, name which rubric points were hit and which were missed. The
user should be able to see exactly what was missing, not just a number.

End with the total: `X.X / N`.

## Step 5 — Record

Build a JSON array of entries, one per question:

```json
[
  {
    "ts": "<ISO 8601 UTC timestamp>",
    "quiz": "<quiz id>",
    "categoryId": "<from the key>",
    "conceptId": "<from the key>",
    "q": 1,
    "type": "mc",
    "correct": false,
    "score": 0,
    "note": "picked the pick-any-two option"
  }
]
```

Pipe it to the CLI — never write `results.jsonl` directly:

```bash
echo '<json array>' | ./bin/study record-result
```

If the command exits non-zero, show the user the validation errors and fix the entries.
Nothing was written, so it is safe to retry.

## Step 6 — Handle a contested grade

If the user pushes back on a grade with a technical argument, **research the point**. Do
not simply capitulate, and do not simply defend the key.

- **The user is right:** say so plainly, then append a correction entry — the same `quiz`
  and `q`, the corrected `score` and `correct`, plus `"corrects": true` and a note saying
  what the key got wrong. The log is append-only; scoring uses the latest entry for a
  question, so the correction supersedes the original.
- **The user is wrong:** show the source that settles it. One quote or link, not a lecture.

This rule exists because the roadmap this curriculum came from contained four genuinely
incorrect claims. An answer key is no more infallible, and a study tool that cannot be
corrected teaches its own errors.

## Step 7 — Weekly review

A review file grades identically. Its questions span several concepts, so read each
question's `conceptId` and `categoryId` from the key per question rather than from the
file header. Results record against the original concept ids, which is what re-weights a
missed concept upward.
