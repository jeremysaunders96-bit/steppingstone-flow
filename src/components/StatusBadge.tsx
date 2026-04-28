import type { ContactStatus } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const map: Record<ContactStatus, string> = {
  contacted: "bg-teal text-white",
  replied: "bg-teal-light text-ink",
  "meeting booked": "bg-muted text-ink",
  "intro made": "bg-muted text-ink",
  "deal done": "bg-ink text-white",
  "gone cold": "bg-[hsl(210_10%_92%)] text-[hsl(210_8%_45%)]",
};

export function StatusBadge({ status }: { status: ContactStatus | null }) {
  if (!status) return null;
  const cls = map[status];
  return (
    <span
      className={cn(
        // Consistent across all screens: same height, padding, font size & weight
        "inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-medium leading-none whitespace-nowrap",
        cls,
      )}
    >
      {status === "meeting booked" && (
        <span className="h-1.5 w-1.5 rounded-full bg-orange" />
      )}
      {status}
    </span>
  );
}