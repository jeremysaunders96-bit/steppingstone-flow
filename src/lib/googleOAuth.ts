// Builds the Google OAuth consent URL. Phase A: client ID is pasted into .env after
// the Google Cloud project is created with Will. Until then, isConfigured() returns false.

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export const GOOGLE_OAUTH_REDIRECT_URI =
  "https://depwgcghnvixbtifxtrz.supabase.co/functions/v1/google-oauth-callback";

export const KNOWN_ACCOUNTS: { email: string; label: string }[] = [
  { email: "william@sstone.co.uk", label: "Work (Steppingstone)" },
  { email: "willmeadon@gmail.com", label: "Personal" },
];

export function getClientId(): string {
  return (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined) ?? "";
}

export function isConfigured(): boolean {
  return Boolean(getClientId());
}

export function buildConsentUrl(loginHint?: string): string {
  const clientId = getClientId();
  if (!clientId) throw new Error("Google OAuth client ID is not configured.");
  const nonce = crypto.randomUUID();
  sessionStorage.setItem("google_oauth_nonce", nonce);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: nonce,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function verifyReturnedState(returnedState: string | null): boolean {
  if (!returnedState) return false;
  const expected = sessionStorage.getItem("google_oauth_nonce");
  sessionStorage.removeItem("google_oauth_nonce");
  return expected !== null && expected === returnedState;
}
