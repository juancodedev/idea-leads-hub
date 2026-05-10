-- 1. Eliminar la tabla genérica que causaba problemas
DROP TABLE IF EXISTS public.entity_tags;

-- 2. Crear tablas de unión específicas (Mejor práctica para Joins en Supabase)
CREATE TABLE public.lead_tags (
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

CREATE TABLE public.idea_tags (
  idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, tag_id)
);

-- 3. Habilitar RLS
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idea_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own lead_tags" ON public.lead_tags FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own idea_tags" ON public.idea_tags FOR ALL USING (auth.uid() = user_id);

-- 4. Índices para performance
CREATE INDEX idx_lead_tags_lead_id ON public.lead_tags(lead_id);
CREATE INDEX idx_idea_tags_idea_id ON public.idea_tags(idea_id);
