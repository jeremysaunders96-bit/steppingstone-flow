import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase, type Contact, type Deal } from "@/lib/supabase";
import { formatMoney } from "@/lib/format";

export function DealModal({ deal, onOpenChange }: { deal: Deal | null; onOpenChange: (v:boolean)=>void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  useEffect(() => {
    if (!deal) return;
    (async () => {
      const { data } = await supabase
        .from("deal_contacts")
        .select("contact:contacts(*)")
        .eq("deal_id", deal.id);
      setContacts((data || []).map((r: any) => r.contact).filter(Boolean));
    })();
  }, [deal]);

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
                      <li key={c.id} className="py-2 text-sm">
                        <span className="font-semibold">{c.full_name}</span>
                        {c.company && <span className="text-muted-foreground"> — {c.company}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}