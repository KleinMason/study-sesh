'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { kitRoot } = require('./config');

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

  fs.mkdirSync(path.join(dataDir, 'quizzes', '.keys'), { recursive: true });
  created.push(path.join(dataDir, 'quizzes', '.keys'));

  const statePath = path.join(dataDir, 'state.json');
  if (fs.existsSync(statePath)) {
    skipped.push('state.json');
  } else {
    fs.writeFileSync(statePath, JSON.stringify(DEFAULT_STATE, null, 2) + '\n');
    created.push('state.json');
  }

  return { created, skipped, dataDir };
}

function command(argv = []) {
  const i = argv.indexOf('--data-dir');
  const options = i === -1 ? {} : { dataDir: argv[i + 1] };
  if (i !== -1 && !options.dataDir) {
    process.stderr.write('--data-dir requires a path\n');
    return 2;
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

module.exports = { initKit, command };
