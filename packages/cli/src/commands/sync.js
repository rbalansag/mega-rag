import { parseArgs } from 'node:util';
import { loadConfig } from '../lib/config.js';
import { loadRulesPackage, syncRules } from '../lib/rules.js';
import { CliError } from '../lib/errors.js';

export async function sync(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { force: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
    }));
  } catch (e) {
    throw new CliError(e.message);
  }
  if (values.help) {
    console.log('Usage: mega-rag sync [--force] [--dry-run]\n\n  --force    overwrite managed rules that you edited locally\n  --dry-run  show what would change');
    return;
  }

  const cwd = process.cwd();
  const config = await loadConfig(cwd);
  const pkg = await loadRulesPackage(cwd);
  const r = await syncRules({ cwd, config, pkg, force: values.force, dryRun: values['dry-run'] });

  const prefix = values['dry-run'] ? '[dry-run] ' : '';
  const list = (label, items) => items.length && console.log(`${prefix}${label}: ${items.join(', ')}`);
  list('added', r.added);
  list('updated', r.updated);
  list('overwritten (--force)', r.forced);
  list('skipped (local changes; use --force, or add to rules.exclude to own it)', r.skipped);
  console.log(`${prefix}${r.unchanged.length} up to date. Custom rules in ${config.rulesDir} were left untouched.`);
}
