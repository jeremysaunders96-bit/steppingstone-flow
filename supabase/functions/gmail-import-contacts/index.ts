// One-off import of Google contacts into the contacts table. Pulls from People API
// connections (the user's saved contacts) and otherContacts (people emailed but not saved).
// Deduplicates against existing emails so Will's existing notes/edits aren't overwritten.

import { corsHeaders, json, serviceClient, googleFetch } from "../_shared/google.ts";

interface RequestBody {
  account_email: string;
  dry_run?: boolean;
}

interface Person {
  names?: { displayName?: string; givenName?: string; familyName?: string; metadata?: { primary?: boolean } }[];
  emailAddresses?: { value: string; metadata?: { primary?: boolean } }[];
  phoneNumbers?: { value: string; metadata?: { primary?: boolean } }[];
  organizations?: { name?: string; title?: string; metadata?: { primary?: boolean } }[];
}

function pickPrimary<T extends { metadata?: { primary?: boolean } }>(arr: T[] | undefined): T | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr.find((x) => x.metadata?.primary) ?? arr[0];
}

interface NewContact {
  full_name: string;
  email: string;
  company: string | null;
  role: string | null;
  phone: string | null;
  source: "gmail-import";
  imported_at: string;
}

function personToContact(p: Person): NewContact | null {
  const email = pickPrimary(p.emailAddresses)?.value?.trim().toLowerCase();
  if (!email) return null;
  const name = pickPrimary(p.names);
  const fullName =
    name?.displayName?.trim() ||
    [name?.givenName, name?.familyName].filter(Boolean).join(" ").trim() ||
    email;
  const org = pickPrimary(p.organizations);
  const phone = pickPrimary(p.phoneNumbers)?.value?.trim() || null;
  return {
    full_name: fullName,
    email,
    company: org?.name?.trim() || null,
    role: org?.title?.trim() || null,
    phone,
    source: "gmail-import",
    imported_at: new Date().toISOString(),
  };
}

async function fetchAllPages(
  supabase: ReturnType<typeof serviceClient>,
  accountEmail: string,
  baseUrl: string,
  pageTokenParam: string,
  resultKey: "connections" | "otherContacts",
): Promise<Person[]> {
  const all: Person[] = [];
  let pageToken: string | null = null;
  for (let i = 0; i < 50; i++) { // guard rail: max 50 pages (~50k contacts)
    const url = new URL(baseUrl);
    if (pageToken) url.searchParams.set(pageTokenParam, pageToken);
    const res = await googleFetch(supabase, accountEmail, url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${resultKey} fetch failed: ${res.status} ${text}`);
    }
    const data = await res.json() as Record<string, unknown>;
    const items = (data[resultKey] as Person[] | undefined) ?? [];
    all.push(...items);
    pageToken = (data.nextPageToken as string | undefined) ?? null;
    if (!pageToken) break;
  }
  return all;
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
  if (!body.account_email) {
    return json({ ok: false, error: "missing_fields", required: ["account_email"] }, { status: 400 });
  }

  const supabase = serviceClient();

  let people: Person[] = [];
  try {
    const connectionsUrl =
      "https://people.googleapis.com/v1/people/me/connections?pageSize=1000&personFields=names,emailAddresses,phoneNumbers,organizations";
    const otherUrl =
      "https://people.googleapis.com/v1/otherContacts?pageSize=1000&readMask=names,emailAddresses";

    const [connections, other] = await Promise.all([
      fetchAllPages(supabase, body.account_email, connectionsUrl, "pageToken", "connections"),
      fetchAllPages(supabase, body.account_email, otherUrl, "pageToken", "otherContacts"),
    ]);
    people = [...connections, ...other];
  } catch (e) {
    return json({ ok: false, error: "people_api_failed", detail: (e as Error).message }, { status: 502 });
  }

  // Deduplicate within the inbound batch by email (otherContacts often overlaps connections).
  const seenInBatch = new Set<string>();
  const candidates: NewContact[] = [];
  for (const p of people) {
    const c = personToContact(p);
    if (!c) continue;
    if (seenInBatch.has(c.email)) continue;
    seenInBatch.add(c.email);
    candidates.push(c);
  }

  // Pull existing emails to filter out anything already in contacts.
  const { data: existing, error: existingErr } = await supabase
    .from("contacts")
    .select("email")
    .not("email", "is", null);
  if (existingErr) return json({ ok: false, error: existingErr.message }, { status: 500 });
  const existingEmails = new Set(
    (existing ?? []).map((r) => ((r as { email: string | null }).email ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const toInsert = candidates.filter((c) => !existingEmails.has(c.email));

  if (body.dry_run) {
    return json({
      ok: true,
      dry_run: true,
      fetched: people.length,
      candidates: candidates.length,
      to_insert: toInsert.length,
      skipped_existing: candidates.length - toInsert.length,
    });
  }

  let imported = 0;
  // Insert in chunks of 500 to avoid large request payloads.
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500);
    const { error: insErr } = await supabase.from("contacts").insert(chunk);
    if (insErr) {
      return json({
        ok: false,
        error: "insert_failed",
        detail: insErr.message,
        imported,
        remaining: toInsert.length - imported,
      }, { status: 500 });
    }
    imported += chunk.length;
  }

  return json({
    ok: true,
    fetched: people.length,
    candidates: candidates.length,
    imported,
    skipped_existing: candidates.length - imported,
  });
});
