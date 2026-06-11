# CLAUDE.md — Portal de Empleo GetEmpleos (Get Company)

Este archivo es el contexto persistente del proyecto. Léelo completo antes de cualquier tarea.

---

## Descripción del proyecto

Portal de captación de talento para **Get Company** (getcompany.co), empresa colombiana de gestión humana y servicios temporales. El portal permite a la empresa publicar ofertas de trabajo y a los candidatos registrarse, completar su perfil, subir su hoja de vida y postularse a las vacantes.

El producto se llama internamente **GetEmpleos** y vive como subdominio o sección del sitio principal.

---

## Stack tecnológico — NO cambiar sin consultar

| Capa | Tecnología | Notas |
|---|---|---|
| Framework | Next.js 14 (App Router) | TypeScript estricto |
| UI base | Tailwind CSS v3 | Configuración personalizada con tokens de Get Company |
| Componentes | shadcn/ui | Tema customizado, no usar estilos por defecto |
| Base de datos | Supabase (PostgreSQL) | Migrations en `/supabase/migrations/` |
| Autenticación | Supabase Auth | Email/password + Google OAuth |
| Almacenamiento | Supabase Storage | Bucket `cvs` para hojas de vida en PDF |
| Email | Resend | Templates en `/emails/` con React Email |
| Deployment | Vercel | CI/CD automático desde rama `main` |

---

## Identidad visual — Get Company

### Paleta de colores (usar SIEMPRE estos valores)

```js
// tailwind.config.ts — colores corporativos Get Company
colors: {
  brand: {
    navy:    '#1B2A4A',   // Azul marino oscuro — color principal, fondos, navbar, footer
    blue:    '#2D5BE3',   // Azul medio — CTAs primarios, links activos
    yellow:  '#F5A623',   // Amarillo/naranja — acento energético, badges destacados
    green:   '#3DBE8C',   // Verde — estados positivos, "activo", "contratado"
    purple:  '#7C4DFF',   // Morado — acento secundario, categorías
    cyan:    '#00BCD4',   // Azul claro — acento informativo
    light:   '#F5F7FA',   // Fondo claro general
    white:   '#FFFFFF',
  },
  status: {
    pending:     '#F5A623',  // amarillo
    reviewing:   '#2D5BE3',  // azul
    shortlisted: '#7C4DFF',  // morado
    rejected:    '#EF4444',  // rojo
    hired:       '#3DBE8C',  // verde
  }
}
```

### Tipografía

```js
// Igual al sitio getcompany.co
fontFamily: {
  sans:    ['Plus Jakarta Sans', 'sans-serif'],   // cuerpo, UI general
  display: ['Sora', 'sans-serif'],                // títulos y headings grandes
}
// Importar desde Google Fonts en layout.tsx
```

### Elementos decorativos (identidad visual Get Company)
- Usar **círculos de colores borrosos** (blur) como elementos decorativos de fondo en secciones hero y banners — replicar el estilo del sitio principal
- Bordes redondeados generosos: `rounded-2xl` como estándar para cards
- Sombras suaves: `shadow-sm` por defecto, `shadow-md` en hover
- El logo de Get Company debe aparecer en navbar y footer — usar el existente en `/public/logo.svg`

---

## Arquitectura de roles

