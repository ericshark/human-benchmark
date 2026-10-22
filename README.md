# HumanRank

A locally developed human-performance arcade: twelve working games, six categories, personal history, and transparent statistics. Play without an account. Online accounts and population contribution are optional and require a configured backend.

## Local development

Requires Node.js 24+ and npm.

```sh
npm ci
npm run dev
```

The launcher tries **http://127.0.0.1:5174**, then increments if occupied. Preview starts at 4174. It never starts on Vite's default development or preview port. Stop the process with Ctrl+C when finished. History belongs to the browser origin, including its port.

```sh
npm run check     # types, lint, domain/database tests, production build
npm run test:e2e  # headless Chromium, Firefox, and WebKit; start the dev server first
npm run preview  # local preview of dist; not a production server
```

Install browser binaries/system dependencies with `npx playwright install --with-deps`. System dependencies may require administrator access. Browser tests use actual UI interactions and controlled clocks to verify gameplay; they do not establish physical hardware timing accuracy.

## Games

| Category | Games |
| --- | --- |
| Reflexes | Signal, Crossroads |
| Memory | Grid Recall, Echo Path |
| Focus | Color Conflict, Rule Shift |
| Reasoning | Pattern Forge, Rotation Lab |
| Precision | Target Burst, Orbit Track |
| Processing speed | Symbol Match, Math Sprint |

Each game includes instructions, an interactive practice session, a full assessment, error/timeout handling, and results. Practice tutorials are shorter and not saved. Daily circuits have separate records and shared seeds. Personal achievements reward participation, independently of performance.

## Your data

IndexedDB stores versioned sessions and an optional online upload queue. Settings supports JSON export/import, persistence requests, and deletion. History and records separate game, protocol, mode, and input. Charts are based on actual play. Population percentiles and profile rarity remain unavailable until the configured online service has qualifying cohorts.

With no `.env.local`, no authentication or game-data service is contacted. Fonts ship with the app. Copy `.env.example` only when connecting a backend; frontend-prefixed values must never include privileged keys.

## Architecture and roadmap

- `src/games`: metadata registry, deterministic generators, and independent game views.
- `src/engine`: scheduling, seeded randomness, input/timing lifecycle, completion audio.
- `src/domain`: schemas, scoring, and cohort/rarity calculations.
- `src/storage`: IndexedDB and migrations.
- `src/features`: catalog, gameplay, results, profile, challenges, and settings.
- `src/server` and `supabase`: optional authenticated data services and PostgreSQL policies.

The approved [implementation plan](docs/implementation-plan.md) defines all three phases. [Measurement research](docs/measurement-research.md) records primary sources and statistical limitations. Public hosting and production data collection require configuration and launch validation; this repository is not automatically deployed.
