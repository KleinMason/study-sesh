'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sampleBank } = require('./helpers');
const { buildStatus, formatStatus } = require('../lib/status');

function entry(conceptId, categoryId, score) {
  return {
    ts: '2026-09-18T13:00:00Z',
    quiz: `quiz-${conceptId}`,
    categoryId,
    conceptId,
    q: 1,
    type: 'mc',
    correct: score === 1,
    score
  };
}

const STATE = { version: 1, cursor: { categoryId: '01-layers', round: 2 } };

test('buildStatus counts covered concepts per category', () => {
  const entries = [entry('layered-architecture', '01-layers', 1)];
  const status = buildStatus(sampleBank(), entries, STATE);
  assert.deepEqual(status.categories[0], {
    id: '01-layers', name: 'Separation of Concerns', covered: 1, total: 2
  });
  assert.equal(status.categories[1].covered, 0);
});

test('buildStatus reports the current round', () => {
  assert.equal(buildStatus(sampleBank(), [], STATE).round, 2);
});

test('buildStatus totals concepts covered across the bank', () => {
  const entries = [
    entry('layered-architecture', '01-layers', 1),
    entry('optimistic-locking', '06-concurrency', 0)
  ];
  const status = buildStatus(sampleBank(), entries, STATE);
  assert.deepEqual(status.totals, { conceptsCovered: 2, conceptsTotal: 4 });
});

test('buildStatus lists the weakest concepts worst first', () => {
  const entries = [
    entry('layered-architecture', '01-layers', 1),
    entry('dependency-inversion', '01-layers', 0.25),
    entry('optimistic-locking', '06-concurrency', 0)
  ];
  const weakest = buildStatus(sampleBank(), entries, STATE).weakest;
  assert.deepEqual(weakest.map((w) => w.conceptId), [
    'optimistic-locking', 'dependency-inversion', 'layered-architecture'
  ]);
});

test('buildStatus caps weakest at five entries', () => {
  const bank = sampleBank();
  bank.categories[0].concepts.push(
    { id: 'c3', name: 'C3' }, { id: 'c4', name: 'C4' },
    { id: 'c5', name: 'C5' }, { id: 'c6', name: 'C6' }
  );
  const entries = ['layered-architecture', 'dependency-inversion', 'c3', 'c4', 'c5', 'c6']
    .map((id, i) => entry(id, '01-layers', i / 10));
  assert.equal(buildStatus(bank, entries, STATE).weakest.length, 5);
});

test('formatStatus renders a readable report', () => {
  const entries = [entry('layered-architecture', '01-layers', 1)];
  const text = formatStatus(buildStatus(sampleBank(), entries, STATE));
  assert.match(text, /Round 2/);
  assert.match(text, /Separation of Concerns\s+1\/2/);
});

test('buildStatus sorts tied concepts by conceptId', () => {
  const entries = [
    entry('optimistic-locking', '06-concurrency', 0.5),
    entry('dependency-inversion', '01-layers', 0.5)
  ];
  const weakest = buildStatus(sampleBank(), entries, STATE).weakest;
  assert.deepEqual(weakest.map((w) => w.conceptId), [
    'dependency-inversion', 'optimistic-locking'
  ]);
});

test('buildStatus excludes concepts retired from the bank', () => {
  const entries = [
    entry('layered-architecture', '01-layers', 0),
    entry('retired-concept', '01-layers', 0)
  ];
  const weakest = buildStatus(sampleBank(), entries, STATE).weakest;
  assert.deepEqual(weakest.map((w) => w.conceptId), ['layered-architecture']);
});
