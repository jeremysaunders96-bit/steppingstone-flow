import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Copy } from "lucide-react";
import { supabase, type Contact } from "@/lib/supabase";
import { formatShortDate, daysSince } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DraftEmailModal } from "@/components/modals/DraftEmailModal";
import { HomeActionItems } from "@/components/HomeActionItems";
import { TodayMeetingsCard } from "@/components/TodayMeetingsCard";
import { useToast } from "@/hooks/use-toast";

const BIO_TEXT = "William Meadon, a chartered accountant, joined Schroders in the late 1980s as a balanced pension fund manager. He then joined Newton Investment Management, where the firm's funds under management increased tenfold during his tenure. In 1996, he joined Flemings, which J.P. Morgan later acquired. During his 28 years at J.P. Morgan, William lead the firm's Core Team where he managed a range of UK, European, and global long-only funds, including several investment trusts such as JPM Claverhouse. In 2024, he left J.P. Morgan to found Steppingstone, a one-stop-shop to help UK businesses grow through its network of fractional experts and advisors.";

type WorthCallRow = { contact: Contact };

export default function Home() {
  const [worthCall, setWorthCall] = useState<WorthCallRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [draftFor, setDraftFor] = useState<Contact | null>(null);
  const { toast } = useToast();

  const copyBio = async () => {
    try {
      await navigator.clipboard.writeText(BIO_TEXT);
      toast({ title: "Bio copied to clipboard" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date(); today.setHours(0,0,0,0);
    const fourteenAgo = new Date(today); fourteenAgo.setDate(fourteenAgo.getDate() - 14);
    const fourteenAgoStr = fourteenAgo.toISOString().slice(0,10);

    // Worth a Call This Week — stale contacts
    const { data: stale } = await supabase
      .from("contacts").select("*")
      .in("status", ["contacted","replied","meeting booked"])
      .lt("last_contact_date", fourteenAgoStr)
      .order("last_contact_date", { ascending: true });
    const worthRows: WorthCallRow[] = (stale || [])
      .slice(0, 3)
      .map((c: Contact) => ({ contact: c }));
    setWorthCall(worthRows);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const allClear = !loading && worthCall.length === 0;

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-3xl text-teal">Good morning, Will</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </header>

      {/* Needs Attention */}
      <section>
        <h2 className="font-display text-2xl text-teal mb-4">Needs Attention</h2>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : allClear ? (
          <div className="card-soft p-8 text-center text-muted-foreground italic">All clear.</div>
        ) : (
          <div className="space-y-6">
            {worthCall.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/70 mb-2">Worth a Call This Week</h3>
                <div className="card-soft divide-y">
                  {worthCall.map(({ contact }) => (
                    <div key={contact.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <Link to={`/contacts/${contact.id}`} className="font-semibold text-ink hover:text-teal">{contact.full_name}</Link>
                          {contact.company && <span className="text-sm text-muted-foreground">{contact.company}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Last contact: {formatShortDate(contact.last_contact_date)} · {daysSince(contact.last_contact_date)} days ago
                        </div>
                      </div>
                      <Button
                        className="bg-teal-light text-teal hover:bg-teal-light/80"
                        onClick={() => setDraftFor(contact)}
                      >Draft Email</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Today */}
      <section>
        <h2 className="font-display text-2xl text-teal mb-4">Today</h2>
        <TodayMeetingsCard />
      </section>

      <HomeActionItems />

      <DraftEmailModal open={!!draftFor} onOpenChange={(v)=>!v && setDraftFor(null)} contactName={draftFor?.full_name} contact={draftFor} />

      {/* Bio */}
      <section>
        <div className="rounded-lg overflow-hidden border border-teal/20 bg-background">
          <div className="bg-teal px-5 py-3">
            <h2 className="font-display text-xl text-white" style={{ fontFamily: "Georgia, serif" }}>Bio</h2>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm leading-relaxed text-ink/90 whitespace-pre-wrap">{BIO_TEXT}</p>
            <div className="flex justify-end">
              <Button
                onClick={copyBio}
                style={{ backgroundColor: "#d97732" }}
                className="text-white hover:opacity-90"
              >
                <Copy className="h-4 w-4 mr-2" /> Copy Bio
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}