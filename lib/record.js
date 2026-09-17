'use strict';
const { loadConfig } = require('./config');
const { loadBank, allConceptIds } = require('./bank');
const { appendResults } = require('./results');

const REQUIRED = ['ts', 'quiz', 'categoryId', 'conceptId', 'q', 'type', 'score'];

// `ts` drives the review cooldown and the per-concept lastTs comparison. An unparseable
// value makes `new Date(ts).getTime() > cutoff` evaluate NaN > cutoff, which is false, so
// the cooldown fails open instead of loudly. Reject it at the boundary instead.
function isIsoTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(new Date(value).getTime());
}

function validateEntries(entries, validConceptIds) {
  const errors = [];
  entries.forEach((e, i) => {
    const at = `entry ${i}:`;
    if (typeof e !== 'object' || e === null) {
      errors.push(`${at} not an object`);
      return;
    }
    for (const field of REQUIRED) {
      if (e[field] === undefined) errors.push(`${at} missing "${field}"`);
    }
    if (e.ts !== undefined && !isIsoTimestamp(e.ts)) {
      errors.push(`${at} ts must be an ISO 8601 timestamp, got: ${JSON.stringify(e.ts)}`);
    }
    if (e.conceptId !== undefined && !validConceptIds.has(e.conceptId)) {
      errors.push(`${at} unknown conceptId: ${e.conceptId}`);
    }
    if (e.q !== undefined && !Number.isInteger(e.q)) {
      errors.push(`${at} q must be an integer`);
    }
    if (e.type !== undefined && e.type !== 'mc' && e.type !== 'short') {
      errors.push(`${at} type must be "mc" or "short"`);
    }
    if (typeof e.score !== 'number' || e.score < 0 || e.score > 1) {
      errors.push(`${at} score must be between 0 and 1`);
    }
    if (e.type === 'mc' && (e.correct === null || e.correct === undefined)) {
      errors.push(`${at} multiple-choice entries need correct: true or false`);
    }
  });
  return errors;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { buf += chunk; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

async function command() {
  // Without this the command waits for EOF forever when run straight from a terminal,
  // looking like a hang rather than a usage mistake.
  if (process.stdin.isTTY) {
    process.stderr.write(
      'record-result reads a JSON array of results on stdin.\n' +
      'Pipe one in, e.g.  echo \'[{...}]\' | study record-result\n'
    );
    return 2;
  }
  const cfg = loadConfig();
  const bank = loadBank(cfg.syllabusPath);
  const raw = await readStdin();

  let entries;
  try {
    entries = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`stdin is not valid JSON: ${err.message}\n`);
    return 1;
  }
  if (!Array.isArray(entries)) {
    process.stderr.write('stdin must be a JSON array of result entries\n');
    return 1;
  }

  const errors = validateEntries(entries, allConceptIds(bank));
  if (errors.length > 0) {
    process.stderr.write(errors.join('\n') + '\nNothing was written.\n');
    return 1;
  }

  const count = appendResults(cfg.dataDir, entries);
  process.stdout.write(JSON.stringify({ appended: count }) + '\n');
  return 0;
}

module.exports = { validateEntries, command };
