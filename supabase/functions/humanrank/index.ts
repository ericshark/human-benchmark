import { createClient } from "npm:@supabase/supabase-js@2";
import { createApiHandler } from "../../../src/server/api.ts";
const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const origin = Deno.env.get("ALLOWED_ORIGIN");
if (!url || !key || !origin) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ALLOWED_ORIGIN must be configured.",
  );
}
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(createApiHandler(client, origin));
