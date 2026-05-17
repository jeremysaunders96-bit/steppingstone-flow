// Creates a calendar event on the specified account/calendar. Used by the voice-note
// "add to calendar?" suggestion in the meeting capture flow.

import { corsHeaders, json, serviceClient, googleFetch } from "../_shared/google.ts";

interface RequestBody {
  account_email: string;
  calendar_id?: string;       // defaults to primary
  summary: string;
  description?: string;
  location?: string;
  start: string;              // ISO datetime, or YYYY-MM-DD for all-day
  end: string;                // same form as start
  time_zone?: string;         // defaults to Europe/London
  attendees?: string[];       // emails
  all_day?: boolean;          // if omitted, inferred from date-only vs datetime
}

function isDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
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
  if (!body.account_email || !body.summary || !body.start || !body.end) {
    return json({ ok: false, error: "missing_fields", required: ["account_email", "summary", "start", "end"] }, { status: 400 });
  }

  const tz = body.time_zone ?? "Europe/London";
  const calendarId = body.calendar_id ?? "primary";
  const allDay = body.all_day ?? (isDateOnly(body.start) && isDateOnly(body.end));

  const payload: Record<string, unknown> = {
    summary: body.summary,
    description: body.description,
    location: body.location,
    start: allDay ? { date: body.start } : { dateTime: body.start, timeZone: tz },
    end: allDay ? { date: body.end } : { dateTime: body.end, timeZone: tz },
  };
  if (body.attendees?.length) {
    payload.attendees = body.attendees.map((email) => ({ email }));
  }

  const supabase = serviceClient();
  const res = await googleFetch(
    supabase,
    body.account_email,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
    { method: "POST", body: JSON.stringify(payload) },
  );

  if (!res.ok) {
    const text = await res.text();
    return json({ ok: false, error: "calendar_api_failed", status: res.status, detail: text }, { status: 502 });
  }
  const created = await res.json() as { id: string; htmlLink: string };
  return json({ ok: true, event_id: created.id, html_link: created.htmlLink });
});
