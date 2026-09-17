'use strict';
const fs = require('node:fs');
const path = require('node:path');

// The kit root is the directory containing this lib/ folder's parent.
function kitRoot() {
  return path.resolve(__dirname, '..');
}

function loadConfig(root = kitRoot()) {
  const configPath = path.join(root, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `No config.json at ${configPath}. Run \`study init\` to create one.`
    );
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`config.json is not valid JSON: ${err.message}`);
  }
  const resolve = (p) => (path.isAbsolute(p) ? p : path.resolve(root, p));
  if (!raw.dataDir) throw new Error('config.json is missing "dataDir"');
  return {
    root,
    dataDir: resolve(raw.dataDir),
    syllabusPath: resolve(raw.syllabus || 'syllabus/concept-bank.json'),
    timezone: raw.timezone || 'America/Chicago'
  };
}

// YYYY-MM-DD in the given IANA timezone. Never use toISOString() for this:
// it returns the UTC date, which is wrong after 6pm Central.
function today(timezone, now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return fmt.format(now);
}

module.exports = { kitRoot, loadConfig, today };
