import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase, type Contact, type Deal } from "@/lib/supabase";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";

type LinkedContact = Contact & { role_in_deal?: string | null };

export function DealModal({ deal, onOpenChange }: { deal: Deal | null; onOpenChange: (v:boolean)=>void }) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<LinkedContact[]>([]);
  const [linking, setLinking] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [picked, setPicked] = useState<Contact | null>(null);
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!deal) return;
    const { data } = await supabase
      .from("deal_contacts")
      .select("role_in_deal, contact:contacts(*)")
      .eq("deal_id", deal.id);
    setContacts((data || []).map((r: any) => r.contact ? { ...r.contact, role_in_deal: r.role_in_deal } : null).filter(Boolean));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [deal]);

  useEffect(() => {
    if (!q || picked) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("contacts").select("*")
        .or(`full_name.ilike.%${q}%,company.ilike.%${q}%`)
        .limit(8);
      const linkedIds = new Set(contacts.map(c => c.id));
      setResults((data || []).filter((c: any) => !linkedIds.has(c.id)) as Contact[]);
    }, 150);
    return () => clearTimeout(t);
  }, [q, picked, contacts]);

  const resetLink = () => { setLinking(false); setQ(""); setPicked(null); setRole(""); setResults([]); };

  const link = async () => {
    if (!deal || !picked) return;
    setSaving(true);
    const { error } = await supabase.from("deal_contacts").insert({
      deal_id: deal.id, contact_id: picked.id, role_in_deal: role.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contact linked");
    resetLink();
    await load();
  };

  const remove = async (contactId: string) => {
    if (!deal) return;
    const { error } = await supabase.from("deal_contacts")
      .delete().eq("deal_id", deal.id).eq("contact_id", contactId);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  const openContact = (id: string) => {
    onOpenChange(false);
    navigate(`/contacts/${id}`);
  };

  return (
    <Dialog open={!!deal} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {deal && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-teal text-2xl">{deal.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-light text-teal">{deal.stage}</span>
                {deal.target_amount != null && (
                  <span className="font-display text-xl text-ink">{formatMoney(deal.target_amount)}</span>
                )}
              </div>
              {deal.description && <p className="text-sm text-ink/80 whitespace-pre-wrap">{deal.description}</p>}
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Linked contacts</div>
                {contacts.length === 0 ? (
                  <div className="text-sm italic text-muted-foreground">None linked yet.</div>
                ) : (
                  <ul className="divide-y">
                    {contacts.map(c => (
                      <li key={c.id} className="py-2 text-sm flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <button
                            className="font-semibold hover:text-teal text-left"
                            onClick={() => openContact(c.id)}
                          >
                            {c.full_name}
                          </button>
                          {c.company && <span className="text-muted-foreground"> — {c.company}</span>}
                          {c.role_in_deal && (
                            <span className="ml-2 text-xs italic text-teal">{c.role_in_deal}</span>
                          )}
                        </div>
                        <button
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => remove(c.id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {!linking ? (
                  <button
                    className="mt-3 inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-teal-light text-teal hover:bg-teal-light/80"
                    onClick={() => setLinking(true)}
                  >
                    + Link Contact
                  </button>
                ) : (
                  <div className="mt-3 space-y-2 p-3 rounded-md border bg-muted/30">
                    {!picked ? (
                      <div className="relative">
                        <Input
                          autoFocus
                          placeholder="Search by name or company…"
                          value={q}
                          onChange={e => setQ(e.target.value)}
                        />
                        {results.length > 0 && (
                          <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
                            {results.map(c => (
                              <button
                                key={c.id}
                                className="block w-full text-left px-3 py-2 text-sm hover:bg-muted"
                                onClick={() => { setPicked(c); setQ(""); setResults([]); }}
                              >
                                <strong>{c.full_name}</strong>
                                {c.company && <span className="text-muted-foreground"> — {c.company}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-background border">
                        <span className="text-sm flex-1 truncate">
                          <strong>{picked.full_name}</strong>
                          {picked.company && <span className="text-muted-foreground"> — {picked.company}</span>}
                        </span>
                        <button className="text-xs text-muted-foreground hover:text-ink" onClick={() => setPicked(null)}>
                          Change
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        value={role}
                        onChange={e => setRole(e.target.value)}
                        placeholder="e.g. Investor, Introducer, Advisor"
                        className="flex-1"
                      />
                      <button
                        disabled={!picked || saving}
                        onClick={link}
                        className="px-3 py-2 rounded-md text-sm font-medium bg-teal text-white hover:bg-teal/90 disabled:opacity-50"
                      >
                        Link
                      </button>
                      <button
                        onClick={resetLink}
                        className="px-2 py-2 text-xs text-muted-foreground hover:text-ink"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}