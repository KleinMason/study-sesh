---
name: study-generate
description: Generate the daily backend study quiz — pick the next concept, research it, write a primer and quiz with a separate answer key. Use when the morning scheduled task fires or when the user asks to generate today's quiz.
---

# Generate the daily study quiz

## Step 1 — Resolve paths

The kit root is the parent directory of this skill's `skills/` folder. Read
`config.json` there for `dataDir` and `timezone`. Compute today's date as `YYYY-MM-DD`
in that timezone.

Do not use `toISOString()` or an unqualified `date` command — both return the UTC date,
which is wrong after roughly 6pm Central. Use an IANA-timezone-aware method:
`Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })`,
or `TZ=<timezone> date +%Y-%m-%d`. `lib/config.js` already exports `today(timezone)` which
does exactly this.

## Step 2 — Idempotency check

List `<dataDir>/quizzes/`. Stop only if a file matches **both** conditions:

1. its name starts with today's date (`YYYY-MM-DD`), **and**
2. its name does **not** end in `-review.md`.

So `2026-09-19-optimistic-locking.md` stops today's run; `2026-09-19-review.md` does not.
If a matching file is found, report "Today's quiz already exists: <filename>" and generate
nothing. This makes a double fire harmless and a missed morning a clean no-op.

The `-review` exclusion is load-bearing, not a detail. The weekly task writes
`<dataDir>/quizzes/YYYY-MM-DD-review.md` into the same directory, and a task that was due
while the desktop app was closed runs on next launch — so the weekly and the daily can
fire on the same morning, in either order. A date-prefix-only check lets the weekly review
silently suppress that day's daily quiz.

## Step 3 — Get the topic

Run `bin/study next-topic`. Parse the JSON. This call is read-only: it reports the topic
without advancing the rotation cursor. Committing is a separate step you take in Step 9,
only once the quiz file actually exists — so if research fails or this run dies partway,
tomorrow retries the same category instead of silently skipping it.

If `needsNewConcepts` is `true`:
1. Research 3-5 additional concepts for that category that are not in `coveredConcepts`.
   Each must be narrow enough to teach in 300-500 words.
2. Append them to the category's `concepts` array in `syllabus/concept-bank.json`, using
   kebab-case ids that have never been used before.
3. Run `bin/study next-topic` again and proceed with the result.

## Step 4 — Research the concept

Search the web for the concept. Prefer primary sources: official documentation, RFCs,
database manuals, papers, and named engineering blogs. Reject content farms, SEO
listicles, and AI-generated summary sites.

Keep the 3-5 sources that actually informed what you wrote. Verify every URL you cite
actually loads — a broken link in the primer is a defect.

## Step 5 — Write the primer

600-900 words. A 6-8 minute read. **Self-contained**: every question must be answerable
from the primer alone, without following a link.

Fixed structure, in this order:
1. What the concept is — two or three sentences, no preamble.
2. The mechanism — how it actually works. This is the longest part, and it carries a
   **worked example**: one concrete case with real values, names, or a short snippet.
   Abstract description plus a worked example is the difference between recognising the
   concept and being able to apply it. This is what the extra length is for.
3. When it applies and when it does not.
4. The failure mode it exists to prevent — be concrete.

Then a `### Go deeper` list: each source as a markdown link plus one line on why it earns
the click. Not a bare URL dump.

Write plainly. No motivational framing, no "in today's fast-paced world". The reader is a
working engineer.

### Formatting

These files are read in Obsidian, so Obsidian and GitHub markdown both render. Use the
following where they genuinely help, not on a schedule:

- **One callout at the top**, immediately under `## Primer`, in the form
  `> [!note] <one sentence>`. It holds the concept in a single sentence — what to remember
  if nothing else survives. In a plain editor it degrades to an ordinary blockquote.
- **A table for a contrast.** Many concepts are fundamentally comparisons — optimistic vs
  pessimistic locking, normalization vs denormalization, write-through vs write-behind. A
  three-column table (dimension, option A, option B) beats three paragraphs of prose.
- **A code or config snippet** where the mechanism is clearer as code than as English: a
  `SELECT ... FOR UPDATE`, a retry signature, a cache key format. Keep it under ten lines.
- **Bold on first use** of every term the questions will assume the reader knows.

Do not use all of these in one primer. A wall of decoration reads worse than clean prose.

### Diagrams

Include a Mermaid diagram **only when the concept is structural or sequential** — a layer
stack, a request or message flow, a state machine, a lock timeline, a replication
topology. When the concept is a definition, a naming convention, or a tradeoff argument,
there is nothing to draw: write prose instead. A decorative diagram is worse than none,
because it costs the reader attention and returns nothing.

When one earns its place:

