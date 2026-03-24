-- Worker queue: jobs appear after admin clicks "Start" (status = in_progress).
DO $$
BEGIN
  ALTER TYPE public.bin_request_status ADD VALUE 'in_progress';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
