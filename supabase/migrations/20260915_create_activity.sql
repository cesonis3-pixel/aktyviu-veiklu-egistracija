-- Run in Supabase Dashboard -> SQL Editor.
-- creator_id is always taken from auth.uid(); it is never accepted from the browser.

CREATE OR REPLACE FUNCTION public.create_activity(
  p_title text,
  p_description text,
  p_location text,
  p_starts_at timestamptz,
  p_capacity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  activity_id uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Prisijunkite prie paskyros.' USING errcode = 'P0001';
  END IF;
  IF btrim(coalesce(p_title, '')) = '' OR btrim(coalesce(p_location, '')) = '' THEN
    RAISE EXCEPTION 'Pavadinimas ir vieta yra privalomi.' USING errcode = 'P0010';
  END IF;
  IF p_starts_at <= now() THEN
    RAISE EXCEPTION 'Veiklos data ir laikas turi būti ateityje.' USING errcode = 'P0011';
  END IF;
  IF p_capacity IS NULL OR p_capacity < 1 THEN
    RAISE EXCEPTION 'Vietų skaičius turi būti teigiamas.' USING errcode = 'P0012';
  END IF;

  INSERT INTO public.activities (creator_id, title, description, location, starts_at, capacity, status)
  VALUES (
    current_user_id,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    btrim(p_location),
    p_starts_at,
    p_capacity,
    'active'
  )
  RETURNING id INTO activity_id;

  RETURN jsonb_build_object('success', true, 'id', activity_id, 'status', 'active');
END;
$$;

REVOKE ALL ON FUNCTION public.create_activity(text, text, text, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_activity(text, text, text, timestamptz, integer) TO authenticated;
