import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUp, ArrowDown, Plus, X } from "lucide-react";
import { supabase, type Contact } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatShortDate } from "@/lib/format";
import { AddContactModal } from "@/components/modals/AddContactModal";
import { NewIntroductionModal } from "@/components/modals/NewIntroductionModal";

type ColumnKey =
  | { kind: "fixed"; key: "full_name" | "company" | "role" | "fund" | "board" | "status" | "last_contact_date"; label: string }
  | { kind: "custom"; key: string; label: string };

const FIXED_COLUMNS: ColumnKey[] = [
  { kind: "fixed", key: "full_name", label: "Name" },
  { kind: "fixed", key: "company", label: "Company" },
  { kind: "fixed", key: "role", label: "Role" },
  { kind: "fixed", key: "fund", label: "Fund" },
  { kind: "fixed", key: "board", label: "Board" },
  { kind: "fixed", key: "status", label: "Status" },
  { kind: "fixed", key: "last_contact_date", label: "Last Contact" },
];

const DEFAULT_VISIBLE: string[] = ["full_name", "company", "role", "status", "last_contact_date"];
const VISIBLE_STORAGE = "contacts.visibleCols.v1";
const CUSTOM_STORAGE = "contacts.customCols.v1";

function getCellValue(c: Contact, col: ColumnKey): string | null {
  if (col.kind === "custom") {
    const v = c.custom_fields?.[col.key];
    return v == null || v === "" ? null : String(v);
  }
  switch (col.key) {
    case "full_name": return c.full_name;
    case "company": return c.company;
    case "role": return c.role;
    case "fund": return c.fund;
    case "board": return c.board;
    case "status": return c.status;
    case "last_contact_date": return c.last_contact_date;
  }
}

