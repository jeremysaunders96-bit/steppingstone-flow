// Fetches today's events for every connected Google account, across the user's visible
// calendars. Returns a single ordered list tagged with the source account and calendar.

import { corsHeaders, json, serviceClient, googleFetch } from "../_shared/google.ts";

interface CalListEntry {
  id: string;
  summary: string;
  primary?: boolean;
  selected?: boolean;
  backgroundColor?: string;
  accessRole?: string;
}

interface GcalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  organizer?: { email: string; displayName?: string };
  status?: string;
  eventType?: string;
}

interface NormalizedEvent {
  id: string;
  account_email: string;
  calendar_id: string;
  calendar_summary: string;
  calendar_color: string | null;
  title: string;
  start: string;
  end: string;
  all_day: boolean;
  location: string | null;
  attendees: { email: string; displayName?: string }[];
  html_link: string | null;
}

function todayRangeIso(): { timeMin: string; timeMax: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

function isSkippableCalendar(c: CalListEntry): boolean {
  // Skip holiday/birthday-style read-only feeds.
  const s = (c.summary || "").toLowerCase();
  if (s.includes("holidays in")) return true;
  if (s.includes("birthdays")) return true;
  if (c.id.endsWith("@group.v.calendar.google.com") && c.accessRole === "reader" && s.includes("holiday")) return true;
  if (c.selected === false) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = serviceClient();
  const { data: tokenRows, error: tokenErr } = await supabase
    .from("user_google_tokens")
    .select("account_email");
  if (tokenErr) return json({ ok: false, error: tokenErr.message }, { status: 500 });

  const accounts = (tokenRows ?? []).map((r) => (r as { account_email: string }).account_email);
  if (accounts.length === 0) return json({ ok: true, events: [], accounts: [] });

  const { timeMin, timeMax } = todayRangeIso();
  const events: NormalizedEvent[] = [];
  const errors: { account_email: string; error: string }[] = [];

  for (const accountEmail of accounts) {
    try {
      const calListRes = await googleFetch(
        supabase,
        accountEmail,
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
      );
      if (!calListRes.ok) {
        errors.push({ account_email: accountEmail, error: `calendarList ${calListRes.status}` });
        continue;
      }
      const calList = await calListRes.json() as { items: CalListEntry[] };

      for (const cal of (calList.items ?? []).filter((c) => !isSkippableCalendar(c))) {
        const evUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`);
        evUrl.searchParams.set("timeMin", timeMin);
        evUrl.searchParams.set("timeMax", timeMax);
        evUrl.searchParams.set("singleEvents", "true");
        evUrl.searchParams.set("orderBy", "startTime");
        evUrl.searchParams.set("maxResults", "50");

        const evRes = await googleFetch(supabase, accountEmail, evUrl.toString());
        if (!evRes.ok) {
          errors.push({ account_email: accountEmail, error: `events ${cal.id}: ${evRes.status}` });
          continue;
        }
        const evData = await evRes.json() as { items: GcalEvent[] };
        for (const e of evData.items ?? []) {
          if (e.status === "cancelled") continue;
          const startStr = e.start?.dateTime ?? e.start?.date;
          const endStr = e.end?.dateTime ?? e.end?.date;
          if (!startStr || !endStr) continue;
          const allDay = Boolean(e.start?.date && !e.start?.dateTime);
          events.push({
            id: e.id,
            account_email: accountEmail,
            calendar_id: cal.id,
            calendar_summary: cal.summary,
            calendar_color: cal.backgroundColor ?? null,
            title: e.summary ?? "(no title)",
            start: startStr,
            end: endStr,
            all_day: allDay,
            location: e.location ?? null,
            attendees: (e.attendees ?? []).map((a) => ({ email: a.email, displayName: a.displayName })),
            html_link: e.htmlLink ?? null,
          });
        }
      }
    } catch (e) {
      errors.push({ account_email: accountEmail, error: (e as Error).message });
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return json({ ok: true, events, accounts, errors });
});
