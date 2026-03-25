-- 10 dummy reports for dashboard / Reports UI / charts.
-- Run in Supabase → SQL Editor.
--
-- Requires: at least one row in auth.users (reports.user_id = auth.users.id).
-- No public.users table needed.
-- Reports use status `pending` so they appear in the admin Reports list (not assigned/cleaned).
--
-- Optional: set user_id manually — replace the subquery in `owner` with e.g. 'YOUR-UUID-HERE'::uuid
--
-- If enum casts fail, align severity/status with your DB enums.

INSERT INTO public.reports (
  user_id,
  image_url,
  latitude,
  longitude,
  address,
  description,
  severity,
  status,
  attention,
  created_at
)
SELECT
  uid,
  v.image_url,
  v.latitude,
  v.longitude,
  v.address,
  v.description,
  v.severity::public.report_severity,
  v.status::public.report_status,
  v.attention,
  v.created_at
FROM (
  SELECT COALESCE(
    (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'citizen' LIMIT 1),
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  ) AS uid
) AS owner
CROSS JOIN (VALUES
  (
    'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800',
    12.9716::double precision,
    77.5946::double precision,
    'MG Road, Bengaluru'::text,
    'Overflowing dustbin near metro exit'::text,
    'medium'::text,
    'pending'::text,
    false::boolean,
    (now() - interval '6 days')::timestamptz
  ),
  (
    'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800',
    12.9352,
    77.6245,
    'Koramangala 5th Block, Bengaluru',
    'Garbage pile on footpath',
    'high',
    'pending',
    true,
    now() - interval '5 days'
  ),
  (
    null,
    12.9279,
    77.5936,
    'Jayanagar 4th Block, Bengaluru',
    'Broken bins — mixed waste on road',
    'low',
    'pending',
    false,
    now() - interval '4 days'
  ),
  (
    'https://images.unsplash.com/photo-1611284446439-ac4d41b5c9dc?w=800',
    13.0358,
    77.5970,
    'Hebbal flyover service road',
    'Construction debris dumped',
    'high',
    'pending',
    false,
    now() - interval '3 days'
  ),
  (
    null,
    12.9463,
    77.6071,
    NULL,
    'Report with coordinates only (no address text)',
    'low',
    'pending',
    false,
    now() - interval '2 days'
  ),
  (
    'https://images.unsplash.com/photo-1558588944-5a1d036dbc02?w=800',
    12.9988,
    77.5921,
    'Indiranagar 100 Feet Road',
    'Uncollected black bags',
    'medium',
    'pending',
    true,
    now() - interval '1 day'
  ),
  (
    null,
    12.9698,
    77.7500,
    'Whitefield Main Road, Bengaluru',
    'Street litter after market hours',
    'low',
    'pending',
    false,
    now() - interval '12 hours'
  ),
  (
    null,
    13.0102,
    77.5555,
    'Sankey Tank walking path',
    'Plastic bottles along lake fence',
    'medium',
    'pending',
    false,
    now() - interval '6 hours'
  ),
  (
    'https://images.unsplash.com/photo-1621451537084-482c61073b2f?w=800',
    12.2958,
    76.6394,
    'Mysuru — Nanjangud Road junction',
    'Demo row outside Bengaluru coords',
    'high',
    'pending',
    false,
    now() - interval '3 hours'
  ),
  (
    null,
    12.9236,
    77.6501,
    NULL,
    'Second coordinate-only site for UI fallback test',
    'low',
    'pending',
    false,
    now() - interval '30 minutes'
  )
) AS v(image_url, latitude, longitude, address, description, severity, status, attention, created_at)
WHERE owner.uid IS NOT NULL;
