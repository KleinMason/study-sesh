'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadBank } = require('../lib/bank');

const BANK = path.join(__dirname, '..', 'syllabus', 'concept-bank.json');

test('the real concept bank loads and validates', () => {
  const bank = loadBank(BANK);
  assert.equal(bank.version, 1);
});

test('the real concept bank has all 11 roadmap categories', () => {
  const bank = loadBank(BANK);
  assert.equal(bank.categories.length, 11);
  assert.deepEqual(
    bank.categories.map((c) => c.id),
    [
      '01-layers',
      '02-api-design',
      '03-design-patterns',
      '04-migrations',
      '05-connections',
      '06-concurrency',
      '07-data-modeling',
      '08-background-jobs',
      '09-caching',
      '10-observability',
      '11-distributed'
    ]
  );
});

test('every category has at least 6 concepts', () => {
  const bank = loadBank(BANK);
  for (const category of bank.categories) {
    assert.ok(
      category.concepts.length >= 6,
      `${category.id} has only ${category.concepts.length} concepts`
    );
  }
});

test('concept ids are kebab-case', () => {
  const bank = loadBank(BANK);
  for (const category of bank.categories) {
    for (const concept of category.concepts) {
      assert.match(concept.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad id: ${concept.id}`);
    }
  }
});
