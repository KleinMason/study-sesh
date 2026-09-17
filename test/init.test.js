'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initKit } = require('../lib/init');

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
