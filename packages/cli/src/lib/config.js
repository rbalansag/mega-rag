import path from 'node:path';
import fs from 'fs-extra';
import { CliError } from './errors.js';

export const CONFIG_FILE = 'mega-rag.config.json';

export const DEFAULT_CONFIG = {
  version: 1,
  rulesDir: '.cursor/rules',
  rules: { include: ['*'], exclude: [] },
  domains: [],
  envValidator: null,
};

export async function loadConfig(cwd) {
  const file = path.join(cwd, CONFIG_FILE);
  let user = {};
  const found = await fs.pathExists(file);
  if (found) {
    try {
      user = await fs.readJson(file);
    } catch (e) {
      throw new CliError(`Invalid JSON in ${file}: ${e.message}`);
    }
  }
  return {
    ...DEFAULT_CONFIG,
    ...user,
    rules: { ...DEFAULT_CONFIG.rules, ...(user.rules ?? {}) },
    found,
  };
}

export async function writeConfig(cwd, config) {
  const { found, ...clean } = config;
  await fs.writeJson(path.join(cwd, CONFIG_FILE), clean, { spaces: 2 });
}
