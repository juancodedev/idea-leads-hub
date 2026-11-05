# Mejoras de mensajería: lo que se trae desde Builder CRM

> Generado: 2026-11-03
> Origen: levantamiento comparativo de `builder-crm` (Next.js 16, Supabase, Coolify) contra `idea-leads-hub` (Next.js 15, Supabase, Cloudflare Workers vía OpenNext).
> Foco: comunicaciones por Meta (Instagram DM y Facebook Messenger). WhatsApp se documenta como referencia para un paso futuro.

---

## 1. Resumen ejecutivo

| Tema | idea-leads-hub hoy | builder-crm | Veredicto |
|------|--------------------|-------------|-----------|
| Canales | Solo Instagram DM, directo contra Graph API | WhatsApp + Instagram + Messenger, con Zernio como transporte | Traer el modelo multicanal |
| Modelo de datos | Los DM son filas de `activities` (`type='INSTAGRAM_MESSAGE'`); la dirección y el remitente se sacan del **título** ("Instagram DM from/to {id}") | Tablas `conversations`, `messages`, `contact_identities`, `channel_accounts` y `webhook_events` | Traer: es la base de todo lo demás |
| Idempotencia | No se guarda el `mid` de Meta, así que un reintento puede duplicar mensajes | Índice único parcial sobre `messages.external_id` y reclamo del evento en `webhook_events` | Traer |
| Webhook | Todo el trabajo es síncrono antes del 2xx | Responde 2xx enseguida y procesa en `after()`; un barrido reintenta lo que queda colgado | Traer, adaptado a Workers (`waitUntil`) |
| Eco de mensajes salientes | Se descartan | Se guardan como `direction=out` y se deduplican contra el envío propio (ventana de 2 min) | Traer: los mensajes enviados desde la app nativa de IG quedan registrados |
| Ventana de 24 h | TODO en `InstagramAutoTrigger` | Calculada en el servidor con `last_inbound_at`, falla cerrada, con tag `HUMAN_AGENT` automático | Traer |
| Salida | Dos endpoints de envío, cada uno con su propia lógica | Un único camino, `deliverMessage`, con fila optimista `pending`, luego `sent`/`failed` y una pista legible del error | Traer |
| Multi-cuenta | Una fila de `user_secrets` por usuario | `channel_accounts`, varias cuentas por canal | Traer (opcional en una primera fase) |
| Agente IA | No existe | Un agente por canal, cola con debounce, tools que mueven el pipeline, pausa por conversación | Fase posterior |
| Tiempo real en la UI | Supabase Realtime sobre `activities` (solo el badge de no leídos) | Polling (2,5 s el chat, 4 s la lista) | **Mejor en idea-leads-hub**: conservar Realtime y extenderlo a `messages` |
| Arquitectura | Hexagonal (`core/domain`, `ports`, `infrastructure`) | Interfaz `Conector` más un registro, sin capas formales | **Mejor en idea-leads-hub**: el conector entra como port y adapter |
| Seguridad de tokens | Tokens en texto plano en `user_secrets` (deuda conocida) | Variables de entorno por instancia (single-tenant) | Ninguno resuelve el caso multiusuario; cifrar es pendiente propio |
| Tests | Specs de rutas de Instagram y de `InstagramAutoTrigger` | Firma HMAC y ventana de 24 h; sin tests de ingest ni de entrega | Combinar los dos |

**Idea central:** idea-leads-hub tiene la mejor arquitectura; builder-crm tiene la mejor **tubería de mensajería**. La mejora consiste en llevar esa tubería a los ports y adapters de idea-leads-hub, sin copiar su forma de carpetas.

---

## 2. Qué se hace mejor en cada uno

### 2.1 Mejor en builder-crm (se trae)

