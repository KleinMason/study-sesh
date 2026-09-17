'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sampleBank } = require('./helpers');
const { nextTopic } = require('../lib/rotation');

const EMPTY_STATE = { version: 1, cursor: { categoryId: null, round: 1 } };

function result(over = {}) {
  return Object.assign({
    ts: '2026-09-18T13:00:00Z',
    quiz: 'q',
    categoryId: '01-layers',
    conceptId: 'layered-architecture',
    q: 1,
    type: 'mc',
    correct: true,
    score: 1
  }, over);
}

test('with no history it serves the first category and its first concept', () => {
  const { result: r, nextState } = nextTopic(sampleBank(), [], EMPTY_STATE);
  assert.equal(r.categoryId, '01-layers');
  assert.equal(r.conceptId, 'layered-architecture');
  assert.equal(r.round, 1);
  assert.equal(r.needsNewConcepts, false);
  assert.equal(nextState.cursor.categoryId, '01-layers');
});

test('it advances to the next category on the following call', () => {
  const first = nextTopic(sampleBank(), [], EMPTY_STATE);
  const second = nextTopic(sampleBank(), [result()], first.nextState);
  assert.equal(second.result.categoryId, '06-concurrency');
  assert.equal(second.result.conceptId, 'optimistic-locking');
});

test('it never repeats a covered concept', () => {
  const entries = [result({ conceptId: 'layered-architecture' })];
  const state = { version: 1, cursor: { categoryId: '06-concurrency', round: 1 } };
  const { result: r } = nextTopic(sampleBank(), entries, state);
  assert.equal(r.categoryId, '01-layers');
  assert.equal(r.conceptId, 'dependency-inversion');
});

test('wrapping past the last category increments the round', () => {
  const state = { version: 1, cursor: { categoryId: '06-concurrency', round: 1 } };
  const { result: r, nextState } = nextTopic(sampleBank(), [], state);
  assert.equal(r.categoryId, '01-layers');
  assert.equal(r.round, 2);
  assert.equal(nextState.cursor.round, 2);
});

test('an exhausted category reports needsNewConcepts', () => {
  const entries = [
    result({ conceptId: 'layered-architecture' }),
    result({ conceptId: 'dependency-inversion', quiz: 'q2' })
  ];
  const state = { version: 1, cursor: { categoryId: '06-concurrency', round: 1 } };
  const { result: r } = nextTopic(sampleBank(), entries, state);
  assert.equal(r.categoryId, '01-layers');
  assert.equal(r.needsNewConcepts, true);
  assert.deepEqual(r.coveredConcepts.sort(), ['dependency-inversion', 'layered-architecture']);
  assert.equal(r.conceptId, null);
});

test('needsNewConcepts does not advance the cursor', () => {
  const entries = [
    result({ conceptId: 'layered-architecture' }),
    result({ conceptId: 'dependency-inversion', quiz: 'q2' })
  ];
  const state = { version: 1, cursor: { categoryId: '06-concurrency', round: 1 } };
  const { nextState } = nextTopic(sampleBank(), entries, state);
  assert.deepEqual(nextState.cursor, state.cursor);
});

test('a retry after the bank is extended serves the new concept', () => {
  const bank = sampleBank();
  const entries = [
    result({ conceptId: 'layered-architecture' }),
    result({ conceptId: 'dependency-inversion', quiz: 'q2' })
  ];
  const state = { version: 1, cursor: { categoryId: '06-concurrency', round: 1 } };
  bank.categories[0].concepts.push({ id: 'repository-pattern', name: 'Repository pattern' });
  const { result: r } = nextTopic(bank, entries, state);
  assert.equal(r.needsNewConcepts, false);
  assert.equal(r.conceptId, 'repository-pattern');
});

test('a cursor pointing at a category no longer in the bank starts over', () => {
  const state = { version: 1, cursor: { categoryId: 'deleted-category', round: 3 } };
  const { result: r } = nextTopic(sampleBank(), [], state);
  assert.equal(r.categoryId, '01-layers');
  assert.equal(r.round, 3);
});
