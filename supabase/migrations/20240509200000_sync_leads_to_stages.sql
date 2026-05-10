-- Sincronizar leads existentes con las nuevas etapas del pipeline basado en su status de texto
-- Esto soluciona que los leads no aparezcan en el Pipeline después de la migración

DO $$
DECLARE
    stage_record RECORD;
BEGIN
    -- Buscamos todas las etapas del pipeline de ventas
    FOR stage_record IN 
        SELECT id, name, pipeline_id FROM public.pipeline_stages
    LOOP
        -- Actualizamos los leads cuyo status coincida con el nombre de la etapa
        -- y que aún no tengan un stage_id asignado
        UPDATE public.leads
        SET stage_id = stage_record.id,
            pipeline_id = stage_record.pipeline_id
        WHERE status = stage_record.name 
        AND (stage_id IS NULL OR pipeline_id IS NULL);
    END LOOP;
    
    -- Para leads que no coincidan exactamente, asignarlos a la primera etapa (Nuevo)
    UPDATE public.leads
    SET stage_id = (SELECT id FROM public.pipeline_stages WHERE name = 'Nuevo' LIMIT 1),
        pipeline_id = (SELECT pipeline_id FROM public.pipeline_stages WHERE name = 'Nuevo' LIMIT 1)
    WHERE stage_id IS NULL;
END $$;