1. **La conversación como entidad propia.** Una persona puede tener un hilo por Instagram y otro por Messenger. `conversations` tiene `UNIQUE(provider, external_id)`, además de `last_inbound_at`, `unread_count`, `last_message_*`, `ai_enabled` y `needs_human`.
2. **Identidad del contacto separada del lead.** `contact_identities(channel, external_id)` es única. Un remitente nuevo crea el contacto con un nombre provisorio ("@handle" o "Instagram 1234"), y `maybeImproveName` lo reemplaza más adelante solo si sigue siendo el provisorio.
3. **Webhook robusto** (`builder-crm/src/lib/channels/webhook.ts`):
   - Lee el body crudo y verifica la firma HMAC con `timingSafeEqual`. Falla cerrado si no hay secreto configurado.
   - Toma el id del evento del proveedor, o usa `sha:<sha256(body)>` si no viene.
   - Reclama el evento con `INSERT INTO webhook_events ... ON CONFLICT DO NOTHING`, guardando el payload. Si es un duplicado, responde 2xx sin procesar.
   - Responde 2xx de inmediato y procesa en segundo plano.
   - El resultado del procesamiento es `processed`, `ignored` o `retry`. Con `retry` se incrementa `attempts`; con una excepción el evento queda `failed`.
   - Un barrido (GET protegido por secreto) reprocesa los eventos que siguen en `received` después de 2 min, hasta 3 intentos.
4. **Deduplicación del eco** (`ingest.ts`):
   - Primero se deduplica por `external_id`.
   - Si no coincide, se "adopta" una fila saliente que todavía no tiene `external_id`, con el mismo cuerpo y en la misma conversación, dentro de 2 min, y se le asigna el id.
   - Un error `23505` (violación de unicidad) se trata como duplicado.
5. **Ventana de 24 h decidida en el servidor** (`types.ts`, `conectores/zernio.ts`):
   - Instagram y Messenger usan `humanAgentTag: true`. Fuera de la ventana se envía con `messaging_type=MESSAGE_TAG` y `tag=HUMAN_AGENT`.
   - WhatsApp usa `humanAgentTag: false`: fuera de la ventana solo puede salir una plantilla.
   - `isOutsideFreeFormWindow` falla cerrado: si `last_inbound_at` es null o inválido, se considera fuera de la ventana.
6. **Un solo camino de salida, `deliverMessage`:**
   - Inserta una fila optimista con `status=pending` y `origin` (`agent`, `human` o `template`).
   - Llama al conector.
   - Marca `sent` con el `external_id`, o `failed` con el error y una pista legible: 401/403 credenciales, 429 límite de envíos, 400 fuera de la ventana de 24 h. En Graph, los códigos 131047 (24 h), 190 (token) y 132000 (plantilla).
7. **Estados de entrega.** `delivered`, `read`, `failed` y `deleted` actualizan el mensaje (`delivered_at`, `read_at`). Si el estado llega antes que el mensaje, el evento queda en `retry`.
8. **Cliente HTTP resiliente** (`zernio/client.ts`): timeout de 15 s, 2 reintentos ante 408, 429, 502, 503 y 504 con backoff y respetando `Retry-After`. Nunca lanza excepciones: devuelve un resultado tipado.
9. **Medios entrantes.** Se guarda un texto provisorio (`[imagen]`, `[audio]`, `(+N)`), `type` con el tipo de adjunto y el payload completo en `raw_payload`. Es mejorable: las URLs de los medios todavía no van a columnas propias.
10. **Backfill** de historial al conectar una cuenta (hasta 200 conversaciones × 100 mensajes) sin disparar al agente. Además, el agente ignora mensajes de más de 1 h de antigüedad.
11. **Atribución de anuncios.** El `metadata` de la conversación guarda los datos de Click-to-DM y Click-to-WhatsApp (`ctwa_*`, `meta_ad_*`) y solo se sobrescribe cuando el evento los trae.

### 2.2 Mejor en idea-leads-hub (se conserva)

