import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { supabase, type Contact } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatShortDate } from "@/lib/format";
import { AddContactModal } from "@/components/modals/AddContactModal";
import { NewIntroductionModal } from "@/components/modals/NewIntroductionModal";

export default function Contacts() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("contacts").select("*").order("full_name");
    setRows((data || []) as Contact[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(r =>
      r.full_name.toLowerCase().includes(s) ||
      (r.company || "").toLowerCase().includes(s) ||
      (r.role || "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-teal">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows.length} total</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-teal hover:bg-teal/90 text-white" onClick={()=>setAddOpen(true)}>Add Contact</Button>
          <Button className="bg-teal-light hover:bg-teal-light/80 text-teal" onClick={()=>setIntroOpen(true)}>New Introduction</Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search name, company, role…" value={q} onChange={e=>setQ(e.target.value)} />
      </div>

      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Company</th>
              <th className="px-5 py-3 hidden md:table-cell">Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 hidden md:table-cell">Last Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td className="px-5 py-6 text-muted-foreground" colSpan={5}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-5 py-6 text-muted-foreground italic" colSpan={5}>No contacts found.</td></tr>
            ) : filtered.map(c => (
              <tr
                key={c.id}
                onClick={() => navigate(`/contacts/${c.id}`)}
                className="hover:bg-muted/30 cursor-pointer"
              >
                <td className="px-5 py-3 font-semibold text-ink">{c.full_name}</td>
                <td className="px-5 py-3 text-ink/80">{c.company || "—"}</td>
                <td className="px-5 py-3 text-ink/70 hidden md:table-cell">{c.role || "—"}</td>
                <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-5 py-3 text-ink/70 hidden md:table-cell">{formatShortDate(c.last_contact_date)}</td>
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