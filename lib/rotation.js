'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config');
const { loadBank } = require('./bank');
const { readResults, coveredConceptIds } = require('./results');

const DEFAULT_STATE = { version: 1, cursor: { categoryId: null, round: 1 } };

function statePath(dataDir) {
  return path.join(dataDir, 'state.json');
}

// Shape matters as much as syntax here. A `round` that parses as a string makes the wrap
// arithmetic concatenate ("3" + 1 -> "31") and writes that back to disk, corrupting the
// counter permanently and silently.
function validateState(state, file) {
  const bad = (why) => new Error(
    `${file} is not a valid rotation cursor: ${why}. It holds only the rotation cursor — ` +
    `delete the file and rotation restarts from the first category.`
  );
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw bad('the top level must be an object');
  }
  const { cursor } = state;
  if (typeof cursor !== 'object' || cursor === null || Array.isArray(cursor)) {
    throw bad('cursor must be an object');
  }
  if (!Number.isInteger(cursor.round) || cursor.round < 1) {
    throw bad('cursor.round must be a positive integer');
  }
  if (cursor.categoryId !== null && typeof cursor.categoryId !== 'string') {
    throw bad('cursor.categoryId must be a string or null');
  }
  return state;
}

function readState(dataDir) {
  const file = statePath(dataDir);
  if (!fs.existsSync(file)) return structuredClone(DEFAULT_STATE);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    // state.json is the only non-append-only file in the data dir, so it is the one an
    // interrupted write can truncate. Both next-topic and status read it, which means a
    // bare parse error is what the morning scheduled task would report.
    throw new Error(
      `${file} is not valid JSON: ${err.message}. It holds only the rotation cursor — ` +
      `delete the file and rotation restarts from the first category.`
    );
  }
  return validateState(parsed, file);
}

function writeState(dataDir, state) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(statePath(dataDir), JSON.stringify(state, null, 2) + '\n');
}

function nextTopic(bank, entries, state) {
  const categories = bank.categories;
  const covered = coveredConceptIds(entries);
  const cursor = (state && state.cursor) || structuredClone(DEFAULT_STATE.cursor);

  const currentIndex = categories.findIndex((c) => c.id === cursor.categoryId);
  // findIndex returns -1 both for "no cursor yet" and "cursor category was deleted".
  // Either way the next index is 0, and a deleted category must not bump the round.
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % categories.length;
  const wrapped = currentIndex !== -1 && nextIndex === 0;
  const round = cursor.round + (wrapped ? 1 : 0);

  const category = categories[nextIndex];
  const concept = category.concepts.find((c) => !covered.has(c.id));

  if (!concept) {
    return {
      result: {
        categoryId: category.id,
        categoryName: category.name,
        conceptId: null,
        conceptName: null,
        round,
        needsNewConcepts: true,
        coveredConcepts: category.concepts.map((c) => c.id)
      },
      nextState: state
    };
  }

  return {
    result: {
      categoryId: category.id,
      categoryName: category.name,
      conceptId: concept.id,
      conceptName: concept.name,
      round,
      needsNewConcepts: false
    },
    nextState: { version: 1, cursor: { categoryId: category.id, round } }
  };
}

// Reading a topic and consuming it are separate acts. Advancing the cursor at serve time
// meant a generator that died during research — or a human running the command to look —
// silently burned that category's turn for the round, with nothing reporting it. The
// generator now commits only after the quiz file exists, and because neither the cursor
// nor results.jsonl change in between, the committing call returns the same topic.
function command(argv = []) {
  const commit = argv.includes('--commit');
  const cfg = loadConfig();
  const bank = loadBank(cfg.syllabusPath);
  const entries = readResults(cfg.dataDir);
  const state = readState(cfg.dataDir);
  const { result, nextState } = nextTopic(bank, entries, state);
  if (commit && !result.needsNewConcepts) writeState(cfg.dataDir, nextState);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return 0;
}

module.exports = { readState, writeState, validateState, nextTopic, command, DEFAULT_STATE };