1. **Arquitectura hexagonal.** El dominio no importa infraestructura, y el "conector" de builder-crm encaja como un port `MessagingChannel` con adapters.
2. **Integración directa con Meta**, sin intermediario. Ya tiene OAuth por Facebook Login y por Instagram Business Login, refresco de tokens, verificación HMAC con WebCrypto y soporte de los dos formatos de webhook (`messaging[]` y `changes[]`). builder-crm depende de Zernio para Instagram y Messenger, y su conector `meta-cloud` solo envía por WhatsApp.
3. **Supabase Realtime** para no leídos. Es mejor que el polling de builder-crm: conviene extenderlo a `messages` y `conversations`.
4. **Validación con Zod `.strict()`** y tests junto al código.

---

## 3. Mejoras propuestas, por fases

### Fase 1: modelo de datos de mensajería (prerrequisito de todo lo demás)

Migración nueva (14 dígitos, como exige `SDD-TRACKING.md`), con RLS `user_id = auth.uid()`:

```sql
-- Sketch, adapt naming and RLS to repository conventions
create table channel_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  channel text not null check (channel in ('instagram','messenger','whatsapp')),
  external_account_id text not null,   -- ig_id / page_id / phone_number_id
  display_name text,
  status text not null default 'connected',
  unique (channel, external_account_id)
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id uuid references leads(id),          -- null while unlinked
  account_id uuid references channel_accounts(id),
  channel text not null,
  provider text not null default 'meta',
  external_id text not null,                  -- IGSID / PSID / wa_id
  participant_name text,
  participant_username text,
  participant_avatar_url text,
  last_inbound_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int not null default 0,
  metadata jsonb not null default '{}',       -- ad attribution, referral
  unique (provider, external_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  origin text check (origin in ('human','agent','template','auto')),
  type text not null default 'text',
  body text,
  external_id text,                            -- Meta mid
  status text not null default 'received',     -- pending|sent|delivered|read|failed
  error_message text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz
);
create unique index messages_external_id_uq on messages(external_id) where external_id is not null;
create index messages_conversation_created_idx on messages(conversation_id, created_at);

create table webhook_events (
  event_id text primary key,
  provider text not null,
  status text not null default 'received',     -- received|processed|ignored|failed
  attempts int not null default 0,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create index webhook_events_status_idx on webhook_events(status, received_at);
```

- Agregar `messages` y `conversations` a la publicación `supabase_realtime`.
- **Migración de datos:** pasar las `activities` de tipo `INSTAGRAM_MESSAGE` a `conversations` y `messages`, sacando la dirección y el id del título. Los mensajes históricos no tienen `mid`, así que quedan con `external_id = null`.
- **Decisión que hay que tomar:** el diseño de `openspec/changes/instagram-messaging/design.md` rechazó una tabla de mensajes separada. Este documento propone revertir esa decisión, porque guardar la dirección en el título impide deduplicar, mostrar estados de entrega, calcular la ventana de 24 h y tener más de un canal. Las `activities` pueden seguir existiendo como **evento de timeline** del lead (por ejemplo "nuevo DM recibido"), pero no como almacén de los mensajes.

### Fase 2: port y adapters de canal

En `src/core/ports`:

```ts
// Sketch
export interface MessagingChannel {
  readonly channel: 'instagram' | 'messenger' | 'whatsapp';
  send(ctx: SendContext, msg: OutboundMessage): Promise<SendOutcome>; // never throws
  verifyWebhook(rawBody: ArrayBuffer, headers: Headers): Promise<boolean>;
  eventId(payload: unknown, rawBody: ArrayBuffer): Promise<string>;
  parse(payload: unknown): InboundEvent[]; // message | echo | status | referral
}
```

