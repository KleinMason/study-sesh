'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sampleBank } = require('./helpers');
const { reviewSet } = require('../lib/review');

const NOW = new Date('2026-10-01T12:00:00Z');
const OLD = '2026-09-01T12:00:00Z';

function entry(conceptId, score, over = {}) {
  return Object.assign({
    ts: OLD,
    quiz: `quiz-${conceptId}`,
    categoryId: conceptId === 'optimistic-locking' || conceptId === 'fencing-tokens'
      ? '06-concurrency' : '01-layers',
    conceptId,
    q: 1,
    type: 'mc',
    correct: score === 1,
    score
  }, over);
}

// Deterministic generator so weighted sampling is testable.
function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('it returns nothing when no concepts have been graded', () => {
  assert.deepEqual(reviewSet(sampleBank(), [], { now: NOW }), []);
});

test('it never returns more than count concepts', () => {
  const entries = [
    entry('layered-architecture', 0),
    entry('dependency-inversion', 0.5),
    entry('optimistic-locking', 1)
  ];
  assert.equal(reviewSet(sampleBank(), entries, { count: 2, now: NOW }).length, 2);
});

test('it excludes concepts graded inside the cooldown window', () => {
  const entries = [
    entry('layered-architecture', 0, { ts: '2026-09-30T12:00:00Z' }),
    entry('optimistic-locking', 0)
  ];
  const ids = reviewSet(sampleBank(), entries, { now: NOW, cooldownDays: 3 })
    .map((r) => r.conceptId);
  assert.deepEqual(ids, ['optimistic-locking']);
});

test('it never returns an ungraded concept', () => {
  const entries = [entry('layered-architecture', 0)];
  const ids = reviewSet(sampleBank(), entries, { count: 8, now: NOW }).map((r) => r.conceptId);
  assert.deepEqual(ids, ['layered-architecture']);
});

test('it carries the concept name, category, score, and misses', () => {
  const entries = [entry('optimistic-locking', 0, { note: 'confused it with pessimistic' })];
  const [r] = reviewSet(sampleBank(), entries, { now: NOW });
  assert.equal(r.conceptName, 'Optimistic locking');
  assert.equal(r.categoryName, 'Concurrency and Locking');
  assert.equal(r.meanScore, 0);
  assert.equal(r.misses[0].note, 'confused it with pessimistic');
});

test('missed concepts are drawn far more often than mastered ones', () => {
  const entries = [entry('layered-architecture', 0), entry('optimistic-locking', 1)];
  let missed = 0;
  let mastered = 0;
  for (let seed = 1; seed <= 400; seed += 1) {
    const [pick] = reviewSet(sampleBank(), entries, { count: 1, now: NOW, rng: seededRng(seed) });
    if (pick.conceptId === 'layered-architecture') missed += 1;
    if (pick.conceptId === 'optimistic-locking') mastered += 1;
  }
  // weights: missed = 1.0, mastered = floor 0.15 -> roughly 87% vs 13%
  assert.ok(missed > mastered * 3, `expected misses to dominate, got ${missed} vs ${mastered}`);
  assert.ok(mastered > 0, 'the floor weight must keep mastered concepts reachable');
});

test('sampling is without replacement', () => {
  const entries = [
    entry('layered-architecture', 0),
    entry('dependency-inversion', 0),
    entry('optimistic-locking', 0)
  ];
  const ids = reviewSet(sampleBank(), entries, { count: 3, now: NOW, rng: seededRng(7) })
    .map((r) => r.conceptId);
  assert.equal(new Set(ids).size, 3);
});

test('concepts missing from the bank are skipped', () => {
  const entries = [entry('retired-concept', 0)];
  assert.deepEqual(reviewSet(sampleBank(), entries, { now: NOW }), []);
});
