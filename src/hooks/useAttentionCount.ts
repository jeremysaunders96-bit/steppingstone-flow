import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Counts only "Owes a Reply" — interactions flagged needs_followup whose
 * followup_by date is on or before today. These are Will's hard obligations.
 */
export function useAttentionCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("interactions")
        .select("contact_id")
        .eq("needs_followup", true)
        .lte("followup_by", todayStr);
      if (!cancelled) setCount((data || []).length);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return count;
}