import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase, type ActionItem } from "@/lib/supabase";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { emitActionItemsChanged } from "@/hooks/useActionItemsCount";

function fmtDue(iso: string | null): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `Due ${format(d, "d MMM")}`;
}

export function ActionItemList({
  interactionId,
  needsFollowup,
  onAllCompleteChanged,
}: {
  interactionId: string;
  needsFollowup?: boolean;
  onAllCompleteChanged?: () => void;
}) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("action_items")
      .select("*")
      .eq("interaction_id", interactionId)
      .order("created_at", { ascending: true });
    setItems((data || []) as ActionItem[]);
    setLoading(false);
  }, [interactionId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (item: ActionItem) => {
    const next = !item.completed;
    setItems(arr => arr.map(i => i.id === item.id ? { ...i, completed: next, completed_at: next ? new Date().toISOString() : null } : i));
    await supabase.from("action_items")
      .update({ completed: next, completed_at: next ? new Date().toISOString() : null })
      .eq("id", item.id);
    emitActionItemsChanged();
  };

  const setDue = async (item: ActionItem, d: Date) => {
    const iso = d.toISOString().slice(0,10);
    setItems(arr => arr.map(i => i.id === item.id ? { ...i, due_date: iso } : i));
    await supabase.from("action_items").update({ due_date: iso }).eq("id", item.id);
  };

  const allDone = items.length > 0 && items.every(i => i.completed);

  const completeFollowup = async () => {
    const { error } = await supabase
      .from("interactions")
      .update({ needs_followup: false })
      .eq("id", interactionId);
    if (error) { toast.error(error.message); return; }
    toast.success("Follow-up marked complete");
    onAllCompleteChanged?.();
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => toggle(item)}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <span className={cn(item.completed && "line-through text-muted-foreground")}>
                {item.text}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink"
                  >
                    <CalendarIcon className="h-3 w-3" />
                    {fmtDue(item.due_date)}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={item.due_date ? new Date(item.due_date) : undefined}
                    onSelect={(d) => d && setDue(item, d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </li>
        ))}
      </ul>
      {allDone && needsFollowup !== false && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 text-teal border-teal/40 hover:bg-teal-light"
          onClick={completeFollowup}
        >
          Mark follow-up complete
        </Button>
      )}
    </div>
  );
}