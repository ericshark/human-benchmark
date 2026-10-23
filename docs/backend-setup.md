# Optional backend setup

The app works without cloud credentials. Setting the two frontend variables enables real Supabase authentication and the HumanRank API; it does not install a simulated backend.

## Managed project

1. Create or select a Supabase project in an account you control. Review its region, budget, backups, and production plan before collecting player results.
2. Apply `supabase/migrations/202610220001_core.sql` using the Supabase CLI or migration system. Keep privileged keys out of browser variables and Git.
3. Deploy `humanrank` and `aggregate` from `supabase/functions/`. Both explicitly authenticate requests; the API checks every Bearer token with `auth.getUser`, and the aggregate function requires its separate job secret. The provided config disables the platform's legacy JWT gate so these explicit checks can handle current auth keys.
4. Set function environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGIN` (one exact frontend origin), and `SNAPSHOT_JOB_SECRET` (at least 32 random characters). Standard Supabase function environments provide the first two; confirm them without printing their values.
5. Set frontend `.env.local`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the public project key). Rebuild the frontend. Never put a service-role key in a `VITE_` variable.
6. In Auth configuration, allow the actual frontend `/auth/callback` URL. Configure production email delivery and test sign-in, session refresh, sign-out, anonymous-to-email linking, and recovery on real accounts. Anonymous sign-in is disabled by default; enable it only with provider abuse protection/CAPTCHA configured and reviewed.
7. In Settings, create a private online profile. Synchronization and population contribution are two separate choices, initially off. Existing local sessions upload only through an explicit sync action. Server-issued assessments use a separate start button and one opportunity per anchor game per UTC day.

The frontend requires HTTPS in production. `public/_headers` supplies security headers on hosts that honor that format. Other hosts must configure equivalent headers themselves. Adjust `connect-src` for an explicitly chosen self-hosted backend; the example policy permits Supabase domains.

## Local Supabase stack

The CLI requires a working Docker-compatible runtime. Docker Desktop is installed on the current host but is not integrated with this WSL distribution, so the full auth/function stack has not been started here.

The checked-in ports are deliberately offset from defaults: API 54322, database 54323, shadow database 54321, Studio 54324, and email inbox 54325. Check all service ports before launch; increment occupied ports and update dependent URLs consistently. Bind local services to loopback. Stop only the stack started for this checkout, then verify its ports are released.

SQL tests run through PGlite, an embedded PostgreSQL runtime. They execute the actual migration and test policies, grants, daily token uniqueness, atomic/idempotent finalization, consent withdrawal, and deletion. They do not replace live Supabase Auth, HTTP gateway, email delivery, scheduler, or network integration tests.

## Reference snapshot publication

The protected aggregate endpoint reads only validated, opted-in candidates. It builds one recent aggregate per player/game/input/presentation cohort from at least three distinct server days. It never uses personal imported history as population evidence.

Run a snapshot build by sending an authenticated POST to `/functions/v1/aggregate` with its job secret. A missing request body runs a build. Do not expose the secret to the frontend, put it in a URL, or commit it. Configure a fixed publication schedule after pilot review (the plan recommends quarterly reference seasons). Do not rebuild norms after every new score.

Schedule a separate daily authenticated POST with JSON `{"job":"maintenance"}`. It expires detailed cloud recordings after 90 days, preserves derived summaries, removes old rate-limit windows, and removes expired/revoked share records. Monitor job failures; retention requires the maintenance schedule to be running.

Snapshot publication locks participant consent rows. A concurrent consent withdrawal either prevents publication or retires the new reference before the withdrawal completes. Withdrawing consent retires active affected snapshots immediately; deletion also removes identifiable records. Rebuild affected comparisons rather than continuing to serve withdrawn references.

Game cohorts distinguish input and presentation. Precision also separates actual arena dimensions, so reference samples may initially be small. Sparse or unstable comparisons remain unavailable. Overall profiles require all twelve anchors, consistent declared input/context, and a qualifying complete-profile cohort. Sampling intervals describe reference-sample uncertainty, not all sources of personal measurement uncertainty.

Rarity fitting, calibration, sensitivity checks, and similarity-frequency intervals are implemented in `src/domain/statistics.ts`. Public rarity remains gated behind actual complete-profile collection and independent pilot validation. The code does not substitute synthetic profiles for real users or convert an anomaly tail into a matching-profile frequency.

## Required external verification before online launch

- Deploy migrations/functions to a staging project and test email/anonymous authentication, redirects, linking, refresh, and recovery.
- Verify account isolation through the real API and Auth roles, not only SQL fixtures.
- Exercise offline submission, retry, simultaneous finalization, token expiry, sign-out/account switching, and queue recovery on real devices.
- Test account export, consent withdrawal during aggregation, deletion, public-link revocation, and expired recording downloads.
- Enable and test scheduler, monitoring, rate limits, backup restore, and migration rollback/recovery.
- Collect an opt-in pilot and evaluate device differences, reliability, cohort precision, model drift, and profile-shape stability before enabling comparative claims.

No project credentials or deployment target were supplied during initial implementation. These live operations are not claimed as verified.

## Enabling profile-shape unusualness after the pilot

`ENABLE_PROFILE_RARITY` is off by default. Enable it in the protected aggregation function only after the pilot's measurement and model review. A qualifying complete cohort must have at least 2,000 profiles, an earlier fixed scoring reference, and sufficiently large disjoint fitting/calibration/evaluation sets.

The snapshot job assigns players to deterministic folds and builds separate model banks. A player is evaluated against a model whose fitting and calibration sets exclude that player's fold. Shape profiles use the previous frozen reference for normalization; current headline ratings use the current reference. Covariance regularization, held-out calibration health, and sensitivity checks can still withhold an estimate. The UI shows broad provisional unusualness bands with sampling intervals, never a reciprocal matching-profile claim.

Prior-reference participants are retained in the snapshot's private provenance so consent withdrawal can retire affected downstream models. Review multimodal populations, nearest-neighbor baselines, repeat reliability, and individual measurement uncertainty before enabling output. A passing synthetic test alone does not authorize real population claims.

Repeated rating results are stored with their original reference date and an evidence digest. Refreshing the page cannot multiply identical rating-history entries, and later norm updates do not rewrite those historical values.
