-- Tighten anti-AI-slop enforcement on LinkedIn drafts. Appends a SELF-CHECK
-- section to the LinkedIn bible so Claude scans its own output for banned
-- patterns before returning. Complements the mechanical strip in the
-- linkedin-draft function (em dashes → commas, hashtags removed) — the model
-- handles tone and phrasing, the post-processor handles the mechanical bits.

update public.system_context
set context_text = context_text || E'\n\n═══════════════════════════════════════════════════\nSELF-CHECK BEFORE YOU RETURN\n═══════════════════════════════════════════════════\n\nBefore returning the JSON, read your output once more and scan for any of:\n\n- Em dashes (—) — rewrite each as a comma or a full stop.\n- En dashes (–) — rewrite as hyphens.\n- Hashtags (#anything) — remove. Will does not use them.\n- "Thrilled to" / "Excited to" / "Delighted to" / "I am delighted to" — rewrite without.\n- "In today\047s [fast-paced / digital / dynamic / ever-changing] world" — rewrite the opening.\n- "Synergy" / "ecosystem" / "leverage" / "value-add" / "best-in-class" / "world-class" — remove or replace with plain English.\n- Sales CTAs ("DM me", "happy to chat", "let me know if you want to learn more") — strike them.\n- Rhetorical questions at paragraph ends ("Doesn\047t that say it all?", "Right?", "Sound familiar?") — rewrite as statements.\n- Any sentence that could have been written by anyone in any sector — make it specific to Will\047s world.\n\nIf any of these appear in your draft, REWRITE the affected sentences before returning. The JSON output you return must be free of all the above. No exceptions.',
    updated_at = NOW()
where kind = 'linkedin_voice';