```
ADMIN (empleados de Get Company)
  - Login con email corporativo
  - CRUD completo de ofertas (propias y de empresas)
  - Ver y gestionar todas las postulaciones
  - Cambiar estado de cada postulación
  - Ver perfil completo de candidatos + descargar CV
  - Aprobar / rechazar registros de empresas clientes
  - Aprobar / rechazar ofertas enviadas por empresas (pending_review → active)
  - Dashboard con métricas
  - Exportar candidatos a CSV
  - Rutas: /admin/*

EMPRESA (clientes de Get Company — nuevas empresas que contratan talento)
  - Registro con email + contraseña o Google, con role='company' en metadata
  - Completar perfil de empresa: NIT, representante legal, ciudad, sector, logo
  - Estado de aprobación: pending → approved / rejected (solo admins aprueban)
  - Solo pueden crear ofertas si su empresa está aprobada (status='approved')
  - Crear, editar y eliminar sus propias ofertas (status inicial siempre 'draft')
  - Enviar oferta a revisión: status 'draft' → 'pending_review'
  - El admin aprueba/rechaza con review_notes → status 'active' / regresa a 'draft'
  - Ver postulaciones SOLO de sus propias ofertas (sin ver admin_notes)
  - Mover candidatos por el pipeline de su empresa
  - Rutas: /empresa/*

CANDIDATO (público general)
  - Registro con email + contraseña o Google
  - Completar perfil personal y profesional
  - Subir/actualizar hoja de vida (PDF, máx 5MB)
  - Buscar y filtrar ofertas
  - Postularse a ofertas (una vez por oferta)
  - Ver historial y estado de sus postulaciones
  - Rutas: /dashboard, /profile, /applications
```

---

## Modelo de datos completo

### `profiles` (extiende auth.users de Supabase)
```sql
id           uuid PRIMARY KEY REFERENCES auth.users(id)
full_name    text NOT NULL
email        text NOT NULL
phone        text
city         text
role         text NOT NULL DEFAULT 'candidate' -- 'admin' | 'candidate' | 'company'
avatar_url   text
created_at   timestamptz DEFAULT now()
updated_at   timestamptz DEFAULT now()
```

### `candidates` (perfil extendido, solo rol candidate)
```sql
id                uuid PRIMARY KEY REFERENCES profiles(id)
birth_date        date
gender            text  -- 'masculino' | 'femenino' | 'otro' | 'prefiero_no_decir'
education_level   text  -- 'bachiller' | 'tecnico' | 'tecnologo' | 'profesional' | 'especialista' | 'maestria' | 'doctorado'
career            text  -- carrera o área de estudio
years_experience  int DEFAULT 0
skills            text[]  -- habilidades blandas y técnicas
languages         text[]  -- idiomas
linkedin_url      text
cv_url            text  -- path en Supabase Storage
cv_updated_at     timestamptz
availability      text  -- 'inmediata' | '15_dias' | '30_dias'
expected_salary   numeric
summary           text  -- resumen profesional (máx 500 chars)
profile_complete  boolean DEFAULT false  -- true cuando tiene los campos mínimos
```

### `job_areas` (catálogo, seed incluido)
```sql
id    serial PRIMARY KEY
name  text NOT NULL  -- 'Ventas', 'Logística', 'Manufactura', 'Administrativo', 'Tecnología', 'Servicio al cliente', 'Finanzas', 'Recursos humanos', 'Operaciones', 'Marketing'
icon  text  -- nombre del ícono de lucide-react
slug  text UNIQUE NOT NULL
```

### `companies` (perfil de empresa cliente — rol 'company')
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
name             text NOT NULL
nit              text           -- NIT de la empresa (ej: 900.123.456-7)
legal_rep        text           -- nombre del representante legal
logo_url         text
website          text
description      text
city             text
industry         text
status           text DEFAULT 'pending'  -- 'pending' | 'approved' | 'rejected'
rejection_reason text           -- razón de rechazo del admin
approved_at      timestamptz
approved_by      uuid REFERENCES profiles(id)
created_by       uuid REFERENCES profiles(id)  -- FK al profile del usuario empresa
created_at       timestamptz DEFAULT now()
updated_at       timestamptz DEFAULT now()
```

### `jobs` (ofertas de trabajo)
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
title            text NOT NULL
slug             text UNIQUE NOT NULL  -- generado automáticamente del título
description      text NOT NULL  -- rich text / markdown
requirements     text  -- lista de requisitos
benefits         text  -- lista de beneficios
area_id          int REFERENCES job_areas(id)
modality         text  -- 'presencial' | 'remoto' | 'hibrido'
contract_type    text  -- 'tiempo_completo' | 'tiempo_parcial' | 'temporal' | 'por_obra'
salary_min       numeric
salary_max       numeric
salary_visible   boolean DEFAULT true
city             text NOT NULL
department       text  -- departamento de Colombia
vacancies        int DEFAULT 1
status           text DEFAULT 'draft'  -- 'draft' | 'pending_review' | 'active' | 'paused' | 'closed'
featured         boolean DEFAULT false  -- ofertas destacadas aparecen primero
company_id       uuid REFERENCES companies(id)  -- empresa que publica (si aplica)
created_by       uuid REFERENCES profiles(id)
review_notes     text  -- feedback del admin al aprobar/rechazar oferta de empresa
expires_at       timestamptz
published_at     timestamptz
created_at       timestamptz DEFAULT now()
updated_at       timestamptz DEFAULT now()
```

