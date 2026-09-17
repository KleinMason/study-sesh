'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { makeTempKit } = require('./helpers');
const { loadConfig, today } = require('../lib/config');

test('loadConfig resolves dataDir to an absolute path', () => {
  const kit = makeTempKit();
  try {
    const cfg = loadConfig(kit.root);
    assert.equal(cfg.dataDir, path.join(kit.root, 'data'));
    assert.equal(path.isAbsolute(cfg.dataDir), true);
  } finally {
    kit.cleanup();
  }
});

test('loadConfig resolves syllabus to an absolute path', () => {
  const kit = makeTempKit();
  try {
    const cfg = loadConfig(kit.root);
    assert.equal(cfg.syllabusPath, path.join(kit.root, 'syllabus', 'concept-bank.json'));
  } finally {
    kit.cleanup();
  }
});

test('loadConfig keeps an absolute dataDir unchanged', () => {
  const kit = makeTempKit({ dataDir: '/tmp/somewhere-else' });
  try {
    assert.equal(loadConfig(kit.root).dataDir, '/tmp/somewhere-else');
  } finally {
    kit.cleanup();
  }
});

test('loadConfig throws a helpful error when config.json is missing', () => {
  const kit = makeTempKit();
  require('node:fs').rmSync(path.join(kit.root, 'config.json'));
  try {
    assert.throws(() => loadConfig(kit.root), /study init/);
  } finally {
    kit.cleanup();
  }
});

test('today formats the date in the configured timezone', () => {
  // 2026-01-01T02:00:00Z is still 2025-12-31 in America/Chicago.
  const d = new Date('2026-01-01T02:00:00Z');
  assert.equal(today('America/Chicago', d), '2025-12-31');
  assert.equal(today('UTC', d), '2026-01-01');
});
