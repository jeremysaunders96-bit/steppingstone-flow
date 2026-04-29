import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export const ACTION_ITEMS_CHANGED = "action-items-changed";

export function emitActionItemsChanged() {
  window.dispatchEvent(new Event(ACTION_ITEMS_CHANGED));
}

export function useActionItemsCount() {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    const { count: c } = await supabase
      .from("action_items")
      .select("*", { count: "exact", head: true })
      .eq("completed", false);
    setCount(c || 0);
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener(ACTION_ITEMS_CHANGED, handler);
    const t = setInterval(load, 60_000);
    return () => {
      window.removeEventListener(ACTION_ITEMS_CHANGED, handler);
      clearInterval(t);
    };
  }, [load]);

  return count;
}
