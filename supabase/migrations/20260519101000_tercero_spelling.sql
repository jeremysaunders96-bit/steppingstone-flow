-- From Will's 2026-05-19 review call: model occasionally mis-spelled "Tercero"
-- as "tercer", "teso", "teres arrow" etc. Append a proper-noun spelling rule
-- to the email voice context so future drafts spell it consistently.

update public.system_context
set context_text = context_text || E'\n\n═══════════════════════════════════════════════════\nPROPER NOUN SPELLINGS (always preserve)\n═══════════════════════════════════════════════════\n\nWhen any of these names appear in a draft, spell them exactly as written. Speech-to-text and model paraphrasing can mangle them, so treat them as immutable:\n\n- Steppingstone (ONE word, lowercase s after the capital). Never "Stepping Stone", never "stepping stone".\n- Tercero (the AI consultancy Jeremy Saunders, Teddy James and Alistair Russell are building). Never "Tercer", "Teso", "Tercer Analytics".\n- William Meadon (not "Willaim", not "Meadow", not "Meaden").\n- Curation Connect (the firm Will introduces). Never "Curation Connect Ltd" unless explicit.\n- Seraphim Space (the investment trust). Never "Seraphim Capital" (different firm).\n- Geiger Counter (the investment trust). Never "Geiger Counter Ltd".\n- Waymap (the indoor navigation app).\n- ThrustWSH (the Richard Noble project — World Speed Hydrofoil).\n- Richard Noble (the founder).\n- JP Morgan or J.P. Morgan, never "JPMorgan" in this voice.\n- Edinburgh Worldwide (the investment trust at the centre of the Saba campaigns).',
    updated_at = NOW()
where kind = 'email_voice';

-- Same set applied to the LinkedIn voice context, since Will's LinkedIn posts
-- mention all the same names.
update public.system_context
set context_text = context_text || E'\n\n═══════════════════════════════════════════════════\nPROPER NOUN SPELLINGS (always preserve)\n═══════════════════════════════════════════════════\n\nWhen any of these names appear in a draft, spell them exactly as written:\n\n- Steppingstone (ONE word). Never "Stepping Stone".\n- Tercero. Never "Tercer", "Teso", "Tercer Analytics".\n- Curation Connect. Never "Curation Connect Ltd".\n- Seraphim Space (the investment trust). Distinct from Seraphim Capital.\n- Geiger Counter (the investment trust).\n- Waymap (the indoor navigation app).\n- ThrustWSH (Richard Noble\047s World Speed Hydrofoil project).\n- Edinburgh Worldwide.\n- William Meadon (not "Willaim", not "Meadow").',
    updated_at = NOW()
where kind = 'linkedin_voice';
