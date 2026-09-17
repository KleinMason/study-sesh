'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempKit, writeResults } = require('./helpers');
const {
  readResults, resolveLatest, conceptStats, coveredConceptIds, appendResults, gradedQuizIds
} = require('../lib/results');

function entry(over = {}) {
  return Object.assign({
    ts: '2026-09-18T13:00:00Z',
    quiz: '2026-09-18-optimistic-locking',
    categoryId: '06-concurrency',
    conceptId: 'optimistic-locking',
    q: 1,
    type: 'mc',
    correct: true,
    score: 1
  }, over);
}

test('readResults returns an empty array when the log does not exist', () => {
  const kit = makeTempKit();
  try {
    assert.deepEqual(readResults(kit.dataDir), []);
  } finally {
    kit.cleanup();
  }
});

test('readResults skips blank lines', () => {
  const kit = makeTempKit();
  try {
    fs.writeFileSync(
      path.join(kit.dataDir, 'results.jsonl'),
      JSON.stringify(entry()) + '\n\n' + JSON.stringify(entry({ q: 2 })) + '\n'
    );
    assert.equal(readResults(kit.dataDir).length, 2);
  } finally {
    kit.cleanup();
  }
});

test('resolveLatest keeps the last entry for a quiz/question pair', () => {
  const entries = [
    entry({ q: 1, score: 0, correct: false }),
    entry({ q: 1, score: 1, correct: true, ts: '2026-09-18T14:00:00Z', corrects: true })
  ];
  const resolved = resolveLatest(entries);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].score, 1);
  assert.equal(resolved[0].corrects, true);
});

test('resolveLatest keeps distinct questions separate', () => {
  const resolved = resolveLatest([entry({ q: 1 }), entry({ q: 2 })]);
  assert.equal(resolved.length, 2);
});

test('conceptStats computes mean score across resolved entries', () => {
  const stats = conceptStats([
    entry({ q: 1, score: 1 }),
    entry({ q: 2, score: 0, correct: false }),
    entry({ q: 3, type: 'short', correct: null, score: 0.5 })
  ]);
  const s = stats.get('optimistic-locking');
  assert.equal(s.count, 3);
  assert.equal(s.meanScore, 0.5);
  assert.equal(s.categoryId, '06-concurrency');
});

test('conceptStats uses corrected scores, not superseded ones', () => {
  const stats = conceptStats([
    entry({ q: 1, score: 0, correct: false }),
    entry({ q: 1, score: 1, correct: true, ts: '2026-09-18T14:00:00Z', corrects: true })
  ]);
  assert.equal(stats.get('optimistic-locking').meanScore, 1);
});

test('conceptStats collects misses with their notes', () => {
  const stats = conceptStats([
    entry({ q: 1, score: 1 }),
    entry({ q: 2, score: 0, correct: false, note: 'picked the pick-any-two option' })
  ]);
  const misses = stats.get('optimistic-locking').misses;
  assert.equal(misses.length, 1);
  assert.equal(misses[0].q, 2);
  assert.equal(misses[0].note, 'picked the pick-any-two option');
});

test('conceptStats counts a partial-credit short answer as a miss', () => {
  const stats = conceptStats([
    entry({ q: 1, score: 1 }),
    entry({ q: 2, type: 'short', correct: null, score: 0.5, note: 'missed the tradeoff point' })
  ]);
  const misses = stats.get('optimistic-locking').misses;
  assert.equal(misses.length, 1, 'anything under full credit is a miss, not just zero');
  assert.equal(misses[0].q, 2);
  assert.equal(misses[0].note, 'missed the tradeoff point');
});

// Later timestamp deliberately comes FIRST in the entry list: an implementation that
// returned the last entry in file order would pass if these were in ascending order.
test('conceptStats records the latest timestamp seen', () => {
  const stats = conceptStats([
    entry({ q: 1, ts: '2026-09-20T13:00:00Z' }),
    entry({ q: 2, ts: '2026-09-18T13:00:00Z' })
  ]);
  assert.equal(stats.get('optimistic-locking').lastTs, '2026-09-20T13:00:00Z');
});

test('conceptStats keeps a skipped question out of misses', () => {
  const stats = conceptStats([
    entry({ q: 1, score: 1 }),
    entry({ q: 2, score: 0, correct: false, note: 'skipped' })
  ]);
  const s = stats.get('optimistic-locking');
  assert.deepEqual(s.misses, [], 'not answering is not the same as answering wrong');
  assert.equal(s.skipped, 1);
});

