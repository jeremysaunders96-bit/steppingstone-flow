// Creates a Gmail draft in the specified account. Lands in the user's Drafts folder;
// Will sends it manually from Gmail. We never call gmail.send.

import { corsHeaders, json, serviceClient, googleFetch } from "../_shared/google.ts";

interface RequestBody {
  account_email: string;
  to: string;
  subject: string;
  body: string; // plain text
  cc?: string;
  bcc?: string;
}

function base64UrlEncode(input: string): string {
  // btoa doesn't handle multi-byte chars safely; encode UTF-8 first.
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRfc822(args: { from: string; to: string; cc?: string; bcc?: string; subject: string; body: string }): string {
  const headers = [
    `From: ${args.from}`,
    `To: ${args.to}`,
    args.cc ? `Cc: ${args.cc}` : "",
    args.bcc ? `Bcc: ${args.bcc}` : "",
    `Subject: ${args.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
  ].filter(Boolean).join("\r\n");
  return `${headers}\r\n\r\n${args.body}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.account_email || !body.to || !body.subject || !body.body) {
    return json({ ok: false, error: "missing_fields", required: ["account_email", "to", "subject", "body"] }, { status: 400 });
  }

  const supabase = serviceClient();
  const rfc822 = buildRfc822({
    from: body.account_email,
    to: body.to,
    cc: body.cc,
    bcc: body.bcc,
    subject: body.subject,
    body: body.body,
  });
  const raw = base64UrlEncode(rfc822);

  const res = await googleFetch(
    supabase,
    body.account_email,
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      body: JSON.stringify({ message: { raw } }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    return json({ ok: false, error: "gmail_api_failed", status: res.status, detail: text }, { status: 502 });
  }
  const draft = await res.json() as { id: string; message: { id: string; threadId: string } };
  return json({ ok: true, draft_id: draft.id, message_id: draft.message?.id, thread_id: draft.message?.threadId });
});
