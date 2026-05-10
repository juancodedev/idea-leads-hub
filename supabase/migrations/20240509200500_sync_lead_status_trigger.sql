-- Función para sincronizar el campo status con el nombre de la etapa de forma bidireccional
CREATE OR REPLACE FUNCTION public.fn_sync_lead_status_with_stage()
RETURNS TRIGGER AS $$
BEGIN
    -- CASO 1: Cambia la Etapa (stage_id) -> Actualizamos el texto del status
    IF (NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.stage_id IS NOT NULL) THEN
        SELECT name INTO NEW.status
        FROM public.pipeline_stages
        WHERE id = NEW.stage_id;
    
    -- CASO 2: Cambia el texto del status -> Actualizamos el stage_id
    ELSIF (NEW.status IS DISTINCT FROM OLD.status OR (NEW.stage_id IS NULL AND NEW.status IS NOT NULL)) THEN
        SELECT id INTO NEW.stage_id
        FROM public.pipeline_stages
        WHERE name ILIKE NEW.status
        AND user_id = NEW.user_id
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para la tabla leads
DROP TRIGGER IF EXISTS tr_sync_lead_status ON public.leads;
CREATE TRIGGER tr_sync_lead_status
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_lead_status_with_stage();
