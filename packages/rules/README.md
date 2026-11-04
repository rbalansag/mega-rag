# @rbalansag/rules

MDC guardrail rules, domain overlays, and `AGENTS.md` / `llms.txt` templates.

- `rules/01-scaffolding.mdc` … `05-telemetry.mdc` — core rules
- `domains/{saas,e-commerce,logistics,gaming}.mdc` — domain overlays
- `templates/AGENTS.md.tmpl`, `templates/llms.txt.tmpl`
- `manifest.json` — slugs, descriptions, globs, content hashes

Build: `npm run build` (runs `scripts/compile-rules.js`).
Use `@rbalansag/cli` to install and sync these into a project.
