# Weekly review task template

Install to `~/.claude/scheduled-tasks/study-weekly/SKILL.md`, replacing `<KIT_ROOT>`.

Schedule: once a week — suggested cron `0 9 * * 6` (Saturday 9am, local time; see the
README's Scheduling section for how this maps to a Claude Desktop scheduled task). This is
an **extra** sitting — the daily quiz still runs that week.

```markdown
---
name: study-weekly
description: Generate the weekly backend retention review
---

Generate this week's backend retention review.

1. Change to the kit at <KIT_ROOT>.
2. Run `./bin/study review-set --count 8`. If it returns an empty array, report that
   there is not enough graded history yet and stop.
3. For each returned concept, write one question targeting the specific gap shown in its
   `misses` array. Do not repeat a missed question verbatim — ask the same idea a
   different way.
4. Follow the file format and answer-key rules in `skills/study-generate/SKILL.md`,
   writing to `<dataDir>/quizzes/YYYY-MM-DD-review.md` and its matching key. A review
   spans concepts, so the key differs from a daily key: `conceptId` and `categoryId` move
   from the top level onto each question. Use exactly this shape — the grader reads those
   two fields per question when it records results:

   ```json
   {
     "quiz": "YYYY-MM-DD-review",
     "review": true,
     "questions": [
       {
         "q": 1,
         "conceptId": "optimistic-locking",
         "categoryId": "06-concurrency",
         "type": "mc",
         "correct": "b",
         "why": "One sentence on why b is right.",
         "distractors": {
           "a": "The misconception this option encodes.",
           "c": "The misconception this option encodes."
         }
       },
       {
         "q": 2,
         "conceptId": "cap-theorem",
         "categoryId": "11-distributed",
         "type": "short",
         "rubric": ["First required point.", "Second required point."]
       }
     ]
   }
   ```
5. No primer is needed — this is a retention check on material already taught. Link back
   to each concept's original quiz file instead.
6. Report the concept count and the review file path.
```
