#!/usr/bin/env node
// Compiles src/{rules,domains,templates} into dist/ and generates manifest.json + index.js/.d.ts.
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { glob } from 'glob';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const pkg = await fs.readJson(path.join(root, 'package.json'));

const normalize = (s) => s.replace(/\r\n/g, '\n');
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function parseFrontmatter(raw, file) {
  const m = normalize(raw).match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`${file}: missing "---" frontmatter block`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    meta[key] = value;
  }
  for (const key of ['description', 'globs', 'alwaysApply']) {
    if (!(key in meta)) throw new Error(`${file}: frontmatter is missing "${key}"`);
  }
  return meta;
}

async function collect(kind, dirName) {
  const files = (await glob('*.mdc', { cwd: path.join(src, dirName) })).sort();
  const out = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(src, dirName, file), 'utf8');
    const meta = parseFrontmatter(raw, `${dirName}/${file}`);
    const content = normalize(raw);
    await fs.outputFile(path.join(dist, dirName, file), content);
    out.push({
      slug: file.replace(/\.mdc$/, ''),
      file,
      kind,
      description: meta.description,
      globs: meta.globs,
      alwaysApply: meta.alwaysApply,
      hash: sha256(content),
    });
  }
  return out;
}

await fs.emptyDir(dist);

const rules = await collect('core', 'rules');
const domains = await collect('domain', 'domains');
if (rules.length === 0) throw new Error('No rules found in src/rules');

const templateFiles = (await glob('*', { cwd: path.join(src, 'templates'), dot: true })).sort();
for (const file of templateFiles) {
  await fs.copy(path.join(src, 'templates', file), path.join(dist, 'templates', file));
}

const manifest = { name: pkg.name, version: pkg.version, rules, domains, templates: templateFiles };
await fs.writeJson(path.join(dist, 'manifest.json'), manifest, { spaces: 2 });

await fs.writeFile(
  path.join(dist, 'index.js'),
  `import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const rulesDir = path.join(here, 'rules');
export const domainsDir = path.join(here, 'domains');
export const templatesDir = path.join(here, 'templates');
export const manifest = JSON.parse(readFileSync(path.join(here, 'manifest.json'), 'utf8'));

/** Read a core rule (e.g. "01-scaffolding") or a domain overlay (e.g. "saas") as a string. */
export function readRule(slug) {
  const entry =
    manifest.rules.find((r) => r.slug === slug) ?? manifest.domains.find((d) => d.slug === slug);
  if (!entry) throw new Error('Unknown rule: ' + slug);
  const dir = entry.kind === 'core' ? rulesDir : domainsDir;
  return readFileSync(path.join(dir, entry.file), 'utf8');
}
`,
);

await fs.writeFile(
  path.join(dist, 'index.d.ts'),
  `export interface RuleEntry {
  slug: string;
  file: string;
  kind: 'core' | 'domain';
  description: string | boolean;
  globs: string | boolean;
  alwaysApply: boolean | string;
  hash: string;
}
export interface Manifest {
  name: string;
  version: string;
  rules: RuleEntry[];
  domains: RuleEntry[];
  templates: string[];
}
export const manifest: Manifest;
export const rulesDir: string;
export const domainsDir: string;
export const templatesDir: string;
export function readRule(slug: string): string;
`,
);

console.log(
  `@rbalansag/rules: compiled ${rules.length} rules, ${domains.length} domain overlays, ${templateFiles.length} templates.`,
);
