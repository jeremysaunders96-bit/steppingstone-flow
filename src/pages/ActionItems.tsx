import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { emitActionItemsChanged, ACTION_ITEMS_CHANGED } from "@/hooks/useActionItemsCount";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type Row = {
  id: string;
  text: string;
  due_date: string | null;
  created_at: string;
  contact: { id: string; full_name: string; company: string | null } | null;
};

type Sort = "due" | "contact" | "created";

function todayStr() { return new Date().toISOString().slice(0,10); }

export default function ActionItems() {
  const [rows, setRows] = useState<Row[]>([]);
  const [sort, setSort] = useState<Sort>("due");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editDate, setEditDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("action_items")
      .select("id, text, due_date, created_at, contact:contacts(id, full_name, company)")
      .eq("completed", false)
      .order("due_date", { ascending: true });
    setRows(((data || []) as any) as Row[]);
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener(ACTION_ITEMS_CHANGED, h);
    return () => window.removeEventListener(ACTION_ITEMS_CHANGED, h);
  }, [load]);

  const tick = async (id: string) => {
    setRows(rs => rs.filter(r => r.id !== id));
    await supabase.from("action_items")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", id);
    emitActionItemsChanged();
  };

  const startEdit = (r: Row) => {
    setEditing(r.id); setEditText(r.text); setEditDate(r.due_date);
  };

  const saveEdit = async () => {
    if (!editing) return;
    await supabase.from("action_items")
      .update({ text: editText.trim(), due_date: editDate })
      .eq("id", editing);
    setEditing(null);
    load();
  };

  const groups = useMemo(() => {
    const t = todayStr();
    const sorted = [...rows];
    if (sort === "due") {
      sorted.sort((a,b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
    } else if (sort === "contact") {
      sorted.sort((a,b) => (a.contact?.full_name || "").localeCompare(b.contact?.full_name || ""));
    } else {
      sorted.sort((a,b) => b.created_at.localeCompare(a.created_at));
    }

    if (sort !== "due") return [{ label: "", items: sorted, tone: "" }];

    const overdue: Row[] = []; const today: Row[] = []; const upcoming: Row[] = [];
    for (const r of sorted) {
      if (!r.due_date) upcoming.push(r);
      else if (r.due_date < t) overdue.push(r);
      else if (r.due_date === t) today.push(r);
      else upcoming.push(r);
    }
    return [
      { label: "Overdue", items: overdue, tone: "text-orange" },
      { label: "Due today", items: today, tone: "text-teal" },
      { label: "Upcoming", items: upcoming, tone: "text-muted-foreground" },
    ].filter(g => g.items.length > 0);
  }, [rows, sort]);

  const t = todayStr();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-teal">Action Items</h1>
        <p className="text-sm text-muted-foreground mt-1">All outstanding tasks across contacts.</p>
      </header>

      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">Sort</span>
        {([["due","Due date"],["contact","Contact"],["created","Created"]] as [Sort,string][]).map(([k,l]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
              sort === k ? "bg-teal text-white" : "bg-muted text-ink/70 hover:bg-teal-light hover:text-teal"
            )}
          >{l}</button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card-soft p-8 text-center text-muted-foreground italic">
          No outstanding action items.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(g => (
            <div key={g.label || "all"}>
              {g.label && (
                <h3 className={cn("text-xs font-semibold uppercase tracking-wide mb-2", g.tone)}>{g.label}</h3>
              )}
              <div className="card-soft divide-y">
                {g.items.map(r => {
                  const overdue = r.due_date && r.due_date < t;
                  const isToday = r.due_date === t;
                  const dueColor = overdue ? "text-orange" : isToday ? "text-teal" : "text-muted-foreground";
                  const isEditing = editing === r.id;
                  return (
                    <div key={r.id} className="flex items-start gap-3 px-5 py-3">
                      <input type="checkbox" onChange={() => tick(r.id)} className="h-4 w-4 mt-1" />
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input value={editText} onChange={e => setEditText(e.target.value)} />
                            <div className="flex items-center gap-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="text-xs">
                                    <CalendarIcon className="h-3 w-3 mr-1" />
                                    {editDate ? format(new Date(editDate), "d MMM yyyy") : "No date"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={editDate ? new Date(editDate) : undefined}
                                    onSelect={(d) => d && setEditDate(d.toISOString().slice(0,10))}
                                    initialFocus
                                    className={cn("p-3 pointer-events-auto")}
                                  />
                                </PopoverContent>
                              </Popover>
                              <Button size="sm" className="bg-teal hover:bg-teal/90 text-white" onClick={saveEdit}>Save</Button>
                              <button onClick={() => setEditing(null)} className="text-xs text-muted-foreground hover:text-ink">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="font-semibold text-ink">{r.text}</div>
                            {r.contact && (
                              <Link to={`/contacts/${r.contact.id}`} className="text-xs text-teal hover:underline">
                                {r.contact.full_name}{r.contact.company ? ` · ${r.contact.company}` : ""}
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                      {!isEditing && (
                        <>
                          <div className={cn("text-xs whitespace-nowrap mt-1", dueColor)}>
                            {r.due_date ? `Due ${format(new Date(r.due_date), "d MMM")}` : "No date"}
                          </div>
                          <button onClick={() => startEdit(r)} className="text-xs text-teal hover:underline mt-1">Edit</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
