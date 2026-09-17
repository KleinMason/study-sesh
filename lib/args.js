'use strict';

// Reads a CLI flag that takes a value, accepting both `--flag value` and
// `--flag=value`. Callers need to tell "absent" apart from "present but empty"
// so that `--flag` with nothing after it is a usage error rather than a silent
// default, hence the { present, value } shape instead of a bare string.
function flagValue(argv, name) {
  const prefix = `${name}=`;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === name) return { present: true, value: argv[i + 1] };
    if (typeof arg === 'string' && arg.startsWith(prefix)) {
      return { present: true, value: arg.slice(prefix.length) };
    }
  }
  return { present: false, value: undefined };
}

module.exports = { flagValue };
