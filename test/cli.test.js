'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sampleBank } = require('./helpers');

const KIT = path.resolve(__dirname, '..');

// lib/config.js derives the kit root from its own __dirname, so cwd alone cannot point
// the CLI at a scratch kit — bin/ and lib/ have to be copied. Everything else (config,
// syllabus, data dir) is written fresh, so these tests never touch the real data/.
function makeCliKit() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'study-cli-'));
  fs.cpSync(path.join(KIT, 'bin'), path.join(root, 'bin'), { recursive: true });
  fs.cpSync(path.join(KIT, 'lib'), path.join(root, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(root, 'syllabus'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'syllabus', 'concept-bank.json'),
    JSON.stringify(sampleBank(), null, 2)
  );
  fs.writeFileSync(
    path.join(root, 'config.json'),
    JSON.stringify({
      dataDir: './data',
      syllabus: 'syllabus/concept-bank.json',
      timezone: 'America/Chicago'
    }, null, 2)
  );
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(path.join(dataDir, 'quizzes', '.keys'), { recursive: true });
  return {
    root,
    dataDir,
    resultsPath: path.join(dataDir, 'results.jsonl'),
    cleanup() { fs.rmSync(root, { recursive: true, force: true }); }
  };
}

// stdio is pinned to pipe on all three streams so a non-zero exit never leaks the child's
// stderr into the test suite's own output. Returns the same shape whether it exits 0 or not.
function runStudy(kit, args, input) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [path.join(kit.root, 'bin', 'study'), ...args],
      { cwd: kit.root, encoding: 'utf8', input: input === undefined ? '' : input,
        stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      status: err.status,
      stdout: err.stdout === undefined ? '' : String(err.stdout),
      stderr: err.stderr === undefined ? '' : String(err.stderr)
    };
  }
}

function resultEntry(over = {}) {
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

test('next-topic prints the documented JSON keys', () => {
  const kit = makeCliKit();
  try {
    const run = runStudy(kit, ['next-topic']);
    assert.equal(run.status, 0, `expected exit 0, got ${run.status}: ${run.stderr}`);
    const topic = JSON.parse(run.stdout);
    for (const key of ['categoryId', 'categoryName', 'conceptId', 'conceptName',
      'round', 'needsNewConcepts']) {
      assert.ok(key in topic, `next-topic output is missing "${key}"`);
    }
    assert.equal(topic.categoryId, '01-layers');
    assert.equal(topic.conceptId, 'layered-architecture');
    assert.equal(topic.needsNewConcepts, false);
  } finally {
    kit.cleanup();
  }
});

// The cursor used to advance the moment a topic was served, so a generator that died
// during research — or a human running the command to look — silently burned that
// category's turn for the round. Committing is now a separate, explicit step the
// generator takes only after the quiz file exists.
test('next-topic does not advance the cursor', () => {
  const kit = makeCliKit();
  try {
    const first = JSON.parse(runStudy(kit, ['next-topic']).stdout);
    const second = JSON.parse(runStudy(kit, ['next-topic']).stdout);
    assert.equal(second.categoryId, first.categoryId);
    assert.equal(second.conceptId, first.conceptId);
    assert.equal(
      fs.existsSync(path.join(kit.dataDir, 'state.json')), false,
      'a read-only next-topic must not write state.json'
    );
  } finally {
    kit.cleanup();
  }
});

test('next-topic --commit advances the cursor to the next category', () => {
  const kit = makeCliKit();
  try {
    const committed = JSON.parse(runStudy(kit, ['next-topic', '--commit']).stdout);
    assert.equal(committed.categoryId, '01-layers');
    const state = JSON.parse(fs.readFileSync(path.join(kit.dataDir, 'state.json'), 'utf8'));
    assert.equal(state.cursor.categoryId, '01-layers');
    const next = JSON.parse(runStudy(kit, ['next-topic']).stdout);
    assert.equal(next.categoryId, '06-concurrency');
  } finally {
    kit.cleanup();
  }
});

test('next-topic --commit returns the same topic the read-only call did', () => {
  const kit = makeCliKit();
  try {
    const peeked = JSON.parse(runStudy(kit, ['next-topic']).stdout);
    const committed = JSON.parse(runStudy(kit, ['next-topic', '--commit']).stdout);
    assert.equal(committed.conceptId, peeked.conceptId);
  } finally {
    kit.cleanup();
  }
});

test('record-result rejects a malformed timestamp', () => {
  const kit = makeCliKit();
  try {
    const batch = [resultEntry({ ts: 'yesterday' })];
    const run = runStudy(kit, ['record-result'], JSON.stringify(batch));
    assert.equal(run.status, 1);
    assert.match(run.stderr, /ts must be an ISO 8601/);
    assert.equal(fs.existsSync(kit.resultsPath), false);
  } finally {
    kit.cleanup();
  }
});

test('record-result appends a valid batch and reports the count', () => {
  const kit = makeCliKit();
  try {
    const batch = [resultEntry({ q: 1 }), resultEntry({ q: 2, correct: false, score: 0 })];
    const run = runStudy(kit, ['record-result'], JSON.stringify(batch));
    assert.equal(run.status, 0, `expected exit 0, got ${run.status}: ${run.stderr}`);
    assert.deepEqual(JSON.parse(run.stdout), { appended: 2 });
    const lines = fs.readFileSync(kit.resultsPath, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
  } finally {
    kit.cleanup();
  }
});

test('record-result rejects an unknown conceptId and writes nothing', () => {
  const kit = makeCliKit();
  try {
    const batch = [resultEntry({ conceptId: 'not-in-the-bank' })];
    const run = runStudy(kit, ['record-result'], JSON.stringify(batch));
    assert.equal(run.status, 1);
    assert.match(run.stderr, /unknown conceptId/);
    assert.equal(
      fs.existsSync(kit.resultsPath), false,
      'a rejected batch must not create or touch results.jsonl'
    );
  } finally {
    kit.cleanup();
  }
});

test('status exits 0 and prints a non-empty report', () => {
  const kit = makeCliKit();
  try {
    const run = runStudy(kit, ['status']);
    assert.equal(run.status, 0, `expected exit 0, got ${run.status}: ${run.stderr}`);
    assert.ok(run.stdout.trim().length > 0, 'status printed nothing');
    assert.match(run.stdout, /Round 1/);
  } finally {
    kit.cleanup();
  }
});
