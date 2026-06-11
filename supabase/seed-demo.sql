-- ============================================================
-- Seed de DEMO — Áreas + 6 ofertas de muestra
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- 1. Áreas de trabajo (idempotente — no falla si ya existen)
INSERT INTO public.job_areas (name, icon, slug) VALUES
  ('Ventas',              'TrendingUp',  'ventas'),
  ('Logística',           'Truck',       'logistica'),
  ('Manufactura',         'Factory',     'manufactura'),
  ('Administrativo',      'Briefcase',   'administrativo'),
  ('Tecnología',          'Monitor',     'tecnologia'),
  ('Servicio al cliente', 'Headphones',  'servicio-cliente'),
  ('Finanzas',            'DollarSign',  'finanzas'),
  ('Recursos humanos',    'Users',       'recursos-humanos'),
  ('Operaciones',         'Settings',    'operaciones'),
  ('Marketing',           'Megaphone',   'marketing')
ON CONFLICT (slug) DO NOTHING;

-- 2. Ofertas de muestra
-- Nota: created_by es NULL porque aún no hay usuario admin creado.
-- Después de crear tu usuario admin, puedes actualizar:
--   UPDATE public.jobs SET created_by = '<tu-uuid>' WHERE created_by IS NULL;

INSERT INTO public.jobs
  (title, slug, description, requirements, benefits, area_id, modality, contract_type,
   salary_min, salary_max, salary_visible, city, department, vacancies,
   status, featured, expires_at, published_at, created_at, updated_at)
VALUES

-- Oferta 1: Ventas
(
  'Asesor Comercial Externo',
  'asesor-comercial-externo',
  E'**Descripción del cargo**\n\nBuscamos un Asesor Comercial Externo con experiencia en ventas de campo, capaz de gestionar su propio portafolio de clientes y cumplir metas mensuales de ventas.\n\n**Responsabilidades principales**\n\n- Prospección y captación de nuevos clientes en zona asignada\n- Seguimiento a clientes activos para fidelización\n- Cumplimiento de presupuesto mensual de ventas\n- Reporte diario de actividades en CRM',
  E'- Mínimo 2 años de experiencia en ventas externas\n- Bachiller o técnico en áreas comerciales\n- Vehículo propio (indispensable)\n- Habilidades de negociación y cierre de ventas',
  E'- Salario base + comisiones sin techo\n- Auxilio de rodamiento\n- Seguro de vida\n- Capacitaciones constantes',
  (SELECT id FROM public.job_areas WHERE slug = 'ventas'),
  'presencial', 'tiempo_completo',
  1500000, 4000000, true,
  'Medellín', 'Antioquia', 3,
  'active', true,
  '2026-09-30T00:00:00Z', now(), now(), now()
),

-- Oferta 2: Logística
(
  'Auxiliar de Bodega',
  'auxiliar-de-bodega',
  E'**Descripción del cargo**\n\nRequerimos Auxiliar de Bodega para empresa del sector retail, encargado de recepción, almacenamiento y despacho de mercancía.\n\n**Responsabilidades principales**\n\n- Recepción y verificación de mercancía\n- Organización y control de inventarios\n- Alistamiento de pedidos\n- Manejo de montacargas (deseable)',
  E'- Bachiller académico\n- Experiencia mínima de 1 año en cargos similares\n- Manejo de sistemas de inventario\n- Disponibilidad para turnos rotativos',
  E'- Salario básico + auxilio de transporte legal\n- Horas extra remuneradas\n- Afiliación a seguridad social\n- Estabilidad laboral',
  (SELECT id FROM public.job_areas WHERE slug = 'logistica'),
  'presencial', 'temporal',
  1300000, 1600000, true,
  'Bogotá', 'Cundinamarca', 5,
  'active', false,
  '2026-09-15T00:00:00Z', now(), now(), now()
),

-- Oferta 3: Tecnología (destacada)
(
  'Desarrollador Frontend React',
  'desarrollador-frontend-react',
  E'**Descripción del cargo**\n\nBuscamos Desarrollador Frontend con experiencia en React y TypeScript para unirse a nuestro equipo de tecnología en modalidad híbrida.\n\n**Responsabilidades principales**\n\n- Desarrollo de interfaces de usuario con React y Next.js\n- Integración con APIs REST y GraphQL\n- Colaboración con el equipo de diseño UX/UI\n- Code reviews y documentación técnica',
  E'- Profesional o estudiante avanzado en Ingeniería de Sistemas o afines\n- Mínimo 2 años con React.js\n- Conocimiento de TypeScript, Tailwind CSS\n- Inglés técnico (deseable)',
  E'- Trabajo híbrido (3 días en casa)\n- Bono de conectividad\n- Plan carrera\n- Capacitaciones en tecnología',
  (SELECT id FROM public.job_areas WHERE slug = 'tecnologia'),
  'hibrido', 'tiempo_completo',
  3500000, 6000000, true,
  'Medellín', 'Antioquia', 2,
  'active', true,
  '2026-10-01T00:00:00Z', now(), now(), now()
),