- Fence it as ```mermaid. `flowchart LR`, `sequenceDiagram`, and `stateDiagram-v2` cover
  nearly everything worth drawing here.
- Keep it under about ten nodes. A diagram that needs scrolling has stopped being a
  summary.
- **Caption it** with one line directly underneath saying what to notice — the thing the
  picture shows that the prose cannot. A diagram nobody knows how to read is decoration.
- Never put an answer in a node label. The diagram is part of the primer, and the reader
  sees it before answering.

## Step 6 — Write the questions

Two to four multiple choice, then exactly one short answer.

**Multiple choice rules:**
- Exactly one correct option. Three or four options total.
- **Distractors encode real misconceptions, not filler.** Good distractors are things a
  competent engineer actually believes: "CAP lets you pick any two", "SELECT FOR UPDATE
  blocks plain reads", "Redis is a consensus store", "the outbox gives exactly-once
  delivery". If a distractor is obviously wrong at a glance, replace it.
- No "all of the above", no "none of the above", no joke options.
- Every correct answer must be supported by a specific sentence in the primer.

**Short answer rules:**
- Ask the reader to explain a tradeoff or apply the concept to a scenario. Not a
  definition lookup.
- It must have a rubric: 2-3 specific points a full-credit answer has to hit.

## Step 7 — Write the two files

`<dataDir>/quizzes/YYYY-MM-DD-<concept-id>.md`:

```markdown
# <Concept Name>
Category: <Category Name> · Round <N> · <YYYY-MM-DD>

## Primer

> [!note] <the concept in one sentence>

<what it is — two or three sentences>

<the mechanism, including the worked example. A Mermaid diagram goes here when the
concept is structural or sequential, captioned with one line on what to notice. A
contrast table goes here when the concept is a comparison.>

<when it applies and when it does not>

<the failure mode it prevents>

<600-900 words total>

### Go deeper
- [Title](url) — why this one is worth reading.

## Questions

**1.** <question text>
- a) <option>
- b) <option>
- c) <option>

**Your answer:** 

**2.** <question text>
- a) <option>
- b) <option>
- c) <option>

**Your answer:** 

**3. (short answer)** <question text>

**Your answer:** 
```

`<dataDir>/quizzes/.keys/YYYY-MM-DD-<concept-id>.json`:

```json
{
  "quiz": "YYYY-MM-DD-<concept-id>",
  "categoryId": "<category-id>",
  "conceptId": "<concept-id>",
  "questions": [
    {
      "q": 1,
      "type": "mc",
      "correct": "b",
      "why": "One sentence on why b is right.",
      "distractors": {
        "a": "The misconception this option encodes.",
        "c": "The misconception this option encodes."
      }
    },
    {
      "q": 3,
      "type": "short",
      "rubric": [
        "Names the specific failure the mechanism prevents.",
        "Explains the cost or tradeoff of using it.",
        "Gives a condition under which it is the wrong choice."
      ]
    }
  ]
}
```

**The answer key never goes in the quiz file.** The reader must be able to read the whole
primer without scrolling into answers.

## Step 8 — Self-validate before finishing

Check all of the following. If any fails, fix it before reporting success:
- One key entry exists for every question in the quiz file, with matching `q` numbers.
- Every multiple-choice key entry names exactly one correct option, and that option
  exists in the quiz file.
- Every short-answer key entry has a rubric with 2-3 points.
- Every cited URL was successfully fetched during research.
- The primer is between 600 and 900 words, counting prose only — not the `Go deeper`
  list, and not the contents of code or Mermaid blocks.
- Any Mermaid block is fenced as ```mermaid, names a diagram type on its first line, and
  is followed by a caption line. A diagram with no caption is decoration.
- No Mermaid node label, table cell, or code comment contains answer text. The reader sees
  the whole primer before answering, and a grep for the key's answer strings will not
  catch an answer paraphrased inside a diagram.
- The quiz `.md` contains no answer content from the key: no correct-option markers, no
  `why` explanations, no rubric text. Grep the `.md` for the key's own answer strings and
  confirm no match.
- The correct options are not all the same letter. Writing three questions whose answer is
  `b` every time is a strong natural tendency — the correct option tends to get drafted
  second — and it makes the quiz answerable without reading the primer. If they came out
  identical, reorder the options on one question.

  When you reorder, move the `correct` letter and the `distractors` keys **together**. The
  distractor map is keyed by position, so swapping option text without remapping the keys
  silently attaches each misconception to the wrong option, and the grader will then
  explain a miss the learner did not make.

## Step 9 — Commit the rotation cursor

Only after Step 8 passes, run `bin/study next-topic --commit`. This advances the cursor so
tomorrow serves the next category. Because neither the cursor nor `results.jsonl` changed
since Step 3, it returns the same topic you just wrote a quiz for — confirm that it does.
If it reports a different concept, something else ran in between: stop and report rather
than committing.

Never run `--commit` before the quiz and key files are written and validated. An advanced
cursor with no quiz behind it is a category that silently loses its turn for the round.

## Step 10 — Report

Print the concept name and the absolute path to the quiz file. Nothing else — this line
becomes the morning notification.
