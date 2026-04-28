import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { daysSince } from "@/lib/format";

export function useAttentionCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const in7 = new Date(); in7.setDate(in7.getDate() + 7);
      const in7Str = in7.toISOString().slice(0, 10);

      const [followups, stale] = await Promise.all([
        supabase.from("interactions")
          .select("contact_id")
          .eq("needs_followup", true)
          .lte("followup_by", in7Str),
        supabase.from("contacts")
          .select("id, last_contact_date")
          .in("status", ["contacted", "replied"]),
      ]);

      const ids = new Set<string>();
      (followups.data || []).forEach((r: any) => r.contact_id && ids.add(r.contact_id));
      (stale.data || []).forEach((c: any) => {
        if (daysSince(c.last_contact_date) > 5) ids.add(c.id);
      });
      if (!cancelled) setCount(ids.size);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return count;
}