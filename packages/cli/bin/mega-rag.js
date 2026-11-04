#!/usr/bin/env node
import { run } from '../src/index.js';

run(process.argv.slice(2)).catch((err) => {
  if (err && err.name === 'CliError') {
    console.error(`\nError: ${err.message}`);
    process.exit(err.exitCode ?? 1);
  }
  console.error('\nUnexpected error:', err?.stack ?? err);
  process.exit(1);
});
