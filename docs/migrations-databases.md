# Prompt para Agente - Migraciones Supabase

Cuando crees o modifies migraciones de base de datos en Supabase:

1. **Idempotencia:** Todo CREATE usa `IF NOT EXISTS`, todo DROP usa `IF EXISTS`
2. **Políticas RLS:** Siempre `DROP POLICY IF EXISTS` antes de `CREATE POLICY`
3. **Estructura:** Envuelve todo en `BEGIN...COMMIT`
4. **Validación:** Usa `supabase db push --dry-run` antes de aplicar

Nunca dejes que una política RLS se cree sin antes eliminar la existente.