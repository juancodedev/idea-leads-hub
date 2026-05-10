BEGIN;

-- 1. Create Tags Table
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Create Entity Tags Table (Generic relation)
CREATE TABLE IF NOT EXISTS public.entity_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags ON DELETE CASCADE NOT NULL,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- 'lead', 'idea'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(tag_id, entity_id, entity_type)
);

-- 3. Create Pipelines Table
CREATE TABLE IF NOT EXISTS public.pipelines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Create Pipeline Stages Table
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID REFERENCES public.pipelines ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  position INT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  is_closed BOOLEAN DEFAULT FALSE,
  is_won BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Create Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- 'lead', 'idea'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. Update Leads Table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES public.pipelines ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.pipeline_stages ON DELETE SET NULL;

-- 7. RLS Policies

-- Tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access own tags" ON public.tags;
CREATE POLICY "Users can access own tags" ON public.tags FOR ALL USING (auth.uid() = user_id);

-- Entity Tags
ALTER TABLE public.entity_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access own entity_tags" ON public.entity_tags;
CREATE POLICY "Users can access own entity_tags" ON public.entity_tags FOR ALL USING (auth.uid() = user_id);

-- Pipelines
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access own pipelines" ON public.pipelines;
CREATE POLICY "Users can access own pipelines" ON public.pipelines FOR ALL USING (auth.uid() = user_id);

-- Pipeline Stages
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access own pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "Users can access own pipeline_stages" ON public.pipeline_stages FOR ALL USING (auth.uid() = user_id);

-- Notes
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access own notes" ON public.notes;
CREATE POLICY "Users can access own notes" ON public.notes FOR ALL USING (auth.uid() = user_id);

-- 8. Triggers for updated_at
DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 9. Initial Default Pipeline Data (Optional: This could be done via seed or app logic, but let's provide a function to initialize defaults)
CREATE OR REPLACE FUNCTION initialize_default_pipeline(target_user_id UUID)
RETURNS UUID AS $$
DECLARE
  new_pipeline_id UUID;
BEGIN
  INSERT INTO public.pipelines (user_id, name, description)
  VALUES (target_user_id, 'Ventas Estándar', 'Pipeline de ventas por defecto')
  RETURNING id INTO new_pipeline_id;

  INSERT INTO public.pipeline_stages (pipeline_id, user_id, name, position, color)
  VALUES 
    (new_pipeline_id, target_user_id, 'Nuevo', 1, '#94a3b8'),
    (new_pipeline_id, target_user_id, 'Contactado', 2, '#3b82f6'),
    (new_pipeline_id, target_user_id, 'Interesado', 3, '#8b5cf6'),
    (new_pipeline_id, target_user_id, 'Propuesta', 4, '#f59e0b');
    
  INSERT INTO public.pipeline_stages (pipeline_id, user_id, name, position, color, is_closed, is_won)
  VALUES 
    (new_pipeline_id, target_user_id, 'Ganado', 5, '#10b981', TRUE, TRUE),
    (new_pipeline_id, target_user_id, 'Perdido', 6, '#ef4444', TRUE, FALSE);

  RETURN new_pipeline_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
