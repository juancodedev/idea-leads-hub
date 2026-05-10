-- Fix relationship between leads and entity_tags
-- This allows PostgREST to resolve the join in the LeadRepository

ALTER TABLE public.entity_tags
ADD CONSTRAINT entity_tags_entity_id_fkey
FOREIGN KEY (entity_id)
REFERENCES public.leads(id)
ON DELETE CASCADE;

-- Also add for ideas just in case
ALTER TABLE public.entity_tags
ADD CONSTRAINT entity_tags_idea_id_fkey
FOREIGN KEY (entity_id)
REFERENCES public.ideas(id)
ON DELETE CASCADE;

-- Note: In a true polymorphic relationship we might use a trigger or a more complex schema, 
-- but for PostgREST joins, having these FKs (even if they overlap) often helps or 
-- we can use specific join syntax.
