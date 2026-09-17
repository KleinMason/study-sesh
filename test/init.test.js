'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initKit, parseOptions } = require('../lib/init');

function makeBareKit() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'study-init-'));
  fs.writeFileSync(
    path.join(root, 'config.example.json'),
    JSON.stringify({ dataDir: './data', syllabus: 'syllabus/concept-bank.json', timezone: 'America/Chicago' }, null, 2)
  );
  return root;
}

test('initKit writes config.json from the example', () => {
  const root = makeBareKit();
  try {
    initKit(root, {});
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
    assert.equal(cfg.dataDir, './data');
    assert.equal(cfg.timezone, 'America/Chicago');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initKit honors an explicit data directory', () => {
  const root = makeBareKit();
  const target = path.join(os.tmpdir(), 'my-study-data');
  try {
    initKit(root, { dataDir: target });
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
    assert.equal(cfg.dataDir, target);
    assert.equal(fs.existsSync(path.join(target, 'quizzes', '.keys')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('--data-dir=PATH reaches config.json, not just --data-dir PATH', () => {
  const root = makeBareKit();
  const target = path.join(os.tmpdir(), 'equals-form-study-data');
  try {
    // The bug this pins: indexOf('--data-dir') missed the = form, so init exited 0,
    // reported success, and wrote "./data" — and never overwrote it on a retry.
    initKit(root, parseOptions([`--data-dir=${target}`]));
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
    assert.equal(cfg.dataDir, target);
    assert.equal(fs.existsSync(path.join(target, 'quizzes', '.keys')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('parseOptions accepts both --data-dir spellings', () => {
  assert.deepEqual(parseOptions(['--data-dir', '/tmp/spaced']), { dataDir: '/tmp/spaced' });
  assert.deepEqual(parseOptions(['--data-dir=/tmp/equals']), { dataDir: '/tmp/equals' });
  assert.deepEqual(parseOptions([]), {});
});

test('parseOptions rejects --data-dir= with an empty value', () => {
  assert.throws(() => parseOptions(['--data-dir=']), (err) => {
    assert.equal(err.usage, true);
    assert.match(err.message, /requires a path/);
    return true;
  });
});

test('parseOptions rejects --data-dir with no value at all', () => {
  assert.throws(() => parseOptions(['--data-dir']), (err) => {
    assert.equal(err.usage, true);
    return true;
  });
});

test('initKit scaffolds the quizzes and keys directories', () => {
  const root = makeBareKit();
  try {
    initKit(root, {});
    assert.equal(fs.existsSync(path.join(root, 'data', 'quizzes', '.keys')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initKit writes an initial state.json', () => {
  const root = makeBareKit();
  try {
    initKit(root, {});
    const state = JSON.parse(fs.readFileSync(path.join(root, 'data', 'state.json'), 'utf8'));
    assert.deepEqual(state, { version: 1, cursor: { categoryId: null, round: 1 } });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initKit never overwrites an existing config.json', () => {
  const root = makeBareKit();
  const kept = path.join(os.tmpdir(), 'keep-me');
  try {
    fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ dataDir: kept }));
    const report = initKit(root, { dataDir: './data' });
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
    assert.equal(cfg.dataDir, kept);
    assert.ok(report.skipped.includes('config.json'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(kept, { recursive: true, force: true });
  }
});

test('initKit never overwrites an existing state.json', () => {
  const root = makeBareKit();
  try {
    fs.mkdirSync(path.join(root, 'data'), { recursive: true });
    const existing = { version: 1, cursor: { categoryId: '06-concurrency', round: 4 } };
    fs.writeFileSync(path.join(root, 'data', 'state.json'), JSON.stringify(existing));
    initKit(root, {});
    const state = JSON.parse(fs.readFileSync(path.join(root, 'data', 'state.json'), 'utf8'));
    assert.equal(state.cursor.round, 4);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initKit reports skipped on a second run', () => {
  const root = makeBareKit();
  try {
    const run1 = initKit(root, {});
    assert.ok(run1.created.length > 0);
    assert.equal(run1.skipped.length, 0);

    const run2 = initKit(root, {});
    assert.deepEqual(run2.created, []);
    assert.ok(run2.skipped.includes('config.json'));
    assert.ok(run2.skipped.includes('state.json'));
    assert.ok(run2.skipped.some(s => s.includes('quizzes/.keys')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