- **Adapters:** `MetaInstagramChannel` (reutiliza `InstagramMessagingService`) y `MetaMessengerChannel` (Graph `/{page_id}/messages` con el token de página; ya se piden los scopes `pages_messaging` en el login de Facebook). Más adelante, `MetaWhatsAppChannel`.
- **Caso de uso `IngestInboundEvent`:** resolver la cuenta, luego la identidad y la conversación, deduplicar el mensaje (incluido el eco), actualizar la conversación (`last_inbound_at`, `unread_count`) y registrar la activity de timeline.
- **Caso de uso `DeliverMessage`:** el único camino de salida. Lo usan los endpoints de envío, `InstagramAutoTrigger` y, más adelante, el agente. Reemplaza los dos endpoints actuales, que escriben activities.
- **Errores:** `SendOutcome` tipado (`ok`, `externalId`, `error`, `hint`), con las pistas de Graph: 190 (token vencido), 10/200 (permisos), 551 (usuario no disponible), 2018278 o 2534022 (fuera de la ventana).

### Fase 3: webhook rápido y confiable en Cloudflare Workers

En Workers no existe `after()` como en Coolify. La alternativa equivalente:

1. Verificar el HMAC y reclamar el evento en `webhook_events` (un solo `INSERT ... ON CONFLICT DO NOTHING`).
2. Programar el procesamiento con `getCloudflareContext().ctx.waitUntil(...)` (de `@opennextjs/cloudflare`) y responder 200 enseguida.
3. Agregar un **Cron Trigger** en `wrangler.toml`, por ejemplo cada 5 min, que reprocese los eventos en `received` con más de 2 min, hasta 3 intentos. En OpenNext requiere un handler `scheduled` en un worker propio, o un endpoint protegido que llame un cron externo.
4. Alternativa más robusta: **Cloudflare Queues**. El webhook encola y el consumidor procesa con reintentos nativos. Cuesta más configuración, pero elimina el barrido.

Además:

- Guardar el `mid` y deduplicar. Hoy un reintento de Meta duplica la activity.
- Procesar los **ecos** (`is_echo: true`) en vez de descartarlos, para que lo enviado desde la app nativa de Instagram aparezca en el CRM.
- Procesar `message_reads`, `message_deliveries` (Messenger) y `messaging_referrals` (atribución de anuncios).
- Mantener el 500 ante una falla de búsqueda del dueño, pero solo antes de reclamar el evento.
- **Riesgo actual:** si no se encuentra al dueño y hay un único usuario conectado, el webhook le asigna el mensaje a ese usuario. Es razonable para single-tenant, pero hay que revisarlo si se suman más usuarios.

### Fase 4: ventana de 24 h y envío fuera de ventana

- `isOutsideFreeFormWindow(lastInboundAt)` en el dominio, fallando cerrado, con tests de borde copiados de `builder-crm/tests/ventana-24h.test.ts`: exactamente 24 h cuenta como dentro de la ventana, y null o inválido cuenta como fuera.
- **Instagram y Messenger:** fuera de la ventana, enviar con `messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT"`. Válido por 7 días, solo para respuestas humanas y no automatizadas, y requiere el permiso **Human Agent** aprobado en App Review.
- `InstagramAutoTrigger` es un mensaje automático, así que **no** puede usar `HUMAN_AGENT`: fuera de la ventana debe saltarse el envío y registrarlo. Así se cierra su TODO.
- **UI:** un banner en el chat cuando la conversación está fuera de la ventana (en builder-crm, `ChatPanel.tsx`).

### Fase 5: Messenger

- Suscribir la página al webhook de `messages`, `messaging_postbacks`, `message_echoes`, `message_reads` y `messaging_referrals`.
- El PSID es la identidad (`channel='messenger'`). El nombre y el avatar vienen de `GET /{psid}?fields=first_name,last_name,profile_pic` con el token de página.
- Puede compartir la ruta del webhook con Instagram (`object: "page"` frente a `object: "instagram"`) o tener una propia. Con el port, el despacho es por `object`.

### Fase 6: inbox