### `applications` (postulaciones)
```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
job_id         uuid REFERENCES jobs(id) ON DELETE CASCADE
candidate_id   uuid REFERENCES profiles(id)
status         text DEFAULT 'pending'  -- 'pending' | 'reviewing' | 'shortlisted' | 'rejected' | 'hired'
cover_letter   text  -- carta de presentación opcional
admin_notes    text  -- notas internas del admin, NUNCA visibles al candidato
applied_at     timestamptz DEFAULT now()
updated_at     timestamptz DEFAULT now()
UNIQUE(job_id, candidate_id)  -- un candidato no puede postularse dos veces
```

---

## Estructura de carpetas

```
/
├── app/
│   ├── layout.tsx                    # Root layout, fuentes, providers
│   ├── (public)/                     # Rutas sin autenticación requerida
│   │   ├── page.tsx                  # Landing / Home
│   │   ├── jobs/
│   │   │   ├── page.tsx              # Listado de ofertas con filtros
│   │   │   └── [slug]/
│   │   │       ├── page.tsx          # Detalle de oferta
│   │   │       └── apply/page.tsx    # Formulario postulación (requiere auth)
│   │   └── auth/
│   │       ├── login/page.tsx
│   │       ├── register/page.tsx
│   │       └── callback/route.ts     # OAuth callback
│   ├── (candidate)/                  # Rutas protegidas — solo rol candidate
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── profile/page.tsx
│   │   └── applications/page.tsx
│   ├── (admin)/                      # Rutas protegidas — solo rol admin
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── page.tsx              # Dashboard admin
│   │       ├── jobs/
│   │       │   ├── page.tsx          # Listado de todas las ofertas (incluye pending_review)
│   │       │   ├── new/page.tsx      # Crear oferta
│   │       │   └── [id]/
│   │       │       ├── edit/page.tsx
│   │       │       └── applications/page.tsx
│   │       ├── candidates/
│   │       │   ├── page.tsx          # Base de datos de candidatos
│   │       │   └── [id]/page.tsx     # Perfil completo del candidato
│   │       └── companies/
│   │           ├── page.tsx          # Listado de empresas (pending, approved, rejected)
│   │           └── [id]/page.tsx     # Detalle empresa + aprobar/rechazar
│   └── (empresa)/                    # Rutas protegidas — solo rol company
│       ├── layout.tsx
│       └── empresa/
│           ├── page.tsx              # Dashboard empresa
│           ├── onboarding/page.tsx   # Completar perfil empresa (NIT, rep. legal, etc.)
│           ├── perfil/page.tsx       # Editar perfil de empresa
│           ├── jobs/
│           │   ├── page.tsx          # Mis ofertas
│           │   ├── new/page.tsx      # Crear oferta
│           │   └── [id]/
│           │       ├── edit/page.tsx
│           │       └── postulaciones/page.tsx  # Candidatos a esta oferta
│           └── postulaciones/page.tsx  # Todas las postulaciones de la empresa
├── components/
│   ├── ui/                           # shadcn/ui — no editar directamente
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   └── AdminSidebar.tsx
│   ├── jobs/
│   │   ├── JobCard.tsx               # Card de oferta en listado
│   │   ├── JobFilters.tsx            # Panel de filtros lateral
│   │   ├── JobForm.tsx               # Formulario crear/editar oferta (admin)
│   │   ├── JobStatusBadge.tsx
│   │   └── JobSearch.tsx             # Buscador principal
│   ├── candidates/
│   │   ├── ProfileForm.tsx           # Formulario perfil candidato
│   │   ├── CVUpload.tsx              # Componente subida de CV
│   │   ├── ApplicationCard.tsx       # Tarjeta de postulación
│   │   └── ApplicationStatusBadge.tsx
│   └── shared/
│       ├── DecorativeBlobs.tsx       # Círculos decorativos del branding
│       ├── PageHeader.tsx
│       └── EmptyState.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # createBrowserClient
│   │   ├── server.ts                 # createServerClient (cookies)
│   │   └── admin.ts                  # createClient con service_role (solo server)
│   ├── types/
│   │   └── database.ts               # Tipos generados del schema de Supabase
│   ├── validations/
│   │   ├── job.ts                    # Zod schemas para ofertas
│   │   ├── candidate.ts              # Zod schemas para perfil
│   │   └── application.ts
│   └── utils/
│       ├── slug.ts                   # Generador de slugs
│       ├── salary.ts                 # Formateador de salarios en COP
│       └── date.ts                   # Formateador de fechas en español
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql    # Schema completo inicial
│   └── seed.sql                      # Datos iniciales (job_areas + admin user)
├── emails/                           # Templates React Email
│   ├── ApplicationReceived.tsx
│   └── StatusChanged.tsx
├── middleware.ts                     # Protección de rutas por rol
├── tailwind.config.ts                # Config con colores y fuentes de Get Company
└── .env.local.example                # Variables necesarias (sin valores reales)
```

