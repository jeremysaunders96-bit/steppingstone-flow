import { useEffect, useState } from "react";
import { supabase, type Deal } from "@/lib/supabase";
import { Input } from "@/components/ui/input";

/**
 * Searchable dropdown of active deals (anything except stage="done").
 * Optional value — Will can leave it blank.
 */
export function DealPicker({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: Deal | null;
  onChange: (d: Deal | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Deal[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      let query = supabase.from("deals").select("*").neq("stage", "done").limit(8);
      if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
      const { data } = await query;
      if (!cancelled) setResults((data || []) as Deal[]);
    };
    const t = setTimeout(run, 120);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  return (
    <div>
      {label && <label className="text-sm font-medium block mb-1.5">{label}</label>}
      {value ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/40">
          <span className="text-sm"><strong className="text-teal">{value.name}</strong></span>
          <button className="text-xs text-muted-foreground hover:text-ink" onClick={() => onChange(null)}>
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            placeholder="Search active deals…"
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && results.length > 0 && (
            <div className="absolute z-50 mt-1 w-full card-soft border max-h-60 overflow-y-auto">
              {results.map(d => (
                <button
                  key={d.id}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => { onChange(d); setQ(""); setOpen(false); }}
                >
                  <strong>{d.name}</strong>
                  <span className="text-muted-foreground"> — {d.stage}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}