- La bandeja lista `conversations` (sin agrupar por títulos), ordenadas por `last_message_at`, con filtro por canal y el ícono de cada canal.
- Supabase Realtime sobre `messages` (INSERT y UPDATE de estado) en el chat abierto, y sobre `conversations` en la lista. Polling de respaldo cada 30 s. Esto **mejora** a builder-crm, que solo hace polling.
- Vincular una conversación sin lead a un lead existente, o crear el lead desde la conversación. Hoy se vincula mensaje por mensaje.
- Mostrar el estado de cada mensaje saliente (pendiente, enviado, entregado, leído o fallido, con la pista del error) y reintentar los fallidos.
- Partir `src/app/messages/page.tsx` (769 líneas) en container y presentational components.

### Fase 7 (posterior): agente IA

Referencia en builder-crm, `src/lib/agent/`:

- **Configuración por canal** (`agent_configs`): prompt, encendido y apagado. Instagram y Messenger arrancan apagados.
- **Cola** `agent_jobs` con debounce de 6 s por conversación, para agrupar ráfagas de mensajes.
- **Tools:** `mover_etapa`, `actualizar_contacto`, `registrar_actividad` y `derivar_asesor`, que pausa solo el hilo y marca `needs_human`.
- **Estilo por canal:** en Instagram, 1 o 2 oraciones y sin URLs largas.
- **En Workers:** un consumidor de Queues con `delaySeconds` reemplaza el debounce con `sleep`.

---

## 4. WhatsApp: cómo lo implementa builder-crm (referencia para el futuro)

- **Transporte por defecto: Zernio.** Con `WHATSAPP_PROVIDER=meta` se usa la integración directa con WhatsApp Cloud API: envío de texto y plantillas en `src/lib/meta-whatsapp.ts`, y webhook legado en `/api/webhooks/whatsapp`, que valida `X-Hub-Signature-256` y el `hub.challenge`.
- **Ventana de 24 h:** sin `HUMAN_AGENT`. Fuera de la ventana solo se envían **plantillas aprobadas**. Una conversación nueva requiere plantilla (`TEMPLATE_REQUIRED`).
- **Plantillas:** CRUD a través de la API de Zernio (`/whatsapp/templates`) con espejo en la tabla local `whatsapp_templates`. Se envían como `template: { elements: [...] }`.
- **Identidad:** el teléfono normalizado a `+E164`. El BSUID se vincula como segunda identidad en `contact_identities`.
- **Deduplicación:** el `wamid` es el `external_id`, y deduplica entre los dos caminos (Meta y Zernio) cuando conviven.
- **Errores de Graph con pista:** 131047 (fuera de 24 h), 131030 (número no permitido en modo prueba), 132000 (parámetros de la plantilla), 190 (token).
- **Alta de número (BYO-WABA):** `npm run zernio:whatsapp` con `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_PHONE_NUMBER_ID` y un PIN opcional de verificación en dos pasos (evita el error 133005).
- **Pendiente en builder-crm:** el conector `meta-cloud` no tiene `webhook` (sin idempotencia en `webhook_events`) ni Embedded Signup.

**Para idea-leads-hub:** con el port de la fase 2, WhatsApp es un adapter más (`MetaWhatsAppChannel`) contra Cloud API directa, más una tabla de plantillas y un selector de plantilla en el chat cuando la conversación está fuera de la ventana. Hay que decidir entre Cloud API directa (sin costo de intermediario, pero con App Review y Embedded Signup propios) o un proveedor como Zernio (más rápido de conectar, con costo mensual).

---

## 5. Deuda que conviene resolver junto con esto

1. **Cifrar los tokens de `user_secrets`.** Ya estaba planeado con pgcrypto y `TOKEN_ENCRYPTION_KEY` pero no se implementó. Con varias cuentas por usuario, los tokens pasan a `channel_accounts`, cifrados.
2. **Tests de la tubería**, que faltan en los dos repos: ingest con eco duplicado, `mid` repetido, estado antes que el mensaje, `DeliverMessage` con fallo y pista, y el webhook con y sin firma (hay tests reutilizables en `builder-crm/tests/firma-webhook.test.ts`).
3. **Unificar la versión de Graph.** Hoy los envíos van por v25.0 y el refresco de token por v21.0.
4. **Actualizar `docs/agent.md`**, que todavía menciona `runtime='edge'` y Cloudflare Pages.

