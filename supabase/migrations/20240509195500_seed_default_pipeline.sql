-- Seed default pipeline and stages
-- This ensures that there is always at least one pipeline for the user

DO $$
DECLARE
    target_user_id UUID;
    new_pipeline_id UUID;
BEGIN
    -- Get the first user from profiles (or auth.users)
    SELECT id INTO target_user_id FROM auth.users LIMIT 1;

    IF target_user_id IS NOT NULL THEN
        -- Create default pipeline if not exists
        INSERT INTO public.pipelines (name, description, user_id)
        VALUES ('Pipeline de Ventas', 'Gestión estándar de leads y oportunidades', target_user_id)
        ON CONFLICT DO NOTHING
        RETURNING id INTO new_pipeline_id;

        -- If a new pipeline was created, add default stages
        IF new_pipeline_id IS NOT NULL THEN
            INSERT INTO public.pipeline_stages (pipeline_id, name, position, color, user_id)
            VALUES 
                (new_pipeline_id, 'Nuevo', 1, '#3b82f6', target_user_id),
                (new_pipeline_id, 'Contactado', 2, '#8b5cf6', target_user_id),
                (new_pipeline_id, 'Interesado', 3, '#f59e0b', target_user_id),
                (new_pipeline_id, 'Propuesta', 4, '#10b981', target_user_id),
                (new_pipeline_id, 'Ganado', 5, '#16a34a', target_user_id),
                (new_pipeline_id, 'Perdido', 6, '#ef4444', target_user_id);
        END IF;
    END IF;
END $$;
