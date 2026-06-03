import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Loader2, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  CalendarEvent,
  CalendarMeta,
  dedupeEvents,
  filterByEnabledCalendars,
  loadExcludedCalendars,
  saveExcludedCalendars,
  tagFor,
} from "@/lib/calendarEvents";
import { CalendarSelector } from "@/components/CalendarSelector";

function formatTime(iso: string, allDay: boolean): string {
  if (allDay) return "All day";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function TodayMeetingsCard() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [calendars, setCalendars] = useState<CalendarMeta[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(() => loadExcludedCalendars());
  const [accountsConnected, setAccountsConnected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke("gcal-today-events", { body: {} });
        if (cancelled) return;
        if (invokeErr) throw invokeErr;
        const result = data as {
          ok: boolean;
          events: CalendarEvent[];
          accounts: string[];
          calendars?: CalendarMeta[];
          errors?: { account_email: string; error: string }[];
        };
        if (!result.ok) throw new Error("Calendar fetch failed");
        setEvents(result.events);
        setCalendars(result.calendars ?? []);
        setAccountsConnected(result.accounts.length);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visibleEvents = useMemo(
    () => (events ? dedupeEvents(filterByEnabledCalendars(events, excluded)) : []),
    [events, excluded],
  );

  const handleExcludedChange = (next: Set<string>) => {
    setExcluded(next);
    saveExcludedCalendars(next);
  };

  if (loading) {
    return (
      <div className="card-soft py-8 px-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading today's events…
      </div>
    );
  }

  if (error || accountsConnected === 0) {
    return (
      <div className="card-soft py-12 px-6 flex flex-col items-center text-center gap-3">
        <CalendarDays className="h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} />
        <p className="text-sm italic text-muted-foreground">
          {accountsConnected === 0 ? "Your calendar isn't connected yet." : "Couldn't load today's events."}
        </p>
        <Link to="/settings">
          <Button className="bg-teal hover:bg-teal/90 text-white mt-1">
            {accountsConnected === 0 ? "Connect Google Calendar" : "Open Settings"}
          </Button>
        </Link>
      </div>
    );
  }

  if (!events || visibleEvents.length === 0) {
    return (
      <>
        {calendars.length > 0 && (
          <div className="flex justify-end mb-2">
            <CalendarSelector calendars={calendars} excluded={excluded} onChange={handleExcludedChange} />
          </div>
        )}
        <div className="card-soft py-8 px-6 flex flex-col items-center text-center gap-2">
          <CalendarDays className="h-8 w-8 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="text-sm italic text-muted-foreground">Nothing on the calendar today.</p>
        </div>
      </>
    );
  }

  return (
    <>
      {calendars.length > 0 && (
        <div className="flex justify-end mb-2">
          <CalendarSelector calendars={calendars} excluded={excluded} onChange={handleExcludedChange} />
        </div>
      )}
      <div className="card-soft divide-y">
      {visibleEvents.map((e) => {
        const tag = tagFor(e.account_email);
        return (
          <a
            key={e.ical_uid ?? `${e.account_email}-${e.id}`}
            href={e.html_link ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-3 py-3 px-4 hover:bg-muted/40 transition-colors"
          >
            <div
              className={cn(
                "w-1 self-stretch rounded-full",
                tag === "work" ? "bg-teal" : "bg-orange",
              )}
            />
            <div className="w-20 shrink-0 text-sm font-medium text-ink/80 pt-0.5">
              {formatTime(e.start, e.all_day)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{e.title}</span>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap",
                    tag === "work" ? "bg-teal-light text-teal" : "bg-orange/15 text-orange",
                  )}
                >
                  {tag}
                </span>
                {e.calendar_summary && e.calendar_summary.toLowerCase() !== e.account_email.toLowerCase() && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    · {e.calendar_summary}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {e.location && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" /> {e.location}
                  </span>
                )}
                {e.attendees.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3 shrink-0" /> {e.attendees.length}
                  </span>
                )}
              </div>
            </div>
          </a>
        );
      })}
      </div>
    </>
  );
}
