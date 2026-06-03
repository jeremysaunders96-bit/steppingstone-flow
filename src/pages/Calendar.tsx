import { TodayMeetingsCard } from "@/components/TodayMeetingsCard";

export default function CalendarPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-muted-foreground">Your calendar events for today.</p>
      </div>
      <TodayMeetingsCard />
    </div>
  );
}
