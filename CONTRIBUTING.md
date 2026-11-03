# Contributing

Start with a small reproducible browser workflow. DemoPilot prioritizes repeatable recordings and understandable exports over a large editing feature set.

## Local development

Use Node.js 22+, FFmpeg/ffprobe, and Playwright Chromium. Follow the README setup, then `npm run dev`. Server changes require a restart; Vite reloads the client.

Before a pull request:

```bash
npm run check
npm test
npm run build
npm run test:e2e
```

End-to-end tests use loopback ports 4322/4323, fresh browser sessions and synthetic data. They generate local evidence under ignored `test-results/`. Test media can be refreshed under `docs/media/`; review it before committing.

## Project map

- `src/shared`: versioned recipes, types and sample recipe.
- `src/server/capture.ts`: browser actions, readiness and original scenes.
- `src/server/render.ts`: edit planning, templates and media output.
- `src/server/app.ts`: loopback-only API; `cli.ts`: the same pipeline from a terminal.
- `src/client`: Studio. “Final cut” must always show a real export.
- `examples/sample.html`: isolated synthetic app used in the demo and tests.
- `tests`: behavior checks and real capture/render/UI integration.

Changes to a recipe's semantics need an identity/migration decision. Preserve original footage. Do not silently retry potentially consequential actions. Keep dependencies locked and explain new licenses or services. Use explicit error states instead of simulated success.

For a bug report, include OS, Node/Chromium/FFmpeg versions, a minimal recipe, expected/actual behavior, and a synthetic reproduction. Remove personal data and secrets from logs, captures and URLs. For design or recording changes, attach a real screenshot or short clip and describe what it demonstrates.

Repository quality requirements: [AGENTS.md](AGENTS.md), [QUALITY_BRIEF.md](docs/QUALITY_BRIEF.md). Contributions remain under MIT.
