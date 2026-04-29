import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { emitActionItemsChanged, ACTION_ITEMS_CHANGED } from "@/hooks/useActionItemsCount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  text: string;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  interaction_id: string | null;
  created_at: string;
  interaction: { date: string | null; type: string | null } | null;
};

function todayStr() { return new Date().toISOString().slice(0,10); }
function fourDays() {
  const d = new Date(); d.setDate(d.getDate() + 4);
  return d.toISOString().slice(0,10);
}

export function ContactActionItemsTab({ contactId }: { contactId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newDate, setNewDate] = useState<string>(fourDays());
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editDate, setEditDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("action_items")
      .select("id, text, due_date, completed, completed_at, interaction_id, created_at, interaction:interactions(date, type)")
      .eq("contact_id", contactId)
      .order("due_date", { ascending: true });
    setRows(((data || []) as any) as Row[]);
  }, [contactId]);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener(ACTION_ITEMS_CHANGED, h);
    return () => window.removeEventListener(ACTION_ITEMS_CHANGED, h);
  }, [load]);

  const toggle = async (r: Row) => {
    const next = !r.completed;
    await supabase.from("action_items")
      .update({ completed: next, completed_at: next ? new Date().toISOString() : null })
      .eq("id", r.id);
    emitActionItemsChanged();
    load();
  };

  const saveNew = async () => {
    if (!newText.trim()) return;
    await supabase.from("action_items").insert({
      contact_id: contactId,
      interaction_id: null,
      text: newText.trim(),
      due_date: newDate,
      completed: false,
    });
    setAdding(false); setNewText(""); setNewDate(fourDays());
    emitActionItemsChanged();
    load();
  };

  const startEdit = (r: Row) => { setEditing(r.id); setEditText(r.text); setEditDate(r.due_date); };
  const saveEdit = async () => {
    if (!editing) return;
    await supabase.from("action_items").update({ text: editText.trim(), due_date: editDate }).eq("id", editing);
    setEditing(null); load();
  };

  const t = todayStr();
  const outstanding = rows.filter(r => !r.completed);
  const completed = rows.filter(r => r.completed);

  return (
    <div className="space-y-4">
      <div>
        {!adding ? (
          <Button size="sm" variant="outline" className="text-teal border-teal/40" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add action item
          </Button>
        ) : (
          <div className="card-soft p-4 space-y-2">
            <Input value={newText} onChange={e => setNewText(e.target.value)} placeholder="What needs doing?" autoFocus />
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {newDate ? format(new Date(newDate), "d MMM yyyy") : "No date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate ? new Date(newDate) : undefined}
                    onSelect={(d) => d && setNewDate(d.toISOString().slice(0,10))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Button size="sm" className="bg-teal hover:bg-teal/90 text-white" onClick={saveNew}>Save</Button>
              <button onClick={() => { setAdding(false); setNewText(""); }} className="text-xs text-muted-foreground hover:text-ink">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {outstanding.length === 0 ? (
        <div className="card-soft p-6 text-sm text-muted-foreground italic">No outstanding action items.</div>
      ) : (
        <div className="card-soft divide-y">
          {outstanding.map(r => {
            const overdue = r.due_date && r.due_date < t;
            const isEditing = editing === r.id;
            return (
              <div key={r.id} className="flex items-start gap-3 px-5 py-3">
                <input type="checkbox" checked={false} onChange={() => toggle(r)} className="h-4 w-4 mt-1" />
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
                      {r.interaction?.date && (
                        <div className="text-xs italic text-muted-foreground mt-0.5">
                          From {r.interaction.type || "interaction"} {format(new Date(r.interaction.date), "d MMM")}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {!isEditing && (
                  <>
                    <div className={cn("text-xs whitespace-nowrap mt-1", overdue ? "text-orange" : "text-muted-foreground")}>
                      {r.due_date ? `Due ${format(new Date(r.due_date), "d MMM")}` : "No date"}
                    </div>
                    <button onClick={() => startEdit(r)} className="text-xs text-teal hover:underline mt-1">Edit</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Completed</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="card-soft divide-y">
            {completed.map(r => (
              <div key={r.id} className="flex items-start gap-3 px-5 py-3">
                <input type="checkbox" checked readOnly onChange={() => toggle(r)} className="h-4 w-4 mt-1 opacity-60" />
                <div className="flex-1 min-w-0">
                  <div className="line-through text-muted-foreground">{r.text}</div>
                  {r.interaction?.date && (
                    <div className="text-xs italic text-muted-foreground mt-0.5">
                      From {r.interaction.type || "interaction"} {format(new Date(r.interaction.date), "d MMM")}
                    </div>
                  )}
                </div>
                {r.completed_at && (
                  <div className="text-xs text-muted-foreground whitespace-nowrap mt-1">
                    Completed {format(new Date(r.completed_at), "d MMM")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
