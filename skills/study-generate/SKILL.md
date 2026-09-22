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
without advancing the rotation cursor. Committing is a separate step you take in Step 10,
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

300-500 words. A 3-5 minute read. **Self-contained**: every question must be answerable
from the primer alone, without following a link.

Fixed structure, in this order:
1. What the concept is — two or three sentences, no preamble.
2. The mechanism — how it actually works. This is the longest part.
3. When it applies and when it does not.
4. The failure mode it exists to prevent — be concrete.

Then a `### Go deeper` list: each source as a markdown link plus one line on why it earns
the click. Not a bare URL dump.

Write plainly. No motivational framing, no "in today's fast-paced world". The reader is a
working engineer.

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

<300-500 words>

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

## Step 8 — Check every question against its key

Before the quiz goes anywhere near the user, take each question and hold it against its
key entry and the primer. Step 9 checks the files are well formed; this step checks the
questions are *fair* — that someone who read the primer carefully can earn every point
the key awards. A question that fails here gets rewritten, not shipped with a note.

**Answer it cold first.** Answer every question using only the quiz `.md` — the primer and
the questions — without looking at the key. If you can dispatch a subagent, give it the
`.md` path alone and have it answer; otherwise answer it yourself before re-opening the
key. Then compare with the key. Any question where the cold answer disagrees with the key,
or where the cold reader could not find the answer in the primer, fails.

**Then, for each multiple-choice question:**
- Quote the primer sentence that makes the `correct` option right. If the question says
  "the primer gives" or "the primer describes", that sentence must state it plainly, in
  terms a reader would recognise as the answer to *this* question — not an aside that only
  supports it once you already know the answer.
- Confirm no distractor is also defensible from the primer. If a careful reader could argue
  for a second option using the primer's own words, the question has two answers.
- Confirm each `distractors` entry describes the option it is keyed to, after any
  reordering.

**For the short answer, check each rubric point separately:**
- **The question asks for it.** Every rubric point must answer a part of the question the
  learner can see. If the rubric awards "names the thread-safety obligation", the question
  must ask about an obligation or cost, not just "what does this buy them".
- **The question does not give it away.** A point that the question's own wording already
  states — a scenario that says "so the sockets are reused", graded on "names that the
  connections are reused" — rewards restating the prompt. Cut the premise from the
  question or change the point.
- **The primer supports it.** Quote the primer sentence each point is graded against. A
  point the primer never makes cannot be earned by someone who studied it, however
  correct the point is.
- **It can be graded.** The point says concretely what earns it and, where a generic
  answer is likely ("a shorter-lived dependency"), whether that is enough or whether an
  example is required. The grader should not have to guess.

This step exists because of `2026-09-21-singleton-and-lifetimes`. The learner answered one
multiple-choice question with "this is not mentioned in the primer": the supporting sentence
was the last clause of the first paragraph, framed as a side note rather than as "the
reason". The short-answer rubric awarded a point the question's own scenario had already
given away. Both could have been caught before the quiz was handed over.

## Step 9 — Self-validate before finishing

Check all of the following. If any fails, fix it before reporting success:
- One key entry exists for every question in the quiz file, with matching `q` numbers.
- Every multiple-choice key entry names exactly one correct option, and that option
  exists in the quiz file.
- Every short-answer key entry has a rubric with 2-3 points.
- Every cited URL was successfully fetched during research.
- The primer is between 300 and 500 words.
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

## Step 10 — Commit the rotation cursor

Only after Steps 8 and 9 pass, run `bin/study next-topic --commit`. This advances the cursor so
tomorrow serves the next category. Because neither the cursor nor `results.jsonl` changed
since Step 3, it returns the same topic you just wrote a quiz for — confirm that it does.
If it reports a different concept, something else ran in between: stop and report rather
than committing.

Never run `--commit` before the quiz and key files are written and validated. An advanced
cursor with no quiz behind it is a category that silently loses its turn for the round.

## Step 11 — Report

Print the concept name and the absolute path to the quiz file. Nothing else — this line
becomes the morning notification.
