import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, MapPin, Users } from "lucide-react";
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

type View = "day" | "week" | "month";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function startOfWeek(d: Date): Date {
  // Monday-start week
  const day = (d.getDay() + 6) % 7;
  const s = startOfDay(d);
  s.setDate(s.getDate() - day);
  return s;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtTime(iso: string, allDay: boolean): string {
  if (allDay) return "All day";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function computeRange(view: View, anchor: Date): { start: Date; end: Date; label: string; days: Date[] } {
  if (view === "day") {
    return {
      start: startOfDay(anchor),
      end: endOfDay(anchor),
      label: anchor.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      days: [startOfDay(anchor)],
    };
  }
  if (view === "week") {
    const s = startOfWeek(anchor);
    const e = endOfDay(addDays(s, 6));
    const days = Array.from({ length: 7 }, (_, i) => addDays(s, i));
    const label = `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${addDays(s, 6).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    return { start: s, end: e, label, days };
  }
  // month — pad to full weeks for grid
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = addDays(startOfWeek(monthEnd), 6);
  const totalDays = Math.round((endOfDay(gridEnd).getTime() - gridStart.getTime()) / 86400000) + 1;
  const days = Array.from({ length: totalDays }, (_, i) => addDays(gridStart, i));
  return {
    start: gridStart,
    end: endOfDay(gridEnd),
    label: anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    days,
  };
}

function navigate(view: View, anchor: Date, dir: -1 | 1): Date {
  if (view === "day") return addDays(anchor, dir);
  if (view === "week") return addDays(anchor, dir * 7);
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
}

export default function CalendarPage() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarMeta[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(() => loadExcludedCalendars());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => computeRange(view, anchor), [view, anchor]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke("gcal-range-events", {
          body: { timeMin: range.start.toISOString(), timeMax: range.end.toISOString() },
        });
        if (cancelled) return;
        if (invokeErr) throw invokeErr;
        const r = data as { ok: boolean; events: CalendarEvent[]; calendars?: CalendarMeta[] };
        if (!r.ok) throw new Error("Calendar fetch failed");
        setEvents(r.events);
        setCalendars(r.calendars ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range.start.getTime(), range.end.getTime()]);

  const visibleEvents = useMemo(
    () => dedupeEvents(filterByEnabledCalendars(events, excluded)),
    [events, excluded],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of range.days) map.set(day.toDateString(), []);
    for (const ev of visibleEvents) {
      const d = new Date(ev.start);
      const key = startOfDay(d).toDateString();
      if (map.has(key)) map.get(key)!.push(ev);
    }
    return map;
  }, [visibleEvents, range.days]);

  const handleExcludedChange = (next: Set<string>) => {
    setExcluded(next);
    saveExcludedCalendars(next);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-teal">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">{range.label}</p>
        </div>
        <div className="flex items-center gap-2">
          {calendars.length > 0 && (
            <CalendarSelector calendars={calendars} excluded={excluded} onChange={handleExcludedChange} />
          )}
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {(["day", "week", "month"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 text-sm capitalize transition-colors",
                  view === v ? "bg-teal text-white" : "bg-background hover:bg-muted",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setAnchor(navigate(view, anchor, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => setAnchor(navigate(view, anchor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="card-soft py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
        </div>
      ) : error ? (
        <div className="card-soft py-12 text-center text-sm text-muted-foreground">{error}</div>
      ) : view === "month" ? (
        <MonthGrid days={range.days} anchor={anchor} eventsByDay={eventsByDay} />
      ) : (
        <DayList days={range.days} eventsByDay={eventsByDay} />
      )}
    </div>
  );
}

function DayList({ days, eventsByDay }: { days: Date[]; eventsByDay: Map<string, CalendarEvent[]> }) {
  const today = new Date();
  return (
    <div className="space-y-4">
      {days.map((day) => {
        const list = eventsByDay.get(day.toDateString()) ?? [];
        const isToday = sameDay(day, today);
        return (
          <div key={day.toISOString()} className="card-soft">
            <div className={cn(
              "px-4 py-2 border-b flex items-center justify-between",
              isToday && "bg-teal-light/40",
            )}>
              <div className="text-sm font-medium text-ink/80">
                {day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              <div className="text-xs text-muted-foreground">{list.length} event{list.length === 1 ? "" : "s"}</div>
            </div>
            {list.length === 0 ? (
              <div className="px-4 py-4 text-sm italic text-muted-foreground">No events</div>
            ) : (
              <div className="divide-y">
                {list.map((e) => <EventRow key={`${e.account_email}-${e.id}`} e={e} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EventRow({ e }: { e: CalendarEvent }) {
  const tag = tagFor(e.account_email);
  return (
    <a
      href={e.html_link ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-3 py-3 px-4 hover:bg-muted/40 transition-colors"
    >
      <div className={cn("w-1 self-stretch rounded-full", tag === "work" ? "bg-teal" : "bg-orange")} />
      <div className="w-20 shrink-0 text-sm font-medium text-ink/80 pt-0.5">{fmtTime(e.start, e.all_day)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{e.title}</span>
          <span className={cn(
            "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap",
            tag === "work" ? "bg-teal-light text-teal" : "bg-orange/15 text-orange",
          )}>{tag}</span>
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
}

function MonthGrid({ days, anchor, eventsByDay }: { days: Date[]; anchor: Date; eventsByDay: Map<string, CalendarEvent[]> }) {
  const today = new Date();
  const monthIdx = anchor.getMonth();
  const dayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="card-soft overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {dayHeaders.map((d) => (
          <div key={d} className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const list = eventsByDay.get(day.toDateString()) ?? [];
          const isToday = sameDay(day, today);
          const inMonth = day.getMonth() === monthIdx;
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[110px] border-b border-r p-1.5 text-xs",
                !inMonth && "bg-muted/20 text-muted-foreground/60",
                isToday && "bg-teal-light/30",
              )}
            >
              <div className={cn("text-right text-[11px] font-medium mb-1", isToday && "text-teal")}>
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((e) => {
                  const tag = tagFor(e.account_email);
                  return (
                    <a
                      key={`${e.account_email}-${e.id}`}
                      href={e.html_link ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "block truncate rounded px-1.5 py-0.5 text-[11px] hover:opacity-80",
                        tag === "work" ? "bg-teal-light text-teal" : "bg-orange/15 text-orange",
                      )}
                      title={e.title}
                    >
                      {!e.all_day && (
                        <span className="opacity-70 mr-1">{fmtTime(e.start, false)}</span>
                      )}
                      {e.title}
                    </a>
                  );
                })}
                {list.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1.5">+{list.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
