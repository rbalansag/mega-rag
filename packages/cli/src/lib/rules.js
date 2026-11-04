import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import { CliError } from './errors.js';

const LOCK_FILE = '.mega-rag-lock.json';
const RULES_PKG = '@rbalansag/rules';

export const normalize = (s) => s.replace(/\r\n/g, '\n');
export const hash = (s) => createHash('sha256').update(s).digest('hex');

/** Resolve the rules package: prefer the one installed in the project, fall back to the CLI's own dependency. */
export async function loadRulesPackage(cwd) {
  const requirers = [createRequire(path.join(cwd, 'package.json')), createRequire(import.meta.url)];
  let pkgJson = null;
  for (const req of requirers) {
    try {
      pkgJson = req.resolve(`${RULES_PKG}/package.json`);
      break;
    } catch {
      /* try next */
    }
  }
  if (!pkgJson) {
    throw new CliError(`Cannot find ${RULES_PKG}. Install it with: npm i -D ${RULES_PKG}`);
  }
  const distDir = path.join(path.dirname(pkgJson), 'dist');
  const manifestFile = path.join(distDir, 'manifest.json');
  if (!(await fs.pathExists(manifestFile))) {
    throw new CliError(`${RULES_PKG} is not built (missing ${manifestFile}). In the monorepo run: npm run build`);
  }
  const manifest = await fs.readJson(manifestFile);
  return { distDir, manifest };
}

export function selectFiles(manifest, config) {
  const include = config.rules?.include ?? ['*'];
  const exclude = config.rules?.exclude ?? [];

  const core = manifest.rules
    .filter((r) => (include.includes('*') || include.includes(r.slug)) && !exclude.includes(r.slug))
    .map((r) => ({ slug: r.slug, target: r.file, source: `rules/${r.file}` }));

  const domains = (config.domains ?? []).map((d) => {
    const entry = manifest.domains.find((x) => x.slug === d);
    if (!entry) {
      const known = manifest.domains.map((x) => x.slug).join(', ');
      throw new CliError(`Unknown domain overlay "${d}" in ${'mega-rag.config.json'}. Available: ${known}`);
    }
    return { slug: `domain-${d}`, target: `domain-${entry.file}`, source: `domains/${entry.file}` };
  });

  return [...core, ...domains];
}

async function readLock(dir) {
  try {
    const lock = await fs.readJson(path.join(dir, LOCK_FILE));
    return { files: lock.files ?? {} };
  } catch {
    return { files: {} };
  }
}

/**
 * Compare managed rules against the installed package.
 * status: missing | current | outdated (untouched locally, package moved on) | modified (changed locally)
 */
export async function buildPlan({ cwd, config, pkg }) {
  const dir = path.join(cwd, config.rulesDir);
  const lock = await readLock(dir);
  const entries = [];
  for (const f of selectFiles(pkg.manifest, config)) {
    const content = normalize(await fs.readFile(path.join(pkg.distDir, f.source), 'utf8'));
    const srcHash = hash(content);
    const targetPath = path.join(dir, f.target);
    let status;
    let localHash = null;
    if (!(await fs.pathExists(targetPath))) {
      status = 'missing';
    } else {
      localHash = hash(normalize(await fs.readFile(targetPath, 'utf8')));
      if (localHash === srcHash) status = 'current';
      else if (lock.files[f.target] === localHash) status = 'outdated';
      else status = 'modified';
    }
    entries.push({ ...f, content, srcHash, targetPath, status });
  }
  return { dir, lock, entries };
}

/** Apply the plan. Never touches files that are not managed (custom rules) and skips locally modified ones unless forced. */
export async function syncRules({ cwd, config, pkg, force = false, dryRun = false }) {
  const plan = await buildPlan({ cwd, config, pkg });
  const result = { added: [], updated: [], unchanged: [], skipped: [], forced: [] };
  const files = { ...plan.lock.files };

  for (const e of plan.entries) {
    if (e.status === 'current') {
      result.unchanged.push(e.target);
      files[e.target] = e.srcHash;
      continue;
    }
    if (e.status === 'modified' && !force) {
      result.skipped.push(e.target);
      continue;
    }
    if (!dryRun) {
      await fs.outputFile(e.targetPath, e.content);
      files[e.target] = e.srcHash;
    }
    if (e.status === 'missing') result.added.push(e.target);
    else if (e.status === 'modified') result.forced.push(e.target);
    else result.updated.push(e.target);
  }

  if (!dryRun) {
    const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
    await fs.outputJson(path.join(plan.dir, LOCK_FILE), { files: sorted }, { spaces: 2 });
  }
  return result;
}
