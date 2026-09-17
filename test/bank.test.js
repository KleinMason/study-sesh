'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeTempKit, writeBank, sampleBank } = require('./helpers');
const { loadBank, allConceptIds, findConcept } = require('../lib/bank');

test('loadBank returns categories in file order', () => {
  const kit = makeTempKit();
  try {
    const p = writeBank(kit.root, sampleBank());
    const bank = loadBank(p);
    assert.deepEqual(bank.categories.map((c) => c.id), ['01-layers', '06-concurrency']);
  } finally {
    kit.cleanup();
  }
});

test('allConceptIds returns every concept id across categories', () => {
  const kit = makeTempKit();
  try {
    const bank = loadBank(writeBank(kit.root, sampleBank()));
    assert.deepEqual(
      [...allConceptIds(bank)].sort(),
      ['dependency-inversion', 'fencing-tokens', 'layered-architecture', 'optimistic-locking']
    );
  } finally {
    kit.cleanup();
  }
});

test('findConcept returns the concept and its owning category', () => {
  const kit = makeTempKit();
  try {
    const bank = loadBank(writeBank(kit.root, sampleBank()));
    const hit = findConcept(bank, 'fencing-tokens');
    assert.equal(hit.category.id, '06-concurrency');
    assert.equal(hit.concept.name, 'Fencing tokens');
    assert.equal(findConcept(bank, 'nope'), null);
  } finally {
    kit.cleanup();
  }
});

test('loadBank rejects duplicate concept ids across categories', () => {
  const kit = makeTempKit();
  try {
    const bank = sampleBank();
    bank.categories[1].concepts.push({ id: 'layered-architecture', name: 'Dupe' });
    const p = writeBank(kit.root, bank);
    assert.throws(() => loadBank(p), /duplicate concept id: layered-architecture/);
  } finally {
    kit.cleanup();
  }
});

test('loadBank rejects duplicate category ids', () => {
  const kit = makeTempKit();
  try {
    const bank = sampleBank();
    bank.categories[1].id = '01-layers';
    const p = writeBank(kit.root, bank);
    assert.throws(() => loadBank(p), /duplicate category id: 01-layers/);
  } finally {
    kit.cleanup();
  }
});

test('loadBank rejects a category with no concepts', () => {
  const kit = makeTempKit();
  try {
    const bank = sampleBank();
    bank.categories[0].concepts = [];
    const p = writeBank(kit.root, bank);
    assert.throws(() => loadBank(p), /has no concepts/);
  } finally {
    kit.cleanup();
  }
});

test('loadBank rejects an unsupported version', () => {
  const kit = makeTempKit();
  try {
    const bank = sampleBank();
    bank.version = 2;
    const p = writeBank(kit.root, bank);
    assert.throws(() => loadBank(p), /unsupported concept bank version: 2/);
  } finally {
    kit.cleanup();
  }
});

test('loadBank rejects a top-level null value', () => {
  const kit = makeTempKit();
  try {
    const path = require('node:path');
    const fs = require('node:fs');
    const p = path.join(kit.root, 'syllabus', 'concept-bank.json');
    fs.writeFileSync(p, 'null', 'utf8');
    assert.throws(() => loadBank(p), /concept bank must be an object/);
  } finally {
    kit.cleanup();
  }
});

test('loadBank rejects a top-level array', () => {
  const kit = makeTempKit();
  try {
    const path = require('node:path');
    const fs = require('node:fs');
    const p = path.join(kit.root, 'syllabus', 'concept-bank.json');
    fs.writeFileSync(p, '[]', 'utf8');
    assert.throws(() => loadBank(p), /concept bank must be an object/);
  } finally {
    kit.cleanup();
  }
});

test('loadBank rejects a top-level primitive', () => {
  const kit = makeTempKit();
  try {
    const path = require('node:path');
    const fs = require('node:fs');
    const p = path.join(kit.root, 'syllabus', 'concept-bank.json');
    fs.writeFileSync(p, '"string"', 'utf8');
    assert.throws(() => loadBank(p), /concept bank must be an object/);
  } finally {
    kit.cleanup();
  }
});

test('loadBank rejects a null entry in categories', () => {
  const kit = makeTempKit();
  try {
    const path = require('node:path');
    const fs = require('node:fs');
    const bank = sampleBank();
    bank.categories[0] = null;
    const p = path.join(kit.root, 'syllabus', 'concept-bank.json');
    fs.writeFileSync(p, JSON.stringify(bank), 'utf8');
    assert.throws(() => loadBank(p), /category entry must be an object/);
  } finally {
    kit.cleanup();
  }
});

test('loadBank rejects a null entry in concepts', () => {
  const kit = makeTempKit();
  try {
    const path = require('node:path');
    const fs = require('node:fs');
    const bank = sampleBank();
    bank.categories[0].concepts[0] = null;
    const p = path.join(kit.root, 'syllabus', 'concept-bank.json');
    fs.writeFileSync(p, JSON.stringify(bank), 'utf8');
    assert.throws(() => loadBank(p), /concept entry must be an object/);
  } finally {
    kit.cleanup();
  }
});
