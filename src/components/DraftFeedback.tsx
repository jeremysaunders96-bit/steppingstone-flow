import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { saveDraftFeedback, type DraftOutcome } from "@/lib/draftEmail";

interface Props {
  mode: "single" | "intro";
  contactId?: string | null;
  originalDraft: string;
  currentDraft: string;
  brief?: string | null;
}

export function DraftFeedback({ mode, contactId, originalDraft, currentDraft, brief }: Props) {
  const { toast } = useToast();
  const [saved, setSaved] = useState<DraftOutcome | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (outcome: DraftOutcome, finalVersion?: string, editNotes?: string) => {
    setBusy(true);
    try {
      await saveDraftFeedback({
        contactId: contactId ?? null,
        mode,
        outcome,
        originalDraft,
        finalVersion: finalVersion ?? originalDraft,
        editNotes: editNotes ?? null,
        brief: brief ?? null,
      });
      setSaved(outcome);
      setShowEdit(false);
      toast({ title: "Thanks — feedback saved" });
    } catch (e) {
      toast({
        title: "Could not save feedback",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Feedback recorded ({saved.replace(/-/g, " ")}).
      </p>
    );
  }

  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs text-muted-foreground">How did this draft land?</p>
      <div className="flex flex-wrap gap-3 text-xs">
        <button
          type="button"
          disabled={busy}
          onClick={() => save("sent-as-written", currentDraft)}
          className="text-muted-foreground underline-offset-2 hover:underline hover:text-foreground disabled:opacity-50"
        >
          Sent as written
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowEdit(true)}
          className="text-muted-foreground underline-offset-2 hover:underline hover:text-foreground disabled:opacity-50"
        >
          Edited before sending
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => save("rejected")}
          className="text-muted-foreground underline-offset-2 hover:underline hover:text-foreground disabled:opacity-50"
        >
          Did not use
        </button>
      </div>
      {showEdit && (
        <div className="flex gap-2 items-center pt-1">
          <Input
            placeholder="What did you change?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-sm h-8"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => save("edited-and-sent", currentDraft, notes.trim() || null)}
            className="text-xs text-teal underline-offset-2 hover:underline disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}