import path from 'node:path';
import { parseArgs } from 'node:util';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import { execa } from 'execa';
import { CliError } from '../lib/errors.js';
import { writeConfig } from '../lib/config.js';
import { loadRulesPackage, syncRules } from '../lib/rules.js';
import {
  PLATFORMS,
  STACKS,
  ARCHITECTURES,
  DESIGN,
  DOMAINS,
  GITIGNORE_BASE,
  GITIGNORE_BY_STACK,
} from '../templates/layouts.js';
import { renderTemplate, DOCKER_COMPOSE } from '../templates/render.js';

const NAME_RE = /^[a-z0-9][a-z0-9-_]*$/i;

const HELP = `Usage: mega-rag init [name] [options]

Runs the interactive wizard. Any option below skips its prompt.

  --platform <${Object.keys(PLATFORMS).join('|')}>
  --stack <${Object.keys(STACKS).join('|')}>
  --arch <${Object.keys(ARCHITECTURES).join('|')}>
  --design <value>           depends on platform (e.g. tailwind-shadcn, material3, custom)
  --domain <${Object.keys(DOMAINS).join('|')}>
  --docker | --no-docker     include docker-compose.yml (Postgres + Redis)
  --telemetry | --no-telemetry
  --git | --no-git           run "git init"
  -y, --yes                  accept defaults for anything not given
  --force                    allow a non-empty target directory`;

function cancelled() {
  p.cancel('Cancelled.');
  process.exit(0);
}

/** Use the flag value if given (validated), the default under --yes, otherwise prompt. */
async function resolve({ flag, valid, yes, fallback, prompt, label }) {
  if (flag !== undefined) {
    if (!valid.includes(flag)) throw new CliError(`Invalid ${label} "${flag}". Expected one of: ${valid.join(', ')}`);
    return flag;
  }
  if (yes) return fallback;
  const answer = await prompt();
  if (p.isCancel(answer)) cancelled();
  return answer;
}

