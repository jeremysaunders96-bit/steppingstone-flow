import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase, type Contact } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";

export default function CompanyDetail() {
  const { name } = useParams<{ name: string }>();
  const company = decodeURIComponent(name || "");
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // case-insensitive exact match on company
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .ilike("company", company)
        .order("full_name");
      if (!cancelled) {
        setRows((data || []) as Contact[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [company]);

  return (
    <div className="space-y-6">
      <Link to="/contacts" className="inline-flex items-center text-sm text-teal hover:underline">
        <ChevronLeft className="h-4 w-4" /> All contacts
      </Link>

      <div>
        <h1 className="font-display text-3xl text-teal">{company || "Company"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {loading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "contact" : "contacts"} at this company`}
        </p>
      </div>

      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td className="px-5 py-6 text-muted-foreground" colSpan={3}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-5 py-6 text-muted-foreground italic" colSpan={3}>
                No contacts found at {company}.
              </td></tr>
            ) : rows.map(c => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-5 py-3 font-semibold">
                  <Link to={`/contacts/${c.id}`} className="text-ink hover:text-teal hover:underline">
                    {c.full_name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-ink/80">{c.role || "—"}</td>
                <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}