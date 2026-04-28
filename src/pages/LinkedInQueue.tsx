import { useEffect, useState } from "react";
import { supabase, type LinkedInPost } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

export default function LinkedInQueue() {
  const [drafts, setDrafts] = useState<LinkedInPost[]>([]);
  const [posted, setPosted] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: d } = await supabase.from("linkedin_posts").select("*").eq("status","draft").order("created_at",{ascending:false});
    setDrafts((d || []) as LinkedInPost[]);
    const since = new Date(); since.setDate(since.getDate()-7);
    const { data: p } = await supabase.from("linkedin_posts").select("*")
      .eq("status","posted").gte("posted_at", since.toISOString()).order("posted_at",{ascending:false});
    setPosted((p || []) as LinkedInPost[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const decide = async (id: string, status: "approved" | "ignored") => {
    const { error } = await supabase.from("linkedin_posts").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Approved" : "Ignored");
    load();
  };

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-3xl text-teal">LinkedIn Queue</h1>
      </header>

      <section>
        <h2 className="font-display text-2xl text-teal mb-4">Awaiting Approval</h2>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : drafts.length === 0 ? (
          <div className="card-soft p-8 text-center text-muted-foreground italic">No posts queued this week.</div>
        ) : (
          <div className="space-y-4">
            {drafts.map(p => (
              <article key={p.id} className="card-soft p-6">
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge>{p.post_type}</Badge>
                  <Badge subtle>{p.page}</Badge>
                </div>
                <p className="text-ink whitespace-pre-wrap leading-relaxed">{p.body}</p>
                {p.personal_commentary && (
                  <div className="mt-4 pl-4 border-l-2 border-orange italic text-ink/80">
                    <div className="text-[11px] uppercase tracking-wide text-orange not-italic mb-1">Will's personal commentary</div>
                    <p className="whitespace-pre-wrap">{p.personal_commentary}</p>
                  </div>
                )}
                <div className="flex gap-2 mt-5">
                  <Button
                    className="bg-teal hover:bg-teal/90 text-white"
                    onClick={()=>decide(p.id,"approved")}
                    aria-label="Approve"
                  >
                    <Check className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Approve</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={()=>decide(p.id,"ignored")}
                    aria-label="Ignore"
                  >
                    <X className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Ignore</span>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {posted.length > 0 && (
        <section>
          <h2 className="font-display text-2xl text-teal mb-4">Posted This Week</h2>
          <div className="space-y-3">
            {posted.map(p => (
              <article key={p.id} className="card-soft p-5">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge>{p.post_type}</Badge>
                  <Badge subtle>{p.page}</Badge>
                </div>
                <p className="text-sm text-ink/85 line-clamp-3 whitespace-pre-wrap">{p.body}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {p.impressions != null && <Stat label="Impressions" value={p.impressions} />}
                  {p.reactions != null && <Stat label="Reactions" value={p.reactions} />}
                  {p.comments != null && <Stat label="Comments" value={p.comments} />}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Badge({ children, subtle }: { children: React.ReactNode; subtle?: boolean }) {
  return (
    <span className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full ${subtle ? "bg-muted text-ink/70" : "bg-teal-light text-teal"}`}>
      {children}
    </span>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-ink/80">
      <strong className="text-ink">{value.toLocaleString()}</strong> {label}
    </span>
  );
}