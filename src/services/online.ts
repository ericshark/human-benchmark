import type { SupabaseClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const onlineConfigured = Boolean(url && key);
let pending: Promise<SupabaseClient> | undefined;
export function onlineClient(): Promise<SupabaseClient> {
  if (!onlineConfigured)
    return Promise.reject(
      new Error(
        "Online services have not been configured. Local play is fully available.",
      ),
    );
  pending ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url!, key!, {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    }),
  );
  return pending;
}
export async function onlineRequest<T>(body: unknown): Promise<T> {
  const client = await onlineClient();
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error("Sign in to use online features.");
  const response = await fetch(`${url}/functions/v1/humanrank`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: key!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Online request could not be completed.");
  return result as T;
}
