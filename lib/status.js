'use strict';
const { loadConfig } = require('./config');
const { loadBank, findConcept } = require('./bank');
const { readResults, conceptStats, coveredConceptIds } = require('./results');
const { readState } = require('./rotation');

function buildStatus(bank, entries, state) {
  const covered = coveredConceptIds(entries);
  const categories = bank.categories.map((c) => ({
    id: c.id,
    name: c.name,
    covered: c.concepts.filter((concept) => covered.has(concept.id)).length,
    total: c.concepts.length
  }));

  const weakest = [...conceptStats(entries).values()]
    .map((s) => {
      const hit = findConcept(bank, s.conceptId);
      if (!hit) return null; // concept retired from the bank
      // Nothing was ever answered, so there is no score to be weak at. Showing it would
      // rank a blank quiz above every question the learner actually got wrong.
      if (!s.attempted) return null;
      return {
        conceptId: s.conceptId,
        conceptName: hit.concept.name,
        meanScore: s.meanScore
      };
    })
    .filter((w) => w !== null)
    .sort((a, b) => a.meanScore - b.meanScore || a.conceptId.localeCompare(b.conceptId))
    .slice(0, 5);

  return {
    round: (state && state.cursor && state.cursor.round) || 1,
    categories,
    weakest,
    totals: {
      conceptsCovered: categories.reduce((n, c) => n + c.covered, 0),
      conceptsTotal: categories.reduce((n, c) => n + c.total, 0)
    }
  };
}

function formatStatus(status) {
  const width = Math.max(...status.categories.map((c) => c.name.length));
  const lines = [
    `Round ${status.round} — ${status.totals.conceptsCovered}/${status.totals.conceptsTotal} concepts covered`,
    ''
  ];
  for (const c of status.categories) {
    lines.push(`  ${c.name.padEnd(width)}  ${c.covered}/${c.total}`);
  }
  if (status.weakest.length > 0) {
    lines.push('', 'Weakest concepts:');
    for (const w of status.weakest) {
      lines.push(`  ${w.meanScore.toFixed(2)}  ${w.conceptName}`);
    }
  }
  return lines.join('\n') + '\n';
}

function command() {
  const cfg = loadConfig();
  const bank = loadBank(cfg.syllabusPath);
  const entries = readResults(cfg.dataDir);
  const state = readState(cfg.dataDir);
  process.stdout.write(formatStatus(buildStatus(bank, entries, state)));
  return 0;
}

module.exports = { buildStatus, formatStatus, command };
