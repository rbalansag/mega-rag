import { parseArgs } from 'node:util';
import fs from 'fs-extra';
import path from 'node:path';
import { loadConfig } from '../lib/config.js';
import { buildPlan, loadRulesPackage } from '../lib/rules.js';
import { CliError } from '../lib/errors.js';

const MESSAGES = {
  missing: 'is missing. Run: npx @rbalansag/cli sync',
  outdated: 'is out of date with @rbalansag/rules. Run: npx @rbalansag/cli sync',
  modified: 'differs from @rbalansag/rules. Run sync --force to reset it, or add it to "rules.exclude" to own it.',
};

export async function check(argv) {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: { ci: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } }));
  } catch (e) {
    throw new CliError(e.message);
  }
  if (values.help) {
    console.log('Usage: mega-rag check [--ci]\n\nExits 1 if managed rules are missing or drifted. --ci emits GitHub annotations.');
    return;
  }

  const cwd = process.cwd();
  const config = await loadConfig(cwd);
  const pkg = await loadRulesPackage(cwd);
  const plan = await buildPlan({ cwd, config, pkg });

  const problems = [];
  for (const e of plan.entries) {
    if (e.status !== 'current') problems.push({ file: path.join(config.rulesDir, e.target), msg: `${e.target} ${MESSAGES[e.status]}` });
  }
  if (config.envValidator && !(await fs.pathExists(path.join(cwd, config.envValidator)))) {
    problems.push({ file: config.envValidator, msg: `env validator "${config.envValidator}" (from mega-rag.config.json) not found.` });
  }

  if (problems.length === 0) {
    console.log(`Guardrails in sync: ${plan.entries.length} managed rule(s) checked.`);
    return;
  }
  for (const p of problems) {
    console.error(values.ci ? `::error file=${p.file}::${p.msg}` : `✖ ${p.msg}`);
  }
  console.error(`\n${problems.length} guardrail problem(s) found.`);
  process.exitCode = 1;
}
