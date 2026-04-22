-- Verify all existing rows have valid calendar_posts.status values before adding constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM calendar_posts
    WHERE status NOT IN ('draft', 'scheduled', 'posted')
  ) THEN
    RAISE EXCEPTION 'Cannot add constraint: found rows with invalid calendar_posts.status values';
  END IF;
END $$;

-- Add CHECK constraint so only valid calendar post statuses can ever be stored
ALTER TABLE calendar_posts
  ADD CONSTRAINT calendar_posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'posted'));

-- Verify all existing rows have valid calendar_posts.post_type values before adding constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM calendar_posts
    WHERE post_type NOT IN ('carousel', 'single-image', 'story')
  ) THEN
    RAISE EXCEPTION 'Cannot add constraint: found rows with invalid calendar_posts.post_type values';
  END IF;
END $$;

-- Add CHECK constraint so only valid calendar post types can ever be stored
ALTER TABLE calendar_posts
  ADD CONSTRAINT calendar_posts_post_type_check
  CHECK (post_type IN ('carousel', 'single-image', 'story'));

-- Verify all existing rows have valid approval_batches.status values before adding constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM approval_batches
    WHERE status NOT IN ('pending', 'reviewed')
  ) THEN
    RAISE EXCEPTION 'Cannot add constraint: found rows with invalid approval_batches.status values';
  END IF;
END $$;

-- Add CHECK constraint so only valid approval batch statuses can ever be stored
ALTER TABLE approval_batches
  ADD CONSTRAINT approval_batches_status_check
  CHECK (status IN ('pending', 'reviewed'));

-- Verify all existing rows have valid approval_images.status values before adding constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM approval_images
    WHERE status NOT IN ('pending', 'approved', 'rejected')
  ) THEN
    RAISE EXCEPTION 'Cannot add constraint: found rows with invalid approval_images.status values';
  END IF;
END $$;

-- Add CHECK constraint so only valid approval image statuses can ever be stored
ALTER TABLE approval_images
  ADD CONSTRAINT approval_images_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));
