export interface CalendarEvent {
  id: string;
  ical_uid: string | null;
  account_email: string;
  calendar_id: string;
  calendar_summary: string;
  calendar_color: string | null;
  is_primary: boolean;
  title: string;
  start: string;
  end: string;
  all_day: boolean;
  location: string | null;
  attendees: { email: string; displayName?: string }[];
  html_link: string | null;
}

export interface CalendarMeta {
  account_email: string;
  calendar_id: string;
  summary: string;
  primary: boolean;
  background_color: string | null;
}

export type Tag = "work" | "personal";

export function tagFor(accountEmail: string): Tag {
  if (accountEmail === "willmeadon@gmail.com") return "personal";
  if (accountEmail === "william@sstone.co.uk") return "work";
  return accountEmail.endsWith("@sstone.co.uk") ? "work" : "personal";
}

export function calendarKey(c: { account_email: string; calendar_id: string }): string {
  return `${c.account_email}::${c.calendar_id}`;
}

// Dedupe events sharing the same iCalUID across calendars. Prefer the entry
// whose source calendar is marked primary; fall back to first seen.
// If iCalUID is missing, fall back to title + start + end as the key.
export function dedupeEvents(events: CalendarEvent[]): CalendarEvent[] {
  const map = new Map<string, CalendarEvent>();
  for (const e of events) {
    const key = e.ical_uid
      ? `uid:${e.ical_uid}`
      : `fb:${e.title}|${e.start}|${e.end}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, e);
      continue;
    }
    // Prefer the primary-calendar copy.
    if (e.is_primary && !existing.is_primary) {
      map.set(key, e);
    }
  }
  const out = Array.from(map.values());
  out.sort((a, b) => a.start.localeCompare(b.start));
  return out;
}

const PREFS_KEY = "calendar.excludedCalendars.v1";

export function loadExcludedCalendars(): Set<string> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function saveExcludedCalendars(excluded: Set<string>): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(Array.from(excluded)));
  } catch {
    // ignore
  }
}

export function filterByEnabledCalendars(
  events: CalendarEvent[],
  excluded: Set<string>,
): CalendarEvent[] {
  if (excluded.size === 0) return events;
  return events.filter((e) => !excluded.has(calendarKey(e)));
}
