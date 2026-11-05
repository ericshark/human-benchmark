# Human Benchmark deployment

The local-play site is at https://human-benchmark-orcin.vercel.app. Vercel
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
