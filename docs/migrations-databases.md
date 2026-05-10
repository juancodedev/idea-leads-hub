# Prompt para Agente - Migraciones Supabase

Cuando crees o modifies migraciones de base de datos en Supabase:

1. **Idempotencia:** Todo CREATE usa `IF NOT EXISTS`, todo DROP usa `IF EXISTS`
2. **Políticas RLS:** Siempre `DROP POLICY IF EXISTS` antes de `CREATE POLICY`
3. **Estructura:** Envuelve todo en `BEGIN...COMMIT`
4. **Validación:** Usa `supabase db push --dry-run` antes de aplicar

Nunca dejes que una política RLS se cree sin antes eliminar la existente.

## Esquema de Entidades y Relaciones

### Ideas (`public.ideas`)
- Relacionada con `leads` vía `lead_id` (Opcional).
- Relacionada con `tags` vía tabla de unión `idea_tags`.
- Estados: `BACKLOG`, `RESEARCHING`, `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `ARCHIVED`.
- Prioridades: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.

### Actividades (`public.activities`)
- Relacionada con `leads` vía `lead_id`.
- Tipos: `CALL`, `MEETING`, `FOLLOW_UP`, `EMAIL`, `TASK`, `NOTE`, `REMINDER`.
- Seguimiento de completitud vía `completed` y `completed_at`.

### Etiquetas (`public.tags`)
- Entidad global compartida por `leads` e `ideas`.
- Relaciones persistidas en `lead_tags` e `idea_tags`.