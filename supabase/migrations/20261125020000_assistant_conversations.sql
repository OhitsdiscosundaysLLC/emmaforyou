-- Ask Emma conversation log (benchmarked on Intercom Fin / HubSpot customer agent reporting): one row per chat,
-- written only by the server (/api/assistant, service role), read only by admins in the dashboard. Lets the owner
-- review conversations, see questions Emma couldn't answer from the site's content (knowledge gaps), handoffs to a
-- person and qualified leads. Contact details are not stored here (they go to tool_requests as before);
-- visitor messages are kept for 90 days.
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{12,40}$'),
  visitor_hash text,
  page text,
  lang text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(messages) = 'array' AND pg_column_size(messages) <= 60000),
  turns integer NOT NULL DEFAULT 0,
  unanswered integer NOT NULL DEFAULT 0,
  handoff boolean NOT NULL DEFAULT false,
  lead boolean NOT NULL DEFAULT false,
  qualification text CHECK (qualification IS NULL OR qualification IN ('qualified', 'partial', 'not_qualified')),
  last_question text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_conversations_updated_idx ON public.assistant_conversations (updated_at DESC);
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_conversations FROM anon, authenticated;
GRANT SELECT ON public.assistant_conversations TO authenticated;
DROP POLICY IF EXISTS "Admins read assistant conversations" ON public.assistant_conversations;
CREATE POLICY "Admins read assistant conversations" ON public.assistant_conversations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Retention: drop conversations untouched for 90 days (runs with the existing daily digest schedule window).
CREATE OR REPLACE FUNCTION public.assistant_conversations_prune() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH gone AS (DELETE FROM public.assistant_conversations WHERE updated_at < now() - interval '90 days' RETURNING 1)
  SELECT count(*)::integer FROM gone;
$$;
REVOKE ALL ON FUNCTION public.assistant_conversations_prune() FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'emmaforyou-assistant-prune';
  PERFORM cron.schedule('emmaforyou-assistant-prune', '17 3 * * *', 'SELECT public.assistant_conversations_prune()');
EXCEPTION WHEN undefined_table OR invalid_schema_name THEN NULL;
END $$;
