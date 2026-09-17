'use strict';
const { loadConfig } = require('./config');
const { loadBank, findConcept } = require('./bank');
const { readResults, conceptStats } = require('./results');
const { flagValue } = require('./args');

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
    // Every question on this concept was skipped, so there is no answer to retest against.
    // Same rule as an ungraded concept: nothing to weight, nothing to return.
    if (stat.attempted === false) continue;
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
  const flag = flagValue(argv, '--count');
  if (!flag.present) return 8;
  const raw = flag.value || '';
  const n = Number.parseInt(raw, 10);
  if (!/^[0-9]+$/.test(raw) || n < 1) {
    const err = new Error('--count must be a positive integer');
    err.usage = true;
    throw err;
  }
  return n;
}

function command(argv = []) {
  let count;
  try {
    count = parseCount(argv);
  } catch (err) {
    if (err.usage) {
      process.stderr.write(`${err.message}\n`);
      return 2;
    }
    throw err;
  }
  const cfg = loadConfig();
  const bank = loadBank(cfg.syllabusPath);
  const entries = readResults(cfg.dataDir);
  const set = reviewSet(bank, entries, { count });
  process.stdout.write(JSON.stringify(set, null, 2) + '\n');
  return 0;
}

module.exports = { reviewSet, parseCount, command };
