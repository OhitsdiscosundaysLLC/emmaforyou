-- Short homepage enquiry ("quick_enquiry"): a 60-second alternative to the full onboarding brief.
-- details holds what the visitor asked for and where they came from (landing page, referrer, UTM tags),
-- so the dashboard can show lead source and route the enquiry to the right service.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_source_check
  CHECK (source = ANY (ARRAY['analyser_full', 'analyser_teaser', 'waitlist', 'quick_enquiry']));
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_details_size;
ALTER TABLE public.leads ADD CONSTRAINT leads_details_size CHECK (details IS NULL OR pg_column_size(details) <= 8000);

-- Lead alert emails: name the new source instead of calling it "Business analyser".
DO $$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef('public.notify_new_lead()'::regprocedure) INTO def;
  IF def IS NOT NULL AND position('quick_enquiry' in def) = 0 THEN
    def := replace(def, $q$WHEN r->>'source' = 'waitlist' THEN 'Waitlist sign-up' ELSE$q$,
                        $q$WHEN r->>'source' = 'waitlist' THEN 'Waitlist sign-up' WHEN r->>'source' = 'quick_enquiry' THEN 'Homepage enquiry' ELSE$q$);
    EXECUTE def;
  END IF;
END $$;
