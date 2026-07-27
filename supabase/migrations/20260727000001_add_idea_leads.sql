BEGIN;

-- 1. Crear tabla de unión idea_leads (many-to-many)
-- Sigue el mismo patrón que idea_tags
CREATE TABLE IF NOT EXISTS public.idea_leads (
  idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, lead_id)
);

-- 2. Habilitar RLS
ALTER TABLE public.idea_leads ENABLE ROW LEVEL SECURITY;

-- 3. Política RLS
CREATE POLICY "Users can access own idea_leads" ON public.idea_leads
  FOR ALL USING (auth.uid() = user_id);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_idea_leads_idea_id ON public.idea_leads(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_leads_lead_id ON public.idea_leads(lead_id);

-- 5. Migrar datos existentes desde ideas.lead_id a idea_leads
INSERT INTO public.idea_leads (idea_id, lead_id, user_id)
SELECT
  id,
  lead_id,
  created_by
FROM public.ideas
WHERE lead_id IS NOT NULL;

-- 6. Opcional: eliminar la columna lead_id de ideas
-- Se elimina para forzar el uso de la join table
ALTER TABLE IF EXISTS public.ideas DROP COLUMN IF EXISTS lead_id;

COMMIT;
