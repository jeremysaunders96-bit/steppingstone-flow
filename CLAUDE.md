# Steppingstone Flow

CRM + AI-drafting dashboard for **Will Meadon**, founder of Steppingstone (UK SME advisory firm, ex-JPM 28y). The user is Jeremy; Will is the end user whose name goes on every draft, so **verbatim fidelity to Will's writing voice is load-bearing** — never paraphrase his prose in templates or system_context.

## Architecture

Single Supabase project: **`depwgcghnvixbtifxtrz`** (name `steppingstone-will`). All data, edge functions, and frontend traffic.

A second project, `pafhhczjfvsexhbpwoha`, appears in git history before 2026-05-17. **Abandoned.** Do not re-introduce these patterns when editing or generating code:

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` env vars
- `@/integrations/supabase/client` (the file is deleted; Lovable has tried to re-add it)
- `LOVABLE_API_KEY`, `ai.gateway.lovable.dev`, `createOpenAICompatible`, `google/gemini-3-flash-preview`
- Two-client split (we have one Supabase client: `@/lib/supabase`)

## Edge functions

- `supabase/functions/draft-email/` — drafts emails. Uses `@anthropic-ai/sdk` with `claude-sonnet-4-6`. The `system_context` row (~38k chars) is wrapped in `cache_control: { type: "ephemeral" }` for prompt caching.
- `supabase/functions/process-meeting/` — meeting transcript cleanup + structured extraction. Also `@anthropic-ai/sdk`.

Both read `ANTHROPIC_API_KEY` from Deno env (set as a secret on `depwgcghnvixbtifxtrz`).

`draft-email` returns HTTP 422 when `templateType` is set but the row isn't in `email_templates`. **Do not restore the silent fallback to general-mode** — it hides the "template missing" bug as a model hallucination.

Debug logging is gated on `?debug=1`, header `x-debug: 1`, or body `debug: true`. Surfaces the prompt branch chosen and the full system + user prompts.

## Templates

`email_templates` (id, label, subject_template, body_template, guidance). `body_template` is Will's verbatim copy with `[BRACKETED]` personalisation slots — only bracketed sections may be filled per recipient. When adding a new template, **both** the row and the front-end button (`src/components/modals/ComposeEmailModal.tsx`) must land together; a button without a row produces hallucinated drafts.

## Commands

```
npm run dev                                          # Vite dev server
npm run build                                        # prod build
supabase functions deploy <name>                     # CLI is linked to depwgcghnvixbtifxtrz
supabase functions logs <name>                       # tail logs (add --tail for follow)
```

Pushes require GitHub auth as `jeremysaunders96-bit` (not `jeremysaunders96`). Use `gh auth login` if push 403s.

## Lovable coexistence

The repo is also edited via Lovable (commits authored by `gpt-engineer-app[bot]`). Lovable works from its own snapshot and is unaware of decisions made via Claude Code — it has previously re-added files Claude Code deleted and re-introduced removed imports.

Before any structural work: `git fetch && git pull --rebase`. Commit and push frequently. Don't leave uncommitted Claude Code changes overnight.

## What to verify, not trust

When Jeremy reports a manual step is "done" (SQL ran in the editor, Lovable applied a migration, a setting was saved), verify via an out-of-band check before continuing — REST query for the row, `supabase functions list` for a deploy. The Supabase SQL editor and the live frontend have hit different projects in the past, so "the row exists" in one place doesn't mean it's reachable from the other.
