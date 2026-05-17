import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeActionItems } from "@/components/HomeActionItems";
import { TodayMeetingsCard } from "@/components/TodayMeetingsCard";
import { useToast } from "@/hooks/use-toast";

const BIO_TEXT = "William Meadon, a chartered accountant, joined Schroders in the late 1980s as a balanced pension fund manager. He then joined Newton Investment Management, where the firm's funds under management increased tenfold during his tenure. In 1996, he joined Flemings, which J.P. Morgan later acquired. During his 28 years at J.P. Morgan, William lead the firm's Core Team where he managed a range of UK, European, and global long-only funds, including several investment trusts such as JPM Claverhouse. In 2024, he left J.P. Morgan to found Steppingstone, a one-stop-shop to help UK businesses grow through its network of fractional experts and advisors.";

export default function Home() {
  const { toast } = useToast();

  const copyBio = async () => {
    try {
      await navigator.clipboard.writeText(BIO_TEXT);
      toast({ title: "Bio copied to clipboard" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-3xl text-teal">Good morning, Will</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </header>

      <section>
        <h2 className="font-display text-2xl text-teal mb-4">Today</h2>
        <TodayMeetingsCard />
      </section>

      <HomeActionItems />

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
