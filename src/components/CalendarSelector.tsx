import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarMeta, calendarKey } from "@/lib/calendarEvents";

interface Props {
  calendars: CalendarMeta[];
  excluded: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function CalendarSelector({ calendars, excluded, onChange }: Props) {
  const enabledCount = calendars.length - excluded.size;

  const toggle = (key: string) => {
    const next = new Set(excluded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  // Group by account_email for readability
  const byAccount = new Map<string, CalendarMeta[]>();
  for (const c of calendars) {
    if (!byAccount.has(c.account_email)) byAccount.set(c.account_email, []);
    byAccount.get(c.account_email)!.push(c);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          Calendars
          <span className="text-xs text-muted-foreground">
            {enabledCount}/{calendars.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-h-[400px] overflow-y-auto p-0">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="text-sm font-medium">Show calendars</span>
          <button
            onClick={() => onChange(new Set())}
            className="text-xs text-teal hover:underline"
          >
            Show all
          </button>
        </div>
        <div className="p-2 space-y-3">
          {Array.from(byAccount.entries()).map(([account, cals]) => (
            <div key={account}>
              <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                {account}
              </div>
              <div className="space-y-1">
                {cals.map((c) => {
                  const key = calendarKey(c);
                  const enabled = !excluded.has(key);
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60 cursor-pointer"
                    >
                      <Checkbox checked={enabled} onCheckedChange={() => toggle(key)} />
                      {c.background_color && (
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: c.background_color }}
                        />
                      )}
                      <span className="text-sm truncate flex-1">{c.summary}</span>
                      {c.primary && (
                        <span className="text-[10px] uppercase text-muted-foreground">primary</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
