-- Verify all existing rows have valid activity_log.post_type values before adding constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM activity_log
    WHERE post_type NOT IN ('carousel', 'single-image', 'story')
  ) THEN
    RAISE EXCEPTION 'Cannot add constraint: found rows with invalid activity_log.post_type values';
  END IF;
END $$;

-- Add CHECK constraint so only valid activity log post types can ever be stored
ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_post_type_check
  CHECK (post_type IN ('carousel', 'single-image', 'story'));
