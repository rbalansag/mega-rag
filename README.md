# 🚀 Mega RAG: Universal Developer & AI Scaffolding Engine

Mega RAG (`rbalansag/mega-rag`) turns architectural standards into an automated scaffolding engine and real-time AI guardrail system. It injects glob-triggered rules (`.cursor/rules/*.mdc`), documentation feeds (`llms.txt`), and system blueprints (`AGENTS.md`) into codebases so AI coding agents (Cursor, Claude, Aider) follow your conventions.

## Packages

| Package | Purpose |
| --- | --- |
| `@rbalansag/rules` | Core `.mdc` rules (`01-scaffolding` … `05-telemetry`), domain overlays (`saas`, `e-commerce`, `logistics`, `gaming`), `AGENTS.md`/`llms.txt` templates, and a `manifest.json` |
| `@rbalansag/cli` | `init` wizard, non-destructive `sync`, and CI `check` (binary: `mega-rag`) |
| `@rbalansag/sdk` | Runtime helpers: `createEnvValidator`, `trackTelemetryEvent` (+ offline queue), `getPromptContext` |

## Two tiers

1. **Machine guardrails** — granular `.mdc` rules injected only when matching files are open (layer boundaries, security/env, design tokens + WCAG AA, domain modeling, telemetry schema).
2. **Updatable distribution** — rules ship as versioned npm packages. `sync` refreshes `.cursor/rules/` without overwriting your custom rules; `check` fails CI when rules drift.

## The CLI

```bash
npx @rbalansag/cli init my-app     # 6-step wizard
npx @rbalansag/cli sync            # update managed rules (custom rules untouched)
npx @rbalansag/cli check --ci      # exit 1 on missing/drifted rules
```

Wizard steps: **platform** (Web, Mobile Cross-Platform, Native, Backend, Game) → **framework/language/engine** (Next.js, Nuxt, Flutter, Expo, SwiftUI, Compose, Go, FastAPI, Rust Axum, Unity, Godot, WebGPU/Three.js) → **folder architecture** → **design system** → **domain overlay** → **telemetry / docker / git**.
Every prompt can be skipped with a flag (see `mega-rag init --help`), e.g.:

```bash
npx @rbalansag/cli init api --platform backend --stack go --arch layered --domain logistics --docker --yes
```

## Using the packages (GitHub Packages)

```ini
# .npmrc in the consuming project
@rbalansag:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

## Developing this monorepo

```bash
npm ci
npm run build            # compiles rules (dist/) and the SDK (tsc)
npm run rules:sync       # refresh the root .cursor/rules baseline
npm run rules:check      # same drift check CI runs
npm run change           # add a changeset
```

**Rule edits:** after changing anything in `packages/rules/src/`, run `npm run build && npm run rules:sync` and commit the updated `.cursor/rules/`. CI's drift check fails otherwise.

## CI/CD

- `ci.yml` — on push/PR to `main`: `npm ci` → build → `mega-rag check --ci`.
- `release.yml` — Changesets action: opens a `chore(release): version packages` PR, or publishes all three packages (fixed versioning) to `npm.pkg.github.com` using `GITHUB_TOKEN` when that PR merges.

## License

MIT © rbalansag
