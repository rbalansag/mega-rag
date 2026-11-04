import { readFile } from 'node:fs/promises';
import { CliError } from './lib/errors.js';

const HELP = `mega-rag — AI guardrail scaffolding engine

Usage:
  mega-rag init [name] [options]   Scaffold a new project (interactive wizard)
  mega-rag sync [--force] [--dry-run]
                                   Update .cursor/rules from @rbalansag/rules
                                   without overwriting custom rules
  mega-rag check [--ci]            Fail if managed rules drifted or are missing
  mega-rag --version | --help

Run "mega-rag init --help" for init options.`;

export async function run(argv) {
  const [command, ...rest] = argv;

  switch (command) {
    case undefined:
    case 'init': {
      const { init } = await import('./commands/init.js');
      return init(rest);
    }
    case 'sync': {
      const { sync } = await import('./commands/sync.js');
      return sync(rest);
    }
    case 'check': {
      const { check } = await import('./commands/check.js');
      return check(rest);
    }
    case '-h':
    case '--help':
    case 'help':
      console.log(HELP);
      return;
    case '-v':
    case '--version': {
      const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
      console.log(pkg.version);
      return;
    }
    default:
      throw new CliError(`Unknown command "${command}".\n\n${HELP}`);
  }
}
