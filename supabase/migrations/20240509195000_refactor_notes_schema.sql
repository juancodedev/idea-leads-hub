-- 1. Modificar la tabla notes para usar columnas específicas con FKs reales
ALTER TABLE public.notes 
  DROP COLUMN IF EXISTS entity_id,
  DROP COLUMN IF EXISTS entity_type;

ALTER TABLE public.notes
  ADD COLUMN lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  ADD COLUMN idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE;

-- 2. Crear índices para búsquedas rápidas
CREATE INDEX idx_notes_lead_id ON public.notes(lead_id);
CREATE INDEX idx_notes_idea_id ON public.notes(idea_id);

-- 3. Comentario para documentación
COMMENT ON TABLE public.notes IS 'Notas y actividad relacionadas con leads o ideas';
