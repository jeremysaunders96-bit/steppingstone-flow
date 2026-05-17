-- Seed the 6th email template row that was referenced by the frontend
-- (templateType: "stepping-stone-long") but never inserted into the table.
-- Without this row, the edge function silently fell through to general-mode
-- and the model invented content instead of reproducing Will's verbatim long intro.

INSERT INTO public.email_templates (id, label, subject_template, body_template, guidance) VALUES
('stepping-stone-long', 'Stepping Stone (long version)', 'An introduction to Steppingstone',
$body$Dear [NAME],

[OPENING ANCHOR]

In short, Steppingstone is a one-stop-shop to help SMEs grow (deck attached).

How we do this varies from client to client. Some just ask for access to our wide range of fractional professional advisors. Others, like Waymap, need help with capital raising. We have even been appointed by world record holder, Richard Noble to help him raise sponsorship money for his next world record attempt: the world water speed record in Scotland in 2027.

Unsurprisingly, everyone we speak to is receptive to us bringing them new business.

Some clients ask to be featured in our now-quarterly newsletter, which reaches 5,000 high-net-worth individuals, CEOs, and entrepreneurs via email and LinkedIn. This is popular because the newsletter has an impressive open rate of over 75% (source: Mailchimp).

Recent newsletters have profiled several quality companies and individuals with whom we have close affiliations, including Sapling Spirits, Sirplus, Wren Press (the King's stationers), Peligoni and world-renowned photographer, David Yarrow.

Another client is Curation Connect, which connects listed companies to retail investors at scale.

It translates complex equity stories into clear, engaging digital Showcases designed for how modern investors consume content, and distributes them at scale across our platform, marketing channels, and corporate IR touchpoints.

Curation currently reaches over 60,000 non-institutional investors each month in addition to its own network — the Curation Collective — of over 320 HNWs, family offices and professional investors representing $250bn of AuM.

For the first time, companies can profile their retail investor base and understand how investors interact with their equity story: what content resonates, where gaps exist, and how messaging should evolve. By combining content, distribution and data, Curation helps companies attract new pools of capital, improve investor engagement, and drive measurable outcomes, including increased liquidity and consistent share price outperformance versus peers.

In less than two years, the Curation platform has secured 40 paying corporate clients (including blue-chips such as Unilever, Balfour Beatty, Fever-Tree & Rathbones) with 11 others set to join shortly and 60 others in active discussion after experimenting with Curation's two-month trial.

Given my experience in managing Investment Trusts, Steppingstone is successfully introducing Curation to our extensive network of Investment Trust directors. Trust clients to date include Seraphim Space and Geiger Counter, with several others in the pipeline. At a time when the whole sector is under pressure from Saba and other activists, Curation is seeing significant interest from IT boards keen to explore marketing strategies that complement their current spend.

Curation has also asked us to help with their current raise.

Steppingstone is committed to being a one-stop shop to help UK SMEs grow. We are fortunate to be in a position to work only with people we like and trust.

In return, we offer generous revenue-sharing arrangements to those who refer paying new clients to us.

[PERSONALISED CLOSE]

[SIGN-OFF]$body$,
$body$REPLACE [NAME] with the recipient's first name.

REPLACE [OPENING ANCHOR] with a personalised opener tied to the relationship or brief. Examples Will uses: "Following our recent [topic] discussions, (which bore fruit!), I wanted to give you a bit more detail on my firm, Steppingstone, as there might be ways we can collaborate again, should you wish." / "Further to our lunch last week" / "Lovely to meet you yesterday" / "Hope all is well and you are thriving." If the brief is empty or generic, keep the opener short and warm — never invent specifics about prior meetings.

REPLACE [PERSONALISED CLOSE] with the reason this is specifically relevant to them. This is where recipient-specific content goes — for example: a tease of an AI partner introduction Will is doing DD on; a property angle; a proposal to meet (e.g. another Lord Nelson lunch); or combining with another contact. Use only what is in the brief — do not invent contacts, opportunities, or specifics.

REPLACE [SIGN-OFF] based on relationship register from contact notes:
- New contact: "With thanks and best wishes, William"
- Warm contact: "With best wishes, Will"
- Family: "With much love, Dad xx"

DO NOT alter any non-bracketed text in the body. It is verbatim Will Meadon writing.$body$)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  subject_template = EXCLUDED.subject_template,
  body_template = EXCLUDED.body_template,
  guidance = EXCLUDED.guidance,
  updated_at = NOW();