---

## Variables de entorno requeridas

```bash
# .env.local — copiar y completar con valores reales de Supabase y Resend
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
RESEND_API_KEY=
RESEND_FROM_EMAIL=empleos@getcompany.co
```

---

## Convenciones de código

- **TypeScript estricto** — no usar `any`, tipar todo
- **Server Components por defecto** — usar `'use client'` solo cuando sea necesario (interactividad, hooks)
- **Server Actions** para mutaciones (crear oferta, postularse, actualizar estado) — no hacer fetch al API desde el cliente para estas operaciones
- **Zod** para validación de formularios en cliente y servidor
- **Error handling explícito** — siempre manejar errores de Supabase, mostrar mensajes útiles al usuario
- **Loading states** — usar Suspense + skeletons, nunca dejar pantalla en blanco
- Comentarios en **español** para lógica de negocio, en **inglés** para lógica técnica
- Nombres de archivos y carpetas en **kebab-case**, componentes en **PascalCase**

---

## Seguridad — RLS (Row Level Security) en Supabase

Implementar estas políticas en las migrations:

```sql
-- profiles: cada usuario ve/edita solo el suyo; admins ven todos
-- jobs: lectura pública para status='active'; escritura solo admins
-- candidates: solo el propio candidato puede ver/editar su perfil; admins pueden leer
-- applications: el candidato ve solo las suyas; admins ven todas
-- CVs en Storage: solo el dueño y admins pueden descargar
```

---

## Flujo de postulación (lógica de negocio)

1. Candidato debe tener `profile_complete = true` para postularse
2. Al postularse → crear registro en `applications` con status `pending`
3. Enviar email de confirmación al candidato (Resend)
4. Admin cambia estado → enviar email de notificación al candidato
5. Status `hired` → cerrar automáticamente la oferta si `vacancies` se llenó

---

## Orden de desarrollo recomendado

