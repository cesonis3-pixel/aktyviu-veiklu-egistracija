-- Run in Supabase Dashboard -> SQL Editor.
-- This migration uses the existing public.activities and public.reservations tables.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.reservations'::regclass
      AND c.contype = 'u'
      AND c.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.reservations'::regclass AND attname = 'activity_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.reservations'::regclass AND attname = 'user_id')
      ]::smallint[]
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_activity_id_user_id_key UNIQUE (activity_id, user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.reserve_activity(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  activity_row public.activities%rowtype;
  active_reservations integer;
  reservation_row public.reservations%rowtype;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Prisijungimas būtinas.' USING errcode = 'P0001';
  END IF;

  SELECT * INTO activity_row
  FROM public.activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Veikla nerasta.' USING errcode = 'P0002';
  END IF;
  IF activity_row.status <> 'active' OR activity_row.starts_at <= now() THEN
    RAISE EXCEPTION 'Ši veikla atšaukta.' USING errcode = 'P0003';
  END IF;

  SELECT * INTO reservation_row
  FROM public.reservations
  WHERE activity_id = p_activity_id AND user_id = current_user_id;
  IF reservation_row.status = 'active' THEN
    RAISE EXCEPTION 'Jūs jau turite rezervaciją šiai veiklai.' USING errcode = 'P0004';
  END IF;

  SELECT count(*)::integer INTO active_reservations
  FROM public.reservations
  WHERE activity_id = p_activity_id AND status = 'active';
  IF active_reservations >= activity_row.capacity THEN
    RAISE EXCEPTION 'Vietų nebeliko.' USING errcode = 'P0005';
  END IF;

  IF reservation_row.id IS NULL THEN
    INSERT INTO public.reservations (activity_id, user_id)
    VALUES (p_activity_id, current_user_id);
  ELSE
    UPDATE public.reservations
    SET status = 'active', cancelled_at = NULL, updated_at = now()
    WHERE id = reservation_row.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'available', activity_row.capacity - active_reservations - 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_activity(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_reservation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_reservation(uuid) TO authenticated;

