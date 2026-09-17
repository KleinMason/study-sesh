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

function readState(dataDir) {
  const file = statePath(dataDir);
  if (!fs.existsSync(file)) return structuredClone(DEFAULT_STATE);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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

function command() {
  const cfg = loadConfig();
  const bank = loadBank(cfg.syllabusPath);
  const entries = readResults(cfg.dataDir);
  const state = readState(cfg.dataDir);
  const { result, nextState } = nextTopic(bank, entries, state);
  if (!result.needsNewConcepts) writeState(cfg.dataDir, nextState);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return 0;
}

module.exports = { readState, writeState, nextTopic, command, DEFAULT_STATE };