### Fase 1 — Fundamentos (empezar aquí)
1. `tailwind.config.ts` con colores y fuentes de Get Company
2. `supabase/migrations/001_initial_schema.sql` con todas las tablas + RLS
3. `supabase/seed.sql` con las 10 áreas de trabajo
4. `lib/supabase/client.ts`, `server.ts`, `admin.ts`
5. `middleware.ts` para protección de rutas
6. `app/layout.tsx` con fuentes (Plus Jakarta Sans + Sora desde Google Fonts)
7. `components/layout/Navbar.tsx` y `Footer.tsx`

### Fase 2 — Autenticación
8. Páginas `/auth/login` y `/auth/register`
9. Callback OAuth `/auth/callback/route.ts`
10. Lógica de asignación de rol al registrarse

### Fase 3 — Módulo Admin (ofertas)
11. CRUD completo de ofertas (`/admin/jobs`)
12. `components/jobs/JobForm.tsx`

### Fase 4 — Portal público
13. Landing `/` con buscador y ofertas destacadas
14. Listado `/jobs` con filtros
15. Detalle `/jobs/[slug]`

### Fase 5 — Módulo candidato
16. Perfil candidato + subida de CV
17. Flujo de postulación
18. Panel de postulaciones

### Fase 6 — Gestión postulaciones (admin)
19. Vista de candidatos por oferta
20. Cambio de estados + notas
21. Dashboard con métricas

### Fase 7 — Módulo empresas (rol company)
22. Registro de empresa: página `/auth/register` debe aceptar tipo='company' y pasar `{role:'company'}` en `raw_user_meta_data`
23. Onboarding `/empresa/onboarding` — crear registro en `companies` con NIT y representante legal
24. Panel `/empresa` con estado de aprobación y accesos rápidos
25. CRUD de ofertas en `/empresa/jobs` — flujo draft → pending_review
26. Vista de postulaciones por oferta (sin admin_notes)
27. Admin: `/admin/companies` — aprobar/rechazar empresas + set app_metadata.role en Supabase Auth
28. Admin: badge "Pendiente revisión" en listado de jobs para ofertas de empresas

---

## Comandos útiles

```bash
# Desarrollo local
npm run dev

# Generar tipos TypeScript desde Supabase
npx supabase gen types typescript --project-id TU_PROJECT_ID > lib/types/database.ts

# Aplicar migrations a Supabase
npx supabase db push

# Lint
npm run lint

# Build producción (verificar antes de push)
npm run build
```

---

## Notas importantes

- Las **notas del admin** (`admin_notes` en applications) NUNCA deben ser visibles al candidato ni a la empresa — verificar en RLS y en las queries; nunca incluir `admin_notes` en queries ejecutadas con el JWT de empresa
- El **salario** se maneja en **COP** (pesos colombianos) — formatear siempre con separador de miles
- **Ciudades y departamentos** de Colombia — usar listas locales, no APIs externas
- La oferta con `status = 'draft'` NO aparece en el portal público; `pending_review` tampoco aparece públicamente
- Al expirar una oferta (`expires_at < now()`) cambiar automáticamente a `status = 'closed'` mediante un cron job de Supabase (pg_cron)
- Máximo **1 postulación por candidato por oferta** — enforced en DB con UNIQUE constraint y en UI ocultando el botón si ya se postuló
- **Flujo de aprobación de empresa**: al registrarse, profile.role='company' pero la empresa no puede publicar ofertas hasta que un admin cambie `companies.status` a 'approved'. El admin también debe actualizar `app_metadata.role = 'company'` en Supabase Auth para que el JWT refleje el rol (esto se hace desde el Dashboard de Supabase o vía Admin API)
- **app_metadata.role**: este campo en el JWT es el que usa el middleware. Para que un usuario tenga acceso a `/empresa/*`, su `app_metadata.role` debe ser `'company'`. Esto se setea al crear el usuario vía la API de Supabase Auth Admin o desde el Dashboard
- **Seguridad crítica**: las empresas no pueden cambiar `companies.status` directamente — un trigger en DB lo protege. Las empresas no pueden publicar ofertas con `status='active'` — la RLS solo permite `draft`, `pending_review` y `closed` al actualizar
