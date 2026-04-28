import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Counts deals whose stage is anything other than "done".
 */
export function useActiveDealsCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from("deals").select("id").neq("stage","done");
      if (!cancelled) setCount((data || []).length);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  return count;
}