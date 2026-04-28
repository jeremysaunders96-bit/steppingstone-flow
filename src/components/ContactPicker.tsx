import { useEffect, useState } from "react";
import { supabase, type Contact } from "@/lib/supabase";
import { Input } from "@/components/ui/input";

export function ContactPicker({
  label, value, onChange, excludeId,
}: { label: string; value: Contact | null; onChange: (c: Contact | null) => void; excludeId?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("contacts").select("*")
        .ilike("full_name", `%${q}%`).limit(8);
      setResults((data || []).filter(c => c.id !== excludeId) as Contact[]);
    }, 150);
    return () => clearTimeout(t);
  }, [q, excludeId]);

  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">{label}</label>
      {value ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/40">
          <span className="text-sm"><strong>{value.full_name}</strong>{value.company ? ` — ${value.company}` : ""}</span>
          <button className="text-xs text-muted-foreground hover:text-ink" onClick={()=>onChange(null)}>Change</button>
        </div>
      ) : (
        <div className="relative">
          <Input
            placeholder="Search contacts…"
            value={q}
            onFocus={()=>setOpen(true)}
            onChange={e=>{ setQ(e.target.value); setOpen(true); }}
            onBlur={()=>setTimeout(()=>setOpen(false), 150)}
          />
          {open && results.length > 0 && (
            <div className="absolute z-50 mt-1 w-full card-soft border max-h-60 overflow-y-auto">
              {results.map(c => (
                <button
                  key={c.id}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  onClick={()=>{ onChange(c); setQ(""); setOpen(false); }}
                >
                  <strong>{c.full_name}</strong>
                  {c.company && <span className="text-muted-foreground"> — {c.company}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}