test('conceptStats does not let a skipped question drag the mean down', () => {
  const stats = conceptStats([
    entry({ q: 1, score: 1 }),
    entry({ q: 2, score: 0, correct: false, note: 'skipped' })
  ]);
  const s = stats.get('optimistic-locking');
  assert.equal(s.count, 1, 'only attempted questions count');
  assert.equal(s.meanScore, 1);
  assert.equal(s.attempted, true);
});

test('conceptStats marks an all-skipped concept unattempted with a zero mean', () => {
  const stats = conceptStats([
    entry({ q: 1, score: 0, correct: false, note: 'skipped' }),
    entry({ q: 2, score: 0, correct: false, note: 'skipped' })
  ]);
  const s = stats.get('optimistic-locking');
  assert.equal(s.attempted, false);
  assert.equal(s.count, 0);
  assert.equal(s.skipped, 2);
  assert.equal(s.meanScore, 0);
  assert.equal(Number.isNaN(s.meanScore), false, '0/0 must not surface as NaN');
});

test('conceptStats only treats the exact note "skipped" as unanswered', () => {
  const stats = conceptStats([
    entry({ q: 1, score: 0, correct: false, note: 'skipped the middle step of the proof' })
  ]);
  const s = stats.get('optimistic-locking');
  assert.equal(s.count, 1);
  assert.equal(s.skipped, 0);
  assert.equal(s.misses.length, 1);
});

test('coveredConceptIds returns every concept with an attempted result', () => {
  const covered = coveredConceptIds([
    entry(),
    entry({ conceptId: 'fencing-tokens', quiz: '2026-09-19-fencing-tokens' })
  ]);
  assert.deepEqual([...covered].sort(), ['fencing-tokens', 'optimistic-locking']);
});

// A quiz that went out and came back entirely blank taught nothing. Counting it as
// covered would retire the concept from this round's rotation while `attempted: false`
// simultaneously hides it from the weekly review — the concept would fall through both.
test('coveredConceptIds omits a concept whose every question was skipped', () => {
  const covered = coveredConceptIds([
    entry({ q: 1, score: 0, correct: false, note: 'skipped' }),
    entry({ q: 2, score: 0, correct: false, note: 'skipped' })
  ]);
  assert.equal(covered.size, 0);
});

test('coveredConceptIds counts a concept with even one attempted question', () => {
  const covered = coveredConceptIds([
    entry({ q: 1, score: 0, correct: false, note: 'skipped' }),
    entry({ q: 2, score: 1 })
  ]);
  assert.deepEqual([...covered], ['optimistic-locking']);
});

test('readResults numbers a malformed line by its position in the file', () => {
  const kit = makeTempKit();
  try {
    fs.writeFileSync(
      path.join(kit.dataDir, 'results.jsonl'),
      '\n' + JSON.stringify(entry()) + '\n' + 'NOT JSON\n'
    );
    assert.throws(() => readResults(kit.dataDir), /line 3 is not valid JSON/);
  } finally {
    kit.cleanup();
  }
});

test('gradedQuizIds returns every quiz id with results', () => {
  const ids = gradedQuizIds([entry(), entry({ quiz: '2026-09-19-fencing-tokens' })]);
  assert.equal(ids.size, 2);
  assert.equal(ids.has('2026-09-18-optimistic-locking'), true);
});

test('appendResults writes one line per entry and never rewrites', () => {
  const kit = makeTempKit();
  try {
    writeResults(kit.dataDir, [entry({ q: 1 })]);
    const added = appendResults(kit.dataDir, [entry({ q: 2 }), entry({ q: 3 })]);
    assert.equal(added, 2);
    const lines = fs.readFileSync(path.join(kit.dataDir, 'results.jsonl'), 'utf8')
      .trim().split('\n');
    assert.equal(lines.length, 3);
    assert.equal(JSON.parse(lines[0]).q, 1);
  } finally {
    kit.cleanup();
  }
});

test('appendResults creates the data directory when missing', () => {
  const kit = makeTempKit();
  try {
    fs.rmSync(kit.dataDir, { recursive: true, force: true });
    appendResults(kit.dataDir, [entry()]);
    assert.equal(fs.existsSync(path.join(kit.dataDir, 'results.jsonl')), true);
  } finally {
    kit.cleanup();
  }
});
