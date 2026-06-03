// Google OAuth entry point. The consent URL is now built server-side by the
// google-oauth-init edge function so the CSRF state nonce can live in an
// HttpOnly cookie on the supabase.co origin (sessionStorage doesn't survive
// the app → Google → supabase → app redirect chain on iOS Safari).

export const GOOGLE_OAUTH_REDIRECT_URI =
  "https://depwgcghnvixbtifxtrz.supabase.co/functions/v1/google-oauth-callback";

const OAUTH_INIT_URL =
  "https://depwgcghnvixbtifxtrz.supabase.co/functions/v1/google-oauth-callback";

export const KNOWN_ACCOUNTS: { email: string; label: string }[] = [
  { email: "william@sstone.co.uk", label: "Work (Steppingstone)" },
  { email: "willmeadon@gmail.com", label: "Personal" },
];

export function getClientId(): string {
  const fromEnv = (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined) ?? "";
  return fromEnv || "233829117590-smtkmhks2bfs8dkt52l2go43099or8p8.apps.googleusercontent.com";
}

export function isConfigured(): boolean {
  return Boolean(getClientId());
}

// Returns the URL that kicks off the server-side OAuth flow. Navigating the
// top-level window here lets google-oauth-init set the state cookie on the
// supabase.co origin before redirecting on to Google.
export function buildConsentUrl(_loginHint?: string): string {
  // Must be the bare function URL — no query params. Any leftover `state`
  // or `code` from a previous attempt would otherwise push the function
  // down the callback path instead of init.
  return OAUTH_INIT_URL;
}