-- Oferta 4: Administrativo
(
  'Recepcionista / Auxiliar Administrativo',
  'recepcionista-auxiliar-administrativo',
  E'**Descripción del cargo**\n\nEmpresa del sector servicios requiere Recepcionista con buena presentación personal, habilidades comunicativas y manejo de herramientas ofimáticas.\n\n**Responsabilidades principales**\n\n- Atención al cliente presencial y telefónica\n- Manejo de agenda y correspondencia\n- Apoyo a procesos administrativos generales\n- Control de visitantes',
  E'- Técnico o tecnólogo en administración o afines\n- Experiencia mínima de 1 año\n- Manejo de Word, Excel\n- Excelente presentación personal',
  E'- Contrato directo con la empresa\n- Horario de oficina (lunes a viernes)\n- Beneficios de ley',
  (SELECT id FROM public.job_areas WHERE slug = 'administrativo'),
  'presencial', 'tiempo_completo',
  1300000, 1800000, true,
  'Cali', 'Valle del Cauca', 1,
  'active', false,
  '2026-09-01T00:00:00Z', now(), now(), now()
),

-- Oferta 5: Servicio al cliente
(
  'Coordinador de Servicio al Cliente',
  'coordinador-servicio-al-cliente',
  E'**Descripción del cargo**\n\nBuscamos Coordinador de Servicio al Cliente para liderar un equipo de 8 asesores en call center de empresa de telecomunicaciones.\n\n**Responsabilidades principales**\n\n- Supervisión y coaching de equipo de asesores\n- Análisis de indicadores de calidad (NPS, FCR, AHT)\n- Gestión de escalados y clientes VIP\n- Reportes de gestión a gerencia',
  E'- Profesional en administración, ingeniería industrial o afines\n- Mínimo 2 años en roles de liderazgo en contact center\n- Manejo avanzado de Excel\n- Capacidad analítica y liderazgo',
  E'- Salario competitivo + bono por cumplimiento\n- Trabajo híbrido\n- Seguro médico complementario\n- Días adicionales de vacaciones',
  (SELECT id FROM public.job_areas WHERE slug = 'servicio-cliente'),
  'hibrido', 'tiempo_completo',
  2500000, 3500000, true,
  'Bogotá', 'Cundinamarca', 1,
  'active', false,
  '2026-09-20T00:00:00Z', now(), now(), now()
),

-- Oferta 6: Recursos humanos
(
  'Analista de Recursos Humanos',
  'analista-recursos-humanos',
  E'**Descripción del cargo**\n\nRequerimos Analista de Recursos Humanos para apoyar los procesos de selección, contratación y bienestar laboral de nuestra organización.\n\n**Responsabilidades principales**\n\n- Publicación de vacantes y reclutamiento\n- Entrevistas y aplicación de pruebas psicotécnicas\n- Elaboración de contratos y afiliaciones\n- Apoyo en actividades de bienestar y clima organizacional',
  E'- Profesional en Psicología, Administración o afines\n- Experiencia mínima 1 año en selección de personal\n- Conocimiento en legislación laboral colombiana\n- Habilidades de comunicación e interpersonales',
  E'- Contrato indefinido desde el inicio\n- Plan de carrera\n- Beneficios adicionales de ley\n- Ambiente de trabajo dinámico',
  (SELECT id FROM public.job_areas WHERE slug = 'recursos-humanos'),
  'presencial', 'tiempo_completo',
  2000000, 2800000, true,
  'Medellín', 'Antioquia', 1,
  'active', false,
  '2026-09-25T00:00:00Z', now(), now(), now()
)

ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Verificar resultado
-- ============================================================
SELECT
  j.title,
  j.city,
  j.status,
  j.featured,
  a.name AS area
FROM public.jobs j
JOIN public.job_areas a ON a.id = j.area_id
ORDER BY j.created_at;
