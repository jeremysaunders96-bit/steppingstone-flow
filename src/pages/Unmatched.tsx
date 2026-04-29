import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { supabase, type UnmatchedMemo } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { AssignMemoModal } from "@/components/modals/AssignMemoModal";
import { toast } from "sonner";

export default function Unmatched() {
  const [memos, setMemos] = useState<UnmatchedMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<UnmatchedMemo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("unmatched_memos")
      .select("*")
      .eq("status", "unmatched")
      .order("created_at", { ascending: false });
    setMemos((data || []) as UnmatchedMemo[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const dismiss = async (m: UnmatchedMemo) => {
    const { error } = await supabase
      .from("unmatched_memos")
      .update({ status: "dismissed" })
      .eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Dismissed");
    load();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-teal">Unmatched</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Voice notes Claude couldn't match to a contact. Assign or dismiss each one.
        </p>
      </header>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : memos.length === 0 ? (
        <div className="card-soft p-8 text-center text-muted-foreground italic">All clear — no unmatched memos.</div>
      ) : (
        <div className="card-soft divide-y">
          {memos.map(m => (
            <div key={m.id} className="px-5 py-4 flex items-start gap-4">
              <div className="text-xs text-teal min-w-[100px] pt-1">
                {m.extracted_date ? format(new Date(m.extracted_date), "d MMM yyyy") : "—"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink">{m.extracted_contact_name || "(no name)"}</div>
                {m.extracted_company && (
                  <div className="text-xs text-muted-foreground">{m.extracted_company}</div>
                )}
                {m.extracted_summary && (
                  <div className="text-sm italic text-ink/80 mt-1">{m.extracted_summary}</div>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  className="bg-teal hover:bg-teal/90 text-white"
                  onClick={() => setAssigning(m)}
                >Assign to contact</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-ink"
                  onClick={() => dismiss(m)}
                >Dismiss</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AssignMemoModal
        open={!!assigning}
        onOpenChange={(v) => !v && setAssigning(null)}
        memo={assigning}
        onAssigned={load}
      />
    </div>
  );
}
