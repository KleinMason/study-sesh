'use strict';
const { loadConfig } = require('./config');
const { loadBank, findConcept } = require('./bank');
const { readResults, conceptStats } = require('./results');

const DAY_MS = 24 * 60 * 60 * 1000;

function reviewSet(bank, entries, options = {}) {
  const {
    count = 8,
    now = new Date(),
    cooldownDays = 3,
    floor = 0.15,
    rng = Math.random
  } = options;

  const cutoff = now.getTime() - cooldownDays * DAY_MS;
  const candidates = [];

  for (const stat of conceptStats(entries).values()) {
    const hit = findConcept(bank, stat.conceptId);
    if (!hit) continue; // concept retired from the bank
    if (new Date(stat.lastTs).getTime() > cutoff) continue; // still cooling down
    candidates.push({
      conceptId: stat.conceptId,
      conceptName: hit.concept.name,
      categoryId: hit.category.id,
      categoryName: hit.category.name,
      meanScore: stat.meanScore,
      misses: stat.misses,
      weight: Math.max(floor, 1 - stat.meanScore)
    });
  }

  const picked = [];
  const pool = candidates.slice();
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, c) => sum + c.weight, 0);
    let target = rng() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      target -= pool[i].weight;
      if (target <= 0) { index = i; break; }
    }
    const [chosen] = pool.splice(index, 1);
    const { weight, ...rest } = chosen;
    picked.push(rest);
  }
  return picked;
}

function parseCount(argv) {
  const i = argv.indexOf('--count');
  if (i === -1) return 8;
  const n = Number.parseInt(argv[i + 1], 10);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('--count must be a positive integer');
  }
  return n;
}

function command(argv = []) {
  const cfg = loadConfig();
  const bank = loadBank(cfg.syllabusPath);
  const entries = readResults(cfg.dataDir);
  const set = reviewSet(bank, entries, { count: parseCount(argv) });
  process.stdout.write(JSON.stringify(set, null, 2) + '\n');
  return 0;
}

module.exports = { reviewSet, command };
