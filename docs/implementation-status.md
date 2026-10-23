# HumanRank implementation status

Updated October 23, 2026 (America/New_York). The product and implementation plan are approved; continuing that scope does not require another plan approval.

## Checkout and handoff

The current checkout is `/home/eric/GitHub/interactive/human-benchmark`. The earlier handoff path `/home/eric/GitHub/games/human-benchmark` does not exist on this host. No `AGENTS.md` file was found in this checkout or its ancestor directories; the owner's supplied global instructions govern this work.

The previous committed baseline was `0df21ae` (`feat: build twelve-game local HumanRank arcade and personal profiles`), following the approved-plan commit `70c4260`. This stabilization change includes the previously uncommitted backend, statistics, tests, documentation, and local polish. Nothing has been pushed or publicly deployed. Use `git log -1` to identify the completed stabilization commit without embedding a self-referential hash here.

## Implemented capabilities

| Area | Implementation and verification boundary |
| --- | --- |
| Local arcade | Twelve playable games across six categories; instructions, interactive practice/remixes, assessments, interruption handling, and server-contract-compatible recordings. Browser automation exercises every game. Physical latency accuracy is not established by controlled test clocks. |
| Personal experience | Six-game introductory circuit; local daily/weekly challenges; achievements; profile coverage, history, records, charts, private notes, downloadable PNG cards, and responsive dark/light settings. |
| Local data | IndexedDB persistence, owner-scoped upload queue, JSON backup/import/delete, and visible storage-failure handling. Local play needs no account or backend. |
| Optional online client | Supabase sign-in/account controls, separate sync/statistics choices, explicit history upload, server-issued assessments, retry, sharing, and rating-history views. Client regression tests simulate Auth and HTTP; no real account/email flow has been verified. |
| Backend | Edge functions and PostgreSQL migration with RLS, owner checks, server recomputation, daily token constraints, idempotent finalization, rate limiting, consent withdrawal, deletion, retention, and revocable shares. Tests execute the actual migration in PGlite; this is not a complete Supabase installation. |
| Population statistics | One recent aggregate per opted-in player/game/cohort, release gates, midrank percentiles, bootstrap intervals, equal-category composite, complete-profile requirements, frozen references, and historical rating provenance. Synthetic fixtures are test inputs, never public reference populations. |
| Profile unusualness | Correlation-aware model with separate fitting/calibration/evaluation folds and stability checks. `ENABLE_PROFILE_RARITY` stays off by default pending real pilot review. Unusualness is not matching-profile prevalence; percentiles are never multiplied into “1 in X.” |
| Release tooling | Production build, headless browser runners with owned-server cleanup, security headers, font licenses, CI, backend setup, and operations documentation. A checked-in CI workflow does not establish a successful remote run. |

The queue regressions exposed and fixed three client defects: consent briefly carried over during an account switch; consent/profile refresh did not restart pending work; and a drain request made during an in-flight upload was discarded. Consent is now cleared on identity changes and checked against its owner before upload, profile changes restart draining, and a concurrent drain request runs after the current upload finishes. Rejected rated recordings remain available as personal history.

## Verification evidence

The inherited `test-results/.last-run.json`, dated October 22, said `passed` with no failed IDs. It did not record a test count or run configuration, so it alone did not prove the handoff's claimed full-suite count. A fresh pre-change run passed 42 Chromium/Firefox scenarios.

| Stabilization check | Actual result on October 23 |
| --- | --- |
| `npm run check` | Passed types, lint, 65 tests in nine files, and the production build. |
| `npm run format:check` | Passed. |
| `npx --yes deno fmt --check supabase/functions` | Passed, three files checked. |
| Deno check of both function entrypoints | Passed using Deno 2.9.6. |
| `npm run test:production:full` | Passed all 63 scenarios in 5.6 minutes: 21 each in Chromium, Firefox, and WebKit, headless against the production build. |
| `git diff --check` | Passed. |

The 12 new client tests comprise nine provider/queue scenarios and three HTTP-boundary scenarios. The provider tests use real provider lifecycle logic and a `fake-indexeddb` database with mocked Auth/HTTP. The request-helper tests mock Auth and fetch. Their passing results do not establish live service integration. Three queue regression tests failed reproducibly before the fixes and passed afterward.