function parse(argv) {
  try {
    return parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        name: { type: 'string' },
        platform: { type: 'string' },
        stack: { type: 'string' },
        arch: { type: 'string' },
        design: { type: 'string' },
        domain: { type: 'string' },
        docker: { type: 'boolean' },
        'no-docker': { type: 'boolean' },
        telemetry: { type: 'boolean' },
        'no-telemetry': { type: 'boolean' },
        git: { type: 'boolean' },
        'no-git': { type: 'boolean' },
        yes: { type: 'boolean', short: 'y' },
        force: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (e) {
    throw new CliError(e.message);
  }
}

const tri = (on, off) => (on ? true : off ? false : undefined);

async function askBool({ flag, yes, fallback, message }) {
  if (flag !== undefined) return flag;
  if (yes) return fallback;
  const answer = await p.confirm({ message, initialValue: fallback });
  if (p.isCancel(answer)) cancelled();
  return answer;
}

export async function init(argv) {
  const { values, positionals } = parse(argv);
  if (values.help) {
    console.log(HELP);
    return;
  }
  const yes = Boolean(values.yes);

  p.intro('🚀 Mega RAG — project scaffolding');

  // Step 0: name
  let name = positionals[0] ?? values.name;
  if (name === undefined) {
    if (yes) throw new CliError('A project name is required with --yes.');
    name = await p.text({
      message: 'Project name',
      placeholder: 'my-app',
      validate: (v) => (NAME_RE.test(v ?? '') ? undefined : 'Use letters, numbers, "-" or "_" (start with a letter or number).'),
    });
    if (p.isCancel(name)) cancelled();
  }
  if (!NAME_RE.test(name)) throw new CliError(`Invalid project name "${name}". Use letters, numbers, "-" or "_".`);

  // Step 1: platform
  const platform = await resolve({
    flag: values.platform,
    valid: Object.keys(PLATFORMS),
    yes,
    fallback: 'web',
    label: 'platform',
    prompt: () =>
      p.select({
        message: 'Target platform',
        options: Object.entries(PLATFORMS).map(([value, { label }]) => ({ value, label })),
      }),
  });

  // Step 2: framework / language / engine (branches on platform)
  const stackChoices = PLATFORMS[platform].stacks;
  const stackId = await resolve({
    flag: values.stack,
    valid: stackChoices,
    yes,
    fallback: stackChoices[0],
    label: `stack for platform "${platform}"`,
    prompt: () =>
      p.select({
        message: 'Framework / language / engine',
        options: stackChoices.map((value) => ({ value, label: STACKS[value].label })),
      }),
  });

  // Step 3: folder architecture
  const arch = await resolve({
    flag: values.arch,
    valid: Object.keys(ARCHITECTURES),
    yes,
    fallback: 'layered',
    label: 'architecture',
    prompt: () =>
      p.select({
        message: 'Folder architecture',
        options: Object.entries(ARCHITECTURES).map(([value, { label }]) => ({ value, label })),
      }),
  });

  // Step 4: design system & UI
  const designChoices = DESIGN[platform];
  const design = await resolve({
    flag: values.design,
    valid: designChoices.map((d) => d.value),
    yes,
    fallback: designChoices[0].value,
    label: 'design system',
    prompt: () => p.select({ message: 'Design system & UI', options: designChoices }),
  });

  // Step 5: domain overlay
  const domain = await resolve({
    flag: values.domain,
    valid: Object.keys(DOMAINS),
    yes,
    fallback: 'none',
    label: 'domain overlay',
    prompt: () =>
      p.select({
        message: 'Domain overlay',
        options: Object.entries(DOMAINS).map(([value, label]) => ({ value, label })),
      }),
  });

  // Step 6: telemetry & docker (+ git)
  const telemetry = await askBool({ flag: tri(values.telemetry, values['no-telemetry']), yes, fallback: true, message: 'Scaffold a telemetry module (event schema + offline queue)?' });
  const docker = await askBool({ flag: tri(values.docker, values['no-docker']), yes, fallback: platform === 'backend' || platform === 'web', message: 'Add docker-compose.yml (Postgres + Redis)?' });
  const git = await askBool({ flag: tri(values.git, values['no-git']), yes, fallback: true, message: 'Initialize a git repository?' });

  const target = path.resolve(process.cwd(), name);
  if ((await fs.pathExists(target)) && (await fs.readdir(target)).length > 0 && !values.force) {
    if (yes) throw new CliError(`Directory "${name}" is not empty. Use --force to continue.`);
    const ok = await p.confirm({ message: `Directory "${name}" is not empty. Continue and keep existing files?`, initialValue: false });
    if (p.isCancel(ok) || !ok) cancelled();
  }

  const s = p.spinner();
  s.start('Scaffolding project');
  let summary;
  try {
    summary = await generate({ target, name, platform, stackId, arch, design, domain, telemetry, docker });
    if (git) {
      try {
        await execa('git', ['init', '-q'], { cwd: target });
      } catch {
        p.log.warn('Could not run "git init" (is git installed?). Skipping.');
      }
    }
  } catch (e) {
    s.stop('Scaffolding failed');
    throw e;
  }
  s.stop(`Created ${name}/`);

  const stack = STACKS[stackId];
  const steps = [`cd ${name}`];
  if (stack.ts) steps.push('npm install   # needs access to the GitHub Packages registry for @rbalansag/*');
  steps.push('npx @rbalansag/cli check   # verify guardrails are in sync');
  if (stack.note) steps.push(stack.note);
  p.note(steps.join('\n'), 'Next steps');
  p.outro(`Done. ${summary.rules} guardrail rule(s) installed in .cursor/rules/`);
}

async function generate({ target, name, platform, stackId, arch, design, domain, telemetry, docker }) {
  const stack = STACKS[stackId];
  const archDef = ARCHITECTURES[arch];
  const dirs = new Set(stack.dirs);

  for (const d of archDef.dirs) dirs.add(`${stack.root}/${d}`);
  if (design !== 'none') dirs.add(`${stack.root}/design/tokens`);
  if (telemetry) dirs.add(`${stack.root}/telemetry`);

  await fs.ensureDir(target);
  for (const d of dirs) await fs.outputFile(path.join(target, d, '.gitkeep'), '');

  // starter files + env validator + .env.example
  const files = { ...stack.files({ name }), [stack.env.path]: stack.env.content };
  let envExample = stack.envExample;
  if (docker) envExample += 'REDIS_URL=redis://localhost:6379\n';
  files['.env.example'] = envExample;
  files['.gitignore'] = [...new Set([...GITIGNORE_BASE, ...(GITIGNORE_BY_STACK[stackId] ?? [])])].join('\n') + '\n';
  if (docker) files['docker-compose.yml'] = DOCKER_COMPOSE;
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(target, rel);
    if (!(await fs.pathExists(file))) await fs.outputFile(file, content);
  }

  // mega-rag.config.json then .cursor/rules via the same sync engine
  const config = {
    version: 1,
    rulesDir: '.cursor/rules',
    rules: { include: ['*'], exclude: [] },
    domains: domain === 'none' ? [] : [domain],
    envValidator: stack.env.path,
  };
  await writeConfig(target, config);
  const pkg = await loadRulesPackage(target);
  await syncRules({ cwd: target, config, pkg });

  // AGENTS.md + llms.txt
  const selected = [...pkg.manifest.rules, ...pkg.manifest.domains.filter((d) => d.slug === domain)];
  const rulesList = selected
    .map((r) => `- \`${r.kind === 'domain' ? 'domain-' : ''}${r.file}\` — ${r.description}`)
    .join('\n');
  const layout = [...dirs].sort().map((d) => `- \`${d}/\``).join('\n');
  const vars = {
    name,
    platform: PLATFORMS[platform].label,
    stack: stack.label,
    lang: stack.lang,
    architecture: archDef.label,
    design: (DESIGN[platform].find((d) => d.value === design) ?? { label: design }).label,
    domain: DOMAINS[domain],
    envPath: stack.env.path,
    layout,
    rules: rulesList,
  };
  const tplDir = path.join(pkg.distDir, 'templates');
  for (const [tpl, out] of [['AGENTS.md.tmpl', 'AGENTS.md'], ['llms.txt.tmpl', 'llms.txt']]) {
    const tplText = await fs.readFile(path.join(tplDir, tpl), 'utf8');
    await fs.outputFile(path.join(target, out), renderTemplate(tplText, vars));
  }

  return { rules: selected.length };
}
