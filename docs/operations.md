# HumanRank operations and release checks

## Build and serve

`npm ci && npm run check` validates types, lint, domain/database tests, and the production build. Serve `dist/` over HTTPS using a static host with fallback routing to `index.html` for application routes. Preserve real asset 404s; do not return application HTML for missing JavaScript.

`npm run test:e2e` starts an owned test server at the first available port from 5174, runs headless browser checks, closes that server, and verifies port release. `npm run test:production` runs two Chromium smoke scenarios using a preview server from 4174 with the same cleanup guarantees. For all scenarios in Chromium, Firefox, and WebKit, run `npm run build && npm run test:production:full`. Both production commands read the existing `dist/`; neither builds it. Install browser binaries/system dependencies first.

The GitHub Actions workflow runs Prettier, Deno 2.9.6 formatting/type checks, the app checks, the full development browser suite, and production smoke scenarios on Ubuntu. A checked-in workflow is not evidence that a remote CI run has passed; review its first actual run after an authorized push.

Online-client regression tests run the real provider and IndexedDB queue using `fake-indexeddb`, while simulating Auth and network responses. Separate HTTP tests exercise the real request helper with simulated Auth and fetch. They cover account switching, durable offline retries, consent changes, and rejected assessment fallback; they do not replace live Supabase integration checks. See [implementation status](implementation-status.md) for the latest actual results.

## Release gate

- Run `npm run check`, browser flows, and production smoke checks on the intended release commit.
- Confirm no default development ports are used and no agent-owned server is left running at handoff.
- Review desktop, tablet, narrow phone, touch, keyboard, light/dark, and reduced-motion behavior.
- Review generated source assets, font licenses, secrets handling, Content Security Policy, and browser console/network errors.
- Verify data import/export, quota/storage failure notices, local deletion, and migration of previous IndexedDB versions.
- For online releases, complete the live checks in `backend-setup.md` and confirm the retention job is scheduled.
- Document physical-device and assistive-technology limitations. Headless tests do not validate physical reaction latency or certify WCAG conformance.
- Ensure production copy and shared cards accurately distinguish local measurements, online assessments, provisional comparisons, and unavailable rarity.

## Recovery

Frontend: retain the preceding built artifact and restore it if a release breaks a critical flow. Keep backward-compatible local schemas; never delete user history to recover from a rendering issue. A route-level error boundary offers a return to the playground.

Database: take a provider backup before applying migrations. Restore into a separate staging project first, verify row counts and ownership, then rehearse recovery before deciding a production cutover. No backup or restore has been exercised against a real project in this workspace.

Statistics: retire a suspect snapshot, keep raw personal measurements, rebuild under a new methodology/reference identifier, and label recalculations. Do not silently replace historical raw game results. Rarity output stays unavailable until independent evaluation supports it.

Account deletion: the API first removes identifiable performance records and links, then deletes the Auth identity. If identity deletion fails, return a visible retry/admin error; do not report full deletion. Provider backup expiry must be documented in the final privacy notice.

## Monitoring without collecting private play

Monitor function status/latency, rejected validation counts by protocol, queue error categories, snapshot age/counts, maintenance success, and provider storage costs. Do not log authorization headers, email addresses, private notes, full request bodies, raw pointer traces, or share tokens. Add the selected production monitoring endpoint only after its data policy is reviewed; the local app does not send telemetry by default.

## Accessibility and timing limits

Menus, buttons, forms, keyboard focus, chart descriptions/tables, and reduced motion are part of the verification matrix. Color Conflict intrinsically requires color discrimination; precision requires pointer movement. These limitations are disclosed before play. Adapted tasks must have separate protocol identities and comparison groups. A full human screen-reader and physical mobile-device audit remains a launch gate.
