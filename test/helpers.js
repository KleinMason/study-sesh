'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Creates a throwaway kit directory with config.json and an empty data dir.
function makeTempKit(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'study-kit-'));
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(path.join(dataDir, 'quizzes', '.keys'), { recursive: true });
  const config = Object.assign(
    { dataDir: './data', syllabus: 'syllabus/concept-bank.json', timezone: 'America/Chicago' },
    overrides
  );
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify(config, null, 2));
  fs.mkdirSync(path.join(root, 'syllabus'), { recursive: true });
  return {
    root,
    dataDir,
    cleanup() { fs.rmSync(root, { recursive: true, force: true }); }
  };
}

// Writes a concept bank into the temp kit and returns its path.
function writeBank(root, bank) {
  const p = path.join(root, 'syllabus', 'concept-bank.json');
  fs.writeFileSync(p, JSON.stringify(bank, null, 2));
  return p;
}

// Appends raw result objects to results.jsonl without going through the CLI.
function writeResults(dataDir, entries) {
  const line = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.appendFileSync(path.join(dataDir, 'results.jsonl'), line);
}

// A minimal two-category bank used by most tests.
function sampleBank() {
  return {
    version: 1,
    categories: [
      {
        id: '01-layers',
        name: 'Separation of Concerns',
        concepts: [
          { id: 'layered-architecture', name: 'Layered architecture' },
          { id: 'dependency-inversion', name: 'Dependency inversion' }
        ]
      },
      {
        id: '06-concurrency',
        name: 'Concurrency and Locking',
        concepts: [
          { id: 'optimistic-locking', name: 'Optimistic locking' },
          { id: 'fencing-tokens', name: 'Fencing tokens' }
        ]
      }
    ]
  };
}

module.exports = { makeTempKit, writeBank, writeResults, sampleBank };