## 6. Orden sugerido

Fase 1, 2 y 3 (base confiable de Instagram) → fase 4 (ventana de 24 h) → fase 6 (inbox) → fase 5 (Messenger) → WhatsApp → fase 7 (agente).

Cada fase debería nacer como un change de `openspec/`. La fase 1 toca datos persistidos y un contrato existente (las activities de Instagram), así que necesita el carril completo de spec y revisión.

---

## 7. Handoff: cómo retomar en una sesión nueva

**Estado:** el levantamiento está hecho y no hay código escrito. El change está registrado como `messaging-pipeline` (#4) en `SDD-TRACKING.md`.

**Decisión tomada (2026-11-03): opción (a).** Se crean tablas nuevas y se migran los `INSTAGRAM_MESSAGE` existentes. Las opciones evaluadas fueron:

| Opción | Qué implica |
|--------|-------------|
| (a) Tablas nuevas y migración (recomendada) | `conversations`, `messages` y `webhook_events`; se migran los `INSTAGRAM_MESSAGE` existentes y las activities quedan como eventos del timeline |
| (b) Tablas nuevas sin migrar | Menos riesgo, pero el inbox lee dos fuentes durante la transición |
| (c) Mantener activities | Se agregan `mid`, la dirección como columna y la idempotencia; Messenger y la ventana de 24 h quedan forzados |

**Código de referencia en builder-crm** (repo hermano, `../builder-crm`):

| Tema | Archivo |
|------|---------|
| Interfaz de conector | `src/lib/channels/conector.ts` |
| Webhook genérico: firma, `webhook_events`, barrido | `src/lib/channels/webhook.ts` |
| Ingest: identidad, conversación, deduplicación del eco | `src/lib/channels/ingest.ts` |
| Salida única | `src/lib/channels/deliver.ts` |
| Ventana de 24 h y `humanAgentTag` | `src/lib/channels/types.ts` |
| Envío con `HUMAN_AGENT` y pistas de error | `src/lib/channels/conectores/zernio.ts` |
| Conector Meta (WhatsApp) | `src/lib/channels/conectores/meta-cloud.ts`, `src/lib/meta-whatsapp.ts` |
| Eventos entrantes: medios y estados | `src/lib/channels/zernio-events.ts` |
| Cliente HTTP con reintentos | `src/lib/zernio/client.ts` |
| Esquema | `src/db/schema.ts`, `supabase/migrations/20261001000000_base.sql` |
| Tests reutilizables | `tests/ventana-24h.test.ts`, `tests/firma-webhook.test.ts` |
| Agente (fase 7) | `src/lib/agent/` |

**Prompt sugerido para abrir la sesión en idea-leads-hub:**

> Lee `docs/mejoras-mensajeria-desde-builder-crm.md` y la entrada `messaging-pipeline` de `SDD-TRACKING.md`. Decidí la opción (a/b/c) para el modelo de DM. Arranca el change `messaging-pipeline` por el flujo SDD (proposal → spec → design) cubriendo las fases 1 a 3. Usa `../builder-crm` solo como referencia de patrones, sin copiar Zernio ni `after()`.

**Antes de implementar, verificar:**

- Los códigos de error de Graph citados en la fase 2 (551, 2018278, 2534022) contra la documentación oficial de Meta, porque no salen del código de ninguno de los dos repos.
- Que `getCloudflareContext().ctx.waitUntil` esté disponible en la versión de `@opennextjs/cloudflare` instalada.
- Que el permiso Human Agent esté aprobado en la app de Meta antes de depender de `HUMAN_AGENT`.
