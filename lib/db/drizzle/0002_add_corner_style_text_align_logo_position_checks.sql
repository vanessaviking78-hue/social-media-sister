-- Verify all existing rows have valid corner_style values before adding constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM client_presets
    WHERE corner_style NOT IN ('none', 'triangle', 'arc', 'double-line', 'frame')
  ) THEN
    RAISE EXCEPTION 'Cannot add constraint: found rows with invalid corner_style values';
  END IF;
END $$;

-- Add CHECK constraint so only valid corner styles can ever be stored
ALTER TABLE client_presets
  ADD CONSTRAINT client_presets_corner_style_check
  CHECK (corner_style IN ('none', 'triangle', 'arc', 'double-line', 'frame'));

-- Verify all existing rows have valid text_align values before adding constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM client_presets
    WHERE text_align NOT IN ('left', 'center', 'right')
  ) THEN
    RAISE EXCEPTION 'Cannot add constraint: found rows with invalid text_align values';
  END IF;
END $$;

-- Add CHECK constraint so only valid text alignments can ever be stored
ALTER TABLE client_presets
  ADD CONSTRAINT client_presets_text_align_check
  CHECK (text_align IN ('left', 'center', 'right'));

-- Verify all existing rows have valid logo_position values before adding constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM client_presets
    WHERE logo_position NOT IN ('top-right', 'top-left', 'bottom-right', 'bottom-left', 'none')
  ) THEN
    RAISE EXCEPTION 'Cannot add constraint: found rows with invalid logo_position values';
  END IF;
END $$;

-- Add CHECK constraint so only valid logo positions can ever be stored
ALTER TABLE client_presets
  ADD CONSTRAINT client_presets_logo_position_check
  CHECK (logo_position IN ('top-right', 'top-left', 'bottom-right', 'bottom-left', 'none'));
