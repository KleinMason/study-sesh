'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateEntries } = require('../lib/record');

const VALID_IDS = new Set(['optimistic-locking', 'fencing-tokens']);

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

test('a well-formed entry produces no errors', () => {
  assert.deepEqual(validateEntries([entry()], VALID_IDS), []);
});

test('an unknown conceptId is rejected', () => {
  const errors = validateEntries([entry({ conceptId: 'invented-concept' })], VALID_IDS);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /unknown conceptId: invented-concept/);
});

test('a missing required field is rejected', () => {
  const bad = entry();
  delete bad.quiz;
  const errors = validateEntries([bad], VALID_IDS);
  assert.match(errors[0], /missing "quiz"/);
});

test('a score outside 0..1 is rejected', () => {
  assert.match(validateEntries([entry({ score: 1.5 })], VALID_IDS)[0], /score must be between 0 and 1/);
  assert.match(validateEntries([entry({ score: -0.1 })], VALID_IDS)[0], /score must be between 0 and 1/);
});

test('an unknown type is rejected', () => {
  assert.match(validateEntries([entry({ type: 'essay' })], VALID_IDS)[0], /type must be "mc" or "short"/);
});

test('a short answer may have correct: null', () => {
  assert.deepEqual(
    validateEntries([entry({ type: 'short', correct: null, score: 0.67 })], VALID_IDS),
    []
  );
});

test('a multiple-choice entry may not have correct: null', () => {
  assert.match(
    validateEntries([entry({ type: 'mc', correct: null })], VALID_IDS)[0],
    /multiple-choice entries need correct: true or false/
  );
});

test('a non-integer question number is rejected', () => {
  assert.match(validateEntries([entry({ q: '1' })], VALID_IDS)[0], /q must be an integer/);
});

test('errors report the index of the offending entry', () => {
  const errors = validateEntries([entry(), entry({ score: 9 })], VALID_IDS);
  assert.match(errors[0], /entry 1:/);
});

test('every error in a batch is reported, not just the first', () => {
  const errors = validateEntries(
    [entry({ score: 9 }), entry({ conceptId: 'nope' })],
    VALID_IDS
  );
  assert.equal(errors.length, 2);
});
