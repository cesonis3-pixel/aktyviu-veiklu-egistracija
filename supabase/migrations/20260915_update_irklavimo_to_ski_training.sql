-- Run in Supabase Dashboard -> SQL Editor.
-- This updates the existing activity only. It does not delete or recreate anything.
-- The activity id, creator_id, starts_at, capacity, status and reservations remain unchanged.

BEGIN;

DO $$
DECLARE
  matching_count integer;
  target_activity_id uuid;
BEGIN
  SELECT count(*)::integer, min(id)
  INTO matching_count, target_activity_id
  FROM public.activities
  WHERE title = 'Irklavimo pamoka'
    AND location = 'Galvės ežeras, Trakai';

  IF matching_count = 0 THEN
    RAISE EXCEPTION 'Nerasta veikla „Irklavimo pamoka“ vietoje „Galvės ežeras, Trakai“. Nieko nepakeista.';
  END IF;

  IF matching_count > 1 THEN
    RAISE EXCEPTION 'Rasti keli veiklos įrašai su tuo pačiu senu pavadinimu ir vieta. Nieko nepakeista.';
  END IF;

  UPDATE public.activities
  SET title = 'Slidinėjimo treniruotė',
      location = 'Snow Arena, Druskininkai',
      description = 'Slidinėjimo treniruotė norintiems patobulinti techniką, saugiau jaustis trasoje ir pasiruošti žiemos kelionėms į kalnus.'
  WHERE id = target_activity_id;
END;
$$;

COMMIT;

-- Optional verification: this should return exactly one updated activity.
SELECT id, creator_id, title, description, location, starts_at, capacity, status
FROM public.activities
WHERE title = 'Slidinėjimo treniruotė'
  AND location = 'Snow Arena, Druskininkai';
