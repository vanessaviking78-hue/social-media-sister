-- Verify all existing rows have valid text_position values before adding constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM client_presets
    WHERE text_position NOT IN ('top', 'center', 'bottom')
  ) THEN
    RAISE EXCEPTION 'Cannot add constraint: found rows with invalid text_position values';
  END IF;
END $$;

-- Add CHECK constraint so only valid text positions can ever be stored
ALTER TABLE client_presets
  ADD CONSTRAINT client_presets_text_position_check
  CHECK (text_position IN ('top', 'center', 'bottom'));