export default function Contacts() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);

  const [customCols, setCustomCols] = useState<{ key: string; label: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_STORAGE) || "[]"); } catch { return []; }
  });
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(VISIBLE_STORAGE) || "null");
      return Array.isArray(v) && v.length ? v : DEFAULT_VISIBLE;
    } catch { return DEFAULT_VISIBLE; }
  });
  const [sortKey, setSortKey] = useState<string>("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showColPicker, setShowColPicker] = useState(false);
  const [newColName, setNewColName] = useState("");

  useEffect(() => { localStorage.setItem(CUSTOM_STORAGE, JSON.stringify(customCols)); }, [customCols]);
  useEffect(() => { localStorage.setItem(VISIBLE_STORAGE, JSON.stringify(visibleKeys)); }, [visibleKeys]);

  const allColumns: ColumnKey[] = useMemo(
    () => [...FIXED_COLUMNS, ...customCols.map(c => ({ kind: "custom" as const, key: c.key, label: c.label }))],
    [customCols]
  );
  const visibleCols = useMemo(
    () => visibleKeys.map(k => allColumns.find(c => c.key === k)).filter(Boolean) as ColumnKey[],
    [visibleKeys, allColumns]
  );
  const sortCol = useMemo(() => allColumns.find(c => c.key === sortKey) || FIXED_COLUMNS[0], [allColumns, sortKey]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("contacts").select("*").order("full_name");
    setRows((data || []) as Contact[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filteredSorted = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = rows.filter(r => {
      if (!s) return true;
      return (
        r.full_name.toLowerCase().includes(s) ||
        (r.company || "").toLowerCase().includes(s) ||
        (r.role || "").toLowerCase().includes(s)
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = getCellValue(a, sortCol);
      const bv = getCellValue(b, sortCol);
      // empties sort to the bottom regardless of direction
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: "base", numeric: true });
      if (cmp !== 0) return cmp * dir;
      // stable tiebreaker on name so groups (e.g. same company) read predictably
      return a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" });
    });
  }, [rows, q, sortCol, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleVisible = (key: string) => {
    setVisibleKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const addCustomColumn = () => {
    const label = newColName.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!key) return;
    if (FIXED_COLUMNS.some(c => c.key === key) || customCols.some(c => c.key === key)) {
      setNewColName("");
      return;
    }
    setCustomCols(prev => [...prev, { key, label }]);
    setVisibleKeys(prev => prev.includes(key) ? prev : [...prev, key]);
    setNewColName("");
  };

  const removeCustomColumn = (key: string) => {
    setCustomCols(prev => prev.filter(c => c.key !== key));
    setVisibleKeys(prev => prev.filter(k => k !== key));
    if (sortKey === key) { setSortKey("full_name"); setSortDir("asc"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-teal">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows.length} total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>setShowColPicker(v=>!v)}>Columns</Button>
          <Button className="bg-teal hover:bg-teal/90 text-white" onClick={()=>setAddOpen(true)}>Add Contact</Button>
          <Button className="bg-teal-light hover:bg-teal-light/80 text-teal" onClick={()=>setIntroOpen(true)}>New Introduction</Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search name, company, role…" value={q} onChange={e=>setQ(e.target.value)} />
      </div>

      {showColPicker && (
        <div className="card-soft p-4 space-y-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Show columns</div>
          <div className="flex flex-wrap gap-2">
            {allColumns.map(col => {
              const on = visibleKeys.includes(col.key);
              const isCustom = col.kind === "custom";
              return (
                <div key={col.key} className="flex items-center">
                  <button
                    onClick={()=>toggleVisible(col.key)}
                    className={`px-3 py-1 rounded-l text-xs border ${on ? "bg-teal text-white border-teal" : "bg-background border-border text-ink"}`}
                  >
                    {col.label}
                  </button>
                  {isCustom && (
                    <button
                      onClick={()=>removeCustomColumn(col.key)}
                      className="px-2 py-1 rounded-r text-xs border border-l-0 border-border bg-background text-muted-foreground hover:text-destructive"
                      title="Remove custom column"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 items-center pt-2 border-t">
            <Input
              placeholder="New column name (e.g. Sector)"
              value={newColName}
              onChange={e=>setNewColName(e.target.value)}
              onKeyDown={e=>{ if (e.key === "Enter") addCustomColumn(); }}
              className="max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={addCustomColumn}>
              <Plus className="h-3 w-3 mr-1" /> Add column
            </Button>
            <span className="text-xs text-muted-foreground">Edit values on each contact's page.</span>
          </div>
        </div>
      )}

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {visibleCols.map(col => {
                const active = sortKey === col.key;
                return (
                  <th key={col.key} className="px-5 py-3">
                    <button
                      onClick={()=>toggleSort(col.key)}
                      className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
                    >
                      {col.label}
                      {active && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td className="px-5 py-6 text-muted-foreground" colSpan={visibleCols.length}>Loading…</td></tr>
            ) : filteredSorted.length === 0 ? (
              <tr><td className="px-5 py-6 text-muted-foreground italic" colSpan={visibleCols.length}>No contacts found.</td></tr>
            ) : filteredSorted.map(c => (
              <tr
                key={c.id}
                onClick={() => navigate(`/contacts/${c.id}`)}
                className="hover:bg-muted/30 cursor-pointer"
              >
                {visibleCols.map(col => {
                  const v = getCellValue(c, col);
                  if (col.key === "full_name") {
                    return <td key={col.key} className="px-5 py-3 font-semibold text-ink">{v || "—"}</td>;
                  }
                  if (col.key === "status") {
                    return <td key={col.key} className="px-5 py-3"><StatusBadge status={c.status} /></td>;
                  }
                  if (col.key === "last_contact_date") {
                    return <td key={col.key} className="px-5 py-3 text-ink/70">{formatShortDate(c.last_contact_date)}</td>;
                  }
                  return <td key={col.key} className="px-5 py-3 text-ink/80">{v || "—"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddContactModal open={addOpen} onOpenChange={setAddOpen} onSaved={load} />
      <NewIntroductionModal open={introOpen} onOpenChange={setIntroOpen} onSaved={load} />
    </div>
  );
}