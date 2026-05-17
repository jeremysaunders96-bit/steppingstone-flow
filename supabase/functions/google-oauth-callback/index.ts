// Google OAuth callback. Registered with Google Cloud as the app's redirect URI.
// Exchanges the auth code for tokens, fetches user info, upserts into user_google_tokens,
// then redirects the browser back to the dashboard with a success/error flag.

import { corsHeaders, json, serviceClient } from "../_shared/google.ts";

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

function redirectTo(url: string): Response {
  return new Response(null, { status: 302, headers: { ...corsHeaders, location: url } });
}

function dashboardUrl(): string {
  return Deno.env.get("DASHBOARD_URL") || "";
}

function finishUrl(params: Record<string, string>): string {
  const base = dashboardUrl();
  if (!base) return "";
  const u = new URL(`${base.replace(/\/$/, "")}/settings`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const errParam = url.searchParams.get("error");

  if (errParam) {
    const r = finishUrl({ google_error: errParam, state });
    return r ? redirectTo(r) : json({ ok: false, error: errParam }, { status: 400 });
  }
  if (!code) {
    const r = finishUrl({ google_error: "missing_code", state });
    return r ? redirectTo(r) : json({ ok: false, error: "missing_code" }, { status: 400 });
  }

  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return json({ ok: false, error: "oauth_not_configured" }, { status: 500 });
  }

  // Token exchange. redirect_uri must match the one used to initiate the flow exactly.
  const redirectUri = `${url.origin}${url.pathname}`;
  const tokenBody = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    const r = finishUrl({ google_error: "token_exchange_failed", detail: text.slice(0, 200), state });
    return r ? redirectTo(r) : json({ ok: false, error: "token_exchange_failed", detail: text }, { status: 502 });
  }
  const tokenData = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };

  if (!tokenData.refresh_token) {
    // Happens when the user has previously consented and Google omits the refresh token.
    // We require prompt=consent in the auth URL to avoid this, but guard anyway.
    const r = finishUrl({ google_error: "no_refresh_token", state });
    return r ? redirectTo(r) : json({ ok: false, error: "no_refresh_token" }, { status: 400 });
  }

  const grantedScopes = (tokenData.scope || "").split(" ");
  const missing = REQUIRED_SCOPES.filter((s) => !grantedScopes.includes(s));
  if (missing.length) {
    const r = finishUrl({ google_error: "missing_scopes", detail: missing.join(","), state });
    return r ? redirectTo(r) : json({ ok: false, error: "missing_scopes", missing }, { status: 400 });
  }

  // Look up account identity.
  const userinfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userinfoRes.ok) {
    const text = await userinfoRes.text();
    return json({ ok: false, error: "userinfo_failed", detail: text }, { status: 502 });
  }
  const userinfo = await userinfoRes.json() as { sub: string; email: string; name?: string };

  const supabase = serviceClient();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  const { error } = await supabase.from("user_google_tokens").upsert(
    {
      account_email: userinfo.email,
      google_user_id: userinfo.sub,
      display_name: userinfo.name ?? null,
      refresh_token: tokenData.refresh_token,
      access_token: tokenData.access_token,
      expires_at: expiresAt,
      scopes: tokenData.scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_email" },
  );
  if (error) {
    return json({ ok: false, error: "db_upsert_failed", detail: error.message }, { status: 500 });
  }

  const r = finishUrl({ google_connected: userinfo.email, state });
  if (r) return redirectTo(r);
  return json({ ok: true, account_email: userinfo.email });
});
