# @rbalansag/cli

Interactive scaffolding engine for Mega RAG.

```bash
npx @rbalansag/cli init my-app          # wizard
npx @rbalansag/cli init my-app --platform backend --stack go --arch layered --domain logistics --docker --yes
npx @rbalansag/cli sync                 # refresh .cursor/rules from @rbalansag/rules
npx @rbalansag/cli check --ci           # fail on missing/drifted rules (use in CI)
```

Packages are published to GitHub Packages. Consumers need:

```ini
# .npmrc
@rbalansag:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

## How sync stays non-destructive
- Only rules listed by `@rbalansag/rules` (plus selected `domain-*.mdc` overlays) are managed. Your own `.mdc` files are never touched.
- `.cursor/rules/.mega-rag-lock.json` records the hash of each managed file as installed. `sync` updates a file only if you haven't edited it; edited files are skipped (use `--force` to reset).
- To own a managed rule, add its slug to `rules.exclude` in `mega-rag.config.json`.

## mega-rag.config.json
```json
{
  "version": 1,
  "rulesDir": ".cursor/rules",
  "rules": { "include": ["*"], "exclude": [] },
  "domains": ["saas"],
  "envValidator": "src/env.ts"
}
```
