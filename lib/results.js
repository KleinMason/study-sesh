'use strict';
const fs = require('node:fs');
const path = require('node:path');

function resultsPath(dataDir) {
  return path.join(dataDir, 'results.jsonl');
}

function readResults(dataDir) {
  const file = resultsPath(dataDir);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`results.jsonl line ${i + 1} is not valid JSON: ${err.message}`);
      }
    });
}

// One entry per (quiz, question). Later lines supersede earlier ones, which is how
// a contested-and-overturned grade replaces its original without a rewrite.
function resolveLatest(entries) {
  const byKey = new Map();
  for (const e of entries) {
    byKey.set(`${e.quiz}#${e.q}`, e);
  }
  return [...byKey.values()];
}

function conceptStats(entries) {
  const stats = new Map();
  for (const e of resolveLatest(entries)) {
    let s = stats.get(e.conceptId);
    if (!s) {
      s = {
        conceptId: e.conceptId,
        categoryId: e.categoryId,
        count: 0,
        totalScore: 0,
        meanScore: 0,
        lastTs: e.ts,
        misses: []
      };
      stats.set(e.conceptId, s);
    }
    s.count += 1;
    s.totalScore += typeof e.score === 'number' ? e.score : 0;
    s.meanScore = s.totalScore / s.count;
    if (e.ts > s.lastTs) s.lastTs = e.ts;
    if ((typeof e.score === 'number' ? e.score : 0) < 1) {
      s.misses.push({ quiz: e.quiz, q: e.q, note: e.note || null });
    }
  }
  return stats;
}

function coveredConceptIds(entries) {
  return new Set(entries.map((e) => e.conceptId));
}

function gradedQuizIds(entries) {
  return new Set(entries.map((e) => e.quiz));
}

function appendResults(dataDir, entries) {
  if (entries.length === 0) return 0;
  fs.mkdirSync(dataDir, { recursive: true });
  const payload = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.appendFileSync(resultsPath(dataDir), payload);
  return entries.length;
}

module.exports = {
  resultsPath, readResults, resolveLatest, conceptStats,
  coveredConceptIds, gradedQuizIds, appendResults
};
