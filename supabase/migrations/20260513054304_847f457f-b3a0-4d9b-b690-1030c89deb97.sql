CREATE TABLE public.quick_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon all quick_assets" ON public.quick_assets FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth all quick_assets" ON public.quick_assets FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.quick_assets (label, category, content) VALUES
('Full bio', 'bio', 'William Meadon, a chartered accountant, joined Schroders in the late 1980s as a balanced pension fund manager. He then joined Newton Investment Management, where the firm''s funds under management increased tenfold during his tenure. In 1996, he joined Flemings, which J.P. Morgan later acquired. During his 28 years at J.P. Morgan, William lead the firm''s Core Team where he managed a range of UK, European, and global long-only funds, including several investment trusts such as JPM Claverhouse. In 2024, he left J.P. Morgan to found Steppingstone, a one-stop-shop to help UK businesses grow through its network of fractional experts and advisors.'),
('Email signature', 'signature', E'William Meadon | Founder\nEmail: william@sstone.co.uk\nPhone: +44 7771 621 619\nWebsite: www.sstone.co.uk');