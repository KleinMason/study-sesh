'use strict';
const fs = require('node:fs');
const path = require('node:path');

function resultsPath(dataDir) {
  return path.join(dataDir, 'results.jsonl');
}

function readResults(dataDir) {
  const file = resultsPath(dataDir);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    // The line number is captured before blank lines are dropped: this message is only
    // ever read while hand-repairing the file, which is exactly when an index into a
    // filtered array would send the reader to the wrong line.
    .map((line, i) => ({ line: line.trim(), lineNumber: i + 1 }))
    .filter(({ line }) => line.length > 0)
    .map(({ line, lineNumber }) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`results.jsonl line ${lineNumber} is not valid JSON: ${err.message}`);
      }
    });
}

function isSkipped(entry) {
  return entry.note === 'skipped';
}

// One entry per (quiz, question). Later lines supersede earlier ones, which is how
// a contested-and-overturned grade replaces its original without a rewrite.
function resolveLatest(entries) {
  const byKey = new Map();
  for (const e of entries) {
    byKey.set(`${e.quiz}#${e.q}`, e);
  }
  return [...byKey.values()];
}

// `count`, `totalScore`, `meanScore` and `misses` describe attempted questions only.
// A question the grader marked `"note": "skipped"` was never answered, so counting it as
// a zero would tell retention weighting that the learner does not understand the concept
// when in fact they never got to it. It is tallied under `skipped` instead of discarded,
// and `attempted` says whether anything is left to weight.
function conceptStats(entries) {
  const stats = new Map();
  for (const e of resolveLatest(entries)) {
    let s = stats.get(e.conceptId);
    if (!s) {
      s = {
        conceptId: e.conceptId,
        categoryId: e.categoryId,
        count: 0,
        skipped: 0,
        totalScore: 0,
        meanScore: 0,
        attempted: false,
        lastTs: e.ts,
        misses: []
      };
      stats.set(e.conceptId, s);
    }
    // lastTs tracks when the concept was last served, skipped or not, so the review
    // cooldown still sees a quiz that went out and came back blank.
    if (e.ts > s.lastTs) s.lastTs = e.ts;

    if (isSkipped(e)) {
      s.skipped += 1;
      continue;
    }

    const score = typeof e.score === 'number' ? e.score : 0;
    s.count += 1;
    s.totalScore += score;
    s.meanScore = s.totalScore / s.count;
    s.attempted = true;
    if (score < 1) {
      s.misses.push({ quiz: e.quiz, q: e.q, note: e.note || null });
    }
  }
  return stats;
}

// "Covered" means the learner actually answered something. A quiz that came back entirely
// blank taught nothing, and counting it would retire the concept from this round's rotation
// while `attempted: false` simultaneously hides it from the weekly review — leaving it in a
// gap where it is neither re-served nor retested.
function coveredConceptIds(entries) {
  const covered = new Set();
  for (const e of resolveLatest(entries)) {
    if (!isSkipped(e)) covered.add(e.conceptId);
  }
  return covered;
}

function gradedQuizIds(entries) {
  return new Set(entries.map((e) => e.quiz));
}

function appendResults(dataDir, entries) {
  if (entries.length === 0) return 0;
  fs.mkdirSync(dataDir, { recursive: true });
  const payload = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.appendFileSync(resultsPath(dataDir), payload);
  return entries.length;
}

module.exports = {
  resultsPath, readResults, resolveLatest, conceptStats,
  coveredConceptIds, gradedQuizIds, appendResults
};
