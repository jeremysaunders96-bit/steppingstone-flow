import { useEffect, useState } from "react";
import { supabase, type Contact } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ContactPicker({
  label, value, onChange, excludeId, allowCreate,
}: {
  label: string;
  value: Contact | null;
  onChange: (c: Contact | null) => void;
  excludeId?: string;
  /** When true, show a "+ Create new contact" option and inline create form. */
  allowCreate?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [saving, setSaving] = useState(false);

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

  const startCreate = () => {
    setNewName(q);
    setNewEmail(q.includes("@") ? q : "");
    setNewCompany("");
    setCreating(true);
    setOpen(false);
  };

  const saveNew = async () => {
    const name = newName.trim();
    if (!name) { toast.error("Name required"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        full_name: name,
        email: newEmail.trim() || null,
        company: newCompany.trim() || null,
        status: "contacted",
        last_contact_date: new Date().toISOString().slice(0, 10),
      })
      .select("*")
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contact created");
    onChange(data as Contact);
    setCreating(false);
    setQ("");
  };

  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">{label}</label>
      {value ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/40">
          <span className="text-sm"><strong>{value.full_name}</strong>{value.company ? ` — ${value.company}` : ""}</span>
          <button className="text-xs text-muted-foreground hover:text-ink" onClick={()=>onChange(null)}>Change</button>
        </div>
      ) : creating ? (
        <div className="card-soft p-3 space-y-2 border">
          <Input placeholder="Full name" value={newName} onChange={e=>setNewName(e.target.value)} />
          <Input placeholder="Email address" value={newEmail} onChange={e=>setNewEmail(e.target.value)} />
          <Input placeholder="Company" value={newCompany} onChange={e=>setNewCompany(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={()=>setCreating(false)}>Cancel</Button>
            <Button size="sm" className="bg-teal hover:bg-teal/90 text-white" disabled={saving} onClick={saveNew}>
              {saving ? "Saving…" : "Create and select"}
            </Button>
          </div>
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
          {open && (results.length > 0 || (allowCreate && q.trim())) && (
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
              {allowCreate && q.trim() && (
                <button
                  type="button"
                  className="block w-full text-left px-3 py-2 text-sm text-teal hover:bg-muted border-t"
                  onMouseDown={(e)=>{ e.preventDefault(); startCreate(); }}
                >
                  + Create new contact{q.trim() ? ` "${q.trim()}"` : ""}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}