The final browser result is recorded in ignored `test-results/.last-run.json` (`passed`, no failed IDs); the complete console output was also retained at `/tmp/humanrank-final-browser.log`. Both are local verification artifacts and can be removed by a later test run or reboot. The suite covers all twelve games, responsive routes at 360/390/768/1440 CSS-pixel widths, touch and keyboard interactions, practice variants, introductory progress, persistence/backup/import/delete, and storage-failure behavior.

WebKit was restored without sudo or a system package installation: Ubuntu library packages were downloaded and extracted into `/tmp/humanrank-webkit-deps`, and `/tmp/humanrank-webkit-launch.sh` launches the headless WPE browser with those libraries. A launch/page smoke check passed. This temporary environment is disposable and may need recreation after reboot. CI installs normal browser dependencies instead. No browser binaries or downloaded libraries belong in Git.

## Configuration blockers and launch gates

No Supabase environment variables or `.env.local` were configured at verification time. No project or paid service has been provisioned. Before an online launch:

- Select/configure an owner-controlled staging project, apply the migration, deploy functions, and set Auth redirects and email delivery. Keep privileged keys in local/provider configuration, never chat, Git, or `VITE_` variables.
- Verify real sign-in, anonymous linking where enabled, refresh/recovery, account isolation, offline retries, token expiry/concurrency, account export/deletion, consent withdrawal during aggregation, and share expiration/revocation.
- Configure and verify daily retention maintenance and reference publication scheduling; confirm monitoring, operating budget, backup restoration, migration recovery, and frontend rollback.
- Complete real mouse/trackpad/touch and mobile-device checks, assistive-technology review, independent security review, and timing/playability/reliability pilot evaluation.
- Collect actual opted-in cohorts before publishing comparisons. Keep unavailable/provisional states and leave rarity disabled until cohort support and independent model review justify enabling it.

Docker was unavailable through the prior WSL setup; a full local Supabase stack has not been exercised. PGlite cannot substitute for Auth, gateway, email, scheduler, or deployed HTTP verification. Public deployment remains a separate release action after a concrete build is reviewable.

## Continuation commands

Node is installed at `/home/eric/.nvm/versions/node/v24.21.0/bin` on this host; add it to `PATH` if the non-login shell cannot find Node/npm. From the current checkout:

```sh
npm ci
npm run check
npm run format:check
npx --yes deno fmt --check supabase/functions
npx --yes deno check --config supabase/functions/deno.json supabase/functions/humanrank/index.ts supabase/functions/aggregate/index.ts
npm run test:production:full
```

`npm run check` builds `dist/`. Both production browser commands consume that existing artifact; they do not build it. `test:production` runs two Chromium smoke scenarios; `test:production:full` runs all 63 scenarios across Chromium, Firefox, and WebKit. Do not edit/rebuild the application while a frozen-build suite is running. For a new build without the other checks, use `npm run build` first.

With the restored temporary WSL wrapper still present:

```sh
HUMANRANK_WEBKIT_EXECUTABLE=/tmp/humanrank-webkit-launch.sh \
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 PW_HEADLESS=true \
npm run test:production:full
```

The host-validation bypass accompanies the supplied user-space libraries; browser execution and assertions still run. Without the wrapper, install dependencies normally with `npx playwright install --with-deps`. Do not claim WebKit coverage from Chromium/Firefox results alone.

Development servers begin at 5174 and previews at 4174, incrementing when occupied. Preserve unrelated processes. At handoff, stop task-owned servers and verify ports 5174, 5175, 5176, and 4174, plus any additional allocated port, are released.

Final cleanup verified that the HumanRank runner and browser processes had exited and all four listed ports were free. An unrelated `interaction-playground` server used 5174 briefly during verification; it was identified by command and working directory and left untouched. No development or preview server started for this task remains running.

Continue from [backend setup](backend-setup.md), [operations](operations.md), and the approved [implementation plan](implementation-plan.md). Prioritize actual staging integration once configuration is available; do not redesign the twelve-game roster or scoring policy to work around missing credentials.
