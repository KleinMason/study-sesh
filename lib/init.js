'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { kitRoot } = require('./config');
const { flagValue } = require('./args');

const DEFAULT_STATE = { version: 1, cursor: { categoryId: null, round: 1 } };

function initKit(root, options = {}) {
  const created = [];
  const skipped = [];

  const configPath = path.join(root, 'config.json');
  if (fs.existsSync(configPath)) {
    skipped.push('config.json');
  } else {
    const example = JSON.parse(
      fs.readFileSync(path.join(root, 'config.example.json'), 'utf8')
    );
    if (options.dataDir) example.dataDir = options.dataDir;
    fs.writeFileSync(configPath, JSON.stringify(example, null, 2) + '\n');
    created.push('config.json');
  }

  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const dataDir = path.isAbsolute(cfg.dataDir)
    ? cfg.dataDir
    : path.resolve(root, cfg.dataDir);

  const keysDir = path.join(dataDir, 'quizzes', '.keys');
  if (fs.existsSync(keysDir)) {
    skipped.push(keysDir);
  } else {
    fs.mkdirSync(keysDir, { recursive: true });
    created.push(keysDir);
  }

  const statePath = path.join(dataDir, 'state.json');
  if (fs.existsSync(statePath)) {
    skipped.push('state.json');
  } else {
    fs.writeFileSync(statePath, JSON.stringify(DEFAULT_STATE, null, 2) + '\n');
    created.push('state.json');
  }

  return { created, skipped, dataDir };
}

// `init` is the first command a new user runs, and initKit never overwrites an existing
// config.json — so a data-dir flag that parses to nothing is not merely ignored, it is
// baked in until the user hand-edits. Both spellings must work.
function parseOptions(argv) {
  const dataDir = flagValue(argv, '--data-dir');
  if (!dataDir.present) return {};
  if (!dataDir.value) {
    const err = new Error('--data-dir requires a path');
    err.usage = true;
    throw err;
  }
  return { dataDir: dataDir.value };
}

function command(argv = []) {
  let options;
  try {
    options = parseOptions(argv);
  } catch (err) {
    if (err.usage) {
      process.stderr.write(`${err.message}\n`);
      return 2;
    }
    throw err;
  }
  const root = kitRoot();
  const report = initKit(root, options);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.stderr.write(
    `\nNext: install the runner templates from runners/local-task.md into ` +
    `~/.claude/scheduled-tasks/, then run \`study next-topic\` to confirm.\n`
  );
  return 0;
}

module.exports = { initKit, parseOptions, command };
