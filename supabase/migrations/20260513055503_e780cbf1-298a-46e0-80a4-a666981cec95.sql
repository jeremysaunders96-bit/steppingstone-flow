CREATE TABLE IF NOT EXISTS public.email_templates (
  id text PRIMARY KEY,
  label text NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  guidance text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon all email_templates" ON public.email_templates;
CREATE POLICY "anon all email_templates" ON public.email_templates FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth all email_templates" ON public.email_templates;
CREATE POLICY "auth all email_templates" ON public.email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

DELETE FROM public.email_templates;

INSERT INTO public.email_templates (id, label, subject_template, body_template, guidance) VALUES
('stepping-stone', 'Stepping Stone Introduction', 'An introduction to Steppingstone',
$body$Dear [NAME],

[OPENING ANCHOR - personalised opening referencing the relationship or recent contact]

After 35 years in the City (28 years at JPM), I left last year to form my own firm, Steppingstone, a one-stop-shop for SMEs, providing a suite of advisors to help them find the right professional help and support.

How we do this varies from client to client. Some just ask for access to our wide range of fractional professional advisors. Others, like Waymap want help with capital raising. We have even been appointed by world record holder, Richard Noble to help him raise sponsorship money for his next world record attempt: the world water speed record in Scotland in 2027.

We've also just launched a bi-monthly newsletter that goes out to a highly engaged network of 5,000 HNWIs, CEOs, and entrepreneurs, with an open rate consistently above 75%. Recent newsletters have profiled several high-quality companies and individuals with whom we have close affiliations, including Claridge's, Wren Press (the King's stationers), Lord's, Richard Noble OBE, and David Yarrow.

[PERSONALISED CLOSE - reason this might be relevant to them specifically]

[SIGN-OFF]$body$,
$body$REPLACE [NAME] with the recipient's first name.
REPLACE [OPENING ANCHOR] with a personalised opener based on the relationship context provided. Examples Will uses: "Further to our lunch last week" / "Lovely to meet you yesterday" / "Hope all is well and you are thriving."
REPLACE [PERSONALISED CLOSE] with a reason this is specifically relevant. Examples: "I would have thought this would be a good value way for [company] to start getting to know us" / "I'd love to find a moment to catch up properly soon."
REPLACE [SIGN-OFF] based on relationship register from contact notes:
- New contact: "With thanks and best wishes, William"
- Warm contact: "With best wishes, Will"
- Old colleague: "With best wishes, Will" or "With warm wishes, Will"
DO NOT change the three middle paragraphs (after the opening anchor, before the close). They are Will's verbatim Stepping Stone introduction.
DO NOT add bullet points. DO NOT add additional paragraphs. DO NOT mention any service Steppingstone does not provide.$body$),
('curation', 'Curation Connect Introduction', 'Introduction to Curation Connect',
$body$Dear [NAME],

[OPENING ANCHOR]

[OPTIONAL WITTY ASIDE if warm relationship: "As promised (or was it threatened?!)"] I enclose some material on Curation Connect which my firm, Steppingstone is busily introducing to Investment Trust boards.

Curation works with listed companies to help them scale their retail shareholder base. They achieve this by building best-in-class digital showcases that act as compelling shop windows for each company and then distributing that content to potential non-institutional investors. The data generated is then used to refine and optimise the equity narrative over time.

In less than two years, the Curation platform has secured 40 paying corporates including blue chips such as Unilever, Balfour Beatty and Rathbones. Current Investment Trust clients include Seraphim Space and Geiger Counter, with several others in active discussions. At a time when the whole sector is under pressure from Saba and other activists, we are seeing significant interest from IT boards keen to explore marketing strategies that complement their current spend.

[PERSONALISED CLOSE]

With best wishes,
Will$body$,
$body$REPLACE [NAME] with the recipient's first name.
REPLACE [OPENING ANCHOR] with one of:
- If lunch/meeting coming up: "Looking forward to seeing you for lunch at [VENUE] on [DAY]. The table is booked for [TIME]."
- If existing warm relationship: "Hope all is well and you are thriving."
- If recent conversation: "Further to our recent conversation,"
- If introduced through someone: "Lovely to be introduced via [INTRODUCER]."
ONLY include the bracketed witty aside "(or was it threatened?!)" if the contact notes indicate a warm or old relationship.
REPLACE [PERSONALISED CLOSE] with one of:
- "Let me know if you'd like to know more, or be introduced to the Curation team."
- "I look forward to hearing what you think."
- "In any case, it would be lovely to have a catchup coffee or lunch sometime."
DO NOT change the two paragraphs explaining what Curation does and the traction. Those are factual and consistent across his emails.
DO NOT add bullet points. KEEP IT SHORT - under 200 words.
Sign off "With best wishes, Will" for warm contacts. "With thanks and best wishes, William" for first emails.$body$),
('waymap', 'Waymap Introduction', 'Waymap',
$body$[OPENING]

My firm, Steppingstone has been appointed to help raise the profile of Waymap, an exciting, young British tech company.

Waymap is the world's most accurate navigation app. Remarkably, it needs neither GPS nor Wi-Fi to work and so is effective indoors, outdoors and deep underground and guides users to within 1 metre of their intended destination. Initially designed for people with visual impairments, such an app (which is free to the user), clearly has mass market appeal (for both sighted and the visually impaired) across the built environment e.g. offices, transport systems, hotels and sporting venues.

[ONE NAMED PROOF POINT relevant to recipient]

I enclose a deck to show the ways in which Waymap might be of help to [SECTOR], together with a one pager which includes the charging structure. Should, at any stage, you wish to speak directly to the Waymap management team, including founder Dr Tom Pey, I would be very happy to arrange.

Let me know if you need more, otherwise I look forward to hearing how I can help you further.

With thanks and best wishes, William$body$,
$body$REPLACE [OPENING] with one of:
- Intro through someone: "Thank you, [INTRODUCER] and very good to be introduced to you, [NAME]."
- Existing contact: "As discussed yesterday, [NAME],"
- Following up on request: "As requested, [NAME],"
REPLACE [ONE NAMED PROOF POINT] - pick ONE relevant to recipient's world:
- Hotel/hospitality contact: "This summer, Lord's cricket ground became the first stadium in the world to install it to help all spectators not only find their seat more easily, but also have a better experience finding all the available amenities once at the ground."
- Transport contact: "Waymap is now live across the whole of Washington DC's entire transport system."
- Healthcare/accessibility contact: "The Royal Hospital for Children and Young People in Edinburgh has recently deployed it - the first children's hospital in the world to use this kind of personal indoor navigation."
- Investor contact: "So impressed were the Google Foundation with the technology that they gave Waymap a $1m grant to change the world for blind people."
- Sporting venue: Lord's reference as above.
NEVER stack multiple proof points - pick ONE.
REPLACE [SECTOR] with the recipient's sector: hotel owners, transport operators, venue managers, healthcare providers, etc.
DO NOT change the paragraph describing what Waymap is - it is factual and verbatim Will.
DO NOT add bullet points. Target length: 180-220 words.$body$),
('richard-noble', 'Richard Noble (ThrustWSH)', 'Richard Noble OBE',
$body$Dear [NAME],

[OPENING]

Richard is a British entrepreneur who, as pilot, held the world land speed record between 1983 and 1997. He was also the project director of Thrust SSC, the British vehicle which holds the current world land speed record, set at Black Rock Desert, Nevada in 1997.

Now, with his highly-skilled team of British engineers at Thrust WSH (WSH = Water Speed Hydrofoil), Richard has designed and is currently testing a high-speed jet hydrofoil that will attempt to break the world water speed record in Scotland in 2027. His efforts are already attracting global attention, with Netflix currently making a high-profile documentary on this remarkable project.

Richard has asked my firm, Steppingstone to help him in a number of areas, including raising sponsorship for this unique attempt. So, if you know anyone who might be keen to be involved, I am sure Richard would be happy to meet them. He is a remarkable man, but as I'm sure you understand, he can only spare time to speak to those who genuinely want and can afford to help.

Not only does Richard want to break the world record but, through his Thrust education programme, he also wants to inspire the next generation of engineers by funding University STEM courses and apprenticeships in the UK.

Sustainability is also a consideration for Richard, as the jet engine runs on a British, sustainable fossil-free jet fuel, which has taken 25 years to develop.

So, at this stage, please let me know if you, or others you know, would like to be kept in touch with Thrust WSH's progress over the coming months.

I look forward to staying in touch. With best wishes, Will$body$,
$body$REPLACE [NAME] with the recipient's first name.
REPLACE [OPENING] with one of:
- "As requested, I enclose some more information on Richard Noble." (if they asked for it)
- "Further to yesterday," (if recent meeting)
- "Lovely to meet you the other day," (if recent introduction)
- "Further to yesterday, I enclose some more information on Richard Noble." (combination)
IF the recipient is Scottish or has a Scottish connection, change "British entrepreneur" to "Scottish entrepreneur" and frame around Scotland - mention Loch Arkaig specifically and the appeal to "proud Scots."
DO NOT shorten the credential paragraph. The precise dates (1983-1997, Black Rock Desert 1997) are deliberate and important.
DO NOT soften the qualification "he can only spare time to speak to those who genuinely want and can afford to help." This is deliberate honesty Will uses every time.
The education and sustainability paragraphs can be included or omitted based on relevance - corporate sponsors with ESG focus get sustainability, education-focused contacts get the STEM angle.
Sign off "With best wishes, Will" for warm contacts.$body$),
('newsletter', 'Newsletter Pitch', 'Steppingstone newsletter',
$body$[OPENING]

[STEPPINGSTONE CONTEXT - one paragraph]

We've launched a bi-monthly newsletter that goes out to a highly engaged network of 5,000 HNWIs, CEOs, and entrepreneurs, with an open rate consistently above 75%.

Recent newsletters have profiled several high-quality companies and individuals with whom we have close affiliations, including Claridge's, Wren Press (the King's stationers), Lord's, Richard Noble OBE, and David Yarrow. Without exception, all have found being profiled a very cost-effective route to new customers.

[THEMED HOOK]

I would be delighted, for £500, to feature [BRAND] in one of our front-page profiles. This would include bespoke editorial copy, imagery and a direct click-through to your website.

[OPTIONAL FOR CONSUMER BRANDS - "Alternatively, for £300, we can offer a slot with a reader discount code and commission structure (typically 10% customer discount plus a 5% introducer's fee on any sales generated)."]

I attach a short deck with more details. [TIME-SENSITIVE NOTE if applicable]

[PERSONAL CLOSE]

With thanks and best wishes,
Will$body$,
$body$REPLACE [OPENING] with one of:
- "Hi [NAME]" for B2C / consumer brand contacts
- "Dear [NAME]" for more formal contacts
- Personal opener if relationship is warm: "I hope all is well with you and the family"
- Family connection: "Hope you're keeping well. [Family reference, e.g. Ella tells me...]"
REPLACE [STEPPINGSTONE CONTEXT] with:
- If they already know Will: "As you know, my firm Steppingstone is a one-stop-shop for SMEs."
- If new: "After 35 years in the City (28 years at JPM), I left last year to form my own firm, Steppingstone, a one-stop-shop for SMEs."
REPLACE [THEMED HOOK] with a contextual hook, examples:
- "It may not be your thing, but as Christmas approaches, we are looking to feature leading retailers in our December issue, and I immediately thought of [BRAND]"
- "We're curating some high quality British brands that play into our theme for the new year of investing in yourself"
- "We have a few slots available in our next edition that I thought might be of interest"
REPLACE [BRAND] with the recipient's company name.
INCLUDE the £300 commission option ONLY for consumer/B2C brands.
REPLACE [TIME-SENSITIVE NOTE] if there's a deadline: "We kindly ask for confirmation by [DATE] to guarantee inclusion in the [EDITION] issue."
REPLACE [PERSONAL CLOSE] with one of:
- "Whatever you decide, it would be good to see you again for a catchup coffee or lunch."
- "No pressure at all, but places are going quite quickly."
- "Happy to discuss further on a call should this be of interest."
DO NOT change the paragraph about 5,000 HNWIs and 75% open rate - these are verified statistics.
DO NOT change the named precedent list (Claridge's, Wren Press, Lord's, Richard Noble, David Yarrow) unless newer high-profile profiles are confirmed.
KEEP "Without exception" phrasing - this is a Will signature.$body$);

UPDATE public.system_context
SET context_text = context_text || E'\n\n═══════════════════════════════════════════════════\nEMAIL TEMPLATES IN DATABASE\n═══════════════════════════════════════════════════\n\nFive verified templates are stored in the email_templates table:\n- stepping-stone (Stepping Stone Introduction)\n- curation (Curation Connect Introduction)\n- waymap (Waymap Introduction)\n- richard-noble (Richard Noble / ThrustWSH)\n- newsletter (Newsletter Pitch)\n\nWhen the user passes a templateType, the edge function fetches the template body and guidance, then asks you to fill in the bracketed sections only. NEVER deviate from the template structure. The body content between brackets is verbatim Will Meadon writing and must not be altered.',
    updated_at = NOW();