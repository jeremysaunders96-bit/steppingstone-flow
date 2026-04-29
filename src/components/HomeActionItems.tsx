import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { emitActionItemsChanged, ACTION_ITEMS_CHANGED } from "@/hooks/useActionItemsCount";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  text: string;
  due_date: string | null;
  contact: { id: string; full_name: string; company: string | null } | null;
};

function todayStr() { return new Date().toISOString().slice(0,10); }
function inDaysStr(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}

export function HomeActionItems() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("action_items")
      .select("id, text, due_date, contact:contacts(id, full_name, company)")
      .eq("completed", false)
      .lte("due_date", inDaysStr(3))
      .order("due_date", { ascending: true })
      .limit(7);
    setRows(((data || []) as any) as Row[]);
    setLoaded(true);
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

  if (!loaded || rows.length === 0) return null;
  const today = todayStr();

  return (
    <section>
      <h2 className="font-display text-2xl text-teal mb-4">Action Items</h2>
      <div className="card-soft divide-y">
        {rows.map(r => {
          const overdue = r.due_date && r.due_date < today;
          const isToday = r.due_date === today;
          const dueColor = overdue ? "text-orange" : isToday ? "text-teal" : "text-muted-foreground";
          return (
            <div key={r.id} className="flex items-center gap-3 px-5 py-3">
              <input type="checkbox" onChange={() => tick(r.id)} className="h-4 w-4" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink">{r.text}</div>
                {r.contact && (
                  <Link to={`/contacts/${r.contact.id}`} className="text-xs text-teal hover:underline">
                    {r.contact.full_name}{r.contact.company ? ` · ${r.contact.company}` : ""}
                  </Link>
                )}
              </div>
              <div className={cn("text-xs whitespace-nowrap", dueColor)}>
                {r.due_date ? `Due ${format(new Date(r.due_date), "d MMM")}` : "No date"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
