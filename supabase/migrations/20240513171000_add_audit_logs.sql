BEGIN;

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'IDEA', 'ACTIVITY'
    entity_id UUID NOT NULL,
    parent_id UUID, -- For activities, this would be the idea_id or lead_id
    action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    changes JSONB DEFAULT '{}'::jsonb,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_parent_idx ON public.audit_logs (parent_id);

-- 3. Set up RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view audit logs for their entities" ON public.audit_logs;
CREATE POLICY "Users can view audit logs for their entities" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Note: We don't allow UPDATE or DELETE on audit logs as they are immutable
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert own audit logs" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

COMMIT;
