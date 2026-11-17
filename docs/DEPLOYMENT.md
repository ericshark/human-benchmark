# Human Benchmark deployment

The local-play site is at https://human-benchmark.ericzwierzynski.dev. Vercel
builds the Vite app from GitHub `main`. The Supabase project
`human-benchmark-prod` (`coctrwhrlcftvsyjotbf`) hosts the schema, Auth, and
the `humanrank` and `aggregate` Edge Functions. Supabase Cron calls
`public.maintain_player_data()` daily at 03:00 UTC.

Public signup and sync are gated while production SMTP is unconfigured.
Configure and verify email first. Then set the production frontend's
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using public values only.
Keep `SNAPSHOT_JOB_SECRET` and `ALLOWED_ORIGIN` in Supabase function settings.
The Auth callback is `/auth/callback` on the production origin.

Review and apply SQL migrations separately from ordinary Git deployments.
Bundle the functions with Deno using `supabase/functions/deno.json` before
uploading them with the Supabase CLI. The hosted bundler could not resolve
the source tree's extensionless imports directly. Verify CI and Vercel
after updates. Roll back the frontend through Vercel if needed.

The production domain uses a DNS-only Cloudflare CNAME to the project-specific
Vercel target. The old Vercel address remains available. No frontend Supabase
environment variables are configured, so the current deployment uses local play.
Browser progress at the old address stays in that origin's storage.

On November 16, 2026, HTTPS and HTTP 200 were verified at the new address.
The hosted Supabase project was paused, so its Auth Site URL and redirect URL
could not be updated. After restoring it, set Site URL to
`https://human-benchmark.ericzwierzynski.dev` and add
`https://human-benchmark.ericzwierzynski.dev/auth/callback` to the redirect allow
list, preserving existing entries. The hosted Edge Function `ALLOWED_ORIGIN`
secret was updated to the new origin. No database schema or signup gate changed.
