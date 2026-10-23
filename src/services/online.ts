import type { SupabaseClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const onlineConfigured = Boolean(url && key);
let pending: Promise<SupabaseClient> | undefined;
export class OnlineRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
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
export async function onlineRequest<T>(
  body: unknown,
  expectedOwner?: string,
): Promise<T> {
  const client = await onlineClient();
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error("Sign in to use online features.");
  if (expectedOwner && data.session.user.id !== expectedOwner)
    throw new OnlineRequestError(
      "The active account changed. This operation is waiting for its original account.",
      401,
    );
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
    throw new OnlineRequestError(
      result.error ?? "Online request could not be completed.",
      response.status,
    );
  return result as T;
}
