ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS treat_as_guidance boolean NOT NULL DEFAULT false;