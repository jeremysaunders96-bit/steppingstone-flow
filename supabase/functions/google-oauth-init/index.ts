// Server-initiated Google OAuth. Generates the CSRF state nonce, stores it in
// an HttpOnly cookie on the supabase.co function origin, then redirects the
// browser to Google's consent screen. The matching cookie is read by
// google-oauth-callback on return — sessionStorage is unreliable across the
// app → Google → supabase → app redirect chain (iOS Safari ITP in particular).

import { corsHeaders, json } from "../_shared/google.ts";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar",
  "openid",
  "email",
  "https://www.googleapis.com/auth/userinfo.email",
];

const REDIRECT_URI =
  "https://depwgcghnvixbtifxtrz.supabase.co/functions/v1/google-oauth-callback";

const COOKIE_NAME = "g_oauth_state";
const COOKIE_MAX_AGE = 600; // 10 minutes

function stateCookie(value: string, maxAge = COOKIE_MAX_AGE): string {
  // SameSite=Lax so the cookie is sent on the top-level redirect back from
  // accounts.google.com. Path is scoped to the callback so it isn't sent on
  // unrelated function calls. Secure + HttpOnly are required on .supabase.co.
  return [
    `${COOKIE_NAME}=${value}`,
    "Path=/functions/v1/google-oauth-callback",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  if (!clientId) {
    return json({ ok: false, error: "oauth_not_configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const loginHint = url.searchParams.get("login_hint") || "";

  const nonce = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: nonce,
  });
  if (loginHint) params.set("login_hint", loginHint);

  const consentUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      location: consentUrl,
      "set-cookie": stateCookie(nonce),
    },
  });
});
