-- Fix relationship between leads and notes
-- This allows PostgREST to resolve the join in the LeadRepository for notes_data

ALTER TABLE public.notes
ADD CONSTRAINT notes_entity_id_fkey
FOREIGN KEY (entity_id)
REFERENCES public.leads(id)
ON DELETE CASCADE;

-- Also add a comment to help PostgREST if there are multiple FKs
COMMENT ON CONSTRAINT notes_entity_id_fkey ON public.notes IS 'Relates notes to leads for direct joins';
