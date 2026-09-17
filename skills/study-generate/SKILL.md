---
name: study-generate
description: Generate the daily backend study quiz — pick the next concept, research it, write a primer and quiz with a separate answer key. Use when the morning scheduled task fires or when the user asks to generate today's quiz.
---

# Generate the daily study quiz

## Step 1 — Resolve paths

The kit root is the directory containing this skill's `skills/` parent. Read
`config.json` there for `dataDir` and `timezone`. Compute today's date as `YYYY-MM-DD`
in that timezone.

## Step 2 — Idempotency check

List `<dataDir>/quizzes/`. If any file starts with today's date, stop and report:
"Today's quiz already exists: <filename>". Generate nothing. This makes a double fire
harmless and a missed morning a clean no-op.

## Step 3 — Get the topic

Run `bin/study next-topic`. Parse the JSON.

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

## Step 8 — Self-validate before finishing

Check all of the following. If any fails, fix it before reporting success:
- One key entry exists for every question in the quiz file, with matching `q` numbers.
- Every multiple-choice key entry names exactly one correct option, and that option
  exists in the quiz file.
- Every short-answer key entry has a rubric with 2-3 points.
- Every cited URL was successfully fetched during research.
- The primer is between 300 and 500 words.

## Step 9 — Report

Print the concept name and the absolute path to the quiz file. Nothing else — this line
becomes the morning notification.
