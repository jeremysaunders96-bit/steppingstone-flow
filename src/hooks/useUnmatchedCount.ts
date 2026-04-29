import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Counts unmatched_memos with status = 'unmatched'. */
export function useUnmatchedCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("unmatched_memos").select("id").eq("status", "unmatched");
      if (!cancelled) setCount((data || []).length);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  return count;
}
