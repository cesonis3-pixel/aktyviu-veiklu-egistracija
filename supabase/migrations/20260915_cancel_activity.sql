-- Run in Supabase Dashboard -> SQL Editor.
-- Changes only public.activities.status; activities and reservations are retained.

CREATE OR REPLACE FUNCTION public.cancel_activity(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  activity_row public.activities%rowtype;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Prisijunkite prie paskyros.' USING errcode = 'P0001';
  END IF;

  SELECT * INTO activity_row
  FROM public.activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Veikla nerasta.' USING errcode = 'P0002';
  END IF;
  IF activity_row.creator_id <> current_user_id THEN
    RAISE EXCEPTION 'Neturite teisės atšaukti šios veiklos.' USING errcode = 'P0008';
  END IF;
  IF activity_row.status = 'cancelled' THEN
    RAISE EXCEPTION 'Ši veikla jau atšaukta.' USING errcode = 'P0009';
  END IF;

  UPDATE public.activities
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_activity_id
    AND creator_id = current_user_id
    AND status = 'active';

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_activity(uuid) TO authenticated;
