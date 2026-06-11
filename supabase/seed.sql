-- ============================================================
-- Seed: áreas de trabajo + usuario admin inicial
-- ============================================================

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

-- Nota: crear el usuario admin desde el dashboard de Supabase Auth
-- y luego ejecutar:
--
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@getcompany.co';
