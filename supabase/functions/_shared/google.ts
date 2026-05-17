// Shared helpers for Google API access from edge functions.
// Stores/refreshes OAuth tokens via the user_google_tokens table.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "content-type": "application/json", ...(init.headers || {}) },
  });
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface GoogleTokenRow {
  account_email: string;
  refresh_token: string;
  access_token: string;
  expires_at: string;
  scopes: string;
  google_user_id: string | null;
  display_name: string | null;
}

function googleCreds(): { clientId: string; clientSecret: string } {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).");
  }
  return { clientId, clientSecret };
}

// Trade a refresh token for a fresh access token.
async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresInSec: number }> {
  const { clientId, clientSecret } = googleCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return { accessToken: data.access_token as string, expiresInSec: (data.expires_in as number) ?? 3600 };
}

// Returns a valid access token for the given account. Refreshes if within 60 seconds of expiry.
export async function getValidAccessToken(supabase: SupabaseClient, accountEmail: string): Promise<string> {
  const { data, error } = await supabase
    .from("user_google_tokens")
    .select("*")
    .eq("account_email", accountEmail)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No Google connection found for ${accountEmail}`);

  const row = data as GoogleTokenRow;
  const expiresAt = new Date(row.expires_at).getTime();
  const now = Date.now();
  if (expiresAt - now > 60_000) return row.access_token;

  const { accessToken, expiresInSec } = await refreshAccessToken(row.refresh_token);
  const newExpiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
  const { error: updateError } = await supabase
    .from("user_google_tokens")
    .update({ access_token: accessToken, expires_at: newExpiresAt, updated_at: new Date().toISOString() })
    .eq("account_email", accountEmail);
  if (updateError) throw updateError;
  return accessToken;
}

// Fetch wrapper that injects a fresh access token and retries once on 401.
export async function googleFetch(
  supabase: SupabaseClient,
  accountEmail: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const exec = async (token: string): Promise<Response> => {
    const headers = new Headers(init.headers || {});
    headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return fetch(url, { ...init, headers });
  };

  const token = await getValidAccessToken(supabase, accountEmail);
  const res = await exec(token);
  if (res.status !== 401) return res;

  // Force-refresh on 401 and retry once.
  const { data } = await supabase
    .from("user_google_tokens")
    .select("refresh_token")
    .eq("account_email", accountEmail)
    .maybeSingle();
  if (!data) return res;
  const refreshed = await refreshAccessToken((data as { refresh_token: string }).refresh_token);
  await supabase
    .from("user_google_tokens")
    .update({
      access_token: refreshed.accessToken,
      expires_at: new Date(Date.now() + refreshed.expiresInSec * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("account_email", accountEmail);
  return exec(refreshed.accessToken);
}
