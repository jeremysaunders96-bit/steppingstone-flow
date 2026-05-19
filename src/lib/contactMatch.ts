import { supabase, type Contact } from "@/lib/supabase";

// Levenshtein edit distance. Iterative two-row implementation — O(m*n) time,
// O(min(m,n)) space. Both strings should be normalised (lowercased, trimmed)
// before calling. Returns the number of single-character edits needed to turn
// a into b.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,           // insertion
        prev[j] + 1,               // deletion
        prev[j - 1] + cost,        // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// Score a candidate full name against a search query. Compares the query
// against the full name AND each individual word in the name; the best
// (smallest) distance wins. Speech-to-text often catches a first name but
// mishears the surname, so first-name-only matching is essential.
function distanceForName(searchLower: string, fullNameLower: string): number {
  if (!fullNameLower) return Infinity;
  let best = levenshtein(searchLower, fullNameLower);
  for (const word of fullNameLower.split(/\s+/)) {
    if (!word) continue;
    const d = levenshtein(searchLower, word);
    if (d < best) best = d;
  }
  return best;
}

export interface ContactMatch {
  contact: Contact;
  distance: number;
  confidence: "high" | "medium" | "low";
}

// Finds the closest contact to a dictated/extracted name. Returns null if no
// contact is close enough to be a confident match. High confidence is edit
// distance ≤ 2; medium is ≤ 4. Beyond that we leave it for manual selection
// rather than auto-assigning a wrong contact.
export async function findClosestContact(searchName: string): Promise<ContactMatch | null> {
  const query = searchName.trim().toLowerCase();
  if (query.length < 2) return null;

  const { data, error } = await supabase
    .from("contacts")
    .select("*");
  if (error || !data) return null;

  let best: Contact | null = null;
  let bestDist = Infinity;

  for (const c of data as Contact[]) {
    const dist = distanceForName(query, (c.full_name || "").toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }

  if (!best) return null;
  // Threshold relative to the search length so short names need closer matches.
  // Maximum allowed distance scales with the query so "Cian" (4 chars) tolerates
  // 2 edits while "Jonathan" (8 chars) tolerates 4.
  const maxAllowed = Math.max(2, Math.floor(query.length / 2));
  if (bestDist > maxAllowed) return null;

  const confidence: ContactMatch["confidence"] =
    bestDist <= 1 ? "high" : bestDist <= 3 ? "medium" : "low";
  return { contact: best, distance: bestDist, confidence };
}
