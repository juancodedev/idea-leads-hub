# Guía de Arquitectura (Hexagonal + Clean Architecture)

## Objetivo

Implementar una arquitectura híbrida Clean + Hexagonal que permita desacoplar la lógica de negocio (Core) de las implementaciones técnicas (Infraestructura) y la interfaz de usuario (Módulos/UI).

## Estructura de Carpetas

```text
src/
├── app/                  # Next.js App Router (Rutas y layouts de página)
├── middleware.ts         # Lógica de protección de rutas y auth en Edge Runtime
├── core/                 # Núcleo de la aplicación (Lógica Pura)
│   ├── domain/           # Entidades, Value Objects y Errores de dominio
│   ├── application/      # Casos de Uso (Orquestación de la lógica de negocio)
│   ├── ports/            # Interfaces (Contratos para Repositorios y Servicios)
│   └── shared/           # Tipos y utilidades transversales al core
├── infrastructure/       # Implementaciones Técnicas (Detalle)
│   ├── database/         # Configuración de clientes (Supabase client/server)
│   ├── repositories/     # Implementación concreta de los ports (vía Supabase)
│   └── auth/             # Configuración de autenticación
├── modules/              # Módulos Funcionales Autocontenidos (Hexagonal Modular)
│   ├── [feature]/        # Carpeta del módulo (ej: leads, ideas, activities)
│   │   ├── domain/       # Entidades y Enums del módulo
│   │   ├── application/  # Casos de Uso específicos
│   │   ├── infrastructure/ # Repositorios, Mappers y esquemas Zod
│   │   ├── presentation/ # Componentes UI, Formularios y Vistas
│   │   ├── store/        # Estado global reactivo (Zustand)
│   │   └── index.ts      # Punto de entrada y factoría del módulo
│   └── auth/             # Módulo de autenticación compartido
├── ui/                   # Sistema de Diseño (UI Kit)
│   ├── components/       # Componentes shadcn/ui y base reutilizables
│   └── layouts/          # Estructuras de página compartidas
└── lib/                  # Configuraciones de librerías externas (utils, etc.)
```

## Reglas de Dependencia

1. **Independencia del Core**: `src/core` no debe importar nada de `src/infrastructure`, `src/modules` o `src/app`. Solo depende de sí mismo.
2. **Inversión de Dependencias**: La infraestructura implementa las interfaces definidas en `src/core/ports`.
3. **Flujo de Datos**: Los Casos de Uso (`application`) orquestan el flujo llamando a los Puertos (`ports`). La UI (`modules`) llama a los Casos de Uso.
4. **UI Desacoplada**: Los componentes de React no deben contener lógica de base de datos ni de negocio compleja. Deben delegar en Casos de Uso o Repositorios inyectados.

## Flujo de Trabajo (Paso a Paso)

1. **Dominio**: Define o actualiza entidades en `src/core/domain`.
2. **Puertos**: Define el contrato necesario (ej. `LeadRepository`) en `src/core/ports`.
3. **Aplicación**: Implementa el Caso de Uso en `src/core/application` (ej. `CreateLead`).
4. **Infraestructura**: Implementa el repositorio concreto en `src/infrastructure/repositories` (ej. `SupabaseLeadRepository`).
5. **Módulos**: Crea el componente de UI en `src/modules` que consuma el Caso de Uso o el Repositorio (vía inyección).
6. **App**: Define la ruta en `src/app` que renderice el módulo.

## Reglas de Oro (Guardrails)

- **No instanciar repositorios directamente en componentes**: Utilizar inyección de dependencias o hooks que orquesten la creación.
- **Sin lógica de Supabase en el Core**: El core no debe saber que Supabase existe.
- **Validación en el Dominio**: Utilizar Zod para validar datos tanto en la entrada de la aplicación como en la persistencia.
- **Single Responsibility**: Un archivo, una responsabilidad. Evitar archivos "god" con miles de líneas.
