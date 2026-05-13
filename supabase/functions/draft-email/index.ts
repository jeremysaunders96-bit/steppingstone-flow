Update the Compose Email modal at src/components/modals/ComposeEmailModal.tsx to support two distinct modes selected by tabs at the top of the modal:

MODE 1 - "USE A TEMPLATE" (default tab)
Display 5 large buttons in a 2-column grid. Each button represents one of Will's standard email types. The button labels should be:
- Stepping Stone Introduction
- Curation Connect Introduction
- Waymap Introduction
- Richard Noble (ThrustWSH)
- Newsletter Pitch

When a button is clicked:
1. Highlight that button as selected
2. Show a "To" field (contact picker, locked if launched from contact record)
3. Show a textarea labelled "Personalisation" with placeholder: "Add anything specific that should shape this email: a recent meeting, a shared connection, why this person specifically. The system will fill in the standard structure - you just add the personal context."
4. Show a "Generate" button

When Generate is clicked, call generateDraft with:
- mode: "single"
- brief: the personalisation text typed
- templateType: the selected template id ("stepping-stone", "curation", "waymap", "richard-noble", or "newsletter")
- contact: the contact brief

MODE 2 - "DICTATE FROM SCRATCH" (second tab)
Display:
1. The "To" field (same)
2. A large microphone button labelled "Hold to record, release to stop"
3. A live transcript textarea showing what was captured (editable after stopping)
4. A "Tidy into an email" button (only enabled when transcript has content)

Use the existing Web Speech API approach from VoiceTextarea component for transcription. For hold-to-record, use mouseDown/touchStart to start and mouseUp/touchEnd to stop.

When "Tidy into an email" is clicked, call generateDraft with:
- mode: "dictation"  
- brief: the full dictation transcript
- contact: the contact brief

SHARED OUTPUT AREA (below both modes):
After generation completes:
- Editable textarea showing the draft
- "Copy to clipboard" button
- "Regenerate" button
- "Send to Gmail Drafts" button (placeholder for now, just shows a toast saying "Coming soon - will deploy with Gmail connection")
- The existing DraftFeedback component

Update src/lib/draftEmail.ts to accept the new optional templateType field and new mode "dictation".

Update the placeholder text in the personalisation field for each template:

Stepping Stone:
"e.g. We met at the Langham yesterday, he runs a hospitality group and is interested in growing his profile. Lunch booked for next Thursday."

Curation:
"e.g. She chairs JPMorgan Claverhouse, we had lunch last week, she's interested but has to put it to the board next month."

Waymap:
"e.g. Introduced by James Blomfield, runs hotels in central London, focus should be on the built environment use case."

Richard Noble:
"e.g. Scottish entrepreneur, interested in sponsorship, met him at David Yarrow's exhibition."

Newsletter:
"e.g. Owner of a Cotswolds wine estate, I think they'd be a fit for the Christmas issue, mention Hayley Ferguson at Hanikon as a precedent."

Keep all other modal functionality identical including the locked contact behaviour when launched from a contact record.
  