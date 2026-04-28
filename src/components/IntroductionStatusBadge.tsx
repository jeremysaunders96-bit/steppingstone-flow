import type { IntroductionStatus } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const map: Record<IntroductionStatus, string> = {
  "made": "bg-teal text-white",
  "progressing": "bg-teal-light text-teal",
  "led-somewhere": "bg-ink text-white",
  "gone-cold": "bg-[hsl(210_10%_92%)] text-[hsl(210_8%_45%)]",
};

export function IntroductionStatusBadge({ status }: { status: IntroductionStatus }) {
  return (
    <span className={cn(
      "inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-medium leading-none whitespace-nowrap",
      map[status],
    )}>{status}</span>
  